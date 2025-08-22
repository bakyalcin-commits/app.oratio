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

      // 2) Kaynak görseli
      const imgURL = URL.createObjectURL(file);
      const img = await loadImage(imgURL);

      // 3) Canvas
      const SCALE = 3;
      const cw = img.width * SCALE;
      const ch = img.height * SCALE;

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      canvas.width = cw;
      canvas.height = ch;

      ctx.imageSmoothingEnabled = true;
      (ctx as any).imageSmoothingQuality = "high";

      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);

      // 4) Arka planı koruyarak sil & yaz
      const rtl = LANG_CODE[lang] === "ar";
      for (const it of items) {
        const bx = Math.max(0, Math.round(it.x * SCALE));
        const by = Math.max(0, Math.round(it.y * SCALE));
        const bw = Math.max(1, Math.round(it.w * SCALE));
        const bh = Math.max(1, Math.round(it.h * SCALE));

        // biraz daha geniş pay: yazı tamamen kapansın
        const pad = Math.max(3, Math.round(Math.min(bw, bh) * 0.10));
        const ix = clamp(bx - pad, 0, cw);
        const iy = clamp(by - pad, 0, ch);
        const iw = clamp(bw + pad * 2, 1, cw - ix);
        const ih = clamp(bh + pad * 2, 1, ch - iy);

        // 4.a) iki kez hafif blur
        blurPatch(ctx, ix, iy, iw, ih, 2);
        blurPatch(ctx, ix, iy, iw, ih, 2);

        // 4.b) ortalama renkle feathered dolgu (merkez daha opak, kenarlar yumuşar)
        const avg = avgColor(ctx, ix, iy, iw, ih, 6);
        featherFill(ctx, ix, iy, iw, ih, avg, 0.32, 14);

        // 4.c) koyu harf kalıntılarını biraz daha “lighten”
        ctx.save();
        ctx.globalAlpha = 0.10;
        ctx.fillStyle = "#fff";
        ctx.fillRect(ix, iy, iw, ih);
        ctx.restore();

        // 4.d) metin (daha büyük başlayıp sığdır)
        const clean = decodeHTMLEntities(it.translated || it.text);

        // arka plan parlaklığına göre renk
        const lum = 0.2126 * avg.r + 0.7152 * avg.g + 0.0722 * avg.b;
        const fill = lum > 185 ? "#111" : "#000";

        ctx.save();
        ctx.fillStyle = fill;
        drawTextInBox(ctx, clean, bx, by, bw, bh, rtl);
        ctx.restore();
      }

      // 5) indirme
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

      {/* Upload */}
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

      {/* Önizleme */}
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

/* ————— helpers ————— */

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

function decodeHTMLEntities(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Kutuyu daha dolgun dolduracak font & hafif stroke ile çizim */
function drawTextInBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  rtl: boolean
) {
  const pad = Math.max(6, Math.floor(Math.min(w, h) * 0.08));
  const lineGap = 1.22;
  const family =
    `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial`;
  const setFont = (size: number) => (ctx.font = `600 ${size}px ${family}`);

  // Daha büyükten başla, sığana kadar küçült
  let fontSize = Math.max(16, Math.floor(h * 0.95));
  let lines: string[] = [];

  while (fontSize >= 10) {
    setFont(fontSize);
    lines = wrapLines(ctx, text, w - pad * 2);
    const needH = lines.length * fontSize * lineGap;
    const widest = Math.max(...lines.map((ln) => ctx.measureText(ln).width));
    if (needH <= h - pad * 2 && widest <= w - pad * 2) break;
    fontSize -= 1;
  }

  ctx.textBaseline = "top";
  ctx.textAlign = rtl ? "right" : "left";
  setFont(fontSize);

  const startX = rtl ? x + w - pad : x + pad;
  let cy = y + pad;

  // okunabilirlik için hafif stroke
  ctx.lineWidth = Math.max(1, Math.floor(fontSize * 0.08));
  ctx.strokeStyle = "rgba(255,255,255,0.60)";

  for (const ln of lines) {
    ctx.strokeText(ln, startX, cy);
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

/* ---------- yeni: blur + feather dolgu + ortalama renk ---------- */

function blurPatch(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  radiusPx: number
) {
  const tmp = document.createElement("canvas");
  tmp.width = Math.max(1, Math.round(sw));
  tmp.height = Math.max(1, Math.round(sh));
  const tctx = tmp.getContext("2d") as CanvasRenderingContext2D;

  tctx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, tmp.width, tmp.height);
  (tctx as any).filter = `blur(${radiusPx}px)`;
  tctx.drawImage(tmp, 0, 0);
  ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, sx, sy, sw, sh);
}

function avgColor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  step = 4
) {
  const data = ctx.getImageData(x, y, w, h).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let j = 0; j < h; j += step) {
    for (let i = 0; i < w; i += step) {
      const idx = ((j * w) + i) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      n++;
    }
  }
  if (n === 0) return { r: 255, g: 255, b: 255 };
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

function featherFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  col: { r: number; g: number; b: number },
  alphaCenter = 0.32,
  feather = 12
) {
  const rgb = (a: number) => `rgba(${col.r},${col.g},${col.b},${a})`;
  ctx.save();

  // merkez
  ctx.globalAlpha = alphaCenter;
  ctx.fillStyle = rgb(1);
  ctx.fillRect(x, y, w, h);

  // kenarlar (yumuşak geçiş)
  const l = ctx.createLinearGradient(x, y, x + feather, y);
  l.addColorStop(0, rgb(alphaCenter));
  l.addColorStop(1, rgb(0));
  ctx.fillStyle = l;
  ctx.fillRect(x, y, feather, h);

  const r = ctx.createLinearGradient(x + w - feather, y, x + w, y);
  r.addColorStop(0, rgb(0));
  r.addColorStop(1, rgb(alphaCenter));
  ctx.fillStyle = r;
  ctx.fillRect(x + w - feather, y, feather, h);

  const t = ctx.createLinearGradient(x, y, x, y + feather);
  t.addColorStop(0, rgb(alphaCenter));
  t.addColorStop(1, rgb(0));
  ctx.fillStyle = t;
  ctx.fillRect(x, y, w, feather);

  const b = ctx.createLinearGradient(x, y + h - feather, x, y + h);
  b.addColorStop(0, rgb(0));
  b.addColorStop(1, rgb(alphaCenter));
  ctx.fillStyle = b;
  ctx.fillRect(x, y + h - feather, w, feather);

  ctx.restore();
}














