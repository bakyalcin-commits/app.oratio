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
  const [txt, setTxt] = useState<string>("");

  const pick = (f?: File) => { if (!f) return; setFile(f); setTxt(""); };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); };

  const run = async () => {
    if (!file) return;
    setBusy(true); setTxt("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("targetLang", lang);
      const res = await fetch("/api/translate", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const out = await res.text();
      setTxt(out);
    } catch (e:any) {
      alert("Error: " + e.message);
    } finally { setBusy(false); }
  };

  const downloadTXT = () => {
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "oratio-translation.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------------- PNG OVERLAY ---------------- */

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

  function downloadPNG(sourceFile: File, text: string, language: string) {
    const imgURL = URL.createObjectURL(sourceFile);
    const img = new window.Image(); // kritik: Next <Image> değil, tarayıcı constructor

    img.onload = () => {
      // temel ayarlar
      const dpi = 2;              // daha keskin çıktı
      const pad = 24;             // panel iç boşluk
      const baseFont = 16;        // px
      const lineH = Math.ceil(baseFont * 1.25);
      const font = `${baseFont}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;

      // ölçüm context'i
      const measure = document.createElement("canvas").getContext("2d")!;
      measure.font = font;

      const usableWidth = img.width - pad * 2;
      const allLines = wrapText(measure, text, usableWidth);

      // panel yüksekliği: metne göre 24% ile 50% arasında
      const needed = allLines.length * lineH + pad * 2;
      const minH = Math.round(img.height * 0.24);
      const maxH = Math.round(img.height * 0.50);
      const panelH = Math.max(minH, Math.min(maxH, needed));

      // eğer sığmıyorsa kes ve son satıra … ekle
      const maxLines = Math.floor((panelH - pad * 2) / lineH);
      const lines = allLines.slice(0, Math.max(0, maxLines));
      if (allLines.length > maxLines && lines.length > 0) {
        const last = lines[lines.length - 1];
        // son satıra ellipsis sığdır
        let ell = last + " …";
        while (measure.measureText(ell).width > usableWidth && ell.length > 1) {
          ell = ell.slice(0, -2) + "…";
        }
        lines[lines.length - 1] = ell;
      }

      // tuval: orijinal resim boyunda
      const canvas = document.createElement("canvas");
      canvas.width = img.width * dpi;
      canvas.height = img.height * dpi;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpi, dpi);

      // arka plan: tamamen orijinal görüntü
      ctx.drawImage(img, 0, 0);

      // alt panel (okunabilirlik için opak beyaz)
      const panelY = img.height - panelH;
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.fillRect(0, panelY, img.width, panelH);

      // metin
      ctx.font = font;
      ctx.fillStyle = "#000";
      // RTL dili düzelt
      // @ts-ignore
      ctx.direction = language === "العربية" ? "rtl" : "ltr";

      let x = pad;
      let y = panelY + pad + lineH;
      for (const line of lines) {
        ctx.fillText(line, x, y);
        y += lineH;
      }

      canvas.toBlob((b) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b!);
        a.download = "oratio-translation.png";
        a.click();
        URL.revokeObjectURL(imgURL);
      }, "image/png");
    };

    img.src = imgURL;
  }

  /* ---------------- PNG OVERLAY SON ---------------- */

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

        <button className="button" disabled={!file || busy} onClick={run}>
          {busy ? "Translating…" : "Get translated TXT"}
        </button>

        <div className="small">{file ? file.name : "No file selected"}</div>

        {txt && (
          <>
            <pre className="out">{txt}</pre>
            <button className="button" onClick={downloadTXT}>Download TXT</button>
            <button
              className="button"
              onClick={()=> downloadPNG(file!, txt, lang)}
              style={{marginTop:10}}
            >
              Download PNG
            </button>
          </>
        )}
      </div>
    </div>
  );
}




