import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { text, targetLang } = await req.json();
    if (!text || !targetLang) {
      return NextResponse.json({ error: "Missing text or targetLang" }, { status: 400 });
    }

    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, target: targetLang })
      }
    );

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error?.message || "Translation failed" }, { status: res.status });

    return NextResponse.json({ translatedText: data.data.translations[0].translatedText });
  } catch (e) {
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}


