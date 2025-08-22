// app/page.tsx
"use client";

import NextImage from "next/image";
import { useRef, useState } from "react";

/* =================== tunable constants =================== */
const PATCH_EXPAND_X = 1.10;     // yatayda kutuyu büyütme
const PATCH_EXPAND_Y = 1.45;     // dikeyde kutuyu büyütme
const EDGE_PAD      = 0.18;      // kutu kenar payı (min %)
const BLUR_RADIUS   = 2 as 2 | 3;// 2 => 3x3, 3 => 5x5
const DARK_LUMA     = 0.60;      // luma < bu ise koyu say
const BLEND_STRENGTH= 0.85;      // koyu pikselleri ortalamaya yaklaştırma

/* =================== languages =================== */
type UiLang =
  | "English" | "Türkçe" | "Русский" | "العربية" | "Српски"
  | "Deutsch" | "Español" | "Français" | "Italiano";

const LANG_CODE: Record<UiLang, string> = {
  English: "en", "Türkçe": "tr", Русский: "ru", العربية: "ar",
  Српски: "sr", Deutsch: "de", Español: "es", Français: "fr", Italiano: "it",
};

type Item = { x:number; y:number; w:number; h:number; text:string; translated:string };

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState<UiLang>("English");
  const [busy, setBusy] = useState(false);
  const [downloadURL, setDownloadURL] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef  = useRef<HTMLInputElement | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f); setDownloadURL(null);
  };
  const openPicker = () => inputRef.current?.click();

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && /^image\/(png|jpe?g)$/.test(f.type)) { setFile(f); setDownloadURL(null); }
  };
  const onDragOver  = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(true);  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(false); };

  async function onTranslatePNG() {
    if (!file) return;
    setBusy(true); setDownloadURL(null);

    try {
      // 1) OCR + translate
      const fd = new FormData();
      fd.append("file", file);
      fd.append("targetLang", lang);
      const res = await fetch("/api/translate", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data: { items: Item[] } = await res.json();
      const items = data.items ?? [];

      // 2) load original
      const imgURL = URL.createObjectURL(file);
      const img = await loadImage(imgURL);

      // 3) canvas
      const SCALE = 3;
      const cw = img.width * SCALE, ch = img.height * SCALE;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      canvas.width = cw; canvas.height = ch;

      ctx.imageSmoothingEnabled = true;
      (ctx as any).imageSmoothingQuality = "high";
      ctx.clearRect(0,0,cw,ch);
      ctx.drawImage(img, 0,0, cw,ch);

      // 4) clean + draw
      const rtl = LANG_CODE[lang] === "ar";
      for (const it of items) {
        const bx = Math.max(0, Math.round(it.x * SCALE));
        const by = Math.max(0, Math.round(it.y * SCALE));
        const bw = Math.max(1, Math.round(it.w * SCALE));
        const bh = Math.max(1, Math.round(it.h * SCALE));

        // daha kontrollü genişletme (şerit oluşmasın)
        const pad = Math.max(4, Math.round(Math.min(bw, bh) * EDGE_PAD));
        const rx  = clamp(Math.round(bx - pad), 0, cw);
        const ry  = clamp(Math.round(by - bh * (PATCH_EXPAND_Y - 1) * 0.55) - pad, 0, ch);
        const rw  = clamp(Math.round(bw * PATCH_EXPAND_X) + pad * 2, 1, cw - rx);
        const rh  = clamp(Math.round(bh * PATCH_EXPAND_Y) + pad * 2, 1, ch - ry);

        // 4.a: sadece koyu pikselleri arka plan ortalamasına yaklaştır (beyaz rect yok)
        cleanPatchSelective(ctx, rx, ry, rw, rh, BLUR_RADIUS, DARK_LUMA, BLEND_STRENGTH);

        // 4.b: çeviri yaz
        const clean = decodeHTMLEntities(it.translated || it.text);
        drawTextInBox(ctx, clean, rx, ry, rw, rh, rtl);
      }

      // 5) export
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
    <main style={{
      minHeight:"100vh", background:"#0b0b0d", color:"#eaeaea",
      display:"flex", flexDirection:"column", alignItems:"center", gap:24, padding:"48px 16px 64px",
    }}>
      <div style={{ width:"100%", maxWidth:880 }}>
        <NextImage src="/oratio.png" alt="oratio" width={592} height={160} priority style={{ height:160, width:"auto" }} />
        <div style={{ marginTop:8, fontSize:28, opacity:0.9 }}>MEDICAL TRANSLATOR</div>
      </div>

      <div style={{
        width:"100%", maxWidth:880, borderRadius:16, background:"#17171b",
        border:"1px solid #2a2a31", padding:28,
      }}>
        <div
          role="button" tabIndex={0} aria-label="Click to upload or drag & drop"
          onClick={openPicker}
          onKeyDown={(e)=> (e.key==="Enter" || e.key===" ") && openPicker()}
          onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
          style={{
            border: dragging ? "2px dashed #7c9cff" : "1px dashed #444",
            transition:"border-color 120ms ease, background 120ms ease",
            background: dragging ? "#20202a" : "transparent",
            borderRadius:12, height:160, display:"grid", placeItems:"center",
            marginBottom:20, cursor:"pointer", userSelect:"none",
          }}
        >
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:22, opacity:0.95 }}>{file ? file.name : "Upload medical document"}</div>
            <div style={{ marginTop:6, fontSize:13, opacity:0.6 }}>Click to upload or drag &amp; drop</div>
          </div>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg" hidden onChange={onFile}/>
        </div>

        <div style={{ opacity:0.7, marginBottom:20 }}>Allowed formats: PNG, JPG</div>

        <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
          <select
            value={lang} onChange={(e)=>setLang(e.target.value as UiLang)}
            style={{
              background:"#101013", color:"#eaeaea", border:"1px solid #2a2a31",
              borderRadius:8, padding:"10px 12px", minWidth:160, outline:"none",
            }}
          >
            {Object.keys(LANG_CODE).map(k => <option key={k} value={k}>{k}</option>)}
          </select>

          <button
            onClick={onTranslatePNG} disabled={!file || busy}
            style={{
              background: file && !busy ? "#fff" : "#2c2c32",
              color: file && !busy ? "#111" : "#888",
              fontWeight:700, borderRadius:10, padding:"10px 16px",
              border:"none", cursor: file && !busy ? "pointer" : "not-allowed",
            }}
          >
            {busy ? "Working..." : "Get translated PNG"}
          </button>

          {downloadURL && (
            <a href={downloadURL} download="translated.png" style={{ marginLeft:8, textDecoration:"underline" }}>
              Download PNG
            </a>
          )}
        </div>
      </div>

      <div style={{ width:"100%", maxWidth:880 }}>
        <canvas ref={canvasRef} style={{ width:"100%", borderRadius:12, background:"#111", border:"1px solid #2a2a31" }}/>
      </div>
    </main>
  );
}

