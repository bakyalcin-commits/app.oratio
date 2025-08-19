// src/app/api/overlay/route.js
import { NextResponse } from "next/server";
import Jimp from "jimp";

export const runtime = "nodejs"; // Jimp için şart

// Basit satır kaydırma
function wrapLines(text, maxChars) {
  if (!text) return [""];
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const cand = line ? line + " " + w : w;
    if (cand.length <= maxChars) line = cand;
    else { if (line) lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

// Sağlık kontrolü: tarayıcıda /api/overlay açınca 200 döner
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/overlay", method: "GET" }, { status: 200 });
}

// Preflight için
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

export async function POST(req) {
  const t0 = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const {
      imageBase64,
      boxes = [],            // [{ x, y, w, h, text }]
      width,
      height,
      fontPx = 22,
      lineWrap = 30
    } = body || {};

    if (!imageBase64 || !Number.isFinite(width) || !Number.isFinite(height)) {
      return NextResponse.json(
        { error: "Invalid payload: image or dimensions missing" },
        { status: 400 }
      );
    }

    // >>> KRİTİK FIX: data URL prefix'ini temizle (Jimp saf base64 bekler)
    const cleaned = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imgBuffer = Buffer.from(cleaned, "base64");

    // PNG/JPG'i yükle
    const image = await Jimp.read(imgBuffer);

    // Font
    const fontMap = {
      16: Jimp.FONT_SANS_16_BLACK,
      22: Jimp.FONT_SANS_32_BLACK,
      28: Jimp.FONT_SANS_32_BLACK,
      32: Jimp.FONT_SANS_32_BLACK,
      36: Jimp.FONT_SANS_64_BLACK
    };
    const fontKey = fontMap[fontPx] || Jimp.FONT_SANS_32_BLACK;
    const font = await Jimp.loadFont(fontKey);

    const PAD = 6;

    for (const b of boxes) {
      const bx = Number.isFinite(b?.x) ? Math.round(b.x) : 0;
      const by = Number.isFinite(b?.y) ? Math.round(b.y) : 0;
      const bw = Number.isFinite(b?.w) ? Math.round(b.w) : 1;
      const bh = Number.isFinite(b?.h) ? Math.round(b.h) : 1;
      const txt = (b?.text ?? "").toString().trim();

      const x = Math.max(0, bx - PAD);
      const y = Math.max(0, by - PAD);
      const w = Math.max(1, bw + PAD * 2);
      const h = Math.max(1, bh + PAD * 2);

      // Okunabilirlik için hafif beyaz zemin
      const rect = new Jimp(w, h, 0xFFFFFFCC);
      image.composite(rect, x, y);

      // Satır kaydır, yaz
      const lines = wrapLines(txt, Math.max(6, lineWrap));
      let cy = y + PAD;
      for (const line of lines) {
        await image.print(font, x + PAD, cy, line, w - PAD * 2);
        cy += fontPx + 6;
        if (cy > y + h - PAD) break;
      }
    }

    // Boyut sabitle
    if (image.bitmap.width !== width || image.bitmap.height !== height) {
      image.resize(width, height);
    }

    const outBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
    return new Response(outBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'attachment; filename="translated-overlay.png"',
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    console.error("[overlay] FAILED:", err?.stack || err?.message || err);
    return NextResponse.json(
      { error: "Overlay generation failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  } finally {
    console.log("[overlay] done in", Date.now() - t0, "ms");
  }
}

