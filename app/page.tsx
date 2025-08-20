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
    const tokens = (data.items || []) as Item[];
    if (!tokens.length) {
      setBusy(false);
      return;
    }

    const srcURL = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      const W = img.width, H = img.height;

      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;

      // beyaz arka plan + kaynak
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0);

      // piksel tarama için data
      const imgData = ctx.getImageData(0, 0, W, H);
      const scan = makeScanHelpers(imgData);

      const medH = median(tokens.map(t => t.h)) || 18;

      // 1) Aynı satırda olan kutuları grupla
      const rows = groupIntoRows(tokens, medH);

      // 2) Her satırı soldan sağa segmentlere birleştir
      const segments: { box: { x:number;y:number;w:number;h:number }, text: string }[] = [];
      for (const row of rows) {
        const merged = mergeNeighbors(row, medH);
        for (const seg of merged) {
          // birleşik kutu + yazı
          const text = seg.items.map(i => clean(i.translated)).join(" ");
          const rough = unionBox(seg.items);
          // kaba -> snap (hücrenin üst/alt çizgisine oturt)
          const base = baseRect(rough, medH, W, H);
          const snapped = snapToCell(scan, base, medH, W, H);
          segments.push({ box: snapped, text });
        }
      }

      // 3) Sil + yaz (RTL destekli)
      for (const s of segments) {
        eraseBox(ctx, expand(s.box, 2, W, H)); // 2px dilate – aksan/dakikaları yakala
        drawFittedText(ctx, chosen, s.text, s.box);
      }

      const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), "image/png"));
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
            {previewName && <div style={{ fontSize: 12, marginTop: 10, opacity: 0.8 }}>{previewName}</div>}
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg" onChange={onPick} style={{ display: "none" }} />

        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <select value={lang} onChange={e => setLang(e.target.value)} style={{ padding: "12px 14px", flex: "0 0 260px" }}>
            {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>

          <button
            onClick={run}
            disabled={!file || busy}
            style={{ background: busy ? "#27272b" : "#fff", color: busy ? "#8b8b92" : "#111114", flex: 1 }}
          >
            {busy ? "Translating…" : "Get translated PNG"}
          </button>
        </div>
      </div>

      {pngURL && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "grid", placeItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pngURL} alt="translated" style={{ maxWidth: "100%", background: "#fff", borderRadius: 8 }} />
          </div>
          <div style={{ display: "grid", placeItems: "center", marginTop: 18 }}>
            <a
              href={pngURL}
              download="translated.png"
              style={{ display: "inline-block", background: "#fff", color: "#111114", padding: "12px 18px", borderRadius: 10, fontWeight: 700, textDecoration: "none" }}
            >
              Download PNG
            </a>
          </div>
        </div>
      )}
    </main>
  );
}

/* ---------------- grouping & geometry ---------------- */

function median(a: number[]) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function clean(s: string) {
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value.replace(/\s+/g, " ").trim();
}

function unionBox(items: { x:number;y:number;w:number;h:number }[]) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const it of items) {
    x1 = Math.min(x1, it.x);
    y1 = Math.min(y1, it.y);
    x2 = Math.max(x2, it.x + it.w);
    y2 = Math.max(y2, it.y + it.h);
  }
  return { x: Math.round(x1), y: Math.round(y1), w: Math.round(x2 - x1), h: Math.round(y2 - y1) };
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

function expand(r:{x:number;y:number;w:number;h:number}, pad:number, W:number, H:number) {
  const x = clamp(r.x - pad, 0, W - 1);
  const y = clamp(r.y - pad, 0, H - 1);
  const w = clamp(r.w + pad*2, 1, W - x);
  const h = clamp(r.h + pad*2, 1, H - y);
  return { x, y, w, h };
}

function baseRect(it:{x:number;y:number;w:number;h:number}, medH:number, W:number, H:number) {
  const hPad = Math.max(4, Math.round(medH*0.8));
  const vPad = Math.max(2, Math.round(medH*0.35));
  const guardH = Math.min(it.h, Math.round(medH*1.15));
  const cx = it.x + it.w/2;
  const cy = it.y + it.h/2;
  const x = clamp(Math.round(it.x - hPad), 0, W-1);
  const y = clamp(Math.round(cy - guardH/2 - vPad), 0, H-1);
  const w = clamp(Math.round(it.w + hPad*2), 1, W - x);
  const h = clamp(Math.round(guardH + vPad*2), 1, H - y);
  return { x, y, w, h };
}

/* --------- row grouping & merge --------- */

function overlapRatio(a1:number, a2:number, b1:number, b2:number) {
  const inter = Math.max(0, Math.min(a2,b2) - Math.max(a1,b1));
  const len = Math.max(1, Math.max(a2-a1, b2-b1));
  return inter / len;
}

function groupIntoRows(tokens: Item[], medH:number) {
  const sorted = [...tokens].sort((a,b) => (a.y + a.h/2) - (b.y + b.h/2));
  const band = Math.max(8, Math.round(medH * 0.9)); // satır bandı
  const rows: Item[][] = [];
  let cur: Item[] = [];
  let cy = -1e9;

  for (const t of sorted) {
    const c = t.y + t.h/2;
    if (!cur.length) { cur.push(t); cy = c; continue; }
    if (Math.abs(c - cy) <= band) {
      cur.push(t);
      cy = (cy* (cur.length-1) + c) / cur.length;
    } else {
      rows.push(cur);
      cur = [t];
      cy = c;
    }
  }
  if (cur.length) rows.push(cur);
  return rows.map(r => r.sort((a,b) => a.x - b.x));
}

