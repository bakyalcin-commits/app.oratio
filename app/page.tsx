'use client';

import Image from "next/image";
import { useRef, useState } from "react";

const LANGS = ["English","Türkçe","Русский","العربية","Српски","Deutsch","Español","Français","Italiano"] as const;

export default function Page() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState<(typeof LANGS)[number]>("English");

  return (
    <div className="container">
      <header className="header">
        <Image src="/oratio.png" alt="oratio" width={240} height={72} className="logo" priority />
        <div className="subtitle">MEDICAL TRANSLATOR</div>
      </header>

      <div className="card" onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{e.preventDefault(); const f=e.dataTransfer.files?.[0]; if(f) setFile(f);}} onClick={()=>inputRef.current?.click()}>
        <div className="folder" />
        <div className="hint">Upload medical document</div>
        <div className="formats">Allowed formats: PNG, JPG, PDF</div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,application/pdf" className="hidden" onChange={(e)=>setFile(e.target.files?.[0]||null)} />
      </div>

      <div className="row">
        <select className="select" value={lang} onChange={(e)=>setLang(e.target.value as any)}>
          {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <button className="button" disabled={!file} onClick={()=>alert("Server endpoint eklendiğinde burada çağrı olacak.")}>
          Translate to PNG
        </button>
        <div className="center">{file ? file.name : "No file selected"}</div>
      </div>
    </div>
  );
}
