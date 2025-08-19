// src/components/ImageTranslator.js
"use client";

import { useMemo, useState } from "react";
import { downloadOverlayPNG } from "@/lib/downloadOverlay";

/**
 * Gerekli props:
 *  - originalImageBase64: "data:image/png;base64,..." (upload sonrası sakladığın data URL)
 *  - translatedBoxes: [{ x, y, w, h, text }]  (text = ÇEVRİLMİŞ METİN)
 *  - originalWidth, originalHeight: orijinal görselin doğal piksel boyutu
 */
export default function ImageTranslator({
  originalImageBase64,
  translatedBoxes,
  originalWidth,
  originalHeight,
  className = "",
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  const disabled = useMemo(
    () =>
      isDownloading ||
      !originalImageBase64 ||
      !Array.isArray(translatedBoxes) ||
      translatedBoxes.length === 0 ||
      !Number.isFinite(originalWidth) ||
      !Number.isFinite(originalHeight),
    [isDownloading, originalImageBase64, translatedBoxes, originalWidth, originalHeight]
  );

  async function handleDownloadOverlay() {
    try {
      setIsDownloading(true);

      // İstemciden yalnızca overlay üretimi için gerekli payload gidiyor.
      await downloadOverlayPNG({
        imageBase64: originalImageBase64,
        boxes: translatedBoxes,
        width: originalWidth,
        height: originalHeight,
        fontPx: 22,
        lineWrap: 30,
        filename: "translated-overlay.png",
      });
    } catch (err) {
      console.error("[overlay] client error:", err);
      alert(`Download PNG failed: ${err?.message || "Overlay generation failed"}`);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className={`flex items-center gap-8 ${className}`}>
      <button
        type="button"
        onClick={handleDownloadOverlay}
        disabled={disabled}
        className={`px-4 py-2 rounded-md border text-sm ${
          disabled ? "opacity-60 cursor-not-allowed" : "hover:opacity-90"
        }`}
        title="Download PNG (overlay)"
      >
        {isDownloading ? "Processing..." : "Download PNG (overlay)"}
      </button>

      <div className="text-xs opacity-70">
        {disabled
          ? "Overlay için veri eksik (görsel, boyutlar, kutular)."
          : "İndirmeye hazır."}
      </div>
    </div>
  );
}


