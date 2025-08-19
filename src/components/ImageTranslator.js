// src/components/ImageTranslator.js
"use client";

import { useState } from "react";
import { downloadOverlayPNG } from "@/lib/downloadOverlay";

/**
 * Bu bileşen, "Download PNG (overlay)" butonunu sunar.
 * Gerekli verileri üst bileşenden props ile alır:
 *  - originalImageBase64: upload edilen orijinal görselin base64'ü ("data:image/png;base64,...")
 *  - translatedBoxes: [{ x, y, w, h, text }]  1px = orijinal görsel pikseli
 *  - originalWidth, originalHeight: orijinal görselin boyutları
 *
 * Not: Eğer bu değerleri hâlihazırda component içinde state olarak tutuyorsan,
 * props kullanmak yerine ilgili state değişkenlerini aşağıdaki handler'da geçirmen yeterli.
 */
export default function ImageTranslator({
  originalImageBase64,
  translatedBoxes,
  originalWidth,
  originalHeight,
  className = "",
}) {
  const [isDownloading, setIsDownloading] = useState(false);

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
        filename: "translated-overlay.png",
      });
    } catch (e) {
      const msg = e?.message || "Overlay generation failed";
      // Burada UI'na uygun bir bildirim de kullanabilirsin
      alert(`Download PNG failed: ${msg}`);
    } finally {
      setIsDownloading(false);
    }
  }

  const disabled =
    isDownloading ||
    !originalImageBase64 ||
    !translatedBoxes ||
    !translatedBoxes.length ||
    !originalWidth ||
    !originalHeight;

  return (
    <div className={`flex items-center gap-8 ${className}`}>
      <button
        type="button"
        onClick={handleDownloadOverlay}
        disabled={disabled}
        className={`px-4 py-2 rounded-md border text-sm
          ${disabled ? "opacity-60 cursor-not-allowed" : "hover:opacity-90"}`}
        title="Download PNG (overlay)"
      >
        {isDownloading ? "Processing..." : "Download PNG (overlay)"}
      </button>

      {/* Durum bilgisi (opsiyonel) */}
      <div className="text-xs opacity-75">
        {disabled
          ? "Overlay için gerekli veri bekleniyor."
          : "İndirmeye hazır."}
      </div>
    </div>
  );
}
