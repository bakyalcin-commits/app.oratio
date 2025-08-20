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

  const runPNG = async () => {
    if (!file) return;
    setBusy(true); setPngURL(null);
    try {
      // 1) çeviri
      const form = new FormData();
      form.append("file", file);
      form.append("targetLang", lang);
      const res = await fetch("/api/translate", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const translated = await res.text();

      // 2) overlay PNG üret
      const blob = await makeOverlayPNG(file, translated, lang);
      const url = URL.createObjectURL(blob);
      setPngURL(url);
    } catch (e:any) {
      alert("Error: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  // -------- PNG OVERLAY --------
  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxWidth) {
        if (line) lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function makeOverlayPNG(sourceFile: File, text: string, language: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const imgURL = URL.createObjectURL(sourceFile);
      const img = new window.Image();

      img.onload = () => {
        const dpi = 2;
        const pad = 24;
        const baseFont = 16;
        const lineH = Math.ceil(baseFont * 1.25);
        const font = `${baseFont}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;

        const m = document.createElement("canvas").getContext("2d")!;
        m.font = font;

        const usableWidth = img.width - pad * 2;
        const allLines = wrapText(m, text, usableWidth);

        const needed = allLines.length * lineH + pad * 2;
        const minH = Math.round(img.height * 0.24);
        const maxH = Math.round(img.height * 0.50);
        const panelH = Math.max(minH, Math.min(maxH, needed));

        const maxLines = Math.floor((panelH - pad * 2) / lineH);
        const lines = allLines.slice(0, Math.max(0, maxLines));
        if (allLines.length > maxLines && lines.length > 0) {
          let last = lines[lines.length - 1] + " …";
          while (m.measureText(last).width > usableWidth && last.length > 1) {
            last = last.slice(0, -2) + "…";
          }
          lines[lines.length - 1] = last;
        }

        const canvas = document.createElement("canvas");
        canvas.width = img.width * dpi;
        canvas.height = img.height * dpi;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(dpi, dpi);

        ctx.drawImage(img, 0, 0);

        const panelY = img.height - panelH;
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.fillRect(0, panelY, img.width, panelH);

        ctx.font = font;
        ctx.fillStyle = "#000";
        // @ts-ignore
        ctx.direction = language === "العربية" ? "rtl" : "ltr";

        let x = pad;
        let y = panelY + pad + lineH;
        for (const line of lines) {
          ctx.fillText(line, x, y);
          y += lineH;
        }

        canvas.toBlob((b) => {
          if (!b) return reject(new Error("PNG encode failed"));
          URL.revokeObjectURL(imgURL);
          resolve(b);
        }, "image/png");
      };

      img.onerror = () => reject(new Error("Image load failed"));
      img.src = imgURL;
    });
  }
  // -------- PNG OVERLAY SON --------

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

        <button className="button" disabled={!file || busy} onClick={runPNG}>
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





