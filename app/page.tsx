// app/page.tsx
"use client";

import NextImage from "next/image";
import { useRef, useState } from "react";

type UiLang =
  | "English"
  | "Türkçe"
  | "Русский"
  | "العربية"
  | "Српски"
  | "Deutsch"
  | "Español"
  | "Français"
  | "Italiano";

const LANG_CODE: Record<UiLang, string> = {
  English: "en",
  "Türkçe": "tr",
  Русский: "ru",
  العربية: "ar",
  Српски: "sr",
  Deutsch: "de",
  Español: "es",
  Français: "fr",
  Italiano: "it",
};

type Item = {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  translated: string;
};

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState<UiLang>("English");
  const [busy, setBusy] = useState(false);
  const [downloadURL, setDownloadURL] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setDownloadURL(null);
  };

  const openPicker = () => inputRef.current?.click();

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && /^image\/(png|jpe?g)$/.test(f.type)) {
      setFile(f);
      setDownloadURL(null);
    }
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
  };

  async function onTranslatePNG() {
    if (!file) return;
    setBusy(true);
    setDownloadURL(null);

    try {
      // 1) OCR + TRANSLATE
      const fd = new FormData();
      fd.append("file", file);
      fd.append("targetLang", lang);
      const res = await fetch("/api/translate", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data: { items: Item[] } = await res.json();
      const items = data.items ?? [];

      // 2) Kaynak görseli yükle
      const imgURL = URL.createObjectURL(file);
      const img = await loadImage(imgURL);

      // 3) Canvas kur
      const SCALE = 3; // daha keskin çıktı
      const cw = img.width * SCALE;
      const ch = img.height * SCALE;

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      canvas.width = cw;
      canvas.height = ch;

      ctx.imageSmoothingEnabled = true;
      // @ts-ignore
      if ((ctx as any).imageSmoothingQuality) (ctx as any).imageSmoothingQuality = "high";

      // Arkaplanı çiz
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);

      // 4) Kutular: blur + renk yıkama + metin
      const rtl = LANG_CODE[lang] === "ar";
      for (const it of items) {
        const bx = Math.max(0, Math.round(it.x * SCALE));
        const by = Math.max(0, Math.round(it.y * SCALE));
        const bw = Math.max(1, Math.round(it.w * SCALE));
        const bh = Math.max(1, Math.round(it.h * SCALE));

        // Kenarlara dokunmamak için içe çek
        const inner = Math.max(2, Math.round(Math.min(bw, bh) * 0.10));
        const ix = bx + inner;
        const iy = by + inner;
        const iw = Math.max(1, bw - inner * 2);
        const ih = Math.max(1, bh - inner * 2);

        // --- Yalnızca kutu içinde blur (orijinal doku korunur)
        ctx.save();
        ctx.beginPath();
        ctx.rect(ix, iy, iw, ih);
        ctx.clip();

        if ("filter" in ctx) {
          (ctx as any).filter = "blur(2.6px) contrast(0.96) brightness(1.02)";
          ctx.drawImage(img, 0, 0, cw, ch);
          (ctx as any).filter = "none";
        } else {
          // Fallback: hafif opak dolgu
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = "#fff";
          ctx.fillRect(ix, iy, iw, ih);
          ctx.globalAlpha = 1;
        }
        ctx.restore();

        // --- Kutunun ortalama rengini örnekle, hafif yıkama uygula
        const [r, g, b] = sampleAverage(canvas, ix, iy, iw, ih);
        ctx.save();
        ctx.globalAlpha = 0.20; // 0.15–0.30
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(ix, iy, iw, ih);
        ctx.restore();

        // --- Metin rengi (arka plana göre)
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const fillColor = luminance > 180 ? "#111" : "#fff";
        const strokeColor = luminance > 180 ? "rgba(255,255,255,.85)" : "rgba(0,0,0,.75)";

        const clean = decodeHTMLEntities(it.translated || it.text);
        drawTextInBox(ctx, clean, ix, iy, iw, ih, rtl, {
          stroke: true,
          fill: fillColor,
          strokeStyle: strokeColor,
        });
      }

      // 5) PNG indir linki
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b as Blob), "image/png")
      );
      const url = URL.createObjectURL(blob);
      setDownloadURL(url);

      URL.revokeObjectURL(imgURL);
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0b0d",
        color: "#eaeaea",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
        padding: "48px 16px 64px",
      }}
    >
      {/* Logo & Başlık */}
      <div style={{ width: "100%", maxWidth: 880 }}>
        <NextImage
          src="/oratio.png"
          alt="oratio"
          width={592}
          height={160}
          priority
          style={{ height: 160, width: "auto" }}
        />
        <div style={{ marginTop: 8, fontSize: 28, opacity: 0.9 }}>
          MEDICAL TRANSLATOR
        </div>
      </div>

      {/* Upload alanı (tıklanabilir + drag&drop) */}
      <div
        style={{
          width: "100%",
          maxWidth: 880,
          borderRadius: 16,
          background: "#17171b",
          border: "1px solid #2a2a31",
          padding: 28,
        }}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Click to upload or drag & drop"
          onClick={openPicker}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openPicker()}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          style={{
            border: dragging ? "2px dashed #7c9cff" : "1px dashed #444",
            transition: "border-color 120ms ease, background 120ms ease",
            background: dragging ? "#20202a" : "transparent",
            borderRadius: 12,
            height: 160,
            display: "grid",
            placeItems: "center",
            marginBottom: 20,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, opacity: 0.95 }}>
              {file ? file.name : "Upload medical document"}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.6 }}>
              Click to upload or drag &amp; drop
            </div>
          </div>

          <input
            ref={inputRef}
            id="file"
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={onFile}
          />
        </div>

        <div style={{ opacity: 0.7, marginBottom: 20 }}>Allowed formats: PNG, JPG</div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as UiLang)}
            style={{
              background: "#101013",
              color: "#eaeaea",
              border: "1px solid #2a2a31",
              borderRadius: 8,
              padding: "10px 12px",
              minWidth: 160,
              outline: "none",
            }}
          >
            {Object.keys(LANG_CODE).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          <button
            onClick={onTranslatePNG}
            disabled={!file || busy}
            style={{
              background: file && !busy ? "#fff" : "#2c2c32",
              color: file && !busy ? "#111" : "#888",
              fontWeight: 700,
              borderRadius: 10,
              padding: "10px 16px",
              border: "none",
              cursor: file && !busy ? "pointer" : "not-allowed",
            }}
          >
            {busy ? "Working..." : "Get translated PNG"}
          </button>

          {downloadURL && (
            <a
              href={downloadURL}
              download="translated.png"
              style={{ marginLeft: 8, textDecoration: "underline" }}
            >
              Download PNG
            </a>
          )}
        </div>
      </div>

      {/* Önizleme Canvas */}
      <div style={{ width: "100%", maxWidth: 880 }}>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            borderRadius: 12,
            background: "#111",
            border: "1px solid #2a2a31",
          }}
        />
      </div>
    </main>
  );
}

