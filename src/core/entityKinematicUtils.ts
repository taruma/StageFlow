/**
 * Shared kinematic types and geometry utilities for entity evaluation.
 * Pure Layer 1 module with zero React or DOM dependencies.
 */

import type {
  BlockingCueSpec,
  EntityKind,
  EntityShape,
  SceneEntityDef,
  TargetAnchor,
  Vec3,
} from './types';
import { ENTITY_DEFAULTS } from './constants';
import { computeLookAtYawRad, shortestAngleDiff } from './sphericalMath';
import {
  computeRotatedSubAnchorPoint,
  matchEntityTargetKey,
} from './cameraTargetResolver';

export interface EntityLookAtPose {
  position?: Vec3;
  rotationYRad: number;
  pitchRad?: number;
  rollRad?: number;
  pivotRatio?: number;
  size?: Vec3;
}

export interface EntityPoseSnapshot {
  position: Vec3;
  rotationYRad: number;
  pitchRad: number;
  rollRad: number;
  pivotRatio: number;
  visible: boolean;
  size: Vec3;
}

export interface ChainedBlockingCueEntry {
  cue: BlockingCueSpec;
  startPos: Vec3;
  endPos: Vec3;
  startRot: number;
  endRot: number;
  startPitch: number;
  endPitch: number;
  startRoll: number;
  endRoll: number;
  startPivot: number;
  endPivot: number;
  startSize: Vec3;
  endSize: Vec3;
  visible: boolean;
  isCut?: boolean;
}

/**
 * Interpolates from startRad to endRad along the shortest angular arc [-PI, PI] at eased progress u.
 */
export function lerpAngleShortest(
  startRad: number,
  endRad: number,
  u: number
): number {
  return startRad + u * shortestAngleDiff(endRad, startRad);
}

/**
 * Resolves start and end vertical pivot ratios for a cue:
 * - endPivot inherits prevPivot when cuePivotRatio is undefined.
 * - startPivot adopts endPivot immediately when `isCut` is true OR when the entity starts
 *   the cue upright (|startPitchRad| < 1e-8 && |startRollRad| < 1e-8), since upright poses
 *   are 100% invariant to pivot ratio (zero world-space jump) and this keeps the hinge fixed
 *   throughout a 0° -> θ° takeoff/tilt transition.
 * - When the entity is already tilted at cue start (!isCut && !isStartUpright), startPivot
 *   starts at prevPivot and eases smoothly to endPivot to preserve C0 world continuity.
 */
export function resolveCueStartEndPivot(
  cuePivotRatio: number | undefined,
  prevPivot: number,
  startPitchRad: number,
  startRollRad: number,
  isCut: boolean
): { startPivot: number; endPivot: number } {
  const endPivot = cuePivotRatio ?? prevPivot;
  const isStartUpright =
    Math.abs(startPitchRad) < 1e-8 && Math.abs(startRollRad) < 1e-8;
  const startPivot = isCut || isStartUpright ? endPivot : prevPivot;
  return { startPivot, endPivot };
}

/**
 * Parses a positive metric scalar value (e.g. 2.2, "2.2m", "0.85 meters") into meters.
 */
export function parsePositiveMetricScalar(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^[+-]?\d+(\.\d+)?\s*(m|meters?)?$/i.test(trimmed)) {
      const val = parseFloat(trimmed);
      if (Number.isFinite(val) && val > 0) {
        return val;
      }
    }
  }
  return undefined;
}

/**
 * Parses a dimension vector or object into optional width, height, depth.
 * Accepts:
 * - [width, height, depth] (length >= 3)
 * - [width, depth] (length === 2)
 * - { width, height, depth } or { x, y, z }
 */
