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
  const [rtl, setRtl] = useState(!!LANGS[0].rtl);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [pngURL, setPngURL] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chosen = useMemo(
    () => LANGS.find((l) => l.code === lang)!,
    [lang]
  );

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

    // draw to canvas with cleanup + overlay
    const srcURL = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;

      // original image
      ctx.drawImage(img, 0, 0);

      const arr = (data.items || []) as Item[];
      const medH = median(arr.map((i) => i.h)) || 18;
      const vPad = Math.max(2, Math.round(medH * 0.40));
      const hPad = Math.max(2, Math.round(medH * 0.60));

      ctx.globalCompositeOperation = "source-over";
      ctx.textBaseline = "middle";

      for (const it of arr) {
        const cx = it.x + it.w / 2;
        const cy = it.y + it.h / 2;

        const x = Math.max(0, Math.round(it.x - hPad));
        const y = Math.max(0, Math.round(cy - medH / 2 - vPad));
        const w = Math.min(canvas.width - x, Math.round(it.w + hPad * 2));
        const h = Math.min(canvas.height - y, Math.round(medH + vPad * 2));

        // two-pass white fill to fully clear aliasing specks
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, w, h);
        ctx.fillRect(x, y, w, h);

        const maxW = Math.max(20, w - 8);
        ctx.textAlign = chosen.rtl ? "right" : "left";
        writeFitted(ctx, decodeHtml(it.translated), chosen.rtl ? x + w - 4 : x + 4, y + h / 2, maxW, medH);
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
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 12, fontSize: 48, fontWeight: 800, letterSpacing: 1 }}>
        oratio
      </div>
      <div style={{ textAlign: "center", opacity: 0.85, marginBottom: 24, fontWeight: 700 }}>
        MEDICAL TRANSLATOR
      </div>

      {/* Upload box */}
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

        {/* language */}
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <select
            value={lang}
            onChange={(e) => {
              setLang(e.target.value);
              const r = LANGS.find((l) => l.code === e.target.value)?.rtl;
              setRtl(!!r);
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

      {/* result preview + download */}
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

/* helpers */
function median(a: number[]) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function writeFitted(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  cy: number,
  maxW: number,
  refH: number
) {
  const family = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  let size = Math.max(9, Math.floor(refH * 0.85));
  for (; size >= 8; size--) {
    ctx.font = `${size}px ${family}`;
    const w = ctx.measureText(text).width;
    if (w <= maxW) {
      ctx.fillStyle = "#000";
      ctx.fillText(text, x, cy);
      return;
    }
  }
  ctx.font = `8px ${family}`;
  let t = text;
  while (ctx.measureText(t + "…").width > maxW && t.length > 1) t = t.slice(0, -1);
  ctx.fillStyle = "#000";
  ctx.fillText(t + "…", x, cy);
}

function decodeHtml(s: string) {
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value;
}








