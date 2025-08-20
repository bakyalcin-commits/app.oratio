"use client";

import { useRef, useState } from "react";

const LANGS = [
  { code: "en", label: "English" },
  { code: "tr", label: "Türkçe" },
  { code: "ru", label: "Русский" },
  { code: "ar", label: "العربية" },
  { code: "sr", label: "Српски" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
];

export default function Page() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [lang, setLang] = useState("en");
  const [busy, setBusy] = useState(false);

  async function handleTranslate() {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("lang", lang);
      const res = await fetch("/api/translate", { method: "POST", body: fd });
      if (!res.ok) throw new Error("translate_failed");
      const blob = await res.blob();

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName ? fileName.replace(/\.(png|jpg|jpeg|webp)$/i, "") + "_translated.png" : "translated.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      alert("Çeviri/yerleştirme başarısız oldu. Loglara bak.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center">
      <div className="w-full max-w-3xl px-4 py-8">
        <div className="flex justify-center mb-4">
          <img src="/oratio.png" alt="oratio" className="h-14" />
        </div>
        <h1 className="text-center tracking-[0.2em] text-xl mb-6">MEDICAL TRANSLATOR</h1>

        <label
          className="block rounded-2xl border border-white/10 bg-white/5 p-10 text-center cursor-pointer hover:bg-white/10 transition"
        >
          <div className="mx-auto mb-4">
            <svg width="56" height="44" viewBox="0 0 24 24" fill="currentColor" className="opacity-70">
              <path d="M10 15v-3H7l5-5 5 5h-3v3h-4Zm-4 4q-.825 0-1.412-.587Q4 17.825 4 17v-2h2v2h12v-2h2v2q0 .825-.588 1.413Q18.825 19 18 19Z"/>
            </svg>
          </div>
          <div className="text-lg">Upload medical document</div>
          <div className="text-xs mt-2 opacity-60">Allowed formats: PNG, JPG</div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setFileName(f?.name ?? "");
            }}
          />
        </label>

        <div className="mt-4">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3"
          >
            {LANGS.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleTranslate}
          disabled={busy || !fileRef.current?.files?.[0]}
          className="w-full mt-6 rounded-xl bg-white text-black font-semibold py-3 disabled:opacity-40"
        >
          {busy ? "Processing…" : "Get translated PNG"}
        </button>

        {fileName ? (
          <div className="mt-2 text-center text-xs opacity-70">{fileName}</div>
        ) : null}
      </div>
    </div>
  );
}