export function parseDimensionTuple(raw: unknown): {
  width?: number;
  height?: number;
  depth?: number;
} {
  if (Array.isArray(raw)) {
    if (raw.length >= 3) {
      return {
        width: parsePositiveMetricScalar(raw[0]),
        height: parsePositiveMetricScalar(raw[1]),
        depth: parsePositiveMetricScalar(raw[2]),
      };
    }
    if (raw.length === 2) {
      return {
        width: parsePositiveMetricScalar(raw[0]),
        depth: parsePositiveMetricScalar(raw[1]),
      };
    }
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const w = parsePositiveMetricScalar(obj.width ?? obj.x);
    const h = parsePositiveMetricScalar(obj.height ?? obj.y);
    const d = parsePositiveMetricScalar(obj.depth ?? obj.length ?? obj.z);
    return {
      ...(w !== undefined ? { width: w } : {}),
      ...(h !== undefined ? { height: h } : {}),
      ...(d !== undefined ? { depth: d } : {}),
    };
  }
  return {};
}

/**
 * Parses a scale multiplier tuple or uniform scalar.
 * Accepts:
 * - scalar number > 0 (uniform scale: { sx, sy, sz })
 * - [sx, sy, sz] or [sx, sz]
 * - { sx, sy, sz } or { x, y, z }
 */
export function parseScaleTuple(raw: unknown): {
  sx?: number;
  sy?: number;
  sz?: number;
} {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return { sx: raw, sy: raw, sz: raw };
  }
  if (Array.isArray(raw)) {
    if (raw.length >= 3) {
      return {
        sx: parsePositiveMetricScalar(raw[0]),
        sy: parsePositiveMetricScalar(raw[1]),
        sz: parsePositiveMetricScalar(raw[2]),
      };
    }
    if (raw.length === 2) {
      return {
        sx: parsePositiveMetricScalar(raw[0]),
        sz: parsePositiveMetricScalar(raw[1]),
      };
    }
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const sx = parsePositiveMetricScalar(obj.sx ?? obj.x);
    const sy = parsePositiveMetricScalar(obj.sy ?? obj.y);
    const sz = parsePositiveMetricScalar(obj.sz ?? obj.z);
    return {
      ...(sx !== undefined ? { sx } : {}),
      ...(sy !== undefined ? { sy } : {}),
      ...(sz !== undefined ? { sz } : {}),
    };
  }
  return {};
}

/**
 * Retrieves the normalized base 3D size vector { x: width, y: height, z: depth } for an entity definition.
 */
export function getEntityBaseSize(def: SceneEntityDef): Vec3 {
  const fallbackDiameter = def.radius * 2;
  return {
    x: def.width ?? fallbackDiameter,
    y: def.height,
    z: def.depth ?? fallbackDiameter,
  };
}

/**
 * Resolves entity definition dimensions with full precedence cascade:
 * 1. Seed from size / dimensions vector ([w, h, d] or [w, d])
 * 2. Explicit width, height, depth override vector components
 * 3. Fallbacks:
 *    - If radius is given without width/depth: width = depth = 2 * radius
 *    - If width and/or depth are given without radius: radius = max(width, depth) / 2
 *    - If width is given without depth: depth = width (and vice versa)
 * 4. Special sphere height rule: if prop is sphere and height is omitted, height = 2 * radius
 */
export function resolveEntityDefDimensions(
  ent: Record<string, unknown>,
  kind: EntityKind,
  shape?: EntityShape
): {
  width: number;
  height: number;
  depth: number;
  radius: number;
} {
  const defaultHeight =
    kind === 'character'
      ? ENTITY_DEFAULTS.CHARACTER_HEIGHT_M
      : kind === 'prop'
      ? ENTITY_DEFAULTS.PROP_HEIGHT_M
      : ENTITY_DEFAULTS.MARKER_HEIGHT_M;

  const defaultRadius =
    kind === 'character'
      ? ENTITY_DEFAULTS.CHARACTER_RADIUS_M
      : kind === 'prop'
      ? ENTITY_DEFAULTS.PROP_RADIUS_M
      : ENTITY_DEFAULTS.MARKER_RADIUS_M;

  const defaultWidth = defaultRadius * 2;
  const defaultDepth = defaultRadius * 2;

  const sizeVec = parseDimensionTuple(ent.size ?? ent.dimensions);
  const scaleVec = parseScaleTuple(ent.scale);

  const expWidth = parsePositiveMetricScalar(ent.width);
  const expHeight = parsePositiveMetricScalar(ent.height);
  const expDepth = parsePositiveMetricScalar(ent.depth ?? ent.length);
  const expRadius = parsePositiveMetricScalar(ent.radius);

  const rawW = expWidth ?? sizeVec.width;
  const rawD = expDepth ?? sizeVec.depth;

  let width: number;
  let depth: number;

  if (rawW !== undefined || rawD !== undefined) {
    width = rawW ?? rawD ?? (expRadius !== undefined ? expRadius * 2 : defaultWidth);
    depth = rawD ?? rawW ?? (expRadius !== undefined ? expRadius * 2 : defaultDepth);
  } else if (expRadius !== undefined) {
    width = expRadius * 2;
    depth = expRadius * 2;
  } else {
    width = defaultWidth;
    depth = defaultDepth;
  }

  if (scaleVec.sx !== undefined) width *= scaleVec.sx;
  if (scaleVec.sz !== undefined) depth *= scaleVec.sz;

  const radius = expRadius ?? Math.max(width, depth) * 0.5;

  const defaultHeightForShape =
    kind === 'prop' && shape === 'sphere' && expHeight === undefined && sizeVec.height === undefined
      ? radius * 2
      : defaultHeight;

  let height = expHeight ?? sizeVec.height ?? defaultHeightForShape;
  if (scaleVec.sy !== undefined) height *= scaleVec.sy;

  return { width, height, depth, radius };
}

