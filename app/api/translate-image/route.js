export const runtime = "nodejs";

import { NextResponse } from "next/server";

/**
 * İstek gövdesi (JSON):
 * {
 *   imageBase64: "data:image/png;base64,...."  // veya jpg
 *   translatedText: "Çevrilmiş metin burada..."
 * }
 */
export async function POST(req) {
  try {
    const { imageBase64, translatedText } = await req.json();

    if (!imageBase64 || !translatedText) {
      return NextResponse.json(
        { error: "imageBase64 ve translatedText zorunludur." },
        { status: 400 }
      );
    }

    // Jimp ESM olduğu için dinamik import
    const { default: Jimp } = await import("jimp");

    // Base64’ü buffer’a çevir
    const base64 = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;
    const imgBuf = Buffer.from(base64, "base64");

    // Görseli aç
    const image = await Jimp.read(imgBuf);
    const { width: W, height: H } = image.bitmap;

    // ----- FONT SEÇİMİ -----
    // Jimp’in gömülü font sabitleri (dosya yolu yok!)
    const fontEntries = [
      { key: Jimp.FONT_SANS_32_BLACK, lineH: 36 },
      { key: Jimp.FONT_SANS_16_BLACK, lineH: 20 },
      { key: Jimp.FONT_SANS_8_BLACK, lineH: 12 },
    ];

    // Metni sığdırmak için önce 32, olmazsa 16, sonra 8 dene
    let chosen = null;
    for (const f of fontEntries) {
      const fnt = await Jimp.loadFont(f.key);
      // kabaca 0.9W genişliğe sığacak max satır genişliği
      const maxWidth = Math.floor(W * 0.9);
      // tek satır genişliği ölçümü için en uzun satırı baz almak mantıklı
      const lines = translatedText.split(/\r?\n/);
      const longest = lines.reduce((a, b) => (a.length > b.length ? a : b), "");
      const m = Jimp.measureText(fnt, longest);
      if (m <= maxWidth) {
        chosen = { font: fnt, lineH: f.lineH };
        break;
      }
      // sığmadıysa bir sonrakine geç
    }
    // hiçbiri olmadıysa en küçük font
    if (!chosen) {
      const fnt = await Jimp.loadFont(Jimp.FONT_SANS_8_BLACK);
      chosen = { font: fnt, lineH: 12 };
    }

    // ----- METİN KUTUSU / ARKAPLAN -----
    // Kenarlardan boşluk
    const PAD_X = Math.floor(W * 0.05); // %5
    const PAD_Y = Math.floor(H * 0.05); // %5
    const BOX_W = W - PAD_X * 2;

    // Metni satırlara böl (kelime kırma)
    const softWrap = (text, font, maxWidth) => {
      const words = text.replace(/\r/g, "").split(/\n| /);
      const rows = [];
      let row = "";

      for (const w of words) {
        const tentative = row ? row + (w === "\n" ? "" : " " + w) : w;
        const meas = Jimp.measureText(font, tentative);
        if (w === "\n") {
          rows.push(row);
          row = "";
          continue;
        }
        if (meas <= maxWidth) {
          row = tentative;
        } else {
          if (row) rows.push(row);
          row = w; // yeni satıra başla
        }
      }
      if (row) rows.push(row);
      return rows;
    };

    const rows = [];
    translatedText.split(/\r?\n/).forEach((paragraph, idx) => {
      const r = softWrap(paragraph, chosen.font, BOX_W);
      rows.push(...r);
      if (idx !== translatedText.split(/\r?\n/).length - 1) rows.push(""); // boş satır
    });

    const textHeight = rows.length * chosen.lineH;
    const BOX_H = textHeight + PAD_Y * 2;

    // Yarı saydam arka plan kutusu
    const overlay = new Jimp(W, BOX_H, 0x00000080); // siyah %50
    image.composite(overlay, 0, H - BOX_H); // altta

    // ----- METNİ YAZ -----
    const startY = H - BOX_H + PAD_Y;
    let y = startY;
    for (const line of rows) {
      image.print(chosen.font, PAD_X, y, line, BOX_W);
      y += chosen.lineH;
    }

    // PNG buffer
    const out = await image.getBufferAsync(Jimp.MIME_PNG);
    return new NextResponse(out, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'attachment; filename="oratio-overlay.png"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Overlay generation failed",
        message: String(err && err.message ? err.message : err),
      },
      { status: 500 }
    );
    // not: hata popup'ında görünecek
  }
}




