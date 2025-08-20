"use client";
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
      const form = new FormData();
      form.append("file", file);
      form.append("targetLang", lang);

      // 1) bbox + çeviri
      const { items } = await fetch("/api/translate", { method: "POST", body: form }).then(r => r.json());

      // 2) kaynağı yükle
      const srcURL = URL.createObjectURL(file);
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, 0, 0);

        // opak beyaz, çizgiler görünmeye devam etsin diye sadece satır yüksekliği kadar kaplıyoruz
        ctx.globalCompositeOperation = "source-over";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        for (const it of items as any[]) {
          const pad = Math.max(1, Math.round(Math.min(it.h, 20) * 0.25)); // ince şerit
          const x = it.x + 1;
          const y = it.y + 1;
          const w = it.w - 2;
          const h = it.h - 2;

          // alanı temizle
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x, y, w, h);

          // tek satır sığdır
          const rtl = lang === "العربية";
          ctx.textAlign = rtl ? "right" : "left";
          fitSingleLine(ctx, decodeHtml(it.translated), rtl ? x + w - pad : x + pad, y + h / 2, w - pad * 2, rtl);
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

/* ---- metni tek satıra sığdır ---- */
function fitSingleLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, cy: number, maxW: number, rtl: boolean
) {
  const family = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  // yükseklikten başla, genişliğe göre küçült
  let size = Math.max(10, Math.min(24, Math.floor(maxW * 0.08)));
  for (; size >= 8; size--) {
    ctx.font = `${size}px ${family}`;
    const w = ctx.measureText(text).width;
    if (w <= maxW) {
      ctx.fillStyle = "#000";
      if (rtl) ctx.fillText(text, x, cy);
      else ctx.fillText(text, x, cy);
      return;
    }
  }
  // sığmazsa kısalt
  size = 8; ctx.font = `${size}px ${family}`;
  const ell = ellipsize(ctx, text, maxW);
  ctx.fillStyle = "#000";
  ctx.fillText(ell, x, cy);
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  let t = text;
  while (ctx.measureText(t + "…").width > maxW && t.length > 1) t = t.slice(0, -1);
  return t + "…";
}

function decodeHtml(s: string) {
  const el = document.createElement("textarea"); el.innerHTML = s;
  return el.value;
}


