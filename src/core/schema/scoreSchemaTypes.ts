/**
 * Canonical runtime enum constants and declarative schema field types
 * for StageFlow YAML choreography scores.
 * Pure Layer 1 module: zero React, DOM, or Three.js dependencies.
 */

export const CAMERA_MANEUVERS = [
  'cut',
  'dolly',
  'straight',
  'arc',
  'swoop',
  'orbit',
  'sweep',
  'spiral',
  'dive',
  'recoil',
  'spline',
] as const;

export const CAMERA_EASINGS = [
  'smooth',
  'linear',
  'ease-in',
  'ease-out',
  'expo',
  'pop',
  'accel',
  'deccel',
  'cruise',
] as const;

export const DOF_PRESETS = ['shallow', 'medium', 'deep'] as const;

export const ENTITY_KINDS = ['character', 'prop', 'marker'] as const;

export const PROP_SHAPES = ['box', 'cylinder', 'sphere', 'capsule'] as const;

export const MARKER_SHAPES = ['x', 't', 'circle', 'puck'] as const;

export const CHARACTER_STYLES = [
  'mannequin',
  'edges',
  'silhouette',
  'wireframe',
] as const;

export const PROP_STYLES = ['edges', 'glass', 'solid', 'wireframe'] as const;

export const MARKER_STYLES = ['tape', 'glow', 'beacon'] as const;

export const CAMERA_RIG_TYPES = ['tripod', 'track', 'spline_track'] as const;

export const CAMERA_DIRECTIONS = ['cw', 'ccw'] as const;

export const STANDARD_LENS_PRESETS_MM = [18, 24, 35, 50, 85, 135] as const;

export const ASPECT_RATIO_PRESETS = ['16:9', '2.39:1', '21:9', '1.85:1', '4:3', '9:16'] as const;

export const ENTITY_PIVOT_PRESETS = ['base', 'center', 'top'] as const;

export type SchemaSectionName =
  | 'root'
  | 'optics'
  | 'stage'
  | 'stageBaseCamera'
  | 'entity'
  | 'blockingCue'
  | 'blockingEntity'
  | 'shot'
  | 'cameraCue'
  | 'observerCameraCue'
  | 'rig'
  | 'waypoint'
  | 'observerShot';

export type FieldKind =
  | 'number'
  | 'angle-deg'
  | 'lens-mm'
  | 'aperture'
  | 'vec3'
  | 'enum'
  | 'entity-ref'
  | 'target-anchor'
  | 'boolean'
  | 'string'
  | 'color'
  | 'timestamp'
  | 'raw-yaml';

export type FieldGroup =
  | 'identity'
  | 'timing'
  | 'framing'
  | 'motion'
  | 'optics'
  | 'rig'
  | 'staging'
  | 'display'
  | 'media';

export interface FieldDescriptor {
  readonly key: string;
  readonly aliases?: readonly string[];
  readonly label: string;
  readonly kind: FieldKind;
  readonly unit?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly options?: readonly string[];
  readonly group: FieldGroup;
  readonly hint: string;
  readonly description?: string;
  readonly multiline?: boolean;
  readonly defaultOnAdd: unknown;
  readonly required?: boolean;
  readonly formatHint?: 'lens-mm' | 'aperture' | 'vec3-flow' | 'plain';
}

export type YamlPathSegment = string | number;
export type YamlPath = readonly YamlPathSegment[];
