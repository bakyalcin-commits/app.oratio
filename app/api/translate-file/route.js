// app/api/translate-file/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const targetLang = formData.get("targetLang") || "en";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Şimdilik PNG/JPG destekliyoruz (PDF ayrı endpoint olacak)
    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GOOGLE_API_KEY" },
        { status: 500 }
      );
    }

    // Dosyayı base64'e çevir
    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");

    // 1) Google Vision REST API ile OCR
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [{ type: "TEXT_DETECTION" }]
            }
          ]
        })
      }
    );

    const visionData = await visionRes.json();

    if (!visionRes.ok || visionData.error) {
      const msg = visionData.error?.message || "Vision OCR failed";
      return NextResponse.json({ error: msg }, { status: visionRes.status || 400 });
    }

    const resp = visionData.responses?.[0] || {};
    const sourceText =
      resp.fullTextAnnotation?.text ||
      resp.textAnnotations?.[0]?.description ||
      "";

    if (!sourceText.trim()) {
      return NextResponse.json({ error: "No text detected" }, { status: 400 });
    }

    // 2) Google Translate v2 ile çeviri
    const translateRes = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: sourceText, target: targetLang, format: "text" })
      }
    );

    const translateData = await translateRes.json();

    if (!translateRes.ok || translateData.error) {
      const msg = translateData.error?.message || "Translate failed";
      return NextResponse.json({ error: msg }, { status: translateRes.status || 400 });
    }

    const translatedText =
      translateData.data?.translations?.[0]?.translatedText || "";

    return NextResponse.json({ sourceText, translatedText });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}



