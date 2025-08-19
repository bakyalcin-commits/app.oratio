import { NextResponse } from "next/server";
import { v2 as vision } from "@google-cloud/vision";

export const runtime = "nodejs";

// Google Vision client (OCR)
const client = new vision.ImageAnnotatorClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
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

    const bytes = Buffer.from(await file.arrayBuffer());

    // OCR with Vision API
    const [result] = await client.textDetection(bytes);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      return NextResponse.json({ error: "No text detected" }, { status: 400 });
    }

    const sourceText = detections[0].description;

    // Translate OCR text using Google Translate
    const translateRes = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: sourceText,
          target: targetLang,
        }),
      }
    );

    const translateData = await translateRes.json();

    const translatedText =
      translateData.data?.translations?.[0]?.translatedText || "";

    return NextResponse.json({
      sourceText,
      translatedText,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

