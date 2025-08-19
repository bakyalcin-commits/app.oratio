// app/api/translate-file/route.js
import { NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";

export const runtime = "nodejs";

// Vision OCR client (Service Account gerekir)
const client = new ImageAnnotatorClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  projectId: process.env.GOOGLE_PROJECT_ID,
});

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const targetLang = formData.get("targetLang") || "en";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Desteklenen tipler: image/png, image/jpeg (PDF bu endpoint’te değil)
    if (
      file.type !== "image/png" &&
      file.type !== "image/jpeg" &&
      file.type !== "image/jpg"
    ) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // OCR
    const [result] = await client.textDetection(bytes);
    const detections = result?.textAnnotations || [];
    if (detections.length === 0) {
      return NextResponse.json({ error: "No text detected" }, { status: 400 });
    }
    const sourceText = detections[0].description;

    // Translate (v2)
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GOOGLE_API_KEY" },
        { status: 500 }
      );
    }

    const tRes = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: sourceText,
          target: targetLang,
          format: "text",
        }),
      }
    );

    const tData = await tRes.json();
    if (!tRes.ok || tData.error) {
      const msg = tData.error?.message || "Translate failed";
      return NextResponse.json({ error: msg }, { status: tRes.status || 400 });
    }

    const translatedText =
      tData.data?.translations?.[0]?.translatedText || "";

    return NextResponse.json({
      sourceText,
      translatedText,
    });
  } catch (err) {
    // Bu kısımda Vision client init hataları da yakalanır
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

