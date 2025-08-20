import type { NextRequest } from "next/server";
import { preprocess } from "../../../lib/preprocess"; // <- relative import

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_KEY = process.env.PROVIDER_API_KEY as string;
const VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;
const TRANSLATE_URL = `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`;

const LANG = {
  English: "en",
  "Türkçe": "tr",
  Русский: "ru",
  العربية: "ar",
  Српски: "sr",
  Deutsch: "de",
  Español: "es",
  Français: "fr",
  Italiano: "it",
} as const;
type UiLang = keyof typeof LANG;

function textFromWord(word: any): { text: string; breakType: string | null } {
  const syms = word?.symbols ?? [];
  const text = syms.map((s: any) => s.text ?? "").join("");
  const last = syms[syms.length - 1];
  const br = last?.property?.detectedBreak?.type ?? null;
  return { text, breakType: br };
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const targetUi = (form.get("targetLang") as UiLang) || "English";
    const target = LANG[targetUi] ?? "en";

    if (!file) return new Response("file missing", { status: 400 });

    // 0) Görseli OCR öncesi temizle (deskew/normalize). Hata olursa orijinalle devam et.
    const origBuf = Buffer.from(await file.arrayBuffer());
    const workBuf = await preprocess(origBuf).catch(() => origBuf);

    // 1) OCR
    const bytes = workBuf.toString("base64");
    const vres = await fetch(VISION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: bytes },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          },
        ],
      }),
    });
    if (!vres.ok) return new Response(await vres.text(), { status: 500 });

    const vjson = await vres.json();
    const page = vjson?.responses?.[0]?.fullTextAnnotation?.pages?.[0];
    if (!page) return Response.json({ items: [] });

    // 2) KELİME → SATIR gruplama (line-level bbox)
    const lines: Array<{ x: number; y: number; w: number; h: number; text: string }> = [];

    for (const block of page.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        let accText = "";
        let accXs: number[] = [];
        let accYs: number[] = [];

        const flush = () => {
          const t = accText.trim();
          if (t.length > 0 && /[A-Za-z0-9ĞÜŞİİğıöçÇÖŞÜ]/.test(t)) {
            const x = Math.min(...accXs);
            const y = Math.min(...accYs);
            const w = Math.max(...accXs) - x;
            const h = Math.max(...accYs) - y;
            if (w > 5 && h > 5) lines.push({ x, y, w, h, text: t });
          }
          accText = "";
          accXs = [];
          accYs = [];
        };

        for (const w of para.words ?? []) {
          const { text, breakType } = textFromWord(w);
          if (!text) continue;

          accText += (accText ? " " : "") + text;

          const v = w.boundingBox?.vertices ?? [];
          const xs = v.map((p: any) => p.x ?? 0);
          const ys = v.map((p: any) => p.y ?? 0);
          accXs.push(Math.min(...xs), Math.max(...xs));
          accYs.push(Math.min(...ys), Math.max(...ys));

          if (breakType === "LINE_BREAK") flush();
        }
        flush(); // paragraf sonu
      }
    }

    if (!lines.length) return Response.json({ items: [] });

    // 3) Çeviri (toplu)
    const tres = await fetch(TRANSLATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: lines.map((l) => l.text), target }),
    });
    if (!tres.ok) return new Response(await tres.text(), { status: 500 });

    const tjson = await tres.json();
    const translated =
      tjson?.data?.translations?.map((t: any) => t.translatedText) ?? [];

    const out = lines.map((l, i) => ({
      ...l,
      translated: translated[i] ?? l.text,
    }));

    return Response.json({ items: out });
  } catch (e: any) {
    return new Response(String(e?.message || e), { status: 500 });
  }
}



