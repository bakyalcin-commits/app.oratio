"use client";

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

const UI_LANGS: UiLang[] = [
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

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState<UiLang>("English");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenLinkRef = useRef<HTMLAnchorElement>(null);

  async function onTranslatePNG() {
    if (!file) {
      alert("Önce bir PNG/JPG yükleyin.");
      return;
    }
    setBusy(true);
    setStatus("OCR + Çeviri çalışıyor…");

    try {
      // 1) API'ye gönder
      const fd = new FormData();
      fd.append("file", file);
      fd.append("targetLang", targetLang);

      const res = await fetch("/api/translate", { method: "POST", body: fd });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "API error");
      }
      const data = (await res.json()) as {
        items: { x: number; y: number; w: number; h: number; text: string; translated: string }[];
      };

      setStatus("Çizim hazırlanıyor…");

      // 2) Görseli canvasa çiz
      const imgBitmap = await createImageBitmap(file);
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;

      // gerçek piksel boyutunda çalış
      canvas.width = imgBitmap.width;
      canvas.height = imgBitmap.height;

      // beyaz arkaplan + orijinal görüntü
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgBitmap, 0, 0);

      // hedef dile göre yön/align
      const isRTL = targetLang === "العربية";
      ctx.direction = isRTL ? ("rtl" as CanvasDirection) : ("ltr" as CanvasDirection));
      ctx.textAlign = isRTL ? "right" : "left";
      ctx.textBaseline = "middle";

      // 3) Her satır kutusunu biraz büyütüp (padding) “beyaz bant” çek, ardından çeviri yaz
      const PADDING = 4; // px
      const MIN_FONT = 10;
      const MAX_FONT = 22;

      for (const it of data.items ?? []) {
        const x = Math.max(0, it.x - PADDING);
        const y = Math.max(0, it.y - PADDING);
        const w = Math.min(canvas.width - x, it.w + 2 * PADDING);
        const h = Math.min(canvas.height - y, it.h + 2 * PADDING);

        // orijinal metni kapat
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, w, h);

        // kutuya sığacak font boyu bul
        let fontPx = Math.min(MAX_FONT, Math.max(MIN_FONT, Math.floor(h * 0.75)));
        ctx.fillStyle = "#000000";
        while (fontPx > MIN_FONT) {
          ctx.font = `600 ${fontPx}px Arial, Helvetica, sans-serif`;
          const textWidth = ctx.measureText(it.translated).width;
          if (textWidth <= w * 0.98) break;
          fontPx -= 1;
        }
        ctx.font = `600 ${fontPx}px Arial, Helvetica, sans-serif`;

        // metni yaz (soldan-sağa veya sağdan-sola)
        const cx = isRTL ? x + w - PADDING : x + PADDING;
        const cy = y + h / 2;
        ctx.fillText(it.translated, cx, cy);
      }

      setStatus("Bitti. “Download PNG” ile indirebilirsiniz.");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || String(e));
      setStatus("Hata!");
    } finally {
      setBusy(false);
    }
  }

  function onDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = hiddenLinkRef.current!;
    a.href = url;
    a.download = "translated.png";
    a.click();
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center gap-6 py-10">
      <h1 className="text-4xl font-semibold">oratio</h1>
      <p className="opacity-80">MEDICAL TRANSLATOR</p>

      <div className="w-[min(900px,92vw)] flex flex-col gap-4">
        <label className="block rounded-xl border border-white/10 bg-white/5 p-6 text-center cursor-pointer">
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <span className="opacity-90">{file.name}</span>
          ) : (
            <span className="opacity-70">Upload medical document (PNG / JPG)</span>
          )}
        </label>

        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value as UiLang)}
          className="bg-white/10 border border-white/10 rounded-lg p-3"
        >
          {UI_LANGS.map((l) => (
            <option value={l} key={l}>
              {l}
            </option>
          ))}
        </select>

        <button
          onClick={onTranslatePNG}
          disabled={busy || !file}
          className="rounded-lg bg-white text-black py-3 font-medium disabled:opacity-50"
        >
          {busy ? "Processing…" : "Get Translated PNG"}
        </button>

        <span className="text-sm opacity-70">{status}</span>

        <canvas ref={canvasRef} className="w-full rounded-lg bg-white" />

        <button
          onClick={onDownload}
          className="rounded-lg border border-white/20 py-3 font-medium"
        >
          Download PNG
        </button>

        <a ref={hiddenLinkRef} className="hidden" />
      </div>
    </main>
  );
}



