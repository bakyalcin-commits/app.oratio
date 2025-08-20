import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';        // Edge değil; Node.js runtime
export const dynamic = 'force-dynamic'; // Her çağrıda çalışsın

type TranslateResponse = {
  data: {
    translations: { translatedText: string; detectedSourceLanguage?: string }[];
  };
};

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const target = (form.get('target') as string | null)?.trim() || 'en';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.PROVIDER_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing PROVIDER_API_KEY' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1) Dosyayı base64'e çevir
    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString('base64');

    // 2) Google Vision OCR
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [{ type: 'TEXT_DETECTION' }],
              // İsterseniz OCR için ipucu dilleri ekleyin:
              // imageContext: { languageHints: ['tr', 'en'] },
            },
          ],
        }),
      }
    );

    if (!visionRes.ok) {
      const txt = await visionRes.text();
      return new Response(JSON.stringify({ error: 'Vision error', detail: txt }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const visionJson = await visionRes.json();
    const anno =
      visionJson?.responses?.[0]?.fullTextAnnotation?.text ||
      visionJson?.responses?.[0]?.textAnnotations?.[0]?.description ||
      '';

    // 3) Çeviri (Google Translate v2)
    let translated = anno;
    if (anno && target) {
      const params = new URLSearchParams();
      params.set('q', anno);
      params.set('target', target);
      params.set('format', 'text');
      params.set('key', apiKey);

      const trRes = await fetch(
        'https://translation.googleapis.com/language/translate/v2',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        }
      );

      if (trRes.ok) {
        const trJson = (await trRes.json()) as TranslateResponse;
        translated = trJson?.data?.translations?.[0]?.translatedText ?? anno;
      }
      // trRes ok değilse, orijinal OCR çıktısını döndürürüz
    }

    return new Response(JSON.stringify({ text: translated }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Unexpected error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}





