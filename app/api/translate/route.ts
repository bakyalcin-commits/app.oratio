import { NextRequest } from "next/server";
import { createCanvas, loadImage } from "@napi-rs/canvas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";
const TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";

// UI'daki görünen dil adlarını ISO koda map’liyoruz
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

export async function POST(req: NextRequest) {
  try {
    const key = process.env.PROVIDER_API_KEY;
    if (!key) return new Response("missing PROVIDER_API_KEY", { status: 500 });

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const targetHuman = (form.get("targetLang") as string) || "English";
    const target = LANG_MAP[targetHuman] || "en";
    if (!file) return new Response("missing file", { status: 400 });

    // Dosyayı al, base64'e çevir
    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");

    // 1) OCR: Vision DOCUMENT_TEXT_DETECTION
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
      const msg = await vres.text();
      return new Response(`vision error: ${msg}`, { status: 502 });
    }

    const vjson = await vres.json();
    const fullText: string =
      vjson?.responses?.[0]?.fullTextAnnotation?.text ||
      vjson?.responses?.[0]?.textAnnotations?.[0]?.description ||
      "";

    // Çevrilecek metin boşsa, dosyayı aynen geri gönder
    if (!fullText.trim()) {
      return new Response(buf, {
        status: 200,
        headers: { "Content-Type": "image/png", "Cache-Control": "no-store" }
      });
    }

    // 2) Translation
    const tres = await fetch(`${TRANSLATE_URL}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: [fullText], target, format: "text" })
    });

    if (!tres.ok) {
      const msg = await tres.text();
      return new Response(`translate error: ${msg}`, { status: 502 });
    }

    const tjson = await tres.json();
    const translated: string =
      tjson?.data?.translations?.[0]?.translatedText || "";

    // 3) PNG üretimi: orijinali çiz, altta yarı saydam bir panel aç, çeviriyi sararak yaz
    const img = await loadImage(buf);
    const W = img.width;
    const H = img.height;

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // Orijinal görsel
    ctx.drawImage(img, 0, 0, W, H);

    // Panel alanı: görselin alt %32'si
    const pad = Math.max(Math.round(W * 0.04), 24);
    const panelH = Math.round(H * 0.32);
    const panelY = H - panelH;

    // Panel arka planı
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, panelY, W, panelH);

    // Metin stil
    // Ölçek: genişliğe göre fontu ayarla
    const baseFont = Math.max(Math.round(W / 42), 16);
    ctx.font = `${baseFont}px sans-serif`;
    ctx.fillStyle = "#ffffff";

    // Metni satırlara böl
    const maxWidth = W - pad * 2;
    const lines: string[] = [];
    const words = translated.replace(/\s+/g, " ").trim().split(" ");
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      const width = ctx.measureText(test).width;
      if (width <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);

    // Satır yüksekliği
    const lh = Math.round(baseFont * 1.4);

    // Çok uzunsa biraz küçült
    while (lines.length * lh > panelH - pad * 2 && baseFont > 12) {
      // fontu düşür
      const newFont = Math.max(Math.round((ctx.measureText("M").actualBoundingBoxAscent || baseFont) - 1), 12);
      ctx.font = `${newFont}px sans-serif`;
      // yeniden satırla
      lines.length = 0;
      const words2 = translated.replace(/\s+/g, " ").trim().split(" ");
      let ln = "";
      for (const w of words2) {
        const t = ln ? `${ln} ${w}` : w;
        if (ctx.measureText(t).width <= maxWidth) ln = t;
        else { if (ln) lines.push(ln); ln = w; }
      }
      if (ln) lines.push(ln);
    }

    // Yazı
    let y = panelY + pad + lh;
    for (const l of lines) {
      if (y > H - pad) break;
      ctx.fillText(l, pad, y);
      y += lh;
    }

    const out = canvas.toBuffer("image/png");
    return new Response(out, {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" }
    });
  } catch (e: any) {
    return new Response("server error: " + e.message, { status: 500 });
  }
}