/* ————— yardımcılar ————— */

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// Ortalama renk örnekleme (hız için seyrek piksel)
function sampleAverage(cv: HTMLCanvasElement, x: number, y: number, w: number, h: number): [number, number, number] {
  const ctx = cv.getContext("2d")!;
  const dx = Math.max(0, x);
  const dy = Math.max(0, y);
  const dw = Math.max(1, Math.min(cv.width - dx, w));
  const dh = Math.max(1, Math.min(cv.height - dy, h));
  const img = ctx.getImageData(dx, dy, dw, dh).data;

  let r = 0, g = 0, b = 0, c = 0;
  for (let i = 0; i < img.length; i += 32) { // 4 kanallı, her 8 pikselde 1
    r += img[i];
    g += img[i + 1];
    b += img[i + 2];
    c++;
  }
  return [Math.round(r / c), Math.round(g / c), Math.round(b / c)];
}

// HTML entity çözümü
function decodeHTMLEntities(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Kutuya sığacak şekilde fontu küçültür, metni satırlara böler ve çizer.
 * Opsiyonla kontur/renk verilebilir.
 */
function drawTextInBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  rtl: boolean,
  opts?: { stroke?: boolean; fill?: string; strokeStyle?: string }
) {
  const pad = Math.max(6, Math.floor(Math.min(w, h) * 0.08));
  const lineGap = 1.25;
  const family =
    `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial`;

  const setFont = (size: number) => {
    ctx.font = `600 ${size}px ${family}`;
  };

  // 1) Font boyutunu kutuya sığdır
  let fontSize = Math.max(10, Math.floor(h * 0.7));
  let lines: string[] = [];

  while (fontSize >= 10) {
    setFont(fontSize);
    lines = wrapLines(ctx, text, w - pad * 2);

    const needH = lines.length * fontSize * lineGap;
    const widest = Math.max(...lines.map((ln) => ctx.measureText(ln).width));
    if (needH <= h - pad * 2 && widest <= w - pad * 2) break;

    fontSize -= 1;
  }

  // 2) Çizim
  ctx.textBaseline = "top";
  ctx.textAlign = rtl ? "right" : "left";
  setFont(fontSize);

  if (opts?.fill) ctx.fillStyle = opts.fill;
  if (opts?.strokeStyle) ctx.strokeStyle = opts.strokeStyle;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(0.75, fontSize * 0.08); // ince kontur

  const startX = rtl ? x + w - pad : x + pad;
  let cy = y + pad;

  for (const ln of lines) {
    if (opts?.stroke) ctx.strokeText(ln, startX, cy);
    ctx.fillText(ln, startX, cy);
    cy += fontSize * lineGap;
    if (cy > y + h - pad) break;
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = "";

  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) out.push(line);
      if (ctx.measureText(w).width > maxWidth) {
        out.push(...breakLongWord(ctx, w, maxWidth));
        line = "";
      } else {
        line = w;
      }
    }
  }
  if (line) out.push(line);
  return out;
}

function breakLongWord(ctx: CanvasRenderingContext2D, word: string, maxWidth: number): string[] {
  let buf = "";
  const out: string[] = [];
  for (const ch of word) {
    const t = buf + ch;
    if (ctx.measureText(t).width <= maxWidth) {
      buf = t;
    } else {
      if (buf) out.push(buf);
      buf = ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}











