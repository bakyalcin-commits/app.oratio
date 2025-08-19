// app/api/translate-file/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// basit chunker: 4500 civarı karakterde kır
function chunkText(str, max = 4500) {
  if (!str) return [];
  const out = [];
  let i = 0;
  while (i < str.length) {
    let end = Math.min(i + max, str.length);
    // kelime ortasında kesmeyelim
    if (end < str.length) {
      const j = str.lastIndexOf("\n", end);
      const k = str.lastIndexOf(" ", end);
      const cut = Math.max(j, k);
      if (cut > i + 1500) end = cut; // çok geri kaçmasın
    }
    out.push(str.slice(i, end));
    i = end;
  }
  return out;
}

// html entity decode (v2 translatedText HTML-safe geliyor)
function decodeHtml(html) {
  if (!html) return "";
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x2F;/g, "/");
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const targetLang = (formData.get("targetLang") || "en").toString();

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
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

    // 1) OCR
    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [{ type: "TEXT_DETECTION" }],
            },
          ],
        }),
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

    const detectedLang =
      resp.textAnnotations?.[0]?.locale ||
      resp.fullTextAnnotation?.pages?.[0]?.property?.detectedLanguages?.[0]?.languageCode ||
      "";

    if (!sourceText.trim()) {
      return NextResponse.json({ error: "No text detected" }, { status: 400 });
    }

    // 2) Translate (chunk + array)
    const chunks = chunkText(sourceText, 4500);
    const body = {
      q: chunks,
      target: targetLang,
      format: "text",
    };
    if (detectedLang && detectedLang.toLowerCase() !== targetLang.toLowerCase()) {
      body.source = detectedLang.toLowerCase();
    }

    const trRes = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const trData = await trRes.json();
    if (!trRes.ok || trData.error) {
      const msg = trData.error?.message || "Translate failed";
      return NextResponse.json({ error: msg }, { status: trRes.status || 400 });
    }

    const parts = (trData.data?.translations || []).map((t) =>
      decodeHtml(t.translatedText || "")
    );
    const translatedText = parts.join("\n");

    return NextResponse.json({
      sourceText,
      translatedText,
      detectedLang: detectedLang || null,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}





