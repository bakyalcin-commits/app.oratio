// app/api/translate-file/route.js
import { NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";

export const runtime = "nodejs";

/** PRIVATE KEY'i normalize et (literal \n → gerçek newline, tırnak/CRLF/base64 vs) */
function sanitizePrivateKey(pk) {
  if (!pk) return pk;

  // string tırnakları yanlışlıkla dahil edildiyse sök
  if (
    (pk.startsWith('"') && pk.endsWith('"')) ||
    (pk.startsWith("'") && pk.endsWith("'"))
  ) {
    pk = pk.slice(1, -1);
  }

  // literal \n, \r -> gerçek newline/CR
  pk = pk.replace(/\\n/g, "\n").replace(/\\r/g, "\r");

  // Windows CRLF normalize
  pk = pk.replace(/\r\n/g, "\n").trim();

  // BEGIN/END yoksa ve base64 gibi görünüyorsa decode etmeyi dene
  if (!pk.includes("BEGIN") && /^[A-Za-z0-9+/=\s]+$/.test(pk)) {
    try {
      const decoded = Buffer.from(pk, "base64").toString("utf8");
      if (decoded.includes("BEGIN") && decoded.includes("END")) pk = decoded;
    } catch {
      // boş ver
    }
  }

  return pk;
}

/** Vision client (3 env değişkeni ile) */
function getVisionClientFromEnv() {
  const projectId = process.env.GOOGLE_PROJECT_ID;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawPrivateKey) {
    throw new Error(
      "Missing GOOGLE_PROJECT_ID / GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY"
    );
  }

  const private_key = sanitizePrivateKey(rawPrivateKey);

  // Basit ama sağlam: doğrudan credentials ver
  return new ImageAnnotatorClient({
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key,
    },
  });
}

export async function POST(req) {
  let client;
  try {
    client = getVisionClientFromEnv();
  } catch (e) {
    return NextResponse.json(
      { error: "Auth init failed: " + e.message },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const targetLang = formData.get("targetLang") || "en";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // OCR
    const [result] = await client.textDetection(bytes);
    const detections = result?.textAnnotations || [];
    if (detections.length === 0) {
      return NextResponse.json({ error: "No text detected" }, { status: 400 });
    }
    const sourceText = detections[0].description;

    // Translate v2
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GOOGLE_API_KEY" },
        { status: 500 }
      );
    }

    const tRes = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: sourceText, target: targetLang, format: "text" }),
      }
    );
    const tData = await tRes.json();

    if (!tRes.ok || tData.error) {
      const msg = tData.error?.message || "Translate failed";
      return NextResponse.json({ error: msg }, { status: tRes.status || 400 });
    }

    return NextResponse.json({
      sourceText,
      translatedText: tData.data?.translations?.[0]?.translatedText || "",
    });
  } catch (err) {
    // OpenSSL/decoder saçmalıkları da burada yakalanır
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


