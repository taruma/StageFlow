/**
 * Pure 2D SVG geometry and target projection helpers for ScoreStageMinimap.
 * Layer 5 UI Utilities (zero React/DOM runtime dependencies).
 */

import type {
  CameraCueSpec,
  EntityKind,
  EntityShape,
  SceneEntityDef,
  StageScore,
  TargetAnchor,
  Vec3,
} from '../../core/types';
import {
  ZERO_OFFSET,
  getEntityDefLookAnchor,
  resolveTargetPoint3DWithAdapter,
} from '../../core/cameraTargetResolver';

export interface Point2D {
  x: number;
  z: number;
}

export interface MinimapEntityItem {
  id: string;
  label: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  shape?: EntityShape;
  rotationYRad: number;
  color: string;
  kind: EntityKind;
}

export interface MinimapLayout {
  viewBox: string;
  entities: MinimapEntityItem[];
  cameraPos: Point2D;
  cameraTarget: Point2D;
  cameraConePath: string;
  cameraTrackPath: string;
}

/**
 * Resolves a TargetAnchor (preset 'center'/'origin'/'stage', entity ID/label/sub-anchor,
 * multi-entity array centroid, or Vec3) onto the 2D XZ stage floor, applying optional metric offset.
 * Stage presets are checked before entity matching so presets remain unambiguous.
 */
export function resolveMinimapTargetXZ(
  target: TargetAnchor | undefined,
  rawEntities: SceneEntityDef[],
  offset?: Vec3,
  fallbackXZ: Point2D = { x: 0, z: 0 }
): Point2D {
  const resolved = resolveTargetPoint3DWithAdapter(
    target,
    {
      items: rawEntities,
      getId: (e) => e.id,
      getLabel: (e) => e.label,
      getAnchor: getEntityDefLookAnchor,
      presetY: 0,
    },
    { x: fallbackXZ.x, y: 0, z: fallbackXZ.z },
    offset
  );
  return { x: resolved.x, z: resolved.z };
}

/**
 * Resolves the effective XZ target offset for a minimap camera shot cue,
 * respecting targetOffsetEnd / targetOffset / targetOffsetStart and continuous inheritance.
 */
export function resolveMinimapShotOffset(
  sc: Pick<CameraCueSpec, 'targetOffset' | 'targetOffsetStart' | 'targetOffsetEnd'>,
  prevOffset: Vec3 = ZERO_OFFSET,
  isContinuousMove = false
): Vec3 {
  if (sc.targetOffsetEnd !== undefined) return sc.targetOffsetEnd;
  if (sc.targetOffset !== undefined) return sc.targetOffset;
  if (sc.targetOffsetStart !== undefined) return sc.targetOffsetStart;
  return isContinuousMove ? prevOffset : ZERO_OFFSET;
}

/**
 * Computes the complete SVG viewBox, entity footprints, opening camera frustum cone,
 * and multi-shot camera trajectory path for a StageScore.
 */
