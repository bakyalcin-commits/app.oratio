import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Box = { x: number; y: number; w: number; h: number; text: string };

const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";
const TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";

export async function POST(req: NextRequest) {
  const apiKey = process.env.PROVIDER_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing PROVIDER_API_KEY" }), {
      status: 500
    });
  }

  const form = await req.formData();
  const lang = String(form.get("lang") || "en");
  const file = form.get("file") as File | null;

  if (!file) {
    return new Response(JSON.stringify({ error: "No file" }), { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");

  // 1) OCR
  const vres = await fetch(`${VISION_URL}?key=${apiKey}`, {
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
    const t = await vres.text();
    return new Response(JSON.stringify({ error: `Vision error: ${t}` }), { status: 500 });
  }
  const vdata = await vres.json();
  const ann = vdata?.responses?.[0];
  const words: any[] = (ann?.textAnnotations || []).slice(1);
  if (!words.length) {
    return new Response(JSON.stringify({ items: [] }), { status: 200 });
  }

  // map word polys to boxes
  const boxes: Box[] = words
    .map((w) => {
      const v = (w.boundingPoly?.vertices || []) as { x?: number; y?: number }[];
      const xs = v.map((p) => p.x || 0);
      const ys = v.map((p) => p.y || 0);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const wdt = Math.max(1, Math.max(...xs) - x);
      const hgt = Math.max(1, Math.max(...ys) - y);
      return { x, y, w: wdt, h: hgt, text: String(w.description || "") };
    })
    .filter((b) => b.text.trim().length > 0);

  // cluster to lines
  const medH = median(boxes.map((b) => b.h)) || 18;
  const lineGap = medH * 0.75;

  boxes.sort((a, b) => a.y - b.y || a.x - b.x);

  const lines: Box[] = [];
  let curr: Box[] = [];
  let lastCY = -Infinity;

  for (const b of boxes) {
    const cy = b.y + b.h / 2;
    if (curr.length === 0 || Math.abs(cy - lastCY) <= lineGap) {
      curr.push(b);
      lastCY = curr.reduce((s, it) => s + (it.y + it.h / 2), 0) / curr.length;
    } else {
      lines.push(mergeLine(curr));
      curr = [b];
      lastCY = b.y + b.h / 2;
    }
  }
  if (curr.length) lines.push(mergeLine(curr));

  // 2) translate batched
  const texts = lines.map((l) => l.text);
  const tres = await fetch(`${TRANSLATE_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: texts, target: lang, format: "text" })
  });
  if (!tres.ok) {
    const t = await tres.text();
    return new Response(JSON.stringify({ error: `Translate error: ${t}` }), {
      status: 500
    });
  }
  const tdata = await tres.json();
  const translations: string[] = tdata?.data?.translations?.map((t: any) => t.translatedText) || [];

  const items = lines.map((l, i) => ({
    x: l.x,
    y: l.y,
    w: l.w,
    h: l.h,
    translated: translations[i] ?? l.text
  }));

  return new Response(JSON.stringify({ items }), { status: 200 });
}

/* helpers */
function mergeLine(arr: Box[]): Box {
  arr.sort((a, b) => a.x - b.x);
  const x = Math.min(...arr.map((b) => b.x));
  const y = Math.min(...arr.map((b) => b.y));
  const r = Math.max(...arr.map((b) => b.x + b.w));
  const btm = Math.max(...arr.map((b) => b.y + b.h));
  const text = arr.map((b) => b.text).join(" ");
  return { x, y, w: r - x, h: btm - y, text };
}

function median(a: number[]) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
