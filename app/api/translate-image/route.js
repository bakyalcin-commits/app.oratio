// app/api/translate-image/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/* ------------------------ dynamic Jimp loader ------------------------ */
let __Jimp = null;
async function getJimp() {
  if (!__Jimp) {
    const mod = await import("jimp");
    __Jimp = mod.default || mod;
  }
  return __Jimp;
}

/* ------------------------ helpers ------------------------ */

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

// Vision textAnnotations -> word-level boxes
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

// Translate v2 batch
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

function getFontTable(Jimp) {
  return [
    { key: "FONT_SANS_8_BLACK", h: 10 },
    { key: "FONT_SANS_12_BLACK", h: 14 },
    { key: "FONT_SANS_16_BLACK", h: 18 },
    { key: "FONT_SANS_32_BLACK", h: 34 },
    { key: "FONT_SANS_64_BLACK", h: 66 },
    { key: "FONT_SANS_128_BLACK", h: 130 },
  ];
}

async function loadFonts(Jimp) {
  if (globalThis.__ORATIO_FONTS__) return globalThis.__ORATIO_FONTS__;
  const table = getFontTable(Jimp);
  const map = new Map();
  for (const f of table) {
    const font = await Jimp.loadFont(Jimp[f.key]);
    map.set(f.key, font);
  }
  globalThis.__ORATIO_FONTS__ = map;
  return map;
}

function pickFontKey(boxH, Jimp) {
  const table = getFontTable(Jimp);
  let chosen = table[0].key;
  for (const f of table) {
    if (boxH >= f.h) chosen = f.key;
  }
  return chosen;
}

/* ------------------------ route ------------------------ */

export async function POST(req) {
  try {
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
    const strings = lineItems.map((l) => l.text);
    const translated = await translateArray(
      strings,
      targetLang,
      detectedLang,
      apiKey
    );

    // Overlay: Jimp (dinamik)
    const Jimp = await getJimp();
    const image = await Jimp.read(buf);
    const fonts = await loadFonts(Jimp);

    // Her kutuyu beyaza boya, metni ortalı yaz
    for (let i = 0; i < lineItems.length; i++) {
      const it = lineItems[i];
      const txt = translated[i] || "";

      // Arka planı beyaz doldur
      image.scan(it.x, it.y, it.w, it.h, function (x, y, idx) {
        this.bitmap.data[idx + 0] = 255;
        this.bitmap.data[idx + 1] = 255;
        this.bitmap.data[idx + 2] = 255;
        this.bitmap.data[idx + 3] = 255;
      });

      const fontKey = pickFontKey(it.h, Jimp);
      const font = fonts.get(fontKey);

      image.print(
        font,
        it.x,
        it.y,
        {
          text: txt,
          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
          alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
        },
        it.w,
        it.h
      );
    }

    const out = await image.getBufferAsync(Jimp.MIME_PNG);
    return new NextResponse(out, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}



