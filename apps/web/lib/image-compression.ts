// Photos straight off a phone are routinely 5–12MB. Hosting the API on
// serverless functions caps a request body at ~4.5MB, so uploads failed with a
// bare "Failed to fetch" (the platform's 413 has no CORS headers, so the
// browser cannot even read it). Downscale large images in the browser first;
// the server still validates the bytes and the real limits.

const COMPRESS_ABOVE_BYTES = 1.5 * 1024 * 1024;
const MAX_EDGE = 2048;
const TARGET_BYTES = 3.5 * 1024 * 1024;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function decode(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Older Safari rejects the options object; fall back to <img>.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode image'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not decode image');
    ctx.drawImage(img, 0, 0);
    return await createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Returns the original file when it is small enough or cannot be decoded;
 * otherwise a resized JPEG that fits comfortably under the serverless body
 * limit.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  if (file.size <= COMPRESS_ABOVE_BYTES) return file;
  if (typeof document === 'undefined') return file;

  try {
    const bitmap = await decode(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }

    // JPEG has no alpha channel; fill white so transparent PNGs don't turn
    // black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    let quality = 0.85;
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      if (blob && blob.size <= TARGET_BYTES) break;
      quality = Math.max(0.4, quality - 0.12);
    }

    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
