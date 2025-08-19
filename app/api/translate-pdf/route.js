import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Basit PDF tip tespiti:
 * - Text-PDF’lerde genelde "BT"/"ET" (Begin/End Text) ve "/Font" gibi işaretler olur.
 * - Scan-PDF’lerde bu izler yoktur; içerik raster image olarak gömülüdür.
 * Bu hızlı heuristik %100 değil ama pratikte iş görür; ileride pdf-parse gibi
 * bir lib ile güçlendiririz.
 */

function sniffPdfType(buf) {
  // Güvenli tarafta kalmak için ilk ~1.5MB içinde ara.
  const MAX_SCAN = Math.min(buf.length, 1_500_000);
  const slice = buf.subarray(0, MAX_SCAN);

  // ASCII stringe dönmeden önce kabaca bakış
  const text = Buffer.from(slice).toString("latin1");

  const hasBT = /[^A-Za-z]BT[^A-Za-z]/.test(text);    // Begin Text
  const hasET = /[^A-Za-z]ET[^A-Za-z]/.test(text);    // End Text
  const hasFont = /\/Font[^A-Za-z]/.test(text);
  const hasXObjectImage = /\/Subtype\s*\/Image/.test(text); // gömülü resim
  const hasContentStreams = /\/Contents\s*\d+\s*0\s*R/.test(text);

  // Basit karar ağacı
  if ((hasBT && hasET && hasFont) || (hasBT && hasContentStreams)) {
    return { type: "text-pdf", signals: { hasBT, hasET, hasFont, hasContentStreams, hasXObjectImage } };
  }

  // Çok resim izi varsa ve BT/ET zayıfsa scan olma ihtimali yüksek
  if (hasXObjectImage && !hasBT) {
    return { type: "scan-pdf", signals: { hasBT, hasET, hasFont, hasContentStreams, hasXObjectImage } };
  }

  // Belirsiz durumda muhafazakar davranıp scan varsay
  return { type: "scan-pdf", signals: { hasBT, hasET, hasFont, hasContentStreams, hasXObjectImage } };
}

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const targetLang = form.get("targetLang") || "en";

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const sniff = sniffPdfType(buf);

    // Şimdilik sadece tespit ve yönlendirme bilgisi döndürüyoruz.
    // Sonraki adımda:
    //  - text-pdf: v3 Document Translation ile format korumalı çeviri
    //  - scan-pdf: sayfaları PNG'e çevir + OCR + Translate + yeniden PDF
    return NextResponse.json({
      detected: sniff.type,
      targetLang,
      // küçük debug bilgisi; prod’da kaldırabiliriz
      signals: sniff.signals,
      // Basit sayfa tahmini (çok kaba, stream sayısına bakar)
      hintPagesEstimate: (buf.toString("latin1").match(/\/Type\s*\/Page/g) || []).length || null
    });
  } catch (err) {
    return NextResponse.json({ error: "Server error: " + err.message }, { status: 500 });
  }
}
