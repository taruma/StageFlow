/**
 * Pure Layer 1 Asset Classifier & Drag-DataTransfer Helpers.
 * Zero React, DOM, or Three.js runtime dependencies.
 */

export type DroppedAssetKind = 'yaml' | 'video' | 'skin' | 'unsupported';

export interface DragTypesLike {
  types?: ArrayLike<string> | Iterable<string> | null;
}

/**
 * Classifies a dropped or file-picked asset by filename extension and MIME type.
 */
export function classifyDroppedAsset(
  fileName: string,
  mimeType = ''
): DroppedAssetKind {
  const lower = fileName.trim().toLowerCase();
  const normalizedMime = mimeType.trim().toLowerCase();

  if (
    lower.endsWith('.yaml') ||
    lower.endsWith('.yml') ||
    lower.endsWith('.json')
  ) {
    return 'yaml';
  }

  if (
    lower.endsWith('.mp4') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.mov') ||
    normalizedMime.startsWith('video/')
  ) {
    return 'video';
  }

  if (
    lower.endsWith('.glb') ||
    lower.endsWith('.gltf') ||
    normalizedMime === 'model/gltf-binary' ||
    normalizedMime === 'model/gltf+json'
  ) {
    return 'skin';
  }

  return 'unsupported';
}

/**
 * Returns true only when a drag event carries OS files (`'Files'` in `dataTransfer.types`),
 * preventing internal text selections (e.g. CodeMirror) or UI element drags from
 * triggering file-drop overlays.
 */
export function hasFilesInDataTransfer(
  dataTransfer: DragTypesLike | null | undefined
): boolean {
  const types = dataTransfer?.types;
  if (!types) return false;
  for (const type of Array.from(types)) {
    if (type === 'Files') return true;
  }
  return false;
}
