// src/components/ImageTranslator.js
"use client";

import { useState, useMemo } from "react";
import { downloadOverlayPNG } from "@/lib/downloadOverlay";

/**
 * GEREKEN PROPS:
 *  - originalImageBase64: "data:image/png;base64,..." (upload sonrası sakla)
 *  - translatedBoxes: [{ x, y, w, h, text }] -> text ÇEVRİLMİŞ metin olmalı
 *  - originalWidth, originalHeight: orijinal görselin doğal boyutu
 */
export default function ImageTranslator({
  originalImageBase64,
  translatedBoxes,
  originalWidth,
  originalHeight,
  className = "",
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  const disabled = useMemo(() => {
    return (
      isDownloading ||
      !originalImageBase64 ||
      !Array.isArray(translatedBoxes) ||
      translatedBoxes.length === 0 ||
      !Number.isFinite(originalWidth) ||
      !Number.isFinite(originalHeight)
    );
  }, [isDownloading, originalImageBase64, translatedBoxes, originalWidth, originalHeight]);

  async function handleDownloadOverlay() {
    try {
      setIsDownloading(true);

      // Debug: ilk 2 kutuyu logla
      console.debug("[overlay] front boxes sample:", (translatedBoxes || []).slice(0, 2));

      await downloadOverlayPNG({
        imageBase64: originalImageBase64,
        boxes: translatedBoxes,
        width: originalWidth,
        height: originalHeight,
        fontPx: 22,
        lineWrap: 30,
        filename: "translated-overlay.png",
      });
    } catch (e) {
      const msg = e?.message || "Overlay generation failed";
      console.error("[overlay] client error:", msg);
      alert(`Download PNG failed: ${msg}`);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className={`flex items-center gap-8 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={handleDownloadOverlay}
        className={`px-4 py-2 rounded-md border text-sm ${disabled ? "opacity-60 cursor-not-allowed" : "hover:opacity-90"}`}
      >
        {isDownloading ? "Processing..." : "Download PNG (overlay)"}
      </button>

      <div className="text-xs opacity-70">
        {disabled
          ? "Overlay için veri bekleniyor (görsel, boyutlar, kutular)."
          : "İndirmeye hazır."}
      </div>
    </div>
  );
}