export function computeMinimapLayout(score: StageScore): MinimapLayout {
  const allPoints: Point2D[] = [{ x: 0, z: 0 }];
  const rawEntities = score?.entities ?? [];

  // 1. Collect entity starting positions
  const entities: MinimapEntityItem[] = rawEntities.map((ent) => {
    const x = ent.position?.x ?? 0;
    const z = ent.position?.z ?? 0;
    const width = ent.width ?? ent.radius * 2;
    const depth = ent.depth ?? ent.radius * 2;
    const halfSpan = Math.max(width, depth) * 0.5;
    allPoints.push({ x: x - halfSpan, z: z - halfSpan });
    allPoints.push({ x: x + halfSpan, z: z + halfSpan });
    return {
      id: ent.id,
      label: ent.label || ent.id,
      x,
      z,
      width,
      depth,
      shape: ent.shape,
      rotationYRad: ent.rotationYRad ?? 0,
      color: ent.color || '#38bdf8',
      kind: ent.kind,
    };
  });

  // 2. Resolve opening and multi-shot camera poses
  let camX = 0;
  let camZ = 5;
  let targetX = 0;
  let targetZ = 0;

  let prevBaseTargetXZ: Point2D = score?.stage?.defaultStageCameraPose?.target
    ? {
        x: score.stage.defaultStageCameraPose.target.x,
        z: score.stage.defaultStageCameraPose.target.z,
      }
    : { x: 0, z: 0 };
  let prevOffset: Vec3 = ZERO_OFFSET;

  const camPoints: Point2D[] = [];
  const shots = score?.shots ?? [];

  shots.forEach((shot, idx) => {
    if (!shot.stageCamera) return;
    const sc = shot.stageCamera;
    const isContinuousMove = Boolean(shot.continuous ?? score.continuous) && idx > 0;
    const offset = resolveMinimapShotOffset(sc, prevOffset, isContinuousMove);
    const baseTargetXZ =
      sc.target !== undefined
        ? resolveMinimapTargetXZ(sc.target, rawEntities, undefined, prevBaseTargetXZ)
        : { ...prevBaseTargetXZ };
    const tX = baseTargetXZ.x + offset.x;
    const tZ = baseTargetXZ.z + offset.z;

    prevBaseTargetXZ = baseTargetXZ;
    prevOffset = offset;

    const dist = Math.max(1.5, sc.distance ?? 5.0);
    const pitch = sc.pitchRad ?? 0.25;
    const yaw = sc.yawRad ?? 0;
    const cosPitch = Math.cos(pitch);

    const cX = tX + dist * cosPitch * Math.sin(yaw);
    const cZ = tZ + dist * cosPitch * Math.cos(yaw);

    if (idx === 0) {
      targetX = tX;
      targetZ = tZ;
      camX = cX;
      camZ = cZ;
      allPoints.push({ x: targetX, z: targetZ });
    }

    camPoints.push({ x: cX, z: cZ });
    allPoints.push({ x: cX, z: cZ });
  });

  // 3. Compute dynamic bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  allPoints.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  });

  // Ensure minimum symmetric stage span of at least 10m x 10m
  const spanX = Math.max(10, (maxX - minX) * 1.35);
  const spanZ = Math.max(10, (maxZ - minZ) * 1.35);
  const span = Math.max(spanX, spanZ);

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const half = span / 2;
  const boxMinX = Number((centerX - half).toFixed(2));
  const boxMinZ = Number((centerZ - half).toFixed(2));
  const boxSize = Number(span.toFixed(2));

  // 4. Construct camera viewing frustum cone
  const dirX = targetX - camX;
  const dirZ = targetZ - camZ;
  const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
  const ndx = dirX / len;
  const ndz = dirZ / len;

  const px = -ndz;
  const pz = ndx;
  const coneDist = Math.min(len * 0.85, 4.5);
  const coneWidth = coneDist * 0.45;

  const pLeftX = camX + ndx * coneDist + px * coneWidth;
  const pLeftZ = camZ + ndz * coneDist + pz * coneWidth;
  const pRightX = camX + ndx * coneDist - px * coneWidth;
  const pRightZ = camZ + ndz * coneDist - pz * coneWidth;

  const cameraConePath = `M ${camX.toFixed(2)} ${camZ.toFixed(2)} L ${pLeftX.toFixed(2)} ${pLeftZ.toFixed(2)} L ${pRightX.toFixed(2)} ${pRightZ.toFixed(2)} Z`;

  // 5. Construct camera trajectory path if multiple shots exist
  let cameraTrackPath = '';
  if (camPoints.length > 1) {
    cameraTrackPath = camPoints.reduce((acc, pt, idx) => {
      return `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.z.toFixed(2)}`;
    }, '');
  }

  return {
    viewBox: `${boxMinX} ${boxMinZ} ${boxSize} ${boxSize}`,
    entities,
    cameraPos: { x: camX, z: camZ },
    cameraTarget: { x: targetX, z: targetZ },
    cameraConePath,
    cameraTrackPath,
  };
}
