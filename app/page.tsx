"use client";

import { useMemo, useRef, useState } from "react";
import "./globals.css";

type Item = { x: number; y: number; w: number; h: number; translated: string };

const LANGS: { label: string; code: string; rtl?: boolean }[] = [
  { label: "English", code: "en" },
  { label: "Türkçe", code: "tr" },
  { label: "Русский", code: "ru" },
  { label: "العربية", code: "ar", rtl: true },
  { label: "Српски", code: "sr" },
  { label: "Deutsch", code: "de" },
  { label: "Español", code: "es" },
  { label: "Français", code: "fr" },
  { label: "Italiano", code: "it" }
];

export default function Page() {
  const [lang, setLang] = useState(LANGS[0].code);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [pngURL, setPngURL] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chosen = useMemo(() => LANGS.find((l) => l.code === lang)!, [lang]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreviewName(f ? f.name : null);
    setPngURL(null);
  }

  async function run() {
    if (!file) return;
    setBusy(true);
    setPngURL(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("lang", lang);

    const res = await fetch("/api/translate", { method: "POST", body: fd });
    if (!res.ok) {
      setBusy(false);
      alert("OCR/translate failed.");
      return;
    }
    const data: { items: Item[] } = await res.json();

    const srcURL = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;

      // 1) orijinal görseli boya
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const arr = (data.items || []) as Item[];
      if (!arr.length) {
        setBusy(false);
        return;
      }

      // medyan satır yüksekliği
      const medH = median(arr.map((i) => i.h)) || 18;

      // her öğe için sil + yaz
      for (const it of arr) {
        const r = calcRect(it, medH, canvas.width, canvas.height);
        eraseBox(ctx, r); // eski metni temizle
        drawFittedText(ctx, chosen, it.translated, r); // çeviriyi yerleştir
      }

      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/png")
      );
      const url = URL.createObjectURL(blob);
      setPngURL(url);
      URL.revokeObjectURL(srcURL);
      setBusy(false);
    };
    img.src = srcURL;
  }

  return (
    <main style={{ maxWidth: 980, margin: "40px auto 80px", padding: "0 16px" }}>
      <div style={{ textAlign: "center", marginBottom: 12, fontSize: 48, fontWeight: 800, letterSpacing: 1 }}>
        oratio
      </div>
      <div style={{ textAlign: "center", opacity: 0.85, marginBottom: 24, fontWeight: 700 }}>
        MEDICAL TRANSLATOR
      </div>

      <div className="card" style={{ padding: 22, marginBottom: 16 }}>
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            border: "1px dashed #2c2c30",
            background: "#0d0d10",
            borderRadius: 14,
            height: 160,
            display: "grid",
            placeItems: "center",
            cursor: "pointer"
          }}
          title="Choose PNG or JPG"
        >
          <div style={{ textAlign: "center", color: "#cfcfd6" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>Upload medical document</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Allowed formats: PNG, JPG</div>
            {previewName && (
              <div style={{ fontSize: 12, marginTop: 10, opacity: 0.8 }}>{previewName}</div>
            )}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={onPick}
          style={{ display: "none" }}
        />

        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <select
            value={lang}
            onChange={(e) => {
              const v = e.target.value;
              setLang(v);
            }}
            style={{ padding: "12px 14px", flex: "0 0 260px" }}
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>

          <button
            onClick={run}
            disabled={!file || busy}
            style={{
              background: busy ? "#27272b" : "#ffffff",
              color: busy ? "#8b8b92" : "#111114",
              flex: 1
            }}
          >
            {busy ? "Translating…" : "Get translated PNG"}
          </button>
        </div>
      </div>

      {pngURL && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "grid", placeItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pngURL}
              alt="translated"
              style={{ maxWidth: "100%", background: "#fff", borderRadius: 8 }}
            />
          </div>
          <div style={{ display: "grid", placeItems: "center", marginTop: 18 }}>
            <a
              href={pngURL}
              download="translated.png"
              style={{
                display: "inline-block",
                background: "#fff",
                color: "#111114",
                padding: "12px 18px",
                borderRadius: 10,
                fontWeight: 700,
                textDecoration: "none"
              }}
            >
              Download PNG
            </a>
          </div>
        </div>
      )}
    </main>
  );
}

/* ───────── helpers ───────── */

function median(a: number[]) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

type Rect = { x: number; y: number; w: number; h: number };

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** Metin kutusunu, çizgilere zarar vermeden biraz genişletilmiş pad ile hesapla */
function calcRect(it: { x: number; y: number; w: number; h: number }, medH: number, W: number, H: number): Rect {
  // yatay biraz geniş, dikey biraz dar pad
  const hPad = Math.max(3, Math.round(medH * 0.70));
  const vPad = Math.max(2, Math.round(medH * 0.35));

  // kutu, aşırı yüksekse (çizgi yakalamışsa) guard ile kısalt
  const guardH = Math.min(it.h, Math.round(medH * 1.25));

  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2;

  const x = clamp(Math.round(it.x - hPad), 0, W - 1);
  const y = clamp(Math.round(cy - guardH / 2 - vPad), 0, H - 1);
  const w = clamp(Math.round(it.w + hPad * 2), 1, W - x);
  const h = clamp(Math.round(guardH + vPad * 2), 1, H - y);

  return { x, y, w, h };
}

/** Silme işlemi: iki beyaz dolgu + küçük “ışık” gölge ile tırtıkları alır. */
function eraseBox(ctx: CanvasRenderingContext2D, r: Rect) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  // 1. geçiş
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(r.x, r.y, r.w, r.h);

  // 2. hafif genişleterek tekrar — aliasing lekelerini toplar
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 0.6;
  ctx.fillRect(r.x - 0.5, r.y - 0.5, r.w + 1, r.h + 1);

  // 3. garanti beyaz
  ctx.shadowBlur = 0;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  ctx.restore();
}

/** Yazıyı kutuya sığdırıp ortalar. */
function drawFittedText(
  ctx: CanvasRenderingContext2D,
  lang: { code: string; rtl?: boolean },
  raw: string,
  r: Rect
) {
  const text = decodeHtml(raw);
  const family = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const maxW = Math.max(20, r.w - 8);
  const targetH = Math.max(9, Math.floor(r.h * 0.80)); // kutunun %80'i

  ctx.textBaseline = "middle";
  ctx.direction = lang.rtl ? "rtl" : "ltr";
  ctx.textAlign = lang.rtl ? "right" : "left";

  let size = targetH;
  for (; size >= 8; size--) {
    ctx.font = `600 ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
  }

  const x = lang.rtl ? r.x + r.w - 4 : r.x + 4;
  const y = r.y + r.h / 2;

  ctx.fillStyle = "#000";
  ctx.fillText(text, x, y);
}

function decodeHtml(s: string) {
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value;
}










