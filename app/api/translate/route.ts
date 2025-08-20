import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";
const TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";

const LANG_MAP: Record<string, string> = {
  English: "en", Türkçe: "tr", Русский: "ru", العربية: "ar", Српски: "sr",
  Deutsch: "de", Español: "es", Français: "fr", Italiano: "it"
};

export async function GET() { return new Response("ok", { status: 200 }); }

export async function POST(req: NextRequest) {
  const key = process.env.PROVIDER_API_KEY;
  if (!key) return new Response("missing PROVIDER_API_KEY", { status: 500 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const target = LANG_MAP[(form.get("targetLang") as string) || "English"] || "en";
  if (!file) return new Response("missing file", { status: 400 });

  if (!/image\/(png|jpeg)/.test(file.type)) {
    return new Response("Only PNG/JPG supported in this build", { status: 415 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");

  // OCR
  const vres = await fetch(`${VISION_URL}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ image: { content: base64 }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }]
    })
  });
  if (!vres.ok) return new Response("vision error: " + (await vres.text()), { status: 502 });
  const vjson = await vres.json();
  const fullText: string =
    vjson?.responses?.[0]?.fullTextAnnotation?.text ||
    vjson?.responses?.[0]?.textAnnotations?.[0]?.description || "";
  if (!fullText.trim()) {
    return new Response("", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  // Translate
  const tres = await fetch(`${TRANSLATE_URL}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: [fullText], target, format: "text" })
  });
  if (!tres.ok) return new Response("translate error: " + (await tres.text()), { status: 502 });
  const tjson = await tres.json();
  const translated: string = tjson?.data?.translations?.[0]?.translatedText || "";

  return new Response(translated, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
  });
}
