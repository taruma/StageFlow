/**
 * Types and low-level YAML AST node projection helpers for VisualScoreIR.
 * Pure Layer 1 module: zero React, DOM, or Three.js dependencies.
 */

import {
  isMap,
  isScalar,
  isSeq,
  type LineCounter,
  type Node,
  type YAMLMap,
  type YAMLSeq,
} from 'yaml';
import {
  lookupFieldDescriptor,
  SECTION_STRUCTURAL_KEYS,
  type FieldDescriptor,
  type SchemaSectionName,
  type YamlPath,
} from './scoreSchema';

export interface VisualFieldNode {
  key: string;
  canonicalKey: string;
  yamlPath: YamlPath;
  value: unknown;
  isFlowSeq?: boolean;
  descriptor: FieldDescriptor | null;
  lineRange?: [number, number];
  inheritedHint?: string;
}

export interface VisualBlockNode {
  key: string;
  yamlPath: YamlPath;
  lineRange?: [number, number];
  fields: VisualFieldNode[];
}

export interface VisualNamedBlockNode extends VisualBlockNode {
  name: string;
}

export interface VisualWaypointItem {
  index: number;
  yamlPath: YamlPath;
  lineRange?: [number, number];
  fields: VisualFieldNode[];
}

export interface VisualCameraBlockNode extends VisualBlockNode {
  rig?: VisualBlockNode & { points?: unknown[] };
  waypoints: VisualWaypointItem[];
  waypointsContainerPath?: YamlPath;
}

export interface VisualEntityItem {
  index: number;
  id: string;
  label: string;
  kind: string;
  color: string;
  yamlPath: YamlPath;
  lineRange?: [number, number];
  fields: VisualFieldNode[];
}

export interface VisualBlockingItem {
  index: number;
  id: string;
  label: string;
  entityId?: string;
  startSec: number;
  endSec: number;
  yamlPath: YamlPath;
  lineRange?: [number, number];
  fields: VisualFieldNode[];
  entityOverrides: VisualNamedBlockNode[];
  entitiesContainerPath?: YamlPath;
}

export interface VisualShotSummary {
  lensMm: number;
  maneuver: string;
  targetLabel: string;
  hasRig: boolean;
  hasObserver: boolean;
  hasEntities: boolean;
}

export interface VisualShotItem {
  index: number;
  shotNumber: number;
  id: string;
  label: string;
  startSec: number;
  endSec: number;
  summary: VisualShotSummary;
  yamlPath: YamlPath;
  lineRange?: [number, number];
  fields: VisualFieldNode[];
  stageCamera?: VisualCameraBlockNode;
  observerCamera?: VisualCameraBlockNode;
  entityOverrides: VisualNamedBlockNode[];
  entitiesContainerPath?: YamlPath;
}

export interface VisualObserverShotItem {
  index: number;
  id: string;
  label: string;
  startSec: number;
  endSec: number;
  yamlPath: YamlPath;
  lineRange?: [number, number];
  fields: VisualFieldNode[];
  camera?: VisualCameraBlockNode;
  flatWaypoints?: VisualWaypointItem[];
}

export interface VisualScoreIR {
  rootFields: VisualFieldNode[];
  optics: {
    exists: boolean;
    yamlPath: YamlPath;
    lineRange?: [number, number];
    fields: VisualFieldNode[];
  };
  stage: {
    exists: boolean;
    yamlPath: YamlPath;
    lineRange?: [number, number];
    fields: VisualFieldNode[];
    observerCamera?: VisualCameraBlockNode;
    stageCamera?: VisualCameraBlockNode;
  };
  entities: VisualEntityItem[];
  entitiesKey: string;
  blocking: VisualBlockingItem[];
  blockingKey: string;
  shots: VisualShotItem[];
  shotsKey: string;
  observerShots: VisualObserverShotItem[];
  observerShotsKey: string;
}

export interface VisualScoreIRResult {
  ir: VisualScoreIR | null;
  error: string | null;
}

export function getNodeLineRange(
  node: Node | null | undefined,
  lineCounter?: LineCounter
): [number, number] | undefined {
  if (!lineCounter || !node || !node.range) return undefined;
  const start = lineCounter.linePos(node.range[0]).line;
  const endOffset = Math.max(node.range[0], node.range[1] - 1);
  const end = lineCounter.linePos(endOffset).line;
  return [start, Math.max(start, end)];
}

export function findMapPairByKeys(
  map: YAMLMap,
  candidateKeys: readonly string[]
): { key: string; node: Node } | null {
  for (const candidate of candidateKeys) {
    for (const pair of map.items) {
      const k = isScalar(pair.key) ? String(pair.key.value) : '';
      if (k === candidate && pair.value) {
        return { key: k, node: pair.value as Node };
      }
    }
  }
  return null;
}

