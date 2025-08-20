// /lib/preprocess.ts
import sharp from "sharp";

/**
 * OCR öncesi basit ama etkili bir pipeline:
 * - 300dpi eşdeğeri ölçekleme (en uzun kenarı 2500px civarı)
 * - gri tonlama + normalize
 * - hafif kontrast (linear) + median blur ile gürültü azaltma
 * - adaptif threshold benzeri (threshold + levels)
 * - beyaz arka planı garanti etme
 */
export async function preprocessForOCR(input: Buffer): Promise<Buffer> {
  const base = sharp(input, { failOn: "none", limitInputPixels: false })
    .rotate() // EXIF'e göre
    .resize({ width: 2500, withoutEnlargement: false }) // küçük görselleri büyütmek OCR'a yarar
    .grayscale()
    .normalize()
    .median(1)
    .linear(1.1, -5) // hafif kontrast
    .threshold(180); // yazıları belirginleştir

  // PNG çıktıyı beyaz zeminde tut
  const buf = await base
    .flatten({ background: "#FFFFFF" })
    .png({ compressionLevel: 9, quality: 100 })
    .toBuffer();

  return buf;
}
