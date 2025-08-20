import type { NextRequest } from "next/server";

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

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const targetUi = (form.get("targetLang") as UiLang) || "English";
    const target = LANG[targetUi] ?? "en";
    if (!file) return new Response("file missing", { status: 400 });

    // 1) OCR (DOCUMENT_TEXT_DETECTION)
    const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
    const payload = {
      requests: [
        {
          image: { content: bytes },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        },
      ],
    };
    const vres = await fetch(VISION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!vres.ok) return new Response(await vres.text(), { status: 500 });
    const vjson = await vres.json();

    const page = vjson?.responses?.[0]?.fullTextAnnotation?.pages?.[0];
    if (!page) {
      return Response.json({ items: [] });
    }

    // 2) Paragrafları topla (bbox + text)
    const items: Array<{ x: number; y: number; w: number; h: number; text: string }> = [];
    for (const block of page.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        let text = "";
        for (const w of para.words ?? []) {
          const word = (w.symbols ?? []).map((s: any) => s.text ?? "").join("");
          text += word + " ";
        }
        text = text.trim();
        if (!text) continue;

        const v = para.boundingBox?.vertices ?? [];
        const xs = v.map((p: any) => p.x ?? 0);
        const ys = v.map((p: any) => p.y ?? 0);
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        const w = Math.max(...xs) - x;
        const h = Math.max(...ys) - y;

        items.push({ x, y, w, h, text });
      }
    }
    if (!items.length) return Response.json({ items: [] });

    // 3) Toplu çeviri
    const tres = await fetch(TRANSLATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: items.map((i) => i.text), target }),
    });
    if (!tres.ok) return new Response(await tres.text(), { status: 500 });
    const tjson = await tres.json();
    const translated = tjson?.data?.translations?.map((t: any) => t.translatedText) ?? [];

    const out = items.map((it, i) => ({ ...it, translated: translated[i] ?? it.text }));
    return Response.json({ items: out });
  } catch (e: any) {
    return new Response(String(e?.message || e), { status: 500 });
  }
}


