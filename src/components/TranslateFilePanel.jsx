// src/components/TranslateFilePanel.jsx
"use client";

import { useMemo, useState } from "react";
import { downloadOverlayPNG } from "@/lib/downloadOverlay";

/**
 * Props:
 * - originalImageBase64: "data:image/png;base64,..." (upload sonrası data URL)
 * - originalWidth, originalHeight: görselin doğal piksel boyutu
 * - translatedBoxes: [{ x, y, w, h, text }] (text = ÇEVRİLMİŞ metin)
 * - onTranslateFile: Senin mevcut dosya-çeviri akışını çağıran async fn (opsiyonel)
 */
export default function TranslateFilePanel({
  originalImageBase64,
  originalWidth,
  originalHeight,
  translatedBoxes,
  onTranslateFile,
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const overlayDisabled = useMemo(
    () =>
      isDownloading ||
      !originalImageBase64 ||
      !Array.isArray(translatedBoxes) ||
      translatedBoxes.length === 0 ||
      !Number.isFinite(originalWidth) ||
      !Number.isFinite(originalHeight),
    [isDownloading, originalImageBase64, translatedBoxes, originalWidth, originalHeight]
  );

  async function handleTranslateFile() {
    if (!onTranslateFile) return;
    try {
      setIsProcessing(true);
      await onTranslateFile(); // kendi çeviri akışın
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleDownloadOverlay() {
    try {
      setIsDownloading(true);
      await downloadOverlayPNG({
        imageBase64: originalImageBase64,
        boxes: translatedBoxes,
        width: originalWidth,
        height: originalHeight,
        fontPx: 22,
        lineWrap: 30,
      });
    } catch (e) {
      console.error("[overlay] client error:", e);
      alert(`Download PNG failed: ${e?.message || "Overlay generation failed"}`);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex items-center gap-12">
      <button
        type="button"
        onClick={handleTranslateFile}
        disabled={isProcessing || !onTranslateFile}
        className={`px-4 py-2 rounded-md border ${
          isProcessing ? "opacity-60 cursor-not-allowed" : "hover:opacity-90"
        }`}
      >
        {isProcessing ? "Processing..." : "Translate File"}
      </button>

      <button
        type="button"
        onClick={handleDownloadOverlay}
        disabled={overlayDisabled}
        className={`px-4 py-2 rounded-md border ${
          overlayDisabled ? "opacity-60 cursor-not-allowed" : "hover:opacity-90"
        }`}
      >
        {isDownloading ? "Processing..." : "Download PNG (overlay)"}
      </button>
    </div>
  );
}
