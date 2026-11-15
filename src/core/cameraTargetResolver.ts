/**
 * Camera target anchor resolution and shot-boundary roll/offset reset semantics.
 * Pure Layer 1 module with zero React or DOM dependencies.
 */

import type {
  CameraCueSpec,
  EntityKind,
  EvaluatedEntityState,
  SceneEntityDef,
  SphericalPose,
  TargetAnchor,
  Vec3,
} from './types';
import { ENTITY_DEFAULTS } from './constants';
import { rotateVec3YXZ } from './sphericalMath';

export interface EntitySubAnchorRatio {
  xRatio: number;
  yRatio: number;
}

/**
 * Normalized local body-space sub-anchor ratios (relative to live entity width & height).
 * Facing +Z (yaw = 0): anatomical left is +X, anatomical right is -X.
 */
export const ENTITY_SUB_ANCHORS: Readonly<Record<string, EntitySubAnchorRatio>> = {
  head: { xRatio: 0, yRatio: 0.9 },
  eyes: { xRatio: 0, yRatio: 0.9 },
  eye: { xRatio: 0, yRatio: 0.9 },
  shoulder: { xRatio: 0, yRatio: 0.75 },
  chest: { xRatio: 0, yRatio: 0.75 },
  shoulder_l: { xRatio: 0.4, yRatio: 0.77 },
  shoulder_r: { xRatio: -0.4, yRatio: 0.77 },
  waist: { xRatio: 0, yRatio: 0.5 },
  center: { xRatio: 0, yRatio: 0.5 },
  feet: { xRatio: 0, yRatio: 0.05 },
  base: { xRatio: 0, yRatio: 0.05 },
  top: { xRatio: 0, yRatio: 1.0 },
};

export interface MatchedEntityTarget<T> {
  item: T;
  part?: string;
  recognizedPart?: string;
}

export const ZERO_OFFSET: Vec3 = { x: 0, y: 0, z: 0 };

/**
 * Resolves starting roll for a shot:
 * - In standard mode (isContinuous = false): Resets to baselinePose.roll (0 rad) unless explicitly specified or continuing a delta/end (Option A).
 * - In continuous mode (isContinuous = true): Preserves prevPose.roll unless explicitly specified, gliding into authored roll.
 */
export function resolveShotStartRoll(
  spec: CameraCueSpec,
  prevPose: SphericalPose,
  baselinePose: SphericalPose,
  isContinuous = false
): number {
  if (spec.rollStartRad !== undefined) {
    return spec.rollStartRad;
  }
  if (spec.rollDeltaRad !== undefined) {
    return spec.rollRad ?? prevPose.roll;
  }
  if (spec.rollEndRad !== undefined) {
    return prevPose.roll;
  }
  if (spec.rollRad !== undefined) {
    return isContinuous ? prevPose.roll : spec.rollRad;
  }
  return isContinuous ? prevPose.roll : baselinePose.roll;
}

export function resolveShotDestRoll(
  P0: SphericalPose,
  spec: CameraCueSpec,
  baselinePose: SphericalPose,
  isContinuous = false
): number {
  if (spec.rollEndRad !== undefined) {
    return spec.rollEndRad;
  }
  if (spec.rollDeltaRad !== undefined) {
    return P0.roll + spec.rollDeltaRad;
  }
  if (spec.rollRad !== undefined) {
    return spec.rollRad;
  }
  return isContinuous ? P0.roll : baselinePose.roll;
}

/**
 * Resolves starting 3D target offset for a shot:
 * - In standard mode (isContinuous = false): Resets to (0, 0, 0) unless explicitly specified or continuing via target_offset_end (Option A).
 * - In continuous mode (isContinuous = true): Preserves prevOffset unless explicitly specified, gliding into authored offset.
 */
export function resolveShotStartOffset(
  spec: CameraCueSpec,
  prevOffset: Vec3 = ZERO_OFFSET,
  isContinuous = false
): Vec3 {
  if (spec.targetOffsetStart !== undefined) {
    return { ...spec.targetOffsetStart };
  }
  if (spec.targetOffsetEnd !== undefined) {
    return spec.targetOffset ? { ...spec.targetOffset } : { ...prevOffset };
  }
  if (spec.targetOffset !== undefined) {
    return isContinuous ? { ...prevOffset } : { ...spec.targetOffset };
  }
  return isContinuous ? { ...prevOffset } : { ...ZERO_OFFSET };
}

export function resolveShotDestOffset(
  spec: CameraCueSpec,
  prevOffset: Vec3 = ZERO_OFFSET,
  isContinuous = false
): Vec3 {
  if (spec.targetOffsetEnd !== undefined) {
    return { ...spec.targetOffsetEnd };
  }
  if (spec.targetOffset !== undefined) {
    return { ...spec.targetOffset };
  }
  return isContinuous ? { ...prevOffset } : { ...ZERO_OFFSET };
}

/**
 * Matches a target string against entity IDs/labels with exact-match-first disambiguation,
 * falling back to final-dot splitting (`<entityKey>.<part>`) for sub-anchor targeting.
 */
