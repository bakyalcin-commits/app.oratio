import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createCanvas, loadImage, CanvasRenderingContext2D } from "@napi-rs/canvas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_KEY = process.env.PROVIDER_API_KEY!;
const VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;
const TRANSLATE_URL = `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`;

type Vertex = { x?: number; y?: number };
type ParaBox = {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const lang = (form.get("lang") as string) || "en";
    if (!file) return NextResponse.json({ error: "no_file" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");

    // 1) OCR (paragraf kutuları + metin)
    const ocrPayload = {
      requests: [
        {
          image: { content: base64 },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: { languageHints: ["tr", "en"] },
        },
      ],
    };

    const ocrRes = await fetch(VISION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ocrPayload),
    });
    const ocrJson = await ocrRes.json();

    const annotation = ocrJson?.responses?.[0]?.fullTextAnnotation;
    const pages = annotation?.pages ?? [];
    if (!pages.length) {
      // OCR sıfır çekerse orijinali döndür – rezil olmayalım.
      return new NextResponse(buf, { headers: { "Content-Type": "image/png" } });
    }

    const paras: ParaBox[] = [];
    for (const p of pages) {
      for (const block of p.blocks ?? []) {
        for (const para of block.paragraphs ?? []) {
          const text = extractParagraphText(para);
          const { x, y, w, h } = boxFromVertices(para.boundingBox?.vertices ?? []);
          // mikro gürültüyü ele
          if (!text.trim()) continue;
          if (w < 20 || h < 10) continue;
          paras.push({ text, x, y, w, h });
        }
      }
    }

    // 2) Toplu çeviri (tek seferde, sırayı koru)
    const translated = await translateBatch(paras.map(p => p.text), lang);

    // 3) Kanvas: orijinali çiz, kutuları beyazla kapat, çeviriyi sığdır
    const img = await loadImage(buf);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0);

    // beyaz kapatma + yazma
    paras.forEach((para, i) => {
      const pad = Math.max(2, Math.floor(Math.min(para.w, para.h) * 0.06)); // kutuya göre pad
      // beyaz kapat
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(para.x - pad, para.y - pad, para.w + pad * 2, para.h + pad * 2);

      // metni kutuya sığdırarak yaz
      ctx.fillStyle = "#111111";
      ctx.textBaseline = "top";
      drawWrappedToBox(ctx, translated[i], para.x, para.y, para.w, para.h);
    });

    const out = canvas.toBuffer("image/png");
    return new NextResponse(out, { headers: { "Content-Type": "image/png" } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "fail" }, { status: 500 });
  }
}

/* ---------------- helpers ---------------- */

function extractParagraphText(para: any): string {
  const words = para?.words ?? [];
  const parts: string[] = [];
  for (const w of words) {
    const symbols = w?.symbols ?? [];
    const token = symbols.map((s: any) => s.text ?? "").join("");
    parts.push(token);
    // boşluk tahmini
    const bp = symbols.at(-1)?.property?.detectedBreak?.type;
    if (bp === "SPACE" || bp === "EOL_SURE_SPACE") parts.push(" ");
    if (bp === "LINE_BREAK") parts.push("\n");
  }
  // Vision çoğu kez boşluk yiyor, son çare normalleştir
  return parts.join("").replace(/[ ]{2,}/g, " ").trim();
}

function boxFromVertices(verts: Vertex[]) {
  const xs = verts.map(v => v.x ?? 0);
  const ys = verts.map(v => v.y ?? 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

async function translateBatch(texts: string[], target: string): Promise<string[]> {
  // Google v2 toplu çeviri
  const body = new URLSearchParams();
  texts.forEach(t => body.append("q", t));
  body.set("target", target);
  body.set("source", "tr");
  body.set("format", "text");
  body.set("model", "nmt");

  const r = await fetch(TRANSLATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = await r.json();
  const arr = j?.data?.translations?.map((t: any) => t.translatedText ?? "") ?? [];
  return arr.map((s: string) =>
    s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
  );
}

function drawWrappedToBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number
) {
  // Kutunun içine sığacak en büyük fontu bul (binary search)
  let min = 8, max = 28, fit = 12;
  while (min <= max) {
    const mid = Math.floor((min + max) / 2);
    const ok = fits(ctx, text, w, h, mid);
    if (ok) {
      fit = mid;
      min = mid + 1;
    } else {
      max = mid - 1;
    }
  }
  ctx.font = `${fit}px "Inter", "Arial", "Helvetica", sans-serif`;
  const lines = wrapLines(ctx, text, w);
  const lineH = Math.round(fit * 1.25);
  let cy = y;
  for (const line of lines) {
    if (cy + lineH - y > h) break; // taşma koruması
    ctx.fillText(line, x, cy);
    cy += lineH;
  }
}

function fits(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, f: number) {
  ctx.font = `${f}px "Inter", "Arial", "Helvetica", sans-serif`;
  const lines = wrapLines(ctx, text, w);
  const needed = Math.round(f * 1.25) * lines.length;
  return needed <= h;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const raw = text.replace(/\s+\n/g, "\n").split(/\n/);
  const out: string[] = [];
  for (const line of raw) {
    const words = line.split(/\s+/);
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (ctx.measureText(test).width <= maxW) {
        cur = test;
      } else {
        if (cur) out.push(cur);
        // tek kelime bile sığmıyorsa kaba kır
        if (ctx.measureText(w).width > maxW) {
          out.push(hardBreak(ctx, w, maxW));
          cur = "";
        } else {
          cur = w;
        }
      }
    }
    if (cur) out.push(cur);
  }
  return out.flatMap(s => (Array.isArray(s) ? (s as any) : [s]));
}

function hardBreak(ctx: CanvasRenderingContext2D, word: string, maxW: number): string[] {
  const chars = [...word];
  let cur = "";
  const lines: string[] = [];
  for (const ch of chars) {
    const test = cur + ch;
    if (ctx.measureText(test).width <= maxW) cur = test;
    else {
      lines.push(cur);
      cur = ch;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}




