/**
 * Camera target anchor resolution and shot-boundary roll/offset reset semantics.
 * Pure Layer 1 module with zero React or DOM dependencies.
 */

import type {
  CameraCueSpec,
  EntityKind,
  EntityShape,
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
      const lbl = getLabel?.(item)?.trim();
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
 * Computes a world-space entity sub-anchor point from position, live dimensions,
 * intrinsic YXZ orientation, optional sub-anchor part name, and vertical pivot ratio p in [0, 1].
 */
export function computeRotatedSubAnchorPoint(
  position: Vec3,
  kind: EntityKind,
  width: number,
  height: number,
  yawRad: number,
  pitchRad: number,
  rollRad: number,
  part?: string,
  pivotRatio = 0
): Vec3 {
  const p = Number.isFinite(pivotRatio)
    ? Math.max(0, Math.min(1, pivotRatio))
    : 0;
  const pivotY = p * height;
  const localOffset = getEntitySubAnchorLocalOffset(kind, width, height, part);
  const rotated = rotateVec3YXZ(
    {
      x: localOffset.x,
      y: localOffset.y - pivotY,
      z: localOffset.z,
    },
    yawRad,
    pitchRad,
    rollRad
  );
  return {
    x: position.x + rotated.x,
    y: position.y + pivotY + rotated.y,
    z: position.z + rotated.z,
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
  return computeRotatedSubAnchorPoint(
    ent.position,
    ent.def.kind,
    effectiveWidth,
    effectiveHeight,
    ent.rotationYRad,
    ent.pitchRad ?? 0,
    ent.rollRad ?? 0,
    part,
    ent.pivotRatio ?? ent.def.pivotRatio ?? 0
  );
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
  return computeRotatedSubAnchorPoint(
    def.position,
    def.kind,
    baseWidth,
    def.height,
    def.rotationYRad,
    def.pitchRad ?? 0,
    def.rollRad ?? 0,
    part,
    def.pivotRatio ?? 0
  );
}

/**
 * Computes the local (x, y, z) position for an entity's floating billboard badge
 * inside its yaw-oriented groupRef, accounting for pitch, roll, live dimensions,
 * vertical pivot ratio p in [0, 1], and entity kind/shape.
 */
export function computeTiltedEntityLabelOffset(
  kind: EntityKind,
  shape: EntityShape | undefined,
  width: number,
  height: number,
  depth: number,
  pitchRad = 0,
  rollRad = 0,
  pivotRatio = 0,
  clearanceM = 0.28
): Vec3 {
  const p = Number.isFinite(pivotRatio)
    ? Math.max(0, Math.min(1, pivotRatio))
    : 0;
  const pivotY = p * height;

  if (Math.abs(pitchRad) < 1e-8 && Math.abs(rollRad) < 1e-8) {
    return { x: 0, y: Math.max(0, height) + clearanceM, z: 0 };
  }

  if (kind === 'character') {
    const crownRot = rotateVec3YXZ(
      { x: 0, y: (1 - p) * height, z: 0 },
      0,
      pitchRad,
      rollRad
    );
    const baseRot = rotateVec3YXZ(
      { x: 0, y: -pivotY, z: 0 },
      0,
      pitchRad,
      rollRad
    );
    const crownY = pivotY + crownRot.y;
    const baseY = pivotY + baseRot.y;
    return {
      x: crownRot.x,
      y: Math.max(0, crownY, baseY) + clearanceM,
      z: crownRot.z,
    };
  }

  // Props and markers: horizontally center over rotated volume midpoint and clear highest Y extent
  const centerRot = rotateVec3YXZ(
    { x: 0, y: (0.5 - p) * height, z: 0 },
    0,
    pitchRad,
    rollRad
  );
  const centerY = pivotY + centerRot.y;

  const cx = Math.cos(pitchRad);
  const sx = Math.sin(pitchRad);
  const cz = Math.cos(rollRad);
  const sz = Math.sin(rollRad);

  // Row 2 (Y-axis components) of R_x(pitch) * R_z(roll)
  const ryx = cx * sz;
  const ryy = cx * cz;
  const ryz = -sx;

  const rx = width * 0.5;
  const ry = height * 0.5;
  const rz = depth * 0.5;

  let supportY: number;
  if (kind === 'prop' && shape === 'sphere') {
    supportY = Math.hypot(rx * ryx, ry * ryy, rz * ryz);
  } else if (
    kind === 'marker' ||
    (kind === 'prop' && (shape === 'cylinder' || shape === 'capsule'))
  ) {
    supportY = ry * Math.abs(ryy) + Math.hypot(rx * ryx, rz * ryz);
  } else {
    // Box prop (default)
    supportY =
      rx * Math.abs(ryx) + ry * Math.abs(ryy) + rz * Math.abs(ryz);
  }

  return {
    x: centerRot.x,
    y: Math.max(0, centerY + supportY) + clearanceM,
    z: centerRot.z,
  };
}

export interface EntityTargetAdapter<T> {
  items: Iterable<T>;
  getId: (item: T) => string;
  getLabel?: (item: T) => string | undefined;
  getAnchor: (item: T, part?: string) => Vec3;
  presetY?: number;
}

function resolveSingleTargetString<T>(
  rawKey: string,
  adapter: EntityTargetAdapter<T>
): Vec3 | undefined {
  const clean = rawKey.trim().toLowerCase();
  if (clean === 'center' || clean === 'origin' || clean === 'stage') {
    return { x: 0, y: adapter.presetY ?? 1.0, z: 0 };
  }
  const matched = matchEntityTargetKey(
    rawKey,
    adapter.items,
    adapter.getId,
    adapter.getLabel
  );
  return matched ? adapter.getAnchor(matched.item, matched.part) : undefined;
}

/**
 * Shared generic target anchor resolver supporting stage presets ('center'/'origin'/'stage'),
 * entity IDs/labels/sub-anchors, multi-entity centroid arrays, Vec3 literals, and metric offsets.
 */
export function resolveTargetPoint3DWithAdapter<T>(
  targetKey: TargetAnchor | undefined,
  adapter: EntityTargetAdapter<T>,
  fallbackTarget: Vec3,
  offset?: Vec3
): Vec3 {
  let base: Vec3 | undefined;

  if (!targetKey) {
    base = { ...fallbackTarget };
  } else if (Array.isArray(targetKey)) {
    const itemList = Array.isArray(adapter.items)
      ? adapter.items
      : Array.from(adapter.items);
    const listAdapter = { ...adapter, items: itemList };
    const anchors: Vec3[] = [];
    for (const key of targetKey) {
      const resolved = resolveSingleTargetString(key, listAdapter);
      if (resolved) {
        anchors.push(resolved);
      }
    }
    base =
      anchors.length > 0
        ? {
            x: anchors.reduce((sum, a) => sum + a.x, 0) / anchors.length,
            y: anchors.reduce((sum, a) => sum + a.y, 0) / anchors.length,
            z: anchors.reduce((sum, a) => sum + a.z, 0) / anchors.length,
          }
        : { ...fallbackTarget };
  } else if (typeof targetKey === 'object') {
    base = { ...targetKey };
  } else {
    base = resolveSingleTargetString(targetKey, adapter);
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
  return resolveTargetPoint3DWithAdapter(
    targetKey,
    {
      items: entitiesById.values(),
      getId: (ent) => ent.id,
      getLabel: (ent) => ent.def.label,
      getAnchor: getEntityLookAnchor,
    },
    fallbackTarget,
    offset
  );
}