export function matchEntityTargetKey<T>(
  rawKey: string,
  items: Iterable<T>,
  getId: (item: T) => string,
  getLabel?: (item: T) => string | undefined
): MatchedEntityTarget<T> | undefined {
  const clean = rawKey.trim().toLowerCase();
  if (!clean) return undefined;

  const itemList = Array.isArray(items) ? items : Array.from(items);
  const findExact = (key: string): T | undefined =>
    itemList.find((item) => {
      if (getId(item).toLowerCase() === key) return true;
      const lbl = getLabel?.(item);
      return lbl ? lbl.toLowerCase() === key : false;
    });

  const exact = findExact(clean);
  if (exact) {
    return { item: exact };
  }

  const dotIdx = clean.lastIndexOf('.');
  if (dotIdx <= 0) {
    return undefined;
  }

  const baseKey = clean.slice(0, dotIdx).trim();
  const part = clean.slice(dotIdx + 1).trim();
  if (!baseKey) {
    return undefined;
  }

  const baseMatch = findExact(baseKey);
  if (!baseMatch) {
    return undefined;
  }

  const recognizedPart =
    part && Object.prototype.hasOwnProperty.call(ENTITY_SUB_ANCHORS, part)
      ? part
      : undefined;

  return {
    item: baseMatch,
    ...(part ? { part } : {}),
    ...(recognizedPart ? { recognizedPart } : {}),
  };
}

/**
 * Computes the unrotated entity-local sub-anchor offset vector from live entity dimensions.
 * Unrecognized or omitted sub-anchor suffixes fall back gracefully to the entity's default ratio.
 */
export function getEntitySubAnchorLocalOffset(
  kind: EntityKind,
  width: number,
  height: number,
  part?: string
): Vec3 {
  const defaultYRatio =
    kind === 'character' ? ENTITY_DEFAULTS.CHARACTER_LOOK_ANCHOR_RATIO : 0.5;
  const cleanPart = part?.trim().toLowerCase();
  const ratio =
    cleanPart && Object.prototype.hasOwnProperty.call(ENTITY_SUB_ANCHORS, cleanPart)
      ? ENTITY_SUB_ANCHORS[cleanPart]
      : undefined;

  if (!ratio) {
    return { x: 0, y: height * defaultYRatio, z: 0 };
  }
  return {
    x: width * ratio.xRatio,
    y: height * ratio.yRatio,
    z: 0,
  };
}

/**
 * Evaluates the 3D world-space look-at anchor point of a live evaluated entity
 * (or optional sub-anchor part) rotated in intrinsic YXZ order.
 */
export function getEntityLookAnchor(
  ent: EvaluatedEntityState,
  part?: string
): Vec3 {
  const effectiveWidth = ent.size?.x ?? ent.def.width ?? ent.def.radius * 2;
  const effectiveHeight = ent.size?.y ?? ent.def.height;
  const localOffset = getEntitySubAnchorLocalOffset(
    ent.def.kind,
    effectiveWidth,
    effectiveHeight,
    part
  );
  const rotated = rotateVec3YXZ(
    localOffset,
    ent.rotationYRad,
    ent.pitchRad ?? 0,
    ent.rollRad ?? 0
  );
  return {
    x: ent.position.x + rotated.x,
    y: ent.position.y + rotated.y,
    z: ent.position.z + rotated.z,
  };
}

/**
 * Evaluates the 3D world-space look-at anchor point of a static SceneEntityDef
 * (used for baseline stage.stage_camera / stage.observer_camera resolution).
 */
export function getEntityDefLookAnchor(
  def: SceneEntityDef,
  part?: string
): Vec3 {
  const baseWidth = def.width ?? def.radius * 2;
  const localOffset = getEntitySubAnchorLocalOffset(
    def.kind,
    baseWidth,
    def.height,
    part
  );
  const rotated = rotateVec3YXZ(
    localOffset,
    def.rotationYRad,
    def.pitchRad ?? 0,
    def.rollRad ?? 0
  );
  return {
    x: def.position.x + rotated.x,
    y: def.position.y + rotated.y,
    z: def.position.z + rotated.z,
  };
}

function resolveSingleTargetString(
  rawKey: string,
  entitiesById: Map<string, EvaluatedEntityState>
): Vec3 | undefined {
  const clean = rawKey.trim().toLowerCase();
  if (clean === 'center' || clean === 'origin' || clean === 'stage') {
    return { x: 0, y: 1.0, z: 0 };
  }
  const matched = matchEntityTargetKey(
    rawKey,
    entitiesById.values(),
    (ent) => ent.id,
    (ent) => ent.def.label
  );
  return matched ? getEntityLookAnchor(matched.item, matched.part) : undefined;
}

/**
 * Resolves an anchor key (single entity ID/sub-anchor, multi-entity array for two-shots/group centroids,
 * preset name, or Vec3) into a 3D world look-at point, applying an optional world-space metric offset [dx, dy, dz].
 */
export function resolveTargetPoint3D(
  targetKey: TargetAnchor | undefined,
  entitiesById: Map<string, EvaluatedEntityState>,
  fallbackTarget: Vec3,
  offset?: Vec3
): Vec3 {
  let base: Vec3 | undefined;

  if (!targetKey) {
    base = { ...fallbackTarget };
  } else if (Array.isArray(targetKey)) {
    // Multi-entity array: compute pure 3D centroid midpoint
    const anchors: Vec3[] = [];
    for (const key of targetKey) {
      const resolved = resolveSingleTargetString(key, entitiesById);
      if (resolved) {
        anchors.push(resolved);
      }
    }
    if (anchors.length > 0) {
      const count = anchors.length;
      base = {
        x: anchors.reduce((sum, a) => sum + a.x, 0) / count,
        y: anchors.reduce((sum, a) => sum + a.y, 0) / count,
        z: anchors.reduce((sum, a) => sum + a.z, 0) / count,
      };
    } else {
      base = { ...fallbackTarget };
    }
  } else if (typeof targetKey === 'object') {
    base = { ...targetKey };
  } else {
    base = resolveSingleTargetString(targetKey, entitiesById);
  }

  const resolved = base ?? { ...fallbackTarget };
  if (!offset) {
    return resolved;
  }
  return {
    x: resolved.x + offset.x,
    y: resolved.y + offset.y,
    z: resolved.z + offset.z,
  };
}
