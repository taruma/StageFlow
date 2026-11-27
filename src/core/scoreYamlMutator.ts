/**
 * Pure, comment-preserving YAML AST command mutator for StageFlow choreography scores.
 * Uses `yaml.parseDocument()` to surgically update only touched nodes while leaving
 * `#` comments, section banners, key order, and formatting intact.
 * Pure Layer 1 module: zero React, DOM, or Three.js dependencies.
 */

import {
  Document,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  YAMLMap,
  YAMLSeq,
  type Node,
} from 'yaml';
import type { ShotTimingEditMode } from './types';
import type { YamlPath } from './schema/scoreSchemaTypes';
import {
  applyAdjustShotTiming,
  applyInsertShotSplit,
  findSeqKey,
  getOrCreateRootSeq,
  roundSec,
  setMapScalarValue,
} from './scoreYamlTimingMutator';

export type ScalarFormatHint = 'lens-mm' | 'aperture' | 'vec3-flow' | 'plain';

export type ScoreYamlCommand =
  | {
      type: 'set-field';
      path: YamlPath;
      value: unknown;
      format?: ScalarFormatHint;
    }
  | {
      type: 'add-field';
      parentPath: YamlPath;
      key: string;
      value: unknown;
      format?: ScalarFormatHint;
    }
  | { type: 'remove-field'; path: YamlPath }
  | {
      type: 'reorder-map-key';
      parentPath: YamlPath;
      fromKey: string;
      toKey: string;
    }
  | { type: 'insert-entity'; afterIndex: number }
  | { type: 'delete-entity'; index: number }
  | { type: 'reorder-entity'; fromIndex: number; toIndex: number }
  | { type: 'insert-blocking'; afterIndex: number; defaultEntityId?: string }
  | { type: 'delete-blocking'; index: number }
  | { type: 'reorder-blocking'; fromIndex: number; toIndex: number }
  | { type: 'insert-shot-split'; afterIndex: number }
  | { type: 'delete-shot'; index: number }
  | { type: 'reorder-shot'; fromIndex: number; toIndex: number }
  | {
      type: 'adjust-shot-timing';
      shotIndex: number;
      edge: 'start' | 'end';
      nextValueSec: number;
      mode: ShotTimingEditMode;
    }
  | { type: 'insert-observer-shot'; afterIndex: number }
  | { type: 'delete-observer-shot'; index: number }
  | { type: 'reorder-observer-shot'; fromIndex: number; toIndex: number };

function formatValueForWrite(
  value: unknown,
  format?: ScalarFormatHint,
  existingNode?: unknown
): unknown {
  if (format === 'lens-mm' && typeof value === 'number' && Number.isFinite(value)) {
    // Preserve numeric style if authored as plain number, otherwise emit "50mm"
    if (isScalar(existingNode) && typeof existingNode.value === 'number') {
      return Math.round(value);
    }
    return `${Math.round(value)}mm`;
  }
  if (format === 'aperture' && typeof value === 'number' && Number.isFinite(value)) {
    const fixed = Number(value.toFixed(1));
    return `f/${fixed}`;
  }
  return value;
}

function createFormattedNode(
  doc: Document,
  value: unknown,
  format?: ScalarFormatHint
): Node {
  const node = doc.createNode(value);
  if ((format === 'vec3-flow' || Array.isArray(value)) && isSeq(node)) {
    node.flow = true;
  }
  return node;
}

function ensureMapAtPath(doc: Document, path: YamlPath): YAMLMap | null {
  if (!isMap(doc.contents)) {
    return null;
  }
  let curr: YAMLMap = doc.contents;
  for (const seg of path) {
    if (typeof seg === 'number') {
      return null;
    }
    const next = curr.get(seg, true);
    if (isMap(next)) {
      curr = next;
    } else if (next === undefined) {
      const created = new YAMLMap();
      curr.set(seg, created);
      curr = created;
    } else {
      return null;
    }
  }
  return curr;
}

function applySetField(
  doc: Document,
  path: YamlPath,
  rawValue: unknown,
  format?: ScalarFormatHint
): void {
  if (path.length === 0) return;
  const existing = doc.getIn(path, true);
  const formatted = formatValueForWrite(rawValue, format, existing);

  if (isScalar(existing)) {
    existing.value = formatted;
    return;
  }

  if (isSeq(existing) && Array.isArray(formatted)) {
    const wasFlow = existing.flow;
    existing.items = formatted.map((v) => doc.createNode(v));
    existing.flow = wasFlow || format === 'vec3-flow';
    return;
  }

  const parentPath = path.slice(0, -1);
  const key = path[path.length - 1];
  const parent = parentPath.length === 0 ? doc.contents : doc.getIn(parentPath, true);
  if (isMap(parent) && typeof key === 'string') {
    parent.set(key, createFormattedNode(doc, formatted, format));
  } else {
    doc.setIn(path, createFormattedNode(doc, formatted, format));
  }
}

