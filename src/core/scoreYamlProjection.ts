/**
 * Single-parse read-only authoring projection (`VisualScoreIR`) from canonical `rawYaml`.
 * Preserves exact YAML path provenance, authored-only keys, source line ranges,
 * and backward compatibility across coupled & decoupled score layouts.
 * Pure Layer 1 module: zero React, DOM, or Three.js dependencies.
 */

import {
  Document,
  LineCounter,
  isMap,
  isSeq,
  parseDocument,
  type Node,
  type YAMLMap,
} from 'yaml';
import type { StageScore } from './types';
import {
  findMapPairByKeys,
  getNodeLineRange,
  projectCameraBlockNode,
  projectEntityOverrideMap,
  projectMapFields,
  type VisualBlockingItem,
  type VisualEntityItem,
  type VisualObserverShotItem,
  type VisualScoreIR,
  type VisualScoreIRResult,
  type VisualShotItem,
  type VisualWaypointItem,
} from './scoreYamlProjectionHelpers';
import { radToDeg } from './sphericalMath';

export * from './scoreYamlProjectionHelpers';

function formatTargetSummary(rawTarget: unknown): string {
  if (typeof rawTarget === 'string' && rawTarget.trim().length > 0) {
    return rawTarget.trim();
  }
  if (Array.isArray(rawTarget)) {
    if (rawTarget.every((x) => typeof x === 'string')) {
      return rawTarget.join('+');
    }
    if (rawTarget.length >= 3) {
      return `[${rawTarget.slice(0, 3).map((n) => Number(n).toFixed(1)).join(',')}]`;
    }
  }
  return 'stage';
}

function buildShotInheritedHints(
  shotIndex: number,
  score: StageScore | null
): Record<string, string> | undefined {
  if (!score || shotIndex < 0 || shotIndex >= score.shots.length) {
    return undefined;
  }
  const shot = score.shots[shotIndex];
  const cam = shot.stageCamera;
  if (!cam) return undefined;

  const hints: Record<string, string> = {};
  if (cam.focalLengthMm !== undefined) {
    hints.lens = `${Math.round(cam.focalLengthMm)}mm`;
  }
  if (cam.distance !== undefined) {
    hints.distance = `${cam.distance.toFixed(2)}m`;
  }
  if (cam.pitchRad !== undefined) {
    hints.pitch = `${radToDeg(cam.pitchRad).toFixed(1)}°`;
  }
  if (cam.yawRad !== undefined) {
    hints.yaw = `${radToDeg(cam.yawRad).toFixed(1)}°`;
  }
  return hints;
}

/**
 * Projects a parsed `yaml.Document` AST into a read-only `VisualScoreIR` without re-parsing YAML text.
 */