export function projectMapFields(
  map: YAMLMap,
  basePath: YamlPath,
  section: SchemaSectionName,
  lineCounter?: LineCounter,
  inheritedHints?: Record<string, string>
): VisualFieldNode[] {
  const structural = new Set(SECTION_STRUCTURAL_KEYS[section]);
  const fields: VisualFieldNode[] = [];

  for (const pair of map.items) {
    if (!isScalar(pair.key)) continue;
    const rawKey = String(pair.key.value);
    if (structural.has(rawKey)) continue;

    const valNode = pair.value as Node | null | undefined;
    const descriptor = lookupFieldDescriptor(section, rawKey);
    const canonicalKey = descriptor ? descriptor.key : rawKey;
    const value = valNode ? valNode.toJSON() : null;
    const isFlowSeq = isSeq(valNode) ? Boolean(valNode.flow) : undefined;
    const lineRange = getNodeLineRange(valNode ?? pair.key, lineCounter);

    fields.push({
      key: rawKey,
      canonicalKey,
      yamlPath: [...basePath, rawKey],
      value,
      ...(isFlowSeq !== undefined ? { isFlowSeq } : {}),
      descriptor,
      lineRange,
      ...(inheritedHints?.[canonicalKey]
        ? { inheritedHint: inheritedHints[canonicalKey] }
        : {}),
    });
  }

  return fields;
}

export function projectCameraBlockNode(
  map: YAMLMap,
  key: string,
  basePath: YamlPath,
  lineCounter?: LineCounter,
  inheritedHints?: Record<string, string>
): VisualCameraBlockNode {
  const blockPath: YamlPath = [...basePath, key];
  const fields = projectMapFields(
    map,
    blockPath,
    'cameraCue',
    lineCounter,
    inheritedHints
  );

  let rig: (VisualBlockNode & { points?: unknown[] }) | undefined;
  const rigPair = findMapPairByKeys(map, ['rig']);
  if (rigPair && isMap(rigPair.node)) {
    const rigPath: YamlPath = [...blockPath, 'rig'];
    const rigFields = projectMapFields(
      rigPair.node,
      rigPath,
      'rig',
      lineCounter
    );
    const ptsPair = findMapPairByKeys(rigPair.node, ['points', 'waypoints']);
    const points =
      ptsPair && isSeq(ptsPair.node)
        ? (ptsPair.node.toJSON() as unknown[])
        : undefined;
    rig = {
      key: 'rig',
      yamlPath: rigPath,
      lineRange: getNodeLineRange(rigPair.node, lineCounter),
      fields: rigFields,
      ...(points ? { points } : {}),
    };
  }

  const waypoints: VisualWaypointItem[] = [];
  const wpPair = findMapPairByKeys(map, ['waypoints']);
  let waypointsContainerPath: YamlPath | undefined;
  if (wpPair && isSeq(wpPair.node)) {
    waypointsContainerPath = [...blockPath, 'waypoints'];
    wpPair.node.items.forEach((wpNode, wpIdx) => {
      if (!isMap(wpNode as Node)) return;
      const wpMap = wpNode as YAMLMap;
      const wpPath: YamlPath = [...waypointsContainerPath!, wpIdx];
      waypoints.push({
        index: wpIdx,
        yamlPath: wpPath,
        lineRange: getNodeLineRange(wpMap, lineCounter),
        fields: projectMapFields(wpMap, wpPath, 'waypoint', lineCounter),
      });
    });
  }

  return {
    key,
    yamlPath: blockPath,
    lineRange: getNodeLineRange(map, lineCounter),
    fields,
    ...(rig ? { rig } : {}),
    waypoints,
    ...(waypointsContainerPath ? { waypointsContainerPath } : {}),
  };
}

export function projectEntityOverrideMap(
  entitiesMap: YAMLMap,
  containerPath: YamlPath,
  lineCounter?: LineCounter
): VisualNamedBlockNode[] {
  const list: VisualNamedBlockNode[] = [];
  for (const pair of entitiesMap.items) {
    if (!isScalar(pair.key) || !pair.value || !isMap(pair.value as Node)) {
      continue;
    }
    const name = String(pair.key.value);
    const ovMap = pair.value as YAMLMap;
    const ovPath: YamlPath = [...containerPath, name];
    list.push({
      key: name,
      name,
      yamlPath: ovPath,
      lineRange: getNodeLineRange(ovMap, lineCounter),
      fields: projectMapFields(ovMap, ovPath, 'blockingEntity', lineCounter),
    });
  }
  return list;
}

export function seqItems(seq: YAMLSeq): Node[] {
  return seq.items.filter((item): item is Node => Boolean(item));
}