/**
 * Parses polymorphic cue dimension overrides (size, from_size, width, from_width, height, depth, scale).
 */
export function parseEntityCueDimensionOverrides(
  ov: Record<string, unknown>,
  baseDef?: SceneEntityDef
): {
  fromWidth?: number;
  fromHeight?: number;
  fromDepth?: number;
  width?: number;
  height?: number;
  depth?: number;
} {
  const baseW = baseDef ? (baseDef.width ?? baseDef.radius * 2) : ENTITY_DEFAULTS.PROP_WIDTH_M;
  const baseH = baseDef?.height ?? ENTITY_DEFAULTS.PROP_HEIGHT_M;
  const baseD = baseDef ? (baseDef.depth ?? baseDef.radius * 2) : ENTITY_DEFAULTS.PROP_DEPTH_M;

  const startVec = parseDimensionTuple(
    ov.from_size ?? ov.fromSize ?? ov.size_start ?? ov.sizeStart
  );
  const startScale = parseScaleTuple(
    ov.from_scale ?? ov.fromScale ?? ov.scale_start ?? ov.scaleStart
  );

  const endVec = parseDimensionTuple(
    ov.size ?? ov.dimensions ?? ov.size_end ?? ov.sizeEnd
  );
  const endScale = parseScaleTuple(
    ov.scale ?? ov.scale_end ?? ov.scaleEnd
  );

  const startRad = parsePositiveMetricScalar(
    ov.from_radius ?? ov.fromRadius ?? ov.radius_start ?? ov.radiusStart
  );
  const endRad = parsePositiveMetricScalar(
    ov.radius ?? ov.radius_end ?? ov.radiusEnd
  );

  const fromW =
    parsePositiveMetricScalar(
      ov.from_width ?? ov.fromWidth ?? ov.width_start ?? ov.widthStart
    ) ??
    startVec.width ??
    (startRad !== undefined ? startRad * 2 : undefined) ??
    (startScale.sx !== undefined ? baseW * startScale.sx : undefined);

  const fromH =
    parsePositiveMetricScalar(
      ov.from_height ?? ov.fromHeight ?? ov.height_start ?? ov.heightStart
    ) ??
    startVec.height ??
    (startScale.sy !== undefined ? baseH * startScale.sy : undefined);

  const fromD =
    parsePositiveMetricScalar(
      ov.from_depth ?? ov.fromDepth ?? ov.depth_start ?? ov.depthStart ?? ov.from_length
    ) ??
    startVec.depth ??
    (startRad !== undefined ? startRad * 2 : undefined) ??
    (startScale.sz !== undefined ? baseD * startScale.sz : undefined);

  const endW =
    parsePositiveMetricScalar(
      ov.width ?? ov.width_end ?? ov.widthEnd
    ) ??
    endVec.width ??
    (endRad !== undefined ? endRad * 2 : undefined) ??
    (endScale.sx !== undefined ? baseW * endScale.sx : undefined);

  const endH =
    parsePositiveMetricScalar(
      ov.height ?? ov.height_end ?? ov.heightEnd
    ) ??
    endVec.height ??
    (endScale.sy !== undefined ? baseH * endScale.sy : undefined);

  const endD =
    parsePositiveMetricScalar(
      ov.depth ?? ov.depth_end ?? ov.depthEnd ?? ov.length
    ) ??
    endVec.depth ??
    (endRad !== undefined ? endRad * 2 : undefined) ??
    (endScale.sz !== undefined ? baseD * endScale.sz : undefined);

  return {
    ...(fromW !== undefined ? { fromWidth: fromW } : {}),
    ...(fromH !== undefined ? { fromHeight: fromH } : {}),
    ...(fromD !== undefined ? { fromDepth: fromD } : {}),
    ...(endW !== undefined ? { width: endW } : {}),
    ...(endH !== undefined ? { height: endH } : {}),
    ...(endD !== undefined ? { depth: endD } : {}),
  };
}

