// app/page.tsx
"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";

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

const RTL_LANGS = new Set<UiLang>(["العربية"]);

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState<UiLang>("English");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---- File helpers ----
  const openPicker = () => inputRef.current?.click();

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && /^image\/(png|jpe?g)$/.test(f.type)) setFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && /^image\/(png|jpe?g)$/.test(f.type)) setFile(f);
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // ---- Main action: call API -> paint PNG -> download ----
  const getTranslatedPNG = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    try {
      // 1) OCR + Translate
      const form = new FormData();
      form.append("file", file);
      form.append("targetLang", targetLang);

      const res = await fetch("/api/translate", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const { items } = await res.json(); // { x,y,w,h,text,translated }[]

      // 2) Draw on canvas
      const imgURL = URL.createObjectURL(file);
      const img = new Image();
      img.src = imgURL;

      await new Promise((ok, err) => {
        img.onload = () => ok(null);
        img.onerror = err;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      const isRTL = RTL_LANGS.has(targetLang);

      for (const l of items as Array<{ x: number; y: number; w: number; h: number; translated: string }>) {
        // Kapama (arka yazıyı sil)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(l.x, l.y, l.w, l.h);

        // Yazı
        const fontPx = Math.max(12, Math.floor(l.h * 0.7));
        ctx.fillStyle = "#000000";
        ctx.font = `600 ${fontPx}px Arial, Helvetica, sans-serif`;
        ctx.textBaseline = "middle";
        ctx.direction = isRTL ? ("rtl" as CanvasDirection) : ("ltr" as CanvasDirection);
        ctx.textAlign = isRTL ? "right" : "left";

        const tx = isRTL ? l.x + l.w - 4 : l.x + 4;
        const ty = l.y + l.h / 2;

        // Basit tek satır yerleşimi (uzunluk taşıyorsa doğal kırpma)
        ctx.fillText(l.translated ?? "", tx, ty, l.w - 8);
      }

      // 3) Download
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "translated.png";
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (e) {
      alert(String(e));
    } finally {
      setLoading(false);
    }
  }, [file, targetLang]);

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Logo */}
        <div className="mb-6">
          <Image
            src="/oratio.png"
            alt="oratio"
            width={148}
            height={40}
            priority
            className="h-10 w-auto"
          />
        </div>

        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">MEDICAL TRANSLATOR</h1>

        {/* Upload card (dropzone) */}
        <section className="mt-8">
          <div
            role="button"
            aria-label="Click to upload or drag & drop"
            tabIndex={0}
            onClick={openPicker}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openPicker()}
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="group flex h-72 w-full cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/[0.03] ring-1 ring-white/5 transition
                       hover:bg-white/[0.06] hover:ring-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <div className="text-center">
              <p className="text-2xl md:text-3xl font-medium text-white">
                {file ? file.name : "Upload medical document"}
              </p>
              <p className="mt-2 text-sm text-white/60">
                Click to upload or drag &amp; drop
              </p>
              <p className="mt-1 text-xs text-white/40">Allowed formats: PNG, JPG</p>
            </div>
            {/* hidden input */}
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={onPick}
            />
          </div>

          {/* Controls */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="text-sm text-white/70">Language</label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value as UiLang)}
              className="w-full sm:w-56 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none
                         focus:ring-2 focus:ring-indigo-400"
            >
              {LANGS.map((l) => (
                <option key={l} value={l} className="bg-black">
                  {l}
                </option>
              ))}
            </select>

            <button
              disabled={!file || loading}
              onClick={getTranslatedPNG}
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-lg bg-white px-4 py-2 font-medium text-black
                         disabled:cursor-not-allowed disabled:opacity-40 hover:bg-white/90 transition"
            >
              {loading ? "Processing…" : "Get translated PNG"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}







