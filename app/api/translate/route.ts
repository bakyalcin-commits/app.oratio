import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const targetLang = (form.get("targetLang") as string) || "English";
    if (!file) return new Response("missing file", { status: 400 });

    // Upstream’a proxy (ENV’leri Vercel’e koyacaksın)
    const upstream = new FormData();
    upstream.append("file", file, (file as any).name || "document.png");
    upstream.append("targetLang", targetLang);
    upstream.append("output", "png");

    const r = await fetch(process.env.PROVIDER_ENDPOINT!, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.PROVIDER_API_KEY!}` },
      body: upstream
    });

    if (!r.ok) return new Response("upstream error: " + (await r.text()), { status: 502 });

    const buf = Buffer.from(await r.arrayBuffer());
    return new Response(buf, { status: 200, headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  } catch (e:any) {
    return new Response("server error: " + e.message, { status: 500 });
  }
}
