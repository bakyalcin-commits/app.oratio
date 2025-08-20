// /lib/preprocess.ts
import sharp from "sharp";

export type PreprocessOptions = {
  /** 0–255 global eşik. (Varsayılan: 180) */
  threshold?: number;
  /** Kenar çarpıntılarını azaltmak için hafif blur. (Varsayılan: 0.6) */
  blur?: number;
  /** Çok küçük görselleri daha iyi OCR için büyüt. */
  targetWidth?: number;
  /** Ters renkli taramalar için. */
  invert?: boolean;
};

export type PreprocessResult = {
  buffer: Buffer;
  width: number;
  height: number;
};

/**
 * OCR öncesi basit ama etkili bir pipeline:
 *  - Griye çevir + normalize
 *  - Hafif blur
 *  - Global threshold (binarize)
 *  - Gerekirse büyütme (low-res görüntüler için)
 */
export async function preprocess(
  input: Buffer,
  opts: PreprocessOptions = {}
): Promise<PreprocessResult> {
  const {
    threshold = 180,
    blur = 0.6,
    targetWidth = 2000,
    invert = false,
  } = opts;

  let img = sharp(input, { failOn: "none", unlimited: true });
  const meta = await img.metadata();

  // Düşük çözünürlüklü görselleri OCR için büyüt
  if (meta.width && meta.width < targetWidth) {
    const factor = targetWidth / meta.width;
    const w = Math.round((meta.width ?? 0) * factor);
    const h = Math.round((meta.height ?? 0) * factor);
    img = img.resize(w, h, { kernel: "lanczos3" });
  }

  // Gri + normalize + hafif blur
  img = img.greyscale().normalize();
  if (blur > 0) img = img.blur(blur);

  // Binarize (global threshold)
  img = img.threshold(threshold);

  if (invert) img = img.negate();

  const { data: buffer, info } = await img
    .removeAlpha()
    .png()
    .toBuffer({ resolveWithObject: true });

  return {
    buffer,
    width: info.width,
    height: info.height,
  };
}

