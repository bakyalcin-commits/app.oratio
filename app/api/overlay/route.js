// app/api/overlay/route.js
import { NextResponse } from "next/server";
import Jimp from "jimp";

export async function POST(req) {
  try {
    const body = await req.json();
    const { imageBase64, boxes, width, height, fontPx = 22, lineWrap = 30 } = body;

    if (!imageBase64 || !boxes || !Array.isArray(boxes)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Base64 -> Buffer
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Jimp ile resmi yükle
    const image = await Jimp.read(buffer);

    // Font yükle (Jimp default)
    const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);

    // Kutulara çevirilmiş text yaz
    boxes.forEach(({ x, y, text }) => {
      if (!text) return;
      image.print(font, x, y, text, width);
    });

    const outBuffer = await image.getBufferAsync(Jimp.MIME_PNG);

    return new Response(outBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": "attachment; filename=translated-overlay.png",
      },
    });
  } catch (err) {
    console.error("Overlay API error:", err);
    return NextResponse.json({ error: "Overlay generation failed" }, { status: 500 });
  }
}



