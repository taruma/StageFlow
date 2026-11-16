/**
 * Shared Browser Canvas Encoding & Download Helpers for Storyboard Exports.
 */

import type { StoryboardExportFormat } from '../core/storyboardMath';

export const STORYBOARD_EXPORT_MIME: Record<StoryboardExportFormat, string> = {
  png: 'image/png',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
};

const LOSSY_EXPORT_QUALITY = 0.94;

export function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export function encodeCanvasImage(
  canvas: HTMLCanvasElement,
  format: StoryboardExportFormat
): Promise<Blob | null> {
  const mime = STORYBOARD_EXPORT_MIME[format];
  const quality = format === 'png' ? undefined : LOSSY_EXPORT_QUALITY;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

export function resolveActualFormat(
  requested: StoryboardExportFormat,
  blobType: string
): StoryboardExportFormat {
  if (blobType === 'image/png') return 'png';
  if (blobType === 'image/jpeg') return 'jpeg';
  if (blobType === 'image/webp') return 'webp';
  return requested;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
