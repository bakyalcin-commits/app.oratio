import type { NextRequest } from "next/server";
import { createCanvas, loadImage } from "@napi-rs/canvas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";
const TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";

// UI -> ISO dil kodu
const LANG_MAP: Record<string, string> = {
  English: "en",
  Türkçe: "tr",
  Русский: "ru",
  العربية: "ar",
  Српски: "sr",
  Deutsch: "de",
  Español: "es",
  Français: "fr",
  Italiano: "it"
};

function isRTL(code: string) {
  return code === "ar";
}

export async function POST(req: NextRequest) {
  try {
    const key = process.env.PROVIDER_API_KEY;
    if (!key) return new Response("missing PROVIDER_API_KEY", { status: 500 });

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const targetHuman = (form.get("targetLang") as string) || "English";
    const target = LANG_MAP[targetHuman] || "en";

    if (!file) return new Response("missing file", { status: 400 });

    // Tip kontrolü (PDF şimdilik destek dışı)
    if (file.type === "application/pdf") {
      return new Response("PDF not supported yet", { status: 415 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");

    // 1) OCR
    const vres = await fetch(`${VISION_URL}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
          }
        ]
      })
    });

    if (!vres.ok) {
      return new Response("vision error: " + (await vres.text()), { status: 502 });
    }

    const vjson = await vres.json();
    const fullText: string =
      vjson?.responses?.[0]?.fullTextAnnotation?.text ||
      vjson?.responses?.[0]?.textAnnotations?.[0]?.description ||
      "";

    if (!fullText.trim()) {
      // metin yoksa orijinal PNG'i aynen döndür
      return new Response(buf, {
        status: 200,
        headers: { "Content-Type": "image/png", "Cache-Control": "no-store" }
      });
    }

    // 2) Çeviri
    const tres = await fetch(`${TRANSLATE_URL}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: [fullText], target, format: "text" })
    });
    if (!tres.ok) {
      return new Response("translate error: " + (await tres.text()), { status: 502 });
    }
    const tjson = await tres.json();
    const translated: string =
      tjson?.data?.translations?.[0]?.translatedText || "";

    // 3) PNG overlay çıktısı
    const img = await loadImage(buf);
    const W = img.width;
    const H = img.height;

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // Orijinal arka plan
    ctx.drawImage(img, 0, 0, W, H);

    // Alt panel
    const pad = Math.max(Math.round(W * 0.04), 24);
    const panelH = Math.round(H * 0.32);
    const panelY = H - panelH;

    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, panelY, W, panelH);

    // Yazı stili
    let fontSize = Math.max(Math.round(W / 42), 16);
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = isRTL(target) ? "right" : "left";

    // word-wrap
    const maxWidth = W - pad * 2;
    const words = translated.replace(/\s+/g, " ").trim().split(" ");
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      const wlen = ctx.measureText(test).width;
      if (wlen <= maxWidth) line = test;
      else { if (line) lines.push(line); line = w; }
    }
    if (line) lines.push(line);

    const lineHeight = Math.round(fontSize * 1.4);
    // sığmayana kadar fontu küçült
    while ((lines.length * lineHeight) > (panelH - pad * 2) && fontSize > 12) {
      fontSize -= 1;
      ctx.font = `${fontSize}px sans-serif`;
      // yeniden sar
      lines.length = 0;
      let cur = "";
      for (const w of words) {
        const t = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(t).width <= maxWidth) cur = t;
        else { if (cur) lines.push(cur); cur = w; }
      }
      if (cur) lines.push(cur);
    }

    // çiz
    let y = panelY + pad + lineHeight;
    for (const l of lines) {
      if (y > H - pad) break;
      if (isRTL(target)) ctx.fillText(l, W - pad, y);
      else ctx.fillText(l, pad, y);
      y += lineHeight;
    }

    const out = canvas.toBuffer("image/png");
    return new Response(out, {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" }
    });
  } catch (e:any) {
    return new Response("server error: " + e.message, { status: 500 });
  }
}