function applyAddField(
  doc: Document,
  parentPath: YamlPath,
  key: string,
  rawValue: unknown,
  format?: ScalarFormatHint
): void {
  const parentNode =
    parentPath.length === 0 ? doc.contents : doc.getIn(parentPath, true);
  const targetMap = isMap(parentNode)
    ? parentNode
    : ensureMapAtPath(doc, parentPath);
  if (!targetMap) return;
  const formatted = formatValueForWrite(rawValue, format);
  targetMap.set(key, createFormattedNode(doc, formatted, format));
}

function generateUniqueItemId(seq: YAMLSeq, prefix: string): string {
  const existing = new Set<string>();
  for (const item of seq.items) {
    if (isMap(item as Node)) {
      const id = (item as YAMLMap).get('id');
      if (typeof id === 'string') existing.add(id);
    }
  }
  let idx = seq.items.length + 1;
  while (existing.has(`${prefix}-${idx}`)) {
    idx += 1;
  }
  return `${prefix}-${idx}`;
}

function reorderSeqItem(seq: YAMLSeq, fromIndex: number, toIndex: number): void {
  if (
    fromIndex < 0 ||
    fromIndex >= seq.items.length ||
    toIndex < 0 ||
    toIndex >= seq.items.length ||
    fromIndex === toIndex
  ) {
    return;
  }
  const [moved] = seq.items.splice(fromIndex, 1);
  seq.items.splice(toIndex, 0, moved);
}

function deleteSeqItem(seq: YAMLSeq, index: number): void {
  if (index < 0 || index >= seq.items.length) return;
  seq.items.splice(index, 1);
}

function applyReorderMapKey(
  doc: Document,
  parentPath: YamlPath,
  fromKey: string,
  toKey: string
): void {
  const target =
    parentPath.length === 0 ? doc.contents : doc.getIn(parentPath, true);
  if (!isMap(target) || fromKey === toKey) return;

  const fromIdx = target.items.findIndex(
    (pair) => isScalar(pair.key) && String(pair.key.value) === fromKey
  );
  const toIdx = target.items.findIndex(
    (pair) => isScalar(pair.key) && String(pair.key.value) === toKey
  );
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

  const [moved] = target.items.splice(fromIdx, 1);
  target.items.splice(toIdx, 0, moved);
}

export interface ScoreYamlMutationResult {
  nextYaml: string;
  doc: Document | null;
  changed: boolean;
}

/**
 * Applies a pure structural or field command to `rawYaml` while preserving comments and formatting,
 * returning the updated YAML string and parsed AST Document for downstream single-parse reuse.
 */