/**
 * Resolves starting and ending size vectors for a cue with per-axis forward chaining.
 */
export function resolveCueStartEndSize(
  cue: {
    fromWidth?: number;
    fromHeight?: number;
    fromDepth?: number;
    width?: number;
    height?: number;
    depth?: number;
  },
  prevSize: Vec3,
  isCut: boolean
): { startSize: Vec3; endSize: Vec3 } {
  const startSize: Vec3 = {
    x: isCut
      ? cue.width ?? cue.fromWidth ?? prevSize.x
      : cue.fromWidth ?? prevSize.x,
    y: isCut
      ? cue.height ?? cue.fromHeight ?? prevSize.y
      : cue.fromHeight ?? prevSize.y,
    z: isCut
      ? cue.depth ?? cue.fromDepth ?? prevSize.z
      : cue.fromDepth ?? prevSize.z,
  };
  const endSize: Vec3 = {
    x: cue.width ?? startSize.x,
    y: cue.height ?? startSize.y,
    z: cue.depth ?? startSize.z,
  };
  return { startSize, endSize };
}

/**
 * Resolves a lookAt target (entity ID/sub-anchor, multi-entity array, entity label,
 * "center", or explicit Vec3) into 3D world coordinates.
 * When a sub-anchor (e.g. "actor.shoulder_l") or tilted target entity is referenced
 * alongside `currentPoses`, applies full intrinsic YXZ rotation to the local offset.
 */
export function resolveLookAtPoint(
  lookAt: TargetAnchor | undefined,
  currentPositions: Map<string, Vec3>,
  entities?: SceneEntityDef[],
  currentPoses?: Map<string, EntityLookAtPose>
): Vec3 | null {
  if (!lookAt) return null;
  if (Array.isArray(lookAt)) {
    if (lookAt.length === 0) return null;
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    let count = 0;
    for (const key of lookAt) {
      const pt = resolveLookAtPoint(key, currentPositions, entities, currentPoses);
      if (pt) {
        sumX += pt.x;
        sumY += pt.y;
        sumZ += pt.z;
        count++;
      }
    }
    return count > 0 ? { x: sumX / count, y: sumY / count, z: sumZ / count } : null;
  }
  if (typeof lookAt === 'object') {
    return lookAt;
  }
  const trimmed = lookAt.trim().toLowerCase();
  if (trimmed === 'center' || trimmed === 'origin' || trimmed === 'stage') {
    return { x: 0, y: 0, z: 0 };
  }

  // Match against declared SceneEntityDef entries first (supports IDs, labels, and <id>.<part>)
  if (entities && entities.length > 0) {
    const matched = matchEntityTargetKey(
      lookAt,
      entities,
      (e) => e.id,
      (e) => e.label
    );
    if (matched) {
      const def = matched.item;
      const pos = currentPositions.get(def.id) ?? currentPoses?.get(def.id)?.position ?? def.position;
      const pose = currentPoses?.get(def.id);
      const yaw = pose?.rotationYRad ?? def.rotationYRad;
      const pitch = pose?.pitchRad ?? def.pitchRad ?? 0;
      const roll = pose?.rollRad ?? def.rollRad ?? 0;
      const isTilted = Math.abs(pitch) >= 1e-8 || Math.abs(roll) >= 1e-8;

      if (!matched.recognizedPart && !isTilted) {
        return pos;
      }

      const width = pose?.size?.x ?? def.width ?? def.radius * 2;
      const height = pose?.size?.y ?? def.height;
      const pivotRatio = pose?.pivotRatio ?? def.pivotRatio ?? 0;
      return computeRotatedSubAnchorPoint(
        pos,
        def.kind,
        width,
        height,
        yaw,
        pitch,
        roll,
        matched.recognizedPart,
        pivotRatio
      );
    }
  }

  // Fallback: match against currentPositions keys directly (e.g. ad-hoc position maps)
  const posMatched = matchEntityTargetKey(
    lookAt,
    currentPositions.keys(),
    (id) => id
  );
  if (posMatched) {
    return currentPositions.get(posMatched.item) ?? null;
  }
  return null;
}