export function projectVisualScoreIRFromDoc(
  doc: Document,
  score: StageScore | null,
  lineCounter?: LineCounter
): VisualScoreIRResult {
  if (doc.errors.length > 0) {
    return { ir: null, error: doc.errors[0].message };
  }

  const contents = doc.contents;
  if (!contents || !isMap(contents)) {
    return {
      ir: null,
      error: 'Score root must be a YAML object mapping.',
    };
  }
  const rootMap = contents as YAMLMap;

  const rootFields = projectMapFields(rootMap, [], 'root', lineCounter);

  // Optics block
  const opticsPair = findMapPairByKeys(rootMap, ['optics']);
  const opticsMap = opticsPair && isMap(opticsPair.node) ? opticsPair.node : null;
  const optics = {
    exists: Boolean(opticsMap),
    yamlPath: ['optics'] as const,
    lineRange: opticsMap ? getNodeLineRange(opticsMap, lineCounter) : undefined,
    fields: opticsMap
      ? projectMapFields(opticsMap, ['optics'], 'optics', lineCounter)
      : [],
  };

  // Stage block
  const stagePair = findMapPairByKeys(rootMap, ['stage']);
  const stageMap = stagePair && isMap(stagePair.node) ? stagePair.node : null;
  const stageObsPair = stageMap
    ? findMapPairByKeys(stageMap, ['observer_camera', 'observerCamera'])
    : null;
  const stageCamPair = stageMap
    ? findMapPairByKeys(stageMap, ['stage_camera', 'stageCamera'])
    : null;

  const stage = {
    exists: Boolean(stageMap),
    yamlPath: ['stage'] as const,
    lineRange: stageMap ? getNodeLineRange(stageMap, lineCounter) : undefined,
    fields: stageMap
      ? projectMapFields(stageMap, ['stage'], 'stage', lineCounter)
      : [],
    observerCamera:
      stageObsPair && isMap(stageObsPair.node)
        ? projectCameraBlockNode(
            stageObsPair.node,
            stageObsPair.key,
            ['stage'],
            lineCounter
          )
        : undefined,
    stageCamera:
      stageCamPair && isMap(stageCamPair.node)
        ? projectCameraBlockNode(
            stageCamPair.node,
            stageCamPair.key,
            ['stage'],
            lineCounter
          )
        : undefined,
  };

  // Entities
  const entitiesPair = findMapPairByKeys(rootMap, ['entities']);
  const entitiesKey = entitiesPair?.key ?? 'entities';
  const entities: VisualEntityItem[] = [];
  if (entitiesPair && isSeq(entitiesPair.node)) {
    entitiesPair.node.items.forEach((item, idx) => {
      if (!isMap(item as Node)) return;
      const entMap = item as YAMLMap;
      const js = entMap.toJSON() as Record<string, unknown>;
      const parsedEnt = score?.entities[idx];
      const entPath = [entitiesKey, idx] as const;
      entities.push({
        index: idx,
        id: String(js.id ?? parsedEnt?.id ?? `entity_${idx + 1}`),
        label: String(js.label ?? js.id ?? parsedEnt?.label ?? `Entity ${idx + 1}`),
        kind: String(js.kind ?? parsedEnt?.kind ?? 'character'),
        color: String(js.color ?? parsedEnt?.color ?? '#38bdf8'),
        yamlPath: entPath,
        lineRange: getNodeLineRange(entMap, lineCounter),
        fields: projectMapFields(entMap, entPath, 'entity', lineCounter),
      });
    });
  }

  // Blocking cues (supports both single-entity and multi-entity `entities:` map)
  const blockingPair = findMapPairByKeys(rootMap, ['blocking']);
  const blockingKey = blockingPair?.key ?? 'blocking';
  const blocking: VisualBlockingItem[] = [];
  if (blockingPair && isSeq(blockingPair.node)) {
    blockingPair.node.items.forEach((item, idx) => {
      if (!isMap(item as Node)) return;
      const blkMap = item as YAMLMap;
      const js = blkMap.toJSON() as Record<string, unknown>;
      const blkPath = [blockingKey, idx] as const;
      const id = String(js.id ?? `blocking-${idx + 1}`);
      const label = String(js.label ?? js.name ?? id);
      const rawEntity = js.entity ?? js.entity_id ?? js.entityId ?? js.actor ?? js.subject;
      const entityId = typeof rawEntity === 'string' ? rawEntity : undefined;

      // Resolve runtime timing from parsed score blocking cues if available
      const matchedParsedCue = score?.blocking?.find(
        (b) => b.id === id || b.id.startsWith(`${id}:`)
      );
      const startSec =
        typeof js.start === 'number'
          ? js.start
          : matchedParsedCue?.startSec ?? 0;
      const endSec =
        typeof js.end === 'number'
          ? js.end
          : matchedParsedCue?.endSec ?? startSec + 5;

      const entMapPair = findMapPairByKeys(blkMap, ['entities']);
      const entitiesContainerPath =
        entMapPair && isMap(entMapPair.node)
          ? ([...blkPath, 'entities'] as const)
          : undefined;
      const entityOverrides =
        entMapPair && isMap(entMapPair.node)
          ? projectEntityOverrideMap(entMapPair.node, entitiesContainerPath!, lineCounter)
          : [];

      blocking.push({
        index: idx,
        id,
        label,
        ...(entityId ? { entityId } : {}),
        startSec,
        endSec,
        yamlPath: blkPath,
        lineRange: getNodeLineRange(blkMap, lineCounter),
        fields: projectMapFields(blkMap, blkPath, 'blockingCue', lineCounter),
        entityOverrides,
        ...(entitiesContainerPath ? { entitiesContainerPath } : {}),
      });
    });
  }

  // Shots
  const shotsPair = findMapPairByKeys(rootMap, ['shots', 'score']);
  const shotsKey = shotsPair?.key ?? 'shots';
  const shots: VisualShotItem[] = [];
  if (shotsPair && isSeq(shotsPair.node)) {
    shotsPair.node.items.forEach((item, idx) => {
      if (!isMap(item as Node)) return;
      const shotMap = item as YAMLMap;
      const js = shotMap.toJSON() as Record<string, unknown>;
      const shotPath = [shotsKey, idx] as const;
      const parsedShot = score?.shots[idx];
      const hints = buildShotInheritedHints(idx, score);

      const stageCamPair = findMapPairByKeys(shotMap, [
        'stage_camera',
        'stageCamera',
        'camera',
      ]);
      const obsCamPair = findMapPairByKeys(shotMap, [
        'observer_camera',
        'observerCamera',
      ]);
      const entMapPair = findMapPairByKeys(shotMap, ['entities']);

      const stageCamera =
        stageCamPair && isMap(stageCamPair.node)
          ? projectCameraBlockNode(
              stageCamPair.node,
              stageCamPair.key,
              shotPath,
              lineCounter,
              hints
            )
          : undefined;

      const observerCamera =
        obsCamPair && isMap(obsCamPair.node)
          ? projectCameraBlockNode(
              obsCamPair.node,
              obsCamPair.key,
              shotPath,
              lineCounter
            )
          : undefined;

      const entitiesContainerPath =
        entMapPair && isMap(entMapPair.node)
          ? ([...shotPath, 'entities'] as const)
          : undefined;
      const entityOverrides =
        entMapPair && isMap(entMapPair.node)
          ? projectEntityOverrideMap(entMapPair.node, entitiesContainerPath!, lineCounter)
          : [];

      const startSec =
        typeof js.start === 'number' ? js.start : parsedShot?.startSec ?? 0;
      const endSec =
        typeof js.end === 'number'
          ? js.end
          : parsedShot?.endSec ?? startSec + 5;

      const camJs = (
        stageCamPair && isMap(stageCamPair.node)
          ? stageCamPair.node.toJSON()
          : js
      ) as Record<string, unknown>;

      const lensMm = Math.round(
        parsedShot?.stageCamera?.focalLengthMm ??
          parsedShot?.stageCamera?.focalLengthStartMm ??
          score?.stage.defaultStageCameraPose.focalLengthMm ??
          50
      );
      const maneuver = String(
        parsedShot?.stageCamera?.maneuver ?? camJs.maneuver ?? 'dolly'
      );
      const targetLabel = formatTargetSummary(
        camJs.target ?? parsedShot?.stageCamera?.target
      );

      shots.push({
        index: idx,
        shotNumber:
          typeof js.shot === 'number'
            ? js.shot
            : parsedShot?.shotNumber ?? idx + 1,
        id: String(js.id ?? parsedShot?.id ?? `shot-${idx + 1}`),
        label: String(js.label ?? js.name ?? parsedShot?.label ?? `Shot ${idx + 1}`),
        startSec,
        endSec,
        summary: {
          lensMm,
          maneuver,
          targetLabel,
          hasRig: Boolean(parsedShot?.stageCamera?.rig || stageCamera?.rig),
          hasObserver: Boolean(observerCamera),
          hasEntities: entityOverrides.length > 0,
        },
        yamlPath: shotPath,
        lineRange: getNodeLineRange(shotMap, lineCounter),
        fields: projectMapFields(shotMap, shotPath, 'shot', lineCounter, hints),
        ...(stageCamera ? { stageCamera } : {}),
        ...(observerCamera ? { observerCamera } : {}),
        entityOverrides,
        ...(entitiesContainerPath ? { entitiesContainerPath } : {}),
      });
    });
  }

  // Decoupled Observer Shots
  const obsPair = findMapPairByKeys(rootMap, [
    'observer_shots',
    'observerShots',
  ]);
  const observerShotsKey = obsPair?.key ?? 'observer_shots';
  const observerShots: VisualObserverShotItem[] = [];
  if (obsPair && isSeq(obsPair.node)) {
    obsPair.node.items.forEach((item, idx) => {
      if (!isMap(item as Node)) return;
      const osMap = item as YAMLMap;
      const js = osMap.toJSON() as Record<string, unknown>;
      const osPath = [observerShotsKey, idx] as const;
      const parsedOs = score?.observerShots?.[idx];

      const camPair = findMapPairByKeys(osMap, [
        'observer_camera',
        'observerCamera',
        'camera',
      ]);

      const wpPair = findMapPairByKeys(osMap, ['waypoints']);
      const flatWaypoints: VisualWaypointItem[] | undefined =
        wpPair && isSeq(wpPair.node)
          ? wpPair.node.items
              .map((wpNode, wpIdx): VisualWaypointItem | null => {
                if (!isMap(wpNode as Node)) return null;
                const wpMap = wpNode as YAMLMap;
                const wpPath = [...osPath, 'waypoints', wpIdx];
                return {
                  index: wpIdx,
                  yamlPath: wpPath,
                  lineRange: getNodeLineRange(wpMap, lineCounter),
                  fields: projectMapFields(wpMap, wpPath, 'waypoint', lineCounter),
                };
              })
              .filter((w): w is VisualWaypointItem => w !== null)
          : undefined;

      const startSec =
        typeof js.start === 'number' ? js.start : parsedOs?.startSec ?? 0;
      const endSec =
        typeof js.end === 'number' ? js.end : parsedOs?.endSec ?? startSec + 5;

      observerShots.push({
        index: idx,
        id: String(js.id ?? parsedOs?.id ?? `obs-shot-${idx + 1}`),
        label: String(
          js.label ?? js.name ?? parsedOs?.label ?? `Observer ${idx + 1}`
        ),
        startSec,
        endSec,
        yamlPath: osPath,
        lineRange: getNodeLineRange(osMap, lineCounter),
        fields: projectMapFields(osMap, osPath, 'observerShot', lineCounter),
        ...(camPair && isMap(camPair.node)
          ? {
              camera: projectCameraBlockNode(
                camPair.node,
                camPair.key,
                osPath,
                lineCounter
              ),
            }
          : {}),
        ...(flatWaypoints && flatWaypoints.length > 0 ? { flatWaypoints } : {}),
      });
    });
  }

  const ir: VisualScoreIR = {
    rootFields,
    optics,
    stage,
    entities,
    entitiesKey,
    blocking,
    blockingKey,
    shots,
    shotsKey,
    observerShots,
    observerShotsKey,
  };

  return { ir, error: null };
}

/**
 * Projects a raw YAML string into a read-only `VisualScoreIR` using a single
 * `yaml.parseDocument()` pass paired with optional `StageScore` telemetry.
 */
export function projectVisualScoreIR(
  rawYaml: string,
  score: StageScore | null
): VisualScoreIRResult {
  if (!rawYaml || rawYaml.trim().length === 0) {
    return { ir: null, error: 'Score content is empty.' };
  }

  const lineCounter = new LineCounter();
  const doc = parseDocument(rawYaml, { lineCounter });
  return projectVisualScoreIRFromDoc(doc, score, lineCounter);
}
