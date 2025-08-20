'use client';

import Image from "next/image";
import { useRef, useState } from "react";

const LANGS = ["English","Türkçe","Русский","العربية","Српски","Deutsch","Español","Français","Italiano"] as const;

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

  const download = () => {
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "oratio-translation.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container">
      <div className="header">
        <Image src="/oratio.png" alt="oratio" width={240} height={72} className="logo" priority />
        <div className="subtitle">MEDICAL TRANSLATOR</div>
      </div>

      <div className="card" onDragOver={(e)=>e.preventDefault()} onDrop={onDrop} onClick={()=>inputRef.current?.click()}>
        <div style={{width:54,height:42,background:"#7f7f7f",borderRadius:6,opacity:.9}} />
        <div className="hint">Upload medical document</div>
        <div className="formats">Allowed formats: PNG, JPG</div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="hidden"
               onChange={(e)=>pick(e.target.files?.[0]||undefined)} />
      </div>

      <div className="row">
        <select className="select" value={lang} onChange={(e)=>setLang(e.target.value as any)}>
          {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <button className="button" disabled={!file || busy} onClick={run}>
          {busy ? "Translating…" : "Get translated TXT"}
        </button>
        <div className="small">{file ? file.name : "No file selected"}</div>
        {txt && <>
          <pre className="out">{txt}</pre>
          <button className="button" onClick={download}>Download TXT</button>
        </>}
      </div>
    </div>
  );
}

