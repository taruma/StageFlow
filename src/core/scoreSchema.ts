/**
 * Single Source of Truth (SSOT) facade for StageFlow YAML schema enums,
 * field descriptors, alias resolution, and "+ Add property" availability queries.
 * Pure Layer 1 module: zero React, DOM, or Three.js dependencies.
 */

export * from './schema/scoreSchemaTypes';
import {
  BLOCKING_CUE_SCHEMA_FIELDS,
  BLOCKING_ENTITY_SCHEMA_FIELDS,
  ENTITY_SCHEMA_FIELDS,
  OPTICS_SCHEMA_FIELDS,
  ROOT_SCHEMA_FIELDS,
  STAGE_SCHEMA_FIELDS,
} from './schema/scoreSchemaRegistry';
import {
  CAMERA_CUE_SCHEMA_FIELDS,
  OBSERVER_CAMERA_CUE_SCHEMA_FIELDS,
  OBSERVER_SHOT_SCHEMA_FIELDS,
  RIG_SCHEMA_FIELDS,
  SHOT_SCHEMA_FIELDS,
  STAGE_BASE_CAMERA_SCHEMA_FIELDS,
  WAYPOINT_SCHEMA_FIELDS,
} from './schema/scoreCameraSchemaRegistry';
import type {
  FieldDescriptor,
  FieldGroup,
  SchemaSectionName,
} from './schema/scoreSchemaTypes';

export const SCORE_SCHEMA_REGISTRY: Record<
  SchemaSectionName,
  readonly FieldDescriptor[]
> = {
  root: ROOT_SCHEMA_FIELDS,
  optics: OPTICS_SCHEMA_FIELDS,
  stage: STAGE_SCHEMA_FIELDS,
  stageBaseCamera: STAGE_BASE_CAMERA_SCHEMA_FIELDS,
  entity: ENTITY_SCHEMA_FIELDS,
  blockingCue: BLOCKING_CUE_SCHEMA_FIELDS,
  blockingEntity: BLOCKING_ENTITY_SCHEMA_FIELDS,
  shot: SHOT_SCHEMA_FIELDS,
  cameraCue: CAMERA_CUE_SCHEMA_FIELDS,
  observerCameraCue: OBSERVER_CAMERA_CUE_SCHEMA_FIELDS,
  rig: RIG_SCHEMA_FIELDS,
  waypoint: WAYPOINT_SCHEMA_FIELDS,
  observerShot: OBSERVER_SHOT_SCHEMA_FIELDS,
};

/**
 * Container/structural YAML keys handled as child sections rather than scalar field rows.
 */
export const SECTION_STRUCTURAL_KEYS: Record<
  SchemaSectionName,
  readonly string[]
> = {
  root: [
    'metadata',
    'optics',
    'stage',
    'entities',
    'blocking',
    'shots',
    'score',
    'observer_shots',
    'observerShots',
  ],
  optics: [],
  stage: ['observer_camera', 'observerCamera', 'stage_camera', 'stageCamera'],
  stageBaseCamera: [],
  entity: [],
  blockingCue: ['entities'],
  blockingEntity: [],
  shot: [
    'stage_camera',
    'stageCamera',
    'camera',
    'observer_camera',
    'observerCamera',
    'rig',
    'entities',
  ],
  cameraCue: ['rig', 'waypoints'],
  observerCameraCue: ['rig', 'waypoints'],
  rig: ['points', 'waypoints'],
  waypoint: [],
  observerShot: ['observer_camera', 'observerCamera', 'camera', 'rig', 'waypoints'],
};

const lookupIndexCache = new Map<
  SchemaSectionName,
  Map<string, FieldDescriptor>
>();

function getLookupIndex(
  section: SchemaSectionName
): Map<string, FieldDescriptor> {
  let map = lookupIndexCache.get(section);
  if (map) return map;

  map = new Map<string, FieldDescriptor>();
  const fields = SCORE_SCHEMA_REGISTRY[section];
  for (const field of fields) {
    if (!map.has(field.key)) {
      map.set(field.key, field);
    }
    if (field.aliases) {
      for (const alias of field.aliases) {
        if (!map.has(alias)) {
          map.set(alias, field);
        }
      }
    }
  }
  lookupIndexCache.set(section, map);
  return map;
}

/**
 * Resolves a raw authored YAML key (canonical or alias) to its FieldDescriptor
 * in the given section, or `null` if unregistered.
 */
export function lookupFieldDescriptor(
  section: SchemaSectionName,
  rawKey: string
): FieldDescriptor | null {
  return getLookupIndex(section).get(rawKey) ?? null;
}

/**
 * Returns all schema descriptors registered for a section.
 */
export function getSchemaFieldsForSection(
  section: SchemaSectionName
): readonly FieldDescriptor[] {
  return SCORE_SCHEMA_REGISTRY[section];
}

/**
 * Returns candidate unauthored fields for "+ Add property" menus,
 * excluding any canonical keys already present (via canonical name or alias).
 */
export function getAvailableAddFields(
  section: SchemaSectionName,
  authoredRawKeys: readonly string[]
): FieldDescriptor[] {
  const index = getLookupIndex(section);
  const authoredCanonical = new Set<string>();
  for (const rawKey of authoredRawKeys) {
    const desc = index.get(rawKey);
    authoredCanonical.add(desc ? desc.key : rawKey);
  }

  return SCORE_SCHEMA_REGISTRY[section].filter(
    (desc) => !authoredCanonical.has(desc.key)
  );
}

/**
 * Groups field descriptors cleanly for categorized "+ Add property" popovers.
 */
export function groupFieldsByCategory(
  fields: readonly FieldDescriptor[]
): Array<{ group: FieldGroup; label: string; fields: FieldDescriptor[] }> {
  const labels: Record<FieldGroup, string> = {
    identity: 'Identity',
    timing: 'Timing',
    framing: 'Framing',
    motion: 'Motion',
    optics: 'Optics & DoF',
    rig: 'Rig Mount',
    staging: 'Staging',
    display: 'Display',
    media: 'Media',
  };

  const buckets = new Map<FieldGroup, FieldDescriptor[]>();
  for (const field of fields) {
    const list = buckets.get(field.group);
    if (list) {
      list.push(field);
    } else {
      buckets.set(field.group, [field]);
    }
  }

  const order: FieldGroup[] = [
    'framing',
    'motion',
    'optics',
    'rig',
    'timing',
    'staging',
    'display',
    'identity',
    'media',
  ];

  const result: Array<{
    group: FieldGroup;
    label: string;
    fields: FieldDescriptor[];
  }> = [];
  for (const group of order) {
    const list = buckets.get(group);
    if (list && list.length > 0) {
      result.push({ group, label: labels[group], fields: list });
    }
  }
  return result;
}
