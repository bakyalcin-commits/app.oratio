"use client";

import { useState, useMemo } from "react";
import { downloadOverlayPNG } from "@/lib/downloadOverlay";

export default function Page() {
  const [imageBase64, setImageBase64] = useState(null);
  const [imgW, setImgW] = useState(null);
  const [imgH, setImgH] = useState(null);
  const [translatedText, setTranslatedText] = useState("");
  const [boxesJson, setBoxesJson] = useState("");

  // Upload → data URL + natural size
  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      const dataUrl = String(fr.result);
      const img = new Image();
      img.onload = () => {
        setImageBase64(dataUrl);
        setImgW(img.naturalWidth);
        setImgH(img.naturalHeight);
      };
      img.src = dataUrl;
    };
    fr.readAsDataURL(file);
  }

  // Auto-kutu: her satırı alt alta yerleştir
  function makeAutoBoxes(lines, width) {
    const fontPx = 22;
    const gap = 10;
    const pad = 12;
    let y = 40;
    const maxW = Math.max(40, (width || 800) - 80);
    return lines.map(line => {
      const box = { x: 40, y, w: maxW, h: fontPx + pad, text: line };
      y += fontPx + pad + gap;
      return box;
    });
  }

  const disabledOverlay = useMemo(() => {
    return !imageBase64 || !Number.isFinite(imgW) || !Number.isFinite(imgH);
  }, [imageBase64, imgW, imgH]);

  async function handleDownloadAuto() {
    if (disabledOverlay) return alert("Önce görsel yükle.");
    const lines = translatedText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const boxes = makeAutoBoxes(lines, imgW);
    try {
      await downloadOverlayPNG({
        imageBase64, boxes, width: imgW, height: imgH, fontPx: 22, lineWrap: 36
      });
    } catch (e) {
      alert(`Download PNG failed: ${e.message || e}`);
      console.error(e);
    }
  }

  async function handleDownloadFromJson() {
    if (disabledOverlay) return alert("Önce görsel yükle.");
    let boxes = [];
    try {
      boxes = JSON.parse(boxesJson);
      if (!Array.isArray(boxes)) throw new Error("Boxes JSON bir dizi olmalı.");
    } catch (e) {
      return alert("Boxes JSON okunamadı. Geçerli bir JSON dizi gir.");
    }
    try {
      await downloadOverlayPNG({
        imageBase64, boxes, width: imgW, height: imgH, fontPx: 22, lineWrap: 30
      });
    } catch (e) {
      alert(`Download PNG failed: ${e.message || e}`);
      console.error(e);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Oratio Minimal Overlay</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Upload PNG/JPG</label>
          <input type="file" accept="image/png,image/jpeg" onChange={onFile} style={{ display: "block", marginTop: 8 }} />

          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 12, opacity: 0.8 }}>Translated Text (her satır bir kutu)</label>
            <textarea
              value={translatedText}
              onChange={e => setTranslatedText(e.target.value)}
              rows={12}
              style={{ width: "100%", marginTop: 8, background: "#0f1526", color: "#d9e1ff", border: "1px solid #253055", padding: 8 }}
              placeholder="Her satır, resimde bir kutu olarak basılacak..."
            />
            <button type="button" onClick={handleDownloadAuto} disabled={disabledOverlay}
              style={{ marginTop: 8, padding: "8px 12px", background: "#1f2a48", border: "1px solid #2d3b66", borderRadius: 8, color: "#d9e1ff" }}>
              Download PNG (overlay) — Auto from Translated Lines
            </button>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Boxes JSON (opsiyonel)</label>
          <textarea
            value={boxesJson}
            onChange={e => setBoxesJson(e.target.value)}
            rows={16}
            style={{ width: "100%", marginTop: 8, background: "#0f1526", color: "#d9e1ff", border: "1px solid #253055", padding: 8 }}
            placeholder='[{"x":120,"y":80,"w":500,"h":40,"text":"Translated line 1"}, ...]'
          />
          <button type="button" onClick={handleDownloadFromJson} disabled={disabledOverlay}
            style={{ marginTop: 8, padding: "8px 12px", background: "#1f2a48", border: "1px solid #2d3b66", borderRadius: 8, color: "#d9e1ff" }}>
            Download PNG (overlay) — From Boxes JSON
          </button>
        </div>
      </div>

      <div style={{ marginTop: 24, fontSize: 12, opacity: 0.8 }}>
        {imageBase64 && Number.isFinite(imgW) && Number.isFinite(imgH)
          ? <>Image loaded: {imgW} × {imgH}px</>
          : <>No image loaded.</>}
      </div>
    </div>
  );
}
