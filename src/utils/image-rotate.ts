export type RotationDegrees = 0 | 90 | 180 | 270;

export function normalizeRotation(degrees: number): RotationDegrees {
  const normalized = ((degrees % 360) + 360) % 360;
  return normalized as RotationDegrees;
}

export async function prepareImageBlobForUpload(
  blob: Blob,
  rotationDegrees: RotationDegrees,
): Promise<Blob> {
  if (rotationDegrees === 0 || isPdfBlob(blob)) return blob;
  return rotateImageBlob(blob, rotationDegrees);
}

export async function rotateImageBlob(blob: Blob, degrees: RotationDegrees): Promise<Blob> {
  const sourceUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImage(sourceUrl);
    const canvas = document.createElement('canvas');
    const isSideways = degrees === 90 || degrees === 270;

    canvas.width  = isSideways ? image.naturalHeight : image.naturalWidth;
    canvas.height = isSideways ? image.naturalWidth : image.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible');

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

    const outputType = getRotatedImageType(blob.type);
    const rotated = await canvasToBlob(canvas, outputType);

    if (blob instanceof File) {
      return new File([rotated], blob.name, {
        type:         rotated.type || outputType,
        lastModified: Date.now(),
      });
    }

    return rotated;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export function getRotatedImageContentType(blob: Blob): 'image/jpeg' | 'image/png' | 'image/webp' {
  return getRotatedImageType(blob.type);
}

export function isPdfBlob(blob: Blob): boolean {
  if (blob.type === 'application/pdf') return true;
  return blob instanceof File && blob.name.toLowerCase().endsWith('.pdf');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo leer la imagen'));
    image.src = src;
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  const primary = await tryCanvasToBlob(canvas, type);
  if (primary) return primary;

  const fallback = await tryCanvasToBlob(canvas, 'image/jpeg');
  if (fallback) return fallback;

  throw new Error('No se pudo generar la imagen rotada');
}

function tryCanvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve(null);
      resolve(blob);
    }, type, 0.92);
  });
}

function getRotatedImageType(sourceType: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (sourceType === 'image/png' || sourceType === 'image/webp') return sourceType;
  return 'image/jpeg';
}
