/**
 * Pure Layer 1 Spatial Normalization & Skin Target Matching Helpers.
 * Zero React, DOM, or Three.js runtime dependencies.
 */

import type { EntityKind, SceneEntityDef, Vec3 } from './types';

export interface GlbNormalizationTarget {
  kind: EntityKind;
  baseWidth: number;
  height: number;
  baseDepth: number;
  hasExplicitWidthDepth: boolean;
}

export interface GlbNormalizationTransform {
  /** Local translation applied before scale to center X/Z and pin min.y to 0 */
  offset: [number, number, number];
  /** Local scale applied after offset so entity hits YAML base dimensions */
  scale: [number, number, number];
}

const MIN_EXTENT = 1e-4;

/**
 * Computes closed-form offset and scale multipliers from a raw mesh Box3
 * so its bottom sits at Y = 0, X/Z are centered at (0, 0), and its base size
 * matches the StageFlow entity definition.
 */
export function computeGlbEntityNormalization(
  rawMin: Vec3,
  rawMax: Vec3,
  target: GlbNormalizationTarget
): GlbNormalizationTransform {
  const rawW = Math.max(MIN_EXTENT, rawMax.x - rawMin.x);
  const rawH = Math.max(MIN_EXTENT, rawMax.y - rawMin.y);
  const rawD = Math.max(MIN_EXTENT, rawMax.z - rawMin.z);

  const cleanZero = (n: number): number => (n === 0 ? 0 : n);
  const centerX = (rawMin.x + rawMax.x) * 0.5;
  const centerZ = (rawMin.z + rawMax.z) * 0.5;
  const offset: [number, number, number] = [
    cleanZero(-centerX),
    cleanZero(-rawMin.y),
    cleanZero(-centerZ),
  ];

  const safeH = Math.max(MIN_EXTENT, target.height);
  const safeW = Math.max(MIN_EXTENT, target.baseWidth);
  const safeD = Math.max(MIN_EXTENT, target.baseDepth);

  if (target.kind === 'character') {
    // Preserve natural human proportions at base height; live YAML scale/width/height still applies outside
    const uniform = safeH / rawH;
    return { offset, scale: [uniform, uniform, uniform] };
  }

  if (target.kind === 'marker') {
    const uniform = Math.min(safeW / rawW, safeD / rawD);
    return { offset, scale: [uniform, uniform, uniform] };
  }

  // Props: exact box fit when width & depth are explicitly authored; uniform height fit otherwise
  if (target.hasExplicitWidthDepth) {
    return {
      offset,
      scale: [safeW / rawW, safeH / rawH, safeD / rawD],
    };
  }

  const uniform = safeH / rawH;
  return { offset, scale: [uniform, uniform, uniform] };
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.(glb|gltf)$/i, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Suggests the best matching assignment target ('stage' or an entity id)
 * from a dropped .glb / .gltf filename.
 */
export function suggestSkinTargetId(
  fileName: string,
  entities: SceneEntityDef[]
): string {
  const stem = normalizeToken(fileName);
  if (!stem) return 'stage';

  // 1. Exact ID match (normalized)
  for (const ent of entities) {
    if (normalizeToken(ent.id) === stem) {
      return ent.id;
    }
  }

  // 2. Exact label match
  for (const ent of entities) {
    if (ent.label && normalizeToken(ent.label) === stem) {
      return ent.id;
    }
  }

  // 3. Token prefix/word containment (longest entity id first to avoid partial collisions)
  const sorted = [...entities].sort(
    (a, b) => normalizeToken(b.id).length - normalizeToken(a.id).length
  );
  for (const ent of sorted) {
    const normId = normalizeToken(ent.id);
    if (
      normId.length >= 2 &&
      (stem.startsWith(`${normId}_`) ||
        stem.endsWith(`_${normId}`) ||
        stem.includes(`_${normId}_`))
    ) {
      return ent.id;
    }
  }

  return 'stage';
}

/**
 * Builds a deterministic cache signature for active entity skin URLs.
 */
export function buildEntitySkinsSignature(
  entitySkinUrls?: Record<string, string> | null
): string {
  if (!entitySkinUrls) return '';
  const entries = Object.entries(entitySkinUrls).filter(([, url]) => Boolean(url));
  if (entries.length === 0) return '';
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([id, url]) => `${id}=${url}`).join(';');
}
