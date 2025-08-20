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

    // kaynak görseli yükle
    const srcURL = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = async () => {
      const W = img.width;
      const H = img.height;

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;

      // 1) arka plan + orijinal
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0);

      // 2) çizgi bulma için binarize data
      const imgData = ctx.getImageData(0, 0, W, H);
      const reader = makeScanHelpers(imgData);

      const items = (data.items || []) as Item[];
      if (!items.length) {
        setBusy(false);
        return;
      }

      // medyan yükseklik
      const medH = median(items.map((i) => i.h)) || 18;

      for (const it of items) {
        // kaba kutu
        const base = baseRect(it, medH, W, H);
        // çizgilere snap
        const snapped = snapToCell(reader, base, medH, W, H);
        // önce sil
        eraseBox(ctx, snapped);
        // sonra yaz
        drawFittedText(ctx, chosen, it.translated, snapped);
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
            onChange={(e) => setLang(e.target.value)}
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

/* ---------------- helpers ---------------- */

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

/** kaba kutu (hafif yatay geniş, dikey dar) */
function baseRect(it: { x: number; y: number; w: number; h: number }, medH: number, W: number, H: number): Rect {
  const hPad = Math.max(4, Math.round(medH * 0.8));
  const vPad = Math.max(2, Math.round(medH * 0.35));
  const guardH = Math.min(it.h, Math.round(medH * 1.15));
  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2;

  const x = clamp(Math.round(it.x - hPad), 0, W - 1);
  const y = clamp(Math.round(cy - guardH / 2 - vPad), 0, H - 1);
  const w = clamp(Math.round(it.w + hPad * 2), 1, W - x);
  const h = clamp(Math.round(guardH + vPad * 2), 1, H - y);

  return { x, y, w, h };
}

/** Canvas üzerindeki piksel okumaları için yardımcılar */
function makeScanHelpers(img: ImageData) {
  const { data, width: W, height: H } = img;

  // gri < TH => “koyu” kabul et
  const DARK = 150;

  function isDarkPixel(x: number, y: number) {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const i = (y * W + x) * 4;
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const gray = (r * 299 + g * 587 + b * 114) / 1000;
    return gray < DARK;
  }

  function rowDarkRatio(y: number, x1: number, x2: number) {
    x1 = clamp(Math.floor(x1), 0, W - 1);
    x2 = clamp(Math.ceil(x2), 0, W - 1);
    let hits = 0,
      total = Math.max(1, x2 - x1 + 1);
    for (let x = x1; x <= x2; x++) if (isDarkPixel(x, y)) hits++;
    return hits / total;
  }

  function colDarkRatio(x: number, y1: number, y2: number) {
    y1 = clamp(Math.floor(y1), 0, H - 1);
    y2 = clamp(Math.ceil(y2), 0, H - 1);
    let hits = 0,
      total = Math.max(1, y2 - y1 + 1);
    for (let y = y1; y <= y2; y++) if (isDarkPixel(x, y)) hits++;
    return hits / total;
  }

  return { rowDarkRatio, colDarkRatio, W, H };
}

/** kutuyu hücrenin üst/alt çizgisine oturt */
function snapToCell(
  scan: ReturnType<typeof makeScanHelpers>,
  r: Rect,
  medH: number,
  W: number,
  H: number
): Rect {
  const LINE_THR = 0.18; // bir satırda bu orandan fazla koyu piksel varsa “çizgi”
  const MAX_SCAN = Math.round(medH * 2.2); // merkezden en fazla bu kadar uzağa bak
  const x1 = clamp(r.x + 2, 0, W - 1);
  const x2 = clamp(r.x + r.w - 2, 0, W - 1);
  const cy = r.y + r.h / 2;

  // yukarı doğru en yakın yatay çizgi
  let top = r.y;
  for (let dy = 0; dy < MAX_SCAN; dy++) {
    const y = Math.round(cy - dy);
    if (y < 0) break;
    if (scan.rowDarkRatio(y, x1, x2) > LINE_THR) {
      top = y + 2; // çizginin hemen altı
      break;
    }
  }

  // aşağı doğru en yakın yatay çizgi
  let bottom = r.y + r.h;
  for (let dy = 0; dy < MAX_SCAN; dy++) {
    const y = Math.round(cy + dy);
    if (y >= H) break;
    if (scan.rowDarkRatio(y, x1, x2) > LINE_THR) {
      bottom = y - 2; // çizginin hemen üstü
      break;
    }
  }

  // eğer alt-üst mantıklıysa kullan
  if (bottom > top + 6) {
    r.y = clamp(top, 0, H - 1);
    r.h = clamp(bottom - top, 6, H - r.y);
  }

  // dikey çerçevelere dokunmamak için hafif içeri çek
  const COL_THR = 0.20;
  let left = r.x,
    right = r.x + r.w;
  const y1 = clamp(r.y + 2, 0, H - 1);
  const y2 = clamp(r.y + r.h - 2, 0, H - 1);

  for (let dx = 0; dx < Math.round(medH * 1.5); dx++) {
    const xL = r.x + dx;
    if (xL >= right) break;
    if (scan.colDarkRatio(xL, y1, y2) > COL_THR) {
      left = xL + 2;
      break;
    }
  }
  for (let dx = 0; dx < Math.round(medH * 1.5); dx++) {
    const xR = r.x + r.w - dx;
    if (xR <= left) break;
    if (scan.colDarkRatio(xR, y1, y2) > COL_THR) {
      right = xR - 2;
      break;
    }
  }

  if (right > left + 8) {
    r.x = clamp(left, 0, W - 1);
    r.w = clamp(right - left, 8, W - r.x);
  }

  // son bir güvenlik: çok alçak/yüksekse normalize et
  const targetH = clamp(Math.round(medH * 0.95), 10, Math.round(medH * 1.35));
  if (r.h > targetH * 1.6) {
    const cy2 = r.y + r.h / 2;
    r.h = targetH;
    r.y = clamp(Math.round(cy2 - r.h / 2), 0, H - r.h);
  }

  return r;
}

/** silme: iki kat beyaz + hafif blur ile tırtıkları yutar */
function eraseBox(ctx: CanvasRenderingContext2D, r: Rect) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 0.7;
  ctx.fillRect(r.x - 0.5, r.y - 0.5, r.w + 1, r.h + 1);
  ctx.shadowBlur = 0;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

/** yazıyı kutuya sığdırıp ortalar (RTL destekli) */
function drawFittedText(
  ctx: CanvasRenderingContext2D,
  lang: { code: string; rtl?: boolean },
  raw: string,
  r: Rect
) {
  const text = decodeHtml(raw).replace(/\s+/g, " ").trim();
  const family = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const maxW = Math.max(24, r.w - 8);
  const targetH = Math.max(10, Math.floor(r.h * 0.78));

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











