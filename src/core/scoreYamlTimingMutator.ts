/**
 * Pure AST timing, split-insert, roll, and ripple mutation helpers for StageFlow YAML scores.
 * Preserves all YAML comments, formatting, and non-targeted nodes.
 * Pure Layer 1 module: zero React, DOM, or Three.js dependencies.
 */

import {
  Document,
  isMap,
  isScalar,
  isSeq,
  YAMLMap,
  YAMLSeq,
  type Node,
} from 'yaml';
import type { ShotTimingEditMode } from './types';

export function roundSec(val: number): number {
  return Math.round(val * 1000) / 1000;
}

export function getMapNumericField(map: YAMLMap, key: string): number | undefined {
  const node = map.get(key, true);
  if (isScalar(node) && typeof node.value === 'number' && Number.isFinite(node.value)) {
    return node.value;
  }
  return undefined;
}

export function setMapScalarValue(
  doc: Document,
  map: YAMLMap,
  key: string,
  value: unknown
): void {
  const existing = map.get(key, true);
  if (isScalar(existing)) {
    existing.value = value;
  } else {
    map.set(key, doc.createNode(value));
  }
}

export function findSeqKey(root: YAMLMap, candidates: readonly string[]): string {
  for (const key of candidates) {
    if (root.has(key)) return key;
  }
  return candidates[0];
}

export function getOrCreateRootSeq(doc: Document, key: string): YAMLSeq {
  const root = doc.contents as YAMLMap;
  const existing = root.get(key, true);
  if (isSeq(existing)) return existing;
  const seq = new YAMLSeq();
  root.set(key, seq);
  return seq;
}

/**
 * Resolves effective [start, end] of each shot item in `shotsSeq`,
 * chaining omitted `start` values when `continuous` is active.
 */
export function resolveShotTimelineBounds(
  doc: Document,
  shotsSeq: YAMLSeq
): Array<{ start: number; end: number; hasExplicitStart: boolean }> {
  const root = doc.contents as YAMLMap;
  const rootCont = root.get('continuous');
  const rootContinuous = rootCont === true || rootCont === 'true' || rootCont === 'yes';

  const bounds: Array<{ start: number; end: number; hasExplicitStart: boolean }> = [];
  let prevEnd = 0;

  for (const item of shotsSeq.items) {
    if (!isMap(item as Node)) {
      bounds.push({ start: prevEnd, end: prevEnd + 4, hasExplicitStart: false });
      prevEnd += 4;
      continue;
    }
    const map = item as YAMLMap;
    const rawStart = getMapNumericField(map, 'start');
    const rawEnd = getMapNumericField(map, 'end');
    const shotCont = map.get('continuous');
    const isCont =
      shotCont === true || shotCont === 'true' || shotCont === 'yes'
        ? true
        : shotCont === false || shotCont === 'false' || shotCont === 'no'
        ? false
        : rootContinuous;

    const start =
      rawStart !== undefined ? Math.max(0, rawStart) : isCont ? prevEnd : 0;
    const end =
      rawEnd !== undefined ? Math.max(start + 0.1, rawEnd) : start + 5;
    prevEnd = end;
    bounds.push({ start, end, hasExplicitStart: rawStart !== undefined });
  }

  return bounds;
}

