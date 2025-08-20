"use client";

import React, { useMemo, useRef, useState } from "react";

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

const LANGS: UiLang[] = [
  "English",
  "Türkçe",
  "Русский",
  "العربية",
  "Српски",
  "Deutsch",
  "Español",
  "Français",
  "Italiano",
];

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
  const [targetLang, setTargetLang] = useState<UiLang>("English");
  const [busy, setBusy] = useState(false);
  const [outUrl, setOutUrl] = useState<string | null>(null);

  const imgURL = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setOutUrl(null);
  };

  const handleTranslate = async () => {
    if (!file) return;
    setBusy(true);
    setOutUrl(null);

    try {
      // 1) API'ye gönder
      const fd = new FormData();
      fd.append("file", file);
      fd.append("targetLang", targetLang);

      const r = await fetch("/api/translate", { method: "POST", body: fd });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "translate failed");
      }
      const { items }: { items: Item[] } = await r.json();

      // 2) Görseli yükle
      const img = await loadImage(URL.createObjectURL(file));

      // 3) Kanvas oluştur
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 4) Kutu üstünü sil + çeviriyi yaz
      const isRTL = targetLang === "العربية";
      ctx.direction = (isRTL ? "rtl" : "ltr") as CanvasDirection; // << düzeltildi
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#000";

      for (const it of items) {
        const pad = Math.max(2, Math.floor(it.h * 0.15));
        // altındaki yazıyı kapat
        ctx.fillStyle = "rgba(255,255,255,0.98)";
        ctx.fillRect(it.x - pad, it.y - pad, it.w + pad * 2, it.h + pad * 2);

        // font boyu satır yüksekliğine göre
        const fontPx = clamp(Math.floor(it.h * 0.8), 10, 48);
        ctx.font = `${fontPx}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;

        // hizalama
        ctx.textAlign = isRTL ? "right" : "left";
        ctx.fillStyle = "#000";

        // yazı konumu
        const tx = isRTL ? it.x + it.w - pad : it.x + pad;
        const ty = it.y + it.h / 2;

        // çok uzun satırlarda ufak küçültme
        const text = decodeHtml(it.translated || it.text);
        const maxWidth = it.w - pad * 2;
        const fitted = fitText(ctx, text, maxWidth);
        ctx.fillText(fitted, tx, ty, maxWidth);
      }

      setOutUrl(canvas.toDataURL("image/png"));
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDownload = () => {
    if (!outUrl) return;
    const a = document.createElement("a");
    a.href = outUrl;
    a.download = "translated.png";
    a.click();
  };

  return (
    <main className="min-h-screen bg-neutral-900 text-white px-4 py-8 flex flex-col items-center gap-6">
      <h1 className="text-5xl font-extrabold tracking-tight">oratio</h1>
      <h2 className="text-xl opacity-80">MEDICAL TRANSLATOR</h2>

      {/* upload kartı */}
      <label className="w-full max-w-3xl rounded-2xl bg-neutral-800/60 border border-neutral-700/60 p-10 flex flex-col items-center gap-3 cursor-pointer hover:bg-neutral-800 transition">
        <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={onPick} />
        <div className="text-2xl opacity-90">Upload medical document</div>
        <div className="text-sm opacity-60">Allowed formats: PNG, JPG</div>
        {file && <div className="text-xs mt-2 opacity-60">{file.name}</div>}
      </label>

      {/* dil seçimi */}
      <div className="w-full max-w-3xl">
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value as UiLang)}
          className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-4"
        >
          {LANGS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {/* işleme butonu */}
      <button
        onClick={handleTranslate}
        disabled={!file || busy}
        className="w-full max-w-3xl rounded-xl bg-white text-black py-3 font-semibold disabled:opacity-50"
      >
        {busy ? "Processing…" : "Get translated PNG"}
      </button>

      {/* çıktı önizleme & indirme */}
      {outUrl && (
        <>
          <div className="w-full max-w-3xl rounded-xl overflow-hidden bg-black/30 border border-neutral-700">
            {/* büyük görseli sayfayı taşırmasın diye container içinde tutuyoruz */}
            <img src={outUrl} alt="translated" className="w-full h-auto block" />
          </div>
          <button
            onClick={onDownload}
            className="w-full max-w-3xl rounded-xl bg-white text-black py-3 font-semibold"
          >
            Download PNG
          </button>
        </>
      )}
    </main>
  );
}

/* ---------------- helpers ---------------- */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// HTML entity'leri çözer (Çeviri API sıklıkla &amp; vb. döndürebilir)
function decodeHtml(s: string) {
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value;
}

// Çok uzun satırı kutuya sığdırmak için basit kısaltma
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const t = text.slice(0, mid) + "…";
    if (ctx.measureText(t).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + "…";
}




