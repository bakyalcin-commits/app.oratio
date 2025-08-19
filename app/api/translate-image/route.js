// app/api/translate-image/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// HTML decode
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

// Vision textAnnotations -> satır benzeri kutular
function extractLineItems(visionJson) {
  const res = [];
  const anns = visionJson?.responses?.[0]?.textAnnotations || [];
  if (anns.length <= 1) return res;
  for (let i = 1; i < anns.length; i++) {
    const a = anns[i];
    const desc = (a.description || "").trim();
    const verts = a.boundingPoly?.vertices || [];
    const xs = verts.map((v) => v.x || 0);
    const ys = verts.map((v) => v.y || 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    res.push({ text: desc, x: minX, y: minY, w, h });
  }
  return res;
}

// Çeviri helper (batch)
async function translateArray(strings, target, source, apiKey) {
  const out = [];
  const batchSize = 100;
  for (let i = 0; i < strings.length; i += batchSize) {
    const batch = strings.slice(i, i + batchSize);
    const body = { q: batch, target, format: "text" };
    if (source && source.toLowerCase() !== target.toLowerCase()) {
      body.source = source.toLowerCase();
    }
    const resp = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await resp.json();
    if (!resp.ok || data.error) {
      throw new Error(data.error?.message || "Translate failed");
    }
    const arr = (data.data?.translations || []).map((t) =>
      decodeHtml(t.translatedText || "")
    );
    out.push(...arr);
  }
  return out;
}

export async function POST(req) {
  try {
    // >>> webpack'i kandır: binary paketi runtime'da yükle
    // eslint-disable-next-line no-eval
    const { createCanvas, loadImage } = eval("require")("@napi-rs/canvas");

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GOOGLE_API_KEY" },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    const targetLang = (form.get("targetLang") || "en").toString();

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    // Görseli oku
    const buf = Buffer.from(await file.arrayBuffer());
    const img = await loadImage(buf);
    const width = img.width;
    const height = img.height;

    // OCR
    const base64 = buf.toString("base64");
    const visRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            { image: { content: base64 }, features: [{ type: "TEXT_DETECTION" }] },
          ],
        }),
      }
    );
    const visJson = await visRes.json();
    if (!visRes.ok || visJson.error) {
      const msg = visJson.error?.message || "Vision OCR failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const lineItems = extractLineItems(visJson);
    if (!lineItems.length) {
      // metin yoksa orijinali döndür
      return new NextResponse(buf, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }

    const detectedLang =
      visJson?.responses?.[0]?.textAnnotations?.[0]?.locale || null;

    // Çeviri
    const texts = lineItems.map((l) => l.text);
    const translated = await translateArray(
      texts,
      targetLang,
      detectedLang,
      apiKey
    );

    // Canvas üzerine yaz
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "transparent";
    ctx.textBaseline = "middle";

    for (let i = 0; i < lineItems.length; i++) {
      const it = lineItems[i];
      const txt = translated[i] || "";

      // arka planı sil
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(it.x, it.y, it.w, it.h);

      // yazı
      ctx.fillStyle = "#111111";
      let fontSize = Math.max(8, Math.floor(it.h * 0.8));
      const family = "sans-serif";
      while (fontSize > 7) {
        ctx.font = `${fontSize}px ${family}`;
        const m = ctx.measureText(txt);
        if (m.width <= it.w) break;
        fontSize -= 1;
      }
      const textX = it.x + it.w / 2;
      const textY = it.y + it.h / 2;
      ctx.textAlign = "center";
      ctx.fillText(txt, textX, textY);
    }

    const out = canvas.toBuffer("image/png");
    return new NextResponse(out, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

