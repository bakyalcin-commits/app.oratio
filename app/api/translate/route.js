import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { text, targetLang } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Missing 'text'" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing GOOGLE_API_KEY" }, { status: 500 });
    }

    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: text,
          target: targetLang || "en",
          format: "text"
        })
      }
    );

    const data = await res.json();
    if (!res.ok || data.error) {
      const msg = data.error?.message || JSON.stringify(data);
      return NextResponse.json({ error: msg }, { status: res.status || 400 });
    }

    return NextResponse.json({ translatedText: data.data.translations[0].translatedText });
  } catch (e) {
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}