function buildNewShotNode(
  doc: Document,
  id: string,
  shotNum: number | undefined,
  label: string,
  startSec: number,
  endSec: number,
  templateShot?: YAMLMap
): YAMLMap {
  const newMap = new YAMLMap();
  newMap.set('id', doc.createNode(id));
  if (shotNum !== undefined) {
    newMap.set('shot', doc.createNode(shotNum));
  }
  newMap.set('label', doc.createNode(label));
  newMap.set('start', doc.createNode(roundSec(startSec)));
  newMap.set('end', doc.createNode(roundSec(endSec)));

  let targetVal: unknown = [0, 1.25, 0];
  let lensVal: unknown = '50mm';
  let distanceVal: unknown = 4.0;
  let pitchVal: unknown = 8;
  let yawVal: unknown = 0;

  if (templateShot) {
    const tplCam = (templateShot.get('stage_camera', true) ??
      templateShot.get('camera', true)) as Node | undefined;
    if (tplCam && isMap(tplCam)) {
      const t = tplCam.get('target');
      if (t !== undefined) targetVal = t;
      const l = tplCam.get('lens');
      if (l !== undefined) lensVal = l;
      const d = tplCam.get('distance') ?? tplCam.get('distance_end');
      if (typeof d === 'number') distanceVal = d;
      const p = tplCam.get('pitch') ?? tplCam.get('pitch_end');
      if (typeof p === 'number') pitchVal = p;
      const y = tplCam.get('yaw') ?? tplCam.get('yaw_end');
      if (typeof y === 'number') yawVal = y;
    }
  }

  const camMap = new YAMLMap();
  const targetNode = doc.createNode(targetVal);
  if (isSeq(targetNode) && Array.isArray(targetVal)) {
    targetNode.flow = true;
  }
  camMap.set('target', targetNode);
  camMap.set('maneuver', doc.createNode('cut'));
  camMap.set('distance', doc.createNode(distanceVal));
  camMap.set('pitch', doc.createNode(pitchVal));
  camMap.set('yaw', doc.createNode(yawVal));
  camMap.set('lens', doc.createNode(lensVal));

  newMap.set('stage_camera', camMap);
  return newMap;
}

function generateUniqueShotId(shotsSeq: YAMLSeq, baseNum: number): string {
  const existing = new Set<string>();
  for (const item of shotsSeq.items) {
    if (isMap(item as Node)) {
      const id = (item as YAMLMap).get('id');
      if (typeof id === 'string') existing.add(id);
    }
  }
  let candidate = `shot-${baseNum}`;
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `shot-${baseNum}-${suffix++}`;
  }
  return candidate;
}

/**
 * Inserts a new shot after `afterIndex` (`-1` inserts before shot 0).
 * When `afterIndex >= 0`, splits the preceding shot cleanly at its midpoint
 * (preserving downstream shots intact).
 */
export function applyInsertShotSplit(
  doc: Document,
  shotsKey: string,
  afterIndex: number
): void {
  const shotsSeq = getOrCreateRootSeq(doc, shotsKey);
  const bounds = resolveShotTimelineBounds(doc, shotsSeq);

  const hasExplicitShotNum = shotsSeq.items.some(
    (item) => isMap(item as Node) && (item as YAMLMap).has('shot')
  );

  if (shotsSeq.items.length === 0 || afterIndex < 0) {
    const newStart = 0;
    const newEnd = bounds[0] ? Math.min(2.0, Math.max(0.2, bounds[0].start)) : 4.0;
    const firstEnd = bounds[0] && bounds[0].start <= 0 ? 2.0 : newEnd;
    const id = generateUniqueShotId(shotsSeq, 1);
    const shotNode = buildNewShotNode(
      doc,
      id,
      hasExplicitShotNum ? 1 : undefined,
      'New Shot',
      newStart,
      firstEnd
    );
    shotsSeq.items.unshift(shotNode);
  } else {
    const idx = Math.min(afterIndex, shotsSeq.items.length - 1);
    const prevNode = shotsSeq.items[idx];
    const prevMap = isMap(prevNode as Node) ? (prevNode as YAMLMap) : undefined;
    const b = bounds[idx] ?? { start: 0, end: 4, hasExplicitStart: true };
    const dur = Math.max(0.2, b.end - b.start);
    const mid = roundSec(b.start + dur * 0.5);

    if (prevMap) {
      if (!b.hasExplicitStart) {
        setMapScalarValue(doc, prevMap, 'start', roundSec(b.start));
      }
      setMapScalarValue(doc, prevMap, 'end', mid);
    }

    const id = generateUniqueShotId(shotsSeq, idx + 2);
    const newShot = buildNewShotNode(
      doc,
      id,
      hasExplicitShotNum ? idx + 2 : undefined,
      `Shot ${String(idx + 2).padStart(2, '0')} · Insert`,
      mid,
      roundSec(Math.max(mid + 0.1, b.end)),
      prevMap
    );
    shotsSeq.items.splice(idx + 1, 0, newShot);
  }

  if (hasExplicitShotNum) {
    shotsSeq.items.forEach((item, i) => {
      if (isMap(item as Node) && (item as YAMLMap).has('shot')) {
        setMapScalarValue(doc, item as YAMLMap, 'shot', i + 1);
      }
    });
  }
}

