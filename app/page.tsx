'use client';

import Image from "next/image";
import { useRef, useState } from "react";

const LANGS = ["English","Türkçe","Русский","العربية","Српски","Deutsch","Español","Français","Italiano"] as const;

export default function Page() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState<(typeof LANGS)[number]>("English");
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = (f?: File) => {
    if (!f) return;
    setFile(f);
    setOutUrl(null);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) pick(f);
  };

  const translate = async () => {
    if (!file) return;
    setBusy(true);
    setOutUrl(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("targetLang", lang);
      const res = await fetch("/api/translate", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      setOutUrl(URL.createObjectURL(blob));
    } catch (e:any) {
      alert("Translation error: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!outUrl) return;
    const a = document.createElement("a");
    a.href = outUrl;
    a.download = "oratio-translated.png";
    a.click();
  };

  return (
    <div className="container">
      <header className="header">
        <Image src="/oratio.png" alt="oratio" width={240} height={72} className="logo" priority />
        <div className="subtitle">MEDICAL TRANSLATOR</div>
      </header>

      <div
        className="card"
        onDragOver={(e)=>e.preventDefault()}
        onDrop={onDrop}
        onClick={()=>inputRef.current?.click()}
      >
        <div className="folder" />
        <div className="hint">Upload medical document</div>
        <div className="formats">Allowed formats: PNG, JPG, PDF</div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,application/pdf"
          className="hidden"
          onChange={(e)=>pick(e.target.files?.[0]||undefined)}
        />
      </div>

      <div className="row">
        <select className="select" value={lang} onChange={(e)=>setLang(e.target.value as any)}>
          {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <div className="actions">
          <button className="button" disabled={!file || busy} onClick={translate}>
            {busy ? "Translating…" : "Translate to PNG"}
          </button>
          <button className="secondary" disabled={!outUrl} onClick={download}>Download PNG</button>
        </div>
        <div className="center">{file ? file.name : "No file selected"}</div>
      </div>

      <div className="preview">
        {outUrl && <img src={outUrl} alt="translated" />}
      </div>
    </div>
  );
}
