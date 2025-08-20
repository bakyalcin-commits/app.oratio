import sharp from "sharp";

/**
 * OCR öncesi basit bir temizlik/normalize pipeline'ı.
 * - EXIF'e göre döndürme
 * - Gri tonlama
 * - Normalize (kontrast/aydınlık)
 * - Hafif keskinleştirme
 */
export async function preprocess(input: Buffer): Promise<Buffer> {
  return await sharp(input)
    .rotate()        // deskew/auto-orient
    .grayscale()
    .normalize()
    .sharpen()
    .toBuffer();
}