/**
 * Adjusts a shot's `start` or `end` timestamp using `'free'`, `'roll'`, or `'ripple'` semantics.
 */
export function applyAdjustShotTiming(
  doc: Document,
  shotsKey: string,
  shotIndex: number,
  edge: 'start' | 'end',
  nextValueSec: number,
  mode: ShotTimingEditMode
): void {
  const root = doc.contents as YAMLMap;
  const shotsSeq = root.get(shotsKey, true);
  if (!isSeq(shotsSeq)) return;
  if (shotIndex < 0 || shotIndex >= shotsSeq.items.length) return;

  const targetNode = shotsSeq.items[shotIndex];
  if (!isMap(targetNode as Node)) return;
  const targetMap = targetNode as YAMLMap;

  const bounds = resolveShotTimelineBounds(doc, shotsSeq);
  const curr = bounds[shotIndex];
  const minDur = 0.1;

  if (mode === 'free') {
    const clamped =
      edge === 'start'
        ? Math.max(0, Math.min(curr.end - minDur, nextValueSec))
        : Math.max(curr.start + minDur, nextValueSec);
    setMapScalarValue(doc, targetMap, edge, roundSec(clamped));
    return;
  }

  if (mode === 'roll') {
    if (edge === 'end') {
      const nextShot =
        shotIndex + 1 < shotsSeq.items.length &&
        isMap(shotsSeq.items[shotIndex + 1] as Node)
          ? (shotsSeq.items[shotIndex + 1] as YAMLMap)
          : null;
      const maxEnd = nextShot
        ? bounds[shotIndex + 1].end - minDur
        : Infinity;
      const clamped = Math.max(
        curr.start + minDur,
        Math.min(maxEnd, nextValueSec)
      );
      setMapScalarValue(doc, targetMap, 'end', roundSec(clamped));
      if (nextShot) {
        setMapScalarValue(doc, nextShot, 'start', roundSec(clamped));
      }
    } else {
      const prevShot =
        shotIndex - 1 >= 0 && isMap(shotsSeq.items[shotIndex - 1] as Node)
          ? (shotsSeq.items[shotIndex - 1] as YAMLMap)
          : null;
      const minStart = prevShot ? bounds[shotIndex - 1].start + minDur : 0;
      const clamped = Math.max(
        minStart,
        Math.min(curr.end - minDur, nextValueSec)
      );
      setMapScalarValue(doc, targetMap, 'start', roundSec(clamped));
      if (prevShot) {
        setMapScalarValue(doc, prevShot, 'end', roundSec(clamped));
      }
    }
    return;
  }

  // 'ripple': shift downstream shots & update root duration if authored
  const prevEdgeVal = edge === 'start' ? curr.start : curr.end;
  const clamped =
    edge === 'start'
      ? Math.max(0, Math.min(curr.end - minDur, nextValueSec))
      : Math.max(curr.start + minDur, nextValueSec);
  const delta = clamped - prevEdgeVal;
  setMapScalarValue(doc, targetMap, edge, roundSec(clamped));

  if (Math.abs(delta) < 1e-6) return;

  for (let i = shotIndex + 1; i < shotsSeq.items.length; i++) {
    const item = shotsSeq.items[i];
    if (!isMap(item as Node)) continue;
    const itemMap = item as YAMLMap;
    const b = bounds[i];
    if (b.hasExplicitStart) {
      setMapScalarValue(
        doc,
        itemMap,
        'start',
        roundSec(Math.max(0, b.start + delta))
      );
    }
    setMapScalarValue(
      doc,
      itemMap,
      'end',
      roundSec(Math.max(0.1, b.end + delta))
    );
  }

  const rootDur = getMapNumericField(root, 'duration');
  if (rootDur !== undefined) {
    setMapScalarValue(
      doc,
      root,
      'duration',
      roundSec(Math.max(0.1, rootDur + delta))
    );
  }
}