export function applyScoreYamlCommandDetailed(
  rawYaml: string,
  command: ScoreYamlCommand
): ScoreYamlMutationResult {
  const doc = parseDocument(rawYaml);
  if (doc.errors.length > 0 || !isMap(doc.contents)) {
    return { nextYaml: rawYaml, doc: null, changed: false };
  }
  const root = doc.contents as YAMLMap;

  switch (command.type) {
    case 'set-field':
      applySetField(doc, command.path, command.value, command.format);
      break;

    case 'add-field':
      applyAddField(
        doc,
        command.parentPath,
        command.key,
        command.value,
        command.format
      );
      break;

    case 'remove-field':
      doc.deleteIn(command.path);
      break;

    case 'reorder-map-key':
      applyReorderMapKey(
        doc,
        command.parentPath,
        command.fromKey,
        command.toKey
      );
      break;

    case 'insert-entity': {
      const seq = getOrCreateRootSeq(doc, 'entities');
      const id = generateUniqueItemId(seq, 'entity');
      const entMap = new YAMLMap();
      entMap.set('id', doc.createNode(id));
      entMap.set('label', doc.createNode('New Actor'));
      entMap.set('kind', doc.createNode('character'));
      const pos = doc.createNode([0, 0, 0]);
      if (isSeq(pos)) pos.flow = true;
      entMap.set('position', pos);
      entMap.set('rotation', doc.createNode(0));
      entMap.set('color', doc.createNode('#38bdf8'));
      const insertAt = Math.max(
        0,
        Math.min(seq.items.length, command.afterIndex + 1)
      );
      seq.items.splice(insertAt, 0, entMap);
      break;
    }

    case 'delete-entity': {
      const seq = root.get('entities', true);
      if (isSeq(seq)) deleteSeqItem(seq, command.index);
      break;
    }

    case 'reorder-entity': {
      const seq = root.get('entities', true);
      if (isSeq(seq)) reorderSeqItem(seq, command.fromIndex, command.toIndex);
      break;
    }

    case 'insert-blocking': {
      const seq = getOrCreateRootSeq(doc, 'blocking');
      const id = generateUniqueItemId(seq, 'cue');
      const blkMap = new YAMLMap();
      blkMap.set('id', doc.createNode(id));
      let entityId = command.defaultEntityId;
      if (!entityId) {
        const entSeq = root.get('entities', true);
        if (isSeq(entSeq) && entSeq.items.length > 0 && isMap(entSeq.items[0] as Node)) {
          const firstId = (entSeq.items[0] as YAMLMap).get('id');
          if (typeof firstId === 'string') entityId = firstId;
        }
      }
      blkMap.set('entity', doc.createNode(entityId || 'hero'));
      let start = 0;
      if (command.afterIndex >= 0 && command.afterIndex < seq.items.length) {
        const prev = seq.items[command.afterIndex];
        if (isMap(prev as Node)) {
          const prevEnd = (prev as YAMLMap).get('end');
          if (typeof prevEnd === 'number') start = prevEnd;
        }
      }
      blkMap.set('start', doc.createNode(roundSec(start)));
      blkMap.set('end', doc.createNode(roundSec(start + 4)));
      const pos = doc.createNode([0, 0, 0]);
      if (isSeq(pos)) pos.flow = true;
      blkMap.set('position', pos);
      blkMap.set('easing', doc.createNode('smooth'));
      const insertAt = Math.max(
        0,
        Math.min(seq.items.length, command.afterIndex + 1)
      );
      seq.items.splice(insertAt, 0, blkMap);
      break;
    }

    case 'delete-blocking': {
      const seq = root.get('blocking', true);
      if (isSeq(seq)) deleteSeqItem(seq, command.index);
      break;
    }

    case 'reorder-blocking': {
      const seq = root.get('blocking', true);
      if (isSeq(seq)) reorderSeqItem(seq, command.fromIndex, command.toIndex);
      break;
    }

    case 'insert-shot-split': {
      const shotsKey = findSeqKey(root, ['shots', 'score']);
      applyInsertShotSplit(doc, shotsKey, command.afterIndex);
      break;
    }

    case 'delete-shot': {
      const shotsKey = findSeqKey(root, ['shots', 'score']);
      const seq = root.get(shotsKey, true);
      if (isSeq(seq) && seq.items.length > 1) {
        deleteSeqItem(seq, command.index);
        seq.items.forEach((item, i) => {
          if (isMap(item as Node) && (item as YAMLMap).has('shot')) {
            setMapScalarValue(doc, item as YAMLMap, 'shot', i + 1);
          }
        });
      }
      break;
    }

    case 'reorder-shot': {
      const shotsKey = findSeqKey(root, ['shots', 'score']);
      const seq = root.get(shotsKey, true);
      if (isSeq(seq)) {
        reorderSeqItem(seq, command.fromIndex, command.toIndex);
        seq.items.forEach((item, i) => {
          if (isMap(item as Node) && (item as YAMLMap).has('shot')) {
            setMapScalarValue(doc, item as YAMLMap, 'shot', i + 1);
          }
        });
      }
      break;
    }

    case 'adjust-shot-timing': {
      const shotsKey = findSeqKey(root, ['shots', 'score']);
      applyAdjustShotTiming(
        doc,
        shotsKey,
        command.shotIndex,
        command.edge,
        command.nextValueSec,
        command.mode
      );
      break;
    }

    case 'insert-observer-shot': {
      const obsKey = findSeqKey(root, ['observer_shots', 'observerShots']);
      const seq = getOrCreateRootSeq(doc, obsKey);
      const id = generateUniqueItemId(seq, 'obs-shot');
      const osMap = new YAMLMap();
      osMap.set('id', doc.createNode(id));
      let start = 0;
      if (command.afterIndex >= 0 && command.afterIndex < seq.items.length) {
        const prev = seq.items[command.afterIndex];
        if (isMap(prev as Node)) {
          const prevEnd = (prev as YAMLMap).get('end');
          if (typeof prevEnd === 'number') start = prevEnd;
        }
      }
      osMap.set('start', doc.createNode(roundSec(start)));
      osMap.set('end', doc.createNode(roundSec(start + 5)));
      const cam = new YAMLMap();
      const tgt = doc.createNode([0, 1.1, 0]);
      if (isSeq(tgt)) tgt.flow = true;
      cam.set('target', tgt);
      cam.set('maneuver', doc.createNode('orbit'));
      cam.set('distance', doc.createNode(14));
      cam.set('pitch', doc.createNode(26));
      cam.set('yaw', doc.createNode(35));
      cam.set('lens', doc.createNode('35mm'));
      osMap.set('observer_camera', cam);
      const insertAt = Math.max(
        0,
        Math.min(seq.items.length, command.afterIndex + 1)
      );
      seq.items.splice(insertAt, 0, osMap);
      break;
    }

    case 'delete-observer-shot': {
      const obsKey = findSeqKey(root, ['observer_shots', 'observerShots']);
      const seq = root.get(obsKey, true);
      if (isSeq(seq)) deleteSeqItem(seq, command.index);
      break;
    }

    case 'reorder-observer-shot': {
      const obsKey = findSeqKey(root, ['observer_shots', 'observerShots']);
      const seq = root.get(obsKey, true);
      if (isSeq(seq)) reorderSeqItem(seq, command.fromIndex, command.toIndex);
      break;
    }
  }

  const nextYaml = doc.toString();
  return {
    nextYaml,
    doc,
    changed: nextYaml !== rawYaml,
  };
}

/**
 * Applies a pure structural or field command to `rawYaml` while preserving comments and formatting.
 */
export function applyScoreYamlCommand(
  rawYaml: string,
  command: ScoreYamlCommand
): string {
  return applyScoreYamlCommandDetailed(rawYaml, command).nextYaml;
}
