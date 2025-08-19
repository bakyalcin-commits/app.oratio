// app/api/overlay/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // Vercel'de edge değil, Node çalışsın

function wrapLines(text, maxChars) {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length <= maxChars) {
      line = (line ? line + " " : "") + w;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function POST(req) {
  try {
    const body = await req.json();

    // Beklenen payload:
    // {
    //   imageBase64: "data:image/png;base64,...."  veya sadece "...." base64,
    //   boxes: [{ x, y, w, h, text }], // OCR'den gelen kutuların translated text ile hali
    //   width, height, // orijinal görüntünün boyutu
    //   fontPx: 22,    // opsiyonel
    //   lineWrap: 28   // opsiyonel: satır başına max karakter
    // }

    const { imageBase64, boxes = [], width, height, fontPx = 22, lineWrap = 28 } = body || {};
    if (!imageBase64 || !width || !height) {
      return NextResponse.json({ error: "Missing image or dimensions" }, { status: 400 });
    }

    // Jimp'i dinamik import et: ESM/CJS çakışmasından kaçınma
    const Jimp = (await import("jimp")).default || (await import("jimp"));

    // Base64 temizliği
    const cleaned = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const imgBuffer = Buffer.from(cleaned, "base64");

    // Orijinali yükle
    const image = await Jimp.read(imgBuffer);

    // Yarı saydam overlay yapmak istersen, şeffaf katman üstüne de yazabiliriz.
    // Ben direkt orijinalin üstüne yazıyorum. Shadow yoksa okunabilirlik için zemin dolduruyorum.
    const fontMap = {
      16: Jimp.FONT_SANS_16_BLACK,
      22: Jimp.FONT_SANS_32_BLACK,
      28: Jimp.FONT_SANS_32_BLACK,
      32: Jimp.FONT_SANS_32_BLACK,
    };
    const fontKey = fontMap[fontPx] || Jimp.FONT_SANS_32_BLACK;
    const font = await Jimp.loadFont(fontKey);

    // Her kutuya önce yarı şeffaf beyaz dolgu, sonra siyah metin
    // Okunabilirlik için.
    const PAD = 6;

    for (const b of boxes) {
      const x = Math.max(0, Math.round(b.x) - PAD);
      const y = Math.max(0, Math.round(b.y) - PAD);
      const w = Math.max(1, Math.round(b.w) + PAD * 2);
      const h = Math.max(1, Math.round(b.h) + PAD * 2);
      const txt = (b.text ?? "").toString().trim();

      // Arka plan: beyaz 220/255 opaklık
      const overlayRect = new Jimp(w, h, 0xFFFFFFDC); // DC ~ 220 alfa
      image.composite(overlayRect, x, y);

      // Satır kaydırma
      const lines = wrapLines(txt, Math.max(6, lineWrap));
      let cursorY = y + PAD;
      for (const line of lines) {
        await image.print(font, x + PAD, cursorY, line, w - PAD * 2);
        cursorY += fontPx + 6;
        if (cursorY > y + h - PAD) break; // taşma olursa kes; ileride auto-expand yapılır
      }
    }

    // Boyut güvenliği
    if (image.bitmap.width !== width || image.bitmap.height !== height) {
      image.resize(width, height);
    }

    const outBuffer = await image.getBufferAsync(Jimp.MIME_PNG);

    return new Response(outBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'attachment; filename="translated-overlay.png"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Overlay generation failed:", err);
    return NextResponse.json({ error: "Overlay generation failed" }, { status: 500 });
  }
}