/* =================== helpers =================== */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
function clamp(n:number, min:number, max:number) {
  return Math.min(max, Math.max(min, n));
}
function decodeHTMLEntities(s: string) {
  return s.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

/** — Selective cleaning: blur, sonra koyu pikselleri ortalamaya yaklaştır — */
function cleanPatchSelective(
  ctx: CanvasRenderingContext2D,
  x:number, y:number, w:number, h:number,
  blur: 2 | 3, darkLuma:number, strength:number
) {
  if (w<=0 || h<=0) return;
  // 1) hafif blur
  blurPatch(ctx, x,y,w,h, blur);

  // 2) ortalama renk
  let avg = { r:240, g:240, b:240 };
  try { avg = averageRGB(ctx, x,y,w,h); } catch {}

  // 3) sadece koyu pikselleri avg'ye yaklaştır
  let img: ImageData;
  try { img = ctx.getImageData(x,y,w,h); } catch { return; }
  const d = img.data;
  for (let i=0; i<d.length; i+=4) {
    const r=d[i], g=d[i+1], b=d[i+2];
    const l = (0.2126*r + 0.7152*g + 0.0722*b) / 255; // 0..1
    if (l < darkLuma) {
      d[i]   = r + (avg.r - r) * strength;
      d[i+1] = g + (avg.g - g) * strength;
      d[i+2] = b + (avg.b - b) * strength;
      d[i+3] = 255;
    }
  }
  ctx.putImageData(img, x,y);

  // 4) kenarları yumuşat
  blurPatch(ctx, x,y,w,h, 2);
}

/** Box blur (iki geçiş) */
function blurPatch(ctx: CanvasRenderingContext2D, x:number, y:number, w:number, h:number, radius:2|3=2) {
  let img: ImageData;
  try { img = ctx.getImageData(x,y,w,h); } catch { return; }
  const data = img.data;
  const tmp  = new Uint8ClampedArray(data.length);
  const rw = w|0, rh = h|0;
  const kernel = radius===3 ? 5 : 3, k = Math.floor(kernel/2);

  // horizontal
  for (let j=0;j<rh;j++){
    for (let i=0;i<rw;i++){
      let r=0,g=0,b=0,c=0;
      for (let dx=-k; dx<=k; dx++){
        const ii = clamp(i+dx,0,rw-1);
        const idx = (j*rw+ii)*4; r+=data[idx]; g+=data[idx+1]; b+=data[idx+2]; c++;
      }
      const t = (j*rw+i)*4; tmp[t]=r/c; tmp[t+1]=g/c; tmp[t+2]=b/c; tmp[t+3]=255;
    }
  }
  // vertical
  for (let j=0;j<rh;j++){
    for (let i=0;i<rw;i++){
      let r=0,g=0,b=0,c=0;
      for (let dy=-k; dy<=k; dy++){
        const jj = clamp(j+dy,0,rh-1);
        const idx = (jj*rw+i)*4; r+=tmp[idx]; g+=tmp[idx+1]; b+=tmp[idx+2]; c++;
      }
      const t=(j*rw+i)*4; data[t]=r/c; data[t+1]=g/c; data[t+2]=b/c; data[t+3]=255;
    }
  }
  ctx.putImageData(img, x,y);
}

/** bölgenin ortalama rengi */
function averageRGB(ctx: CanvasRenderingContext2D, x:number,y:number,w:number,h:number){
  const img = ctx.getImageData(x,y,w,h);
  const d = img.data;
  let r=0,g=0,b=0,cnt=0;
  const step = Math.max(1, Math.floor((w*h)/2000));
  for (let i=0;i<d.length;i+=4*step){ r+=d[i]; g+=d[i+1]; b+=d[i+2]; cnt++; }
  return { r: Math.round(r/cnt), g: Math.round(g/cnt), b: Math.round(b/cnt) };
}

/** metni kutuya sığdırıp çizer */
function drawTextInBox(
  ctx: CanvasRenderingContext2D,
  text:string, x:number,y:number,w:number,h:number, rtl:boolean
){
  const pad = Math.max(8, Math.floor(Math.min(w,h)*0.12));
  const lineGap = 1.28;
  const family = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial`;
  const setFont = (s:number)=> (ctx.font=`600 ${s}px ${family}`);

  let fontSize = Math.max(12, Math.floor(h*0.72));
  let lines:string[]=[];
  while (fontSize>=11){
    setFont(fontSize);
    lines = wrapLines(ctx,text,w-pad*2);
    const needH = lines.length*fontSize*lineGap;
    const widest = Math.max(...lines.map(ln=>ctx.measureText(ln).width));
    if (needH<=h-pad*2 && widest<=w-pad*2) break;
    fontSize--;
  }

  ctx.fillStyle="#000";
  ctx.textBaseline="top";
  ctx.textAlign = rtl? "right" : "left";
  setFont(fontSize);

  const startX = rtl ? x+w-pad : x+pad;
  let cy = y+pad;
  for (const ln of lines){
    ctx.fillText(ln, startX, cy);
    cy += fontSize*lineGap;
    if (cy>y+h-pad) break;
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text:string, maxWidth:number){
  const words = text.split(/\s+/).filter(Boolean);
  const out:string[]=[]; let line="";
  for (const w of words){
    const test = line ? line+" "+w : w;
    if (ctx.measureText(test).width <= maxWidth) line=test;
    else {
      if (line) out.push(line);
      if (ctx.measureText(w).width > maxWidth) { out.push(...breakLongWord(ctx,w,maxWidth)); line=""; }
      else line=w;
    }
  }
  if (line) out.push(line);
  return out;
}
function breakLongWord(ctx:CanvasRenderingContext2D, word:string, maxWidth:number){
  let buf=""; const out:string[]=[];
  for (const ch of word){
    const t=buf+ch;
    if (ctx.measureText(t).width<=maxWidth) buf=t;
    else { if (buf) out.push(buf); buf=ch; }
  }
  if (buf) out.push(buf);
  return out;
}
