'use client';

import NextImage from "next/image";
import { useRef, useState } from "react";

const LANGS = [
  "English","Türkçe","Русский","العربية","Српски","Deutsch","Español","Français","Italiano"
] as const;

export default function Page() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState<(typeof LANGS)[number]>("English");
  const [busy, setBusy] = useState(false);
  const [pngURL, setPngURL] = useState<string | null>(null);

  const pick = (f?: File) => { if (!f) return; setFile(f); setPngURL(null); };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); };

  const getTranslatedPNG = async () => {
    if (!file) return;
    setBusy(true); setPngURL(null);

    try {
      // 1) OCR + bbox + çeviri
      const form = new FormData();
      form.append("file", file);
      form.append("targetLang", lang);
      const j = await fetch("/api/translate", { method: "POST", body: form }).then(r => r.json());

      // 2) Görüntüyü yükle
      const srcURL = URL.createObjectURL(file);
      const img = new Image();
      img.onload = async () => {
        const dpi = 2;
        const canvas = document.createElement("canvas");
        canvas.width = img.width * dpi;
        canvas.height = img.height * dpi;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(dpi, dpi);
        ctx.drawImage(img, 0, 0);

        // RTL yönü
        // @ts-ignore
        ctx.direction = lang === "العربية" ? "rtl" : "ltr";
        ctx.textBaseline = "top";

        for (const it of (j.items as any[])) {
          // 2.1 alanı beyazla kapat
          const pad = Math.max(2, Math.round(Math.min(it.h, it.w) * 0.06));
          ctx.fillStyle = "rgba(255,255,255,0.98)";
          ctx.fillRect(it.x - pad, it.y - pad, it.w + pad * 2, it.h + pad * 2);

          // 2.2 yazıyı kutuya sığdır
          fitTextInBox(ctx, it.translated, it.x, it.y, it.w, it.h, lang === "العربية");
        }

        const blob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), "image/png")
        );
        const url = URL.createObjectURL(blob);
        setPngURL(url);
        URL.revokeObjectURL(srcURL);
      };
      img.src = srcURL;
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <NextImage src="/oratio.png" alt="oratio" width={240} height={72} className="logo" priority />
        <div className="subtitle">MEDICAL TRANSLATOR</div>
      </div>

      <div
        className="card"
        onDragOver={(e)=>e.preventDefault()}
        onDrop={onDrop}
        onClick={()=>inputRef.current?.click()}
      >
        <div style={{width:54,height:42,background:"#7f7f7f",borderRadius:6,opacity:.9}} />
        <div className="hint">Upload medical document</div>
        <div className="formats">Allowed formats: PNG, JPG</div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e)=>pick(e.target.files?.[0]||undefined)}
        />
      </div>

      <div className="row">
        <select className="select" value={lang} onChange={(e)=>setLang(e.target.value as any)}>
          {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <button className="button" disabled={!file || busy} onClick={getTranslatedPNG}>
          {busy ? "Processing…" : "Get translated PNG"}
        </button>

        <div className="small">{file ? file.name : "No file selected"}</div>

        {pngURL && (
          <button
            className="button"
            onClick={()=>{
              const a = document.createElement("a");
              a.href = pngURL;
              a.download = "oratio-translation.png";
              a.click();
            }}
            style={{marginTop:10}}
          >
            Download PNG
          </button>
        )}
      </div>
    </div>
  );
}

/* ------- yardımcı çizim ------- */
function fitTextInBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number, w: number, h: number,
  rtl: boolean
) {
  const family = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  let size = Math.max(10, Math.floor(Math.min(w, h) * 0.22)); // başlangıç tahmini
  const pad = 4;

  for (; size >= 8; size--) {
    ctx.font = `${size}px ${family}`;
    const lineH = Math.ceil(size * 1.2);
    const lines = wrapText(ctx, decodeHtml(text), w - pad * 2);
    const needed = lines.length * lineH;
    if (needed <= h - pad * 2) {
      ctx.fillStyle = "#000";
      let yy = y + pad;
      const xx = rtl ? x + w - pad : x + pad;
      for (const ln of lines) {
        if (rtl) {
          const width = ctx.measureText(ln).width;
          ctx.fillText(ln, xx - width, yy);
        } else {
          ctx.fillText(ln, xx, yy);
        }
        yy += lineH;
      }
      return;
    }
  }

  // Olmadıysa en küçük boyda tek satır kısalt
  size = 8; ctx.font = `${size}px ${family}`;
  const ell = ellipsize(ctx, decodeHtml(text), w - pad * 2);
  ctx.fillText(ell, x + pad, y + pad);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW) {
      if (line) lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  let t = text;
  while (ctx.measureText(t + "…").width > maxW && t.length > 1) t = t.slice(0, -1);
  return t + "…";
}
function decodeHtml(s: string) {
  // Google Translate v2 bazen HTML entity döndürür
  const el = document.createElement("textarea"); el.innerHTML = s;
  return el.value;
}