/**
 * Resolves entity `look_at` yaws in an order-independent Jacobi relaxation loop.
 * Reads from `poseMap` without mutating it during a sweep, then commits all new yaws
 * simultaneously up to `maxIterations` or until `maxDeltaYaw < 1e-7`.
 * Returns the set of entity IDs whose `look_at` target resolved cleanly.
 */
export function relaxLookAtPoses(
  entities: SceneEntityDef[],
  posMap: Map<string, Vec3>,
  poseMap: Map<string, EntityLookAtPose>,
  getLookAt: (entityId: string) => TargetAnchor | undefined,
  maxIterations = 8
): Set<string> {
  const resolvedIds = new Set<string>();
  for (let iter = 0; iter < maxIterations; iter++) {
    const nextRots = new Map<string, number>();
    let maxDeltaYaw = 0;

    for (const def of entities) {
      const lookAt = getLookAt(def.id);
      if (!lookAt) continue;
      const pos = posMap.get(def.id);
      const pose = poseMap.get(def.id);
      if (!pos || !pose) continue;

      const targetPt = resolveLookAtPoint(lookAt, posMap, entities, poseMap);
      if (!targetPt) continue;

      resolvedIds.add(def.id);
      const nextYaw = computeLookAtYawRad(pos, targetPt);
      const delta = Math.abs(shortestAngleDiff(nextYaw, pose.rotationYRad));
      if (delta > maxDeltaYaw) {
        maxDeltaYaw = delta;
      }
      nextRots.set(def.id, nextYaw);
    }

    if (nextRots.size === 0) break;

    for (const [id, yaw] of nextRots) {
      const pose = poseMap.get(id);
      if (pose) {
        pose.rotationYRad = yaw;
      }
    }

    if (maxDeltaYaw < 1e-7) break;
  }
  return resolvedIds;
}

/**
 * Generates a 16-segment ground movement trail when displacement exceeds 0.05m.
 */
export function buildGroundTrailPoints(startPos: Vec3, endPos: Vec3): Vec3[] {
  const moveDist = Math.hypot(
    endPos.x - startPos.x,
    endPos.y - startPos.y,
    endPos.z - startPos.z
  );
  if (moveDist <= 0.05) return [];

  const trailPoints: Vec3[] = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    trailPoints.push({
      x: startPos.x + frac * (endPos.x - startPos.x),
      y: 0.02, // Slightly above floor plane to avoid z-fighting
      z: startPos.z + frac * (endPos.z - startPos.z),
    });
  }
  return trailPoints;
}

/**
 * Computes the 4 ground floor corners of an oriented bounding box (OBB) rotated by yawRad.
 */
export function computeOrientedBoundingBox(
  center: { x: number; z: number },
  width: number,
  depth: number,
  yawRad: number
): Array<{ x: number; z: number }> {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const cos = Math.cos(yawRad);
  const sin = Math.sin(yawRad);
  const localCorners = [
    { x: -hw, z: -hd },
    { x: hw, z: -hd },
    { x: hw, z: hd },
    { x: -hw, z: hd },
  ];
  return localCorners.map((pt) => ({
    x: center.x + pt.x * cos + pt.z * sin,
    z: center.z - pt.x * sin + pt.z * cos,
  }));
}