function mergeNeighbors(row: Item[], medH:number) {
  const gapThr = Math.max(6, Math.round(medH * 0.9));
  const out: { items: Item[] }[] = [];
  let cur: Item[] = [];

  const pushCur = () => { if (cur.length) out.push({ items:[...cur] }); cur = []; };

  for (let i=0;i<row.length;i++) {
    const t = row[i];
    if (!cur.length) { cur.push(t); continue; }
    const prev = cur[cur.length-1];
    const prevRight = prev.x + prev.w;
    const gap = t.x - prevRight;
    const vOverlap = overlapRatio(prev.y, prev.y+prev.h, t.y, t.y+t.h);

    // yakın & aynı satır -> birleştir
    if (gap <= gapThr && vOverlap > 0.4) {
      cur.push(t);
    } else {
      pushCur();
      cur.push(t);
    }
  }
  pushCur();
  return out;
}

/* -------------- snap & draw -------------- */

function makeScanHelpers(img: ImageData) {
  const { data, width: W, height: H } = img;
  const DARK = 150;

  function isDark(x:number,y:number) {
    if (x<0||y<0||x>=W||y>=H) return false;
    const i = (y*W+x)*4;
    const r=data[i], g=data[i+1], b=data[i+2];
    const gray = (r*299 + g*587 + b*114)/1000;
    return gray < DARK;
  }
  function rowDarkRatio(y:number, x1:number, x2:number) {
    x1 = clamp(Math.floor(x1),0,W-1); x2 = clamp(Math.ceil(x2),0,W-1);
    let hits=0, total=Math.max(1, x2-x1+1);
    for (let x=x1;x<=x2;x++) if (isDark(x,y)) hits++;
    return hits/total;
  }
  function colDarkRatio(x:number, y1:number, y2:number) {
    y1 = clamp(Math.floor(y1),0,H-1); y2 = clamp(Math.ceil(y2),0,H-1);
    let hits=0, total=Math.max(1, y2-y1+1);
    for (let y=y1;y<=y2;y++) if (isDark(x,y)) hits++;
    return hits/total;
  }
  return { rowDarkRatio, colDarkRatio, W, H };
}

function snapToCell(scan: ReturnType<typeof makeScanHelpers>, r:{x:number;y:number;w:number;h:number}, medH:number, W:number, H:number) {
  const LINE_THR = 0.16;
  const MAX_SCAN = Math.round(medH * 2.0);
  const x1 = clamp(r.x+2,0,W-1), x2 = clamp(r.x+r.w-2,0,W-1);
  const cy = r.y + r.h/2;

  // up
  let top=r.y;
  for (let dy=0; dy<MAX_SCAN; dy++){
    const y = Math.round(cy - dy);
    if (y<0) break;
    if (scan.rowDarkRatio(y, x1, x2) > LINE_THR) { top = y+2; break; }
  }
  // down
  let bottom=r.y+r.h;
  for (let dy=0; dy<MAX_SCAN; dy++){
    const y = Math.round(cy + dy);
    if (y>=H) break;
    if (scan.rowDarkRatio(y, x1, x2) > LINE_THR) { bottom = y-2; break; }
  }
  if (bottom > top + 6) { r.y = clamp(top,0,H-1); r.h = clamp(bottom-top,6,H-r.y); }

  // side guards
  const COL_THR = 0.18;
  const y1 = clamp(r.y+2,0,H-1), y2 = clamp(r.y+r.h-2,0,H-1);
  let left=r.x, right=r.x+r.w;

  for (let dx=0; dx<Math.round(medH*1.4); dx++){
    const xL = r.x + dx; if (xL>=right) break;
    if (scan.colDarkRatio(xL, y1, y2) > COL_THR){ left = xL+2; break; }
  }
  for (let dx=0; dx<Math.round(medH*1.4); dx++){
    const xR = r.x + r.w - dx; if (xR<=left) break;
    if (scan.colDarkRatio(xR, y1, y2) > COL_THR){ right = xR-2; break; }
  }
  if (right > left + 8) { r.x = clamp(left,0,W-1); r.w = clamp(right-left,8,W-r.x); }

  const targetH = clamp(Math.round(medH*0.95), 10, Math.round(medH*1.35));
  if (r.h > targetH*1.6) {
    const cy2 = r.y + r.h/2;
    r.h = targetH;
    r.y = clamp(Math.round(cy2 - r.h/2), 0, H - r.h);
  }
  return r;
}

function eraseBox(ctx: CanvasRenderingContext2D, r:{x:number;y:number;w:number;h:number}) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#fff";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // çok küçük artıklar için hafif blur’lü örtme
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = 0.8;
  ctx.fillRect(r.x-0.6, r.y-0.6, r.w+1.2, r.h+1.2);
  ctx.restore();
}

function drawFittedText(
  ctx: CanvasRenderingContext2D,
  lang: { code:string; rtl?:boolean },
  raw: string,
  r: {x:number;y:number;w:number;h:number}
){
  const text = raw.replace(/\s+/g," ").trim();
  if (!text) return;

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
  const y = r.y + r.h/2;
  ctx.fillStyle = "#000";
  ctx.fillText(text, x, y);
}
