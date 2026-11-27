/**
 * Core data contracts for the StageFlow 3D Camera-Blocking & Scene Choreography Diorama.
 * Zero React or DOM dependencies.
 */

import type {
  CAMERA_DIRECTIONS,
  CAMERA_EASINGS,
  CAMERA_MANEUVERS,
  CAMERA_RIG_TYPES,
  CHARACTER_STYLES,
  DOF_PRESETS,
  ENTITY_KINDS,
  MARKER_SHAPES,
  MARKER_STYLES,
  PROP_SHAPES,
  PROP_STYLES,
} from './schema/scoreSchemaTypes';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Internal normalized spherical pose (distance in meters, pitch/yaw in radians).
 */
export interface SphericalPose {
  target: Vec3;
  distance: number;      // meters
  pitch: number;         // radians (clamped to [-85 deg, +85 deg])
  yaw: number;           // radians
  roll: number;          // radians (0 = level horizon, + = CW camera tilt from operator POV)
  focalLengthMm: number; // e.g., 24, 35, 50, 85
}

/**
 * Derived 3D Cartesian transform ready for Three.js cameras and frustum meshes.
 */
export interface CameraTransform3D {
  pose: SphericalPose;
  position: Vec3;      // Eye position in meters
  target: Vec3;        // Look-at target in meters
  up: Vec3;            // Unit camera up-vector in world space (incorporating roll)
  fovDeg: number;      // Vertical FOV in degrees derived from focalLengthMm & aspect
  aspectRatio: number; // Gate aspect ratio (e.g. 16/9 = 1.7778, 2.39)
}

export type CameraManeuver = (typeof CAMERA_MANEUVERS)[number];

export type CameraEasing = (typeof CAMERA_EASINGS)[number];

export type CameraDirection = (typeof CAMERA_DIRECTIONS)[number];

export type EditorStudioMode = 'visual' | 'yaml';

export type ShotTimingEditMode = 'free' | 'roll' | 'ripple';

export type CameraViewMode = 'scripted' | 'free' | 'stage-pov';

export type LabelDisplayMode = 'all' | 'cast' | 'camera-only' | 'off';

export type StageFloorMode = 'solid' | 'grid' | 'off';

export interface StageDisplayOptions {
  floorMode: StageFloorMode;
  showCharacters: boolean;
  showProps: boolean;
  showMarkers: boolean;
  hiddenCharacterIds: readonly string[];
  showArrows: boolean;
  showFootprints: boolean;
  showTrails: boolean;
}

export type SplitPreset = 'split' | 'full';

export interface WorkspaceLayoutDimensions {
  leftSplitPct: number;
  rightSplitPct: number;
  videoHeightPct: number;
  isSubpanelCollapsed: boolean;
}

export type AppThemeMode = 'auto' | 'light' | 'warm' | 'dark';
export type AppThemeCategory = 'light' | 'warm' | 'dark';
export type DioramaThemeMode = 'dark' | 'match-app' | 'warm' | 'light';

export type StoragePersistenceStatus =
  | 'bundled'
  | 'draft-saved'
  | 'custom'
  | 'saving';

export interface ToastNotification {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export type EntityKind = (typeof ENTITY_KINDS)[number];

export type PropShape = (typeof PROP_SHAPES)[number];
export type MarkerShape = (typeof MARKER_SHAPES)[number];
export type EntityShape = PropShape | MarkerShape;

export type CharacterStyle = (typeof CHARACTER_STYLES)[number];
export type PropStyle = (typeof PROP_STYLES)[number];
export type MarkerStyle = (typeof MARKER_STYLES)[number];
export type EntityStyle = CharacterStyle | PropStyle | MarkerStyle;

export interface SceneEntityDef {
  id: string;
  label: string;
  kind: EntityKind;
  shape?: EntityShape;
  style?: EntityStyle;
  position: Vec3;       // Base position in meters (Y=0 is floor)
  rotationYRad: number; // Base facing yaw in radians (0 = +Z, PI = -Z)
  pitchRad?: number;    // Base X-axis tilt in radians (0 = upright, +PI/2 = prone toward +Z)
  rollRad?: number;     // Base Z-axis bank in radians (0 = level, + = CW from behind entity)
  pivotRatio?: number;  // Normalized vertical rotation pivot ratio in [0, 1] (0 = base, 0.5 = center, 1 = top)
  height: number;       // Height in meters (default 1.75m for character, 0.85m for prop)
  width?: number;       // Lateral breadth in meters (X axis, default 2 * radius)
  depth?: number;       // Sagittal depth in meters (Z axis, default 2 * radius)
  radius: number;       // Footprint radius in meters (default max(width, depth) / 2)
  color: string;        // Hex or blueprint token
}

export interface EntityCueOverride {
  fromPosition?: Vec3;
  position?: Vec3;
  rotationYRad?: number;
  pitchRad?: number;
  rollRad?: number;
  pivotRatio?: number;
  lookAt?: TargetAnchor; // Entity ID, multiple entity IDs, or world Vec3 to face toward
  fromWidth?: number;
  fromHeight?: number;
  fromDepth?: number;
  width?: number;
  height?: number;
  depth?: number;
  easing: CameraEasing;
  highlighted: boolean;
  visible: boolean;
  note?: string;
  cut?: boolean;
  continuous?: boolean;
}

/**
 * An independent entity blocking cue with its own start/end time window,
 * decoupled from the film coverage shots.
 */
export interface BlockingCueSpec {
  id: string;
  label?: string;
  entityId: string;
  startSec: number;
  endSec: number;
  duration?: number;
  fromPosition?: Vec3;
  position?: Vec3;
  rotationYRad?: number;
  pitchRad?: number;
  rollRad?: number;
  pivotRatio?: number;
  lookAt?: TargetAnchor;
  fromWidth?: number;
  fromHeight?: number;
  fromDepth?: number;
  width?: number;
  height?: number;
  depth?: number;
  easing: CameraEasing;
  highlighted?: boolean;
  visible?: boolean;
  note?: string;
  cut?: boolean;
  continuous?: boolean;
}

export interface EvaluatedEntityState {
  id: string;
  def: SceneEntityDef;
  cueId?: string | null;
  position: Vec3;
  rotationYRad: number;
  pitchRad?: number;
  rollRad?: number;
  pivotRatio?: number;
  size?: Vec3;          // Live evaluated { x: width, y: height, z: depth } in meters at time t
  highlighted: boolean;
  visible: boolean;
  note?: string;
  trailPoints: Vec3[]; // Sampled ground trail when moving during active cue/shot
}

export type DofPreset = (typeof DOF_PRESETS)[number];

export interface ScoreOpticsConfig {
  dofBlur: boolean;              // Opt-in bokeh blur in Stage Cam POV (default: false)
  defaultDof?: DofPreset;        // Optional score-wide default DoF preset
  defaultApertureFStop?: number; // Optional score-wide default f-stop
}

export interface EvaluatedDofState {
  enabled: boolean;            // True when apertureFStop is finite (dof !== 'deep')
  preset: DofPreset;           // 'shallow' | 'medium' | 'deep'
  apertureFStop: number;       // Effective f-number N (e.g. 2.8, 5.6, or Infinity)
  focusDistanceM: number;      // Orthogonal optical-axis focus depth d_focus in meters
  hyperfocalDistanceM: number; // H in meters (Infinity when disabled)
  nearLimitM: number;          // D_near in meters (0 when disabled)
  farLimitM: number;           // D_far in meters (Infinity when disabled or d >= H)
  depthOfFieldM: number;       // D_far - D_near in meters (Infinity when farLimitM is Infinity)
  focusTargetPoint?: Vec3;     // Resolved 3D focus point when targeting an entity/coord
  hasExplicitFocus: boolean;   // True when focus or focus_distance was explicitly authored
}

export type TargetAnchor = string | string[] | Vec3;

export interface CameraWaypointSpec {
  target?: TargetAnchor;
  from?: TargetAnchor;
  targetOffset?: Vec3;
  distance?: number;
  pitchRad?: number;
  yawRad?: number;
  rollRad?: number;
  focalLengthMm?: number;
  focus?: string | string[] | Vec3;
  focusDistanceM?: number;
  dof?: DofPreset;
  apertureFStop?: number;
  at?: number;
}

export type CameraRigType = (typeof CAMERA_RIG_TYPES)[number];

export interface CameraRigSpec {
  type: CameraRigType;
  position?: Vec3; // For 'tripod'
  from?: Vec3;     // Start of 'track' rail (optional when continuous: true)
  to?: Vec3;       // End of 'track' rail
  points?: Vec3[]; // Waypoints for 'spline_track'
}

export interface EvaluatedCameraRigState {
  type: CameraRigType;
  progress: number;       // Eased progress u in [0, 1]
  eyePosition: Vec3;      // Evaluated 3D camera nodal position on rig
  railPoints: Vec3[];     // Sampled 3D rail path ([] for tripod, >=2 for track/spline_track)
  hasTargetLock: boolean; // True when tracking a target, false when fixed/animated gaze
}

export interface CameraCueSpec {
  continuous?: boolean;
  maneuver: CameraManeuver;
  easing: CameraEasing;
  target?: TargetAnchor;
  from?: TargetAnchor;
  targetOffset?: Vec3;
  targetOffsetStart?: Vec3;
  targetOffsetEnd?: Vec3;
  distance?: number;
  distanceStart?: number;
  distanceEnd?: number;
  pitchRad?: number;
  pitchStartRad?: number;
  pitchEndRad?: number;
  yawRad?: number;
  yawDeltaRad?: number;
  yawStartRad?: number;
  yawEndRad?: number;
  rollRad?: number;
  rollDeltaRad?: number;
  rollStartRad?: number;
  rollEndRad?: number;
  focalLengthMm?: number;
  focalLengthStartMm?: number;
  focalLengthEndMm?: number;
  focus?: string | string[] | Vec3;
  focusStart?: string | string[] | Vec3;
  focusEnd?: string | string[] | Vec3;
  focusDistanceM?: number;
  focusDistanceStartM?: number;
  focusDistanceEndM?: number;
  dof?: DofPreset;
  apertureFStop?: number;
  apertureStartFStop?: number;
  apertureEndFStop?: number;
  breathe: number;
  direction: 'cw' | 'ccw';
  hasExplicitDirection?: boolean;
  revolutions?: number;
  orbitSpeedRad?: number;
  waypoints?: CameraWaypointSpec[];
  trackTarget: boolean;
  rig?: CameraRigSpec;
  showRig?: boolean;
}

export interface StageCameraCueSpec extends CameraCueSpec {
  frustumDepth: number; // Length of frustum cone in meters (default: distance to target)
  frustumColor: string;
  showPath: boolean;
}

export interface ShotCue {
  id: string;
  shotNumber: number;
  label: string;
  description: string;
  continuous?: boolean; // When true, auto-chains start time and camera kinematics from preceding shot
  startSec: number;
  endSec: number;
  stageCamera?: StageCameraCueSpec;
  observerCamera?: CameraCueSpec;
  entities: Record<string, EntityCueOverride>;
}

/**
 * An independent observer camera cue with its own start/end time window,
 * decoupled from the film coverage shots.
 */
export interface ObserverShotCue {
  id: string;
  label?: string;
  continuous?: boolean; // When true, auto-chains start time and camera kinematics from preceding observer shot
  startSec: number;
  endSec: number;
  camera: CameraCueSpec;
}

export interface StageScore {
  version: string;
  id: string;
  title: string;
  subtitle?: string;
  description?: string; // Optional score-level directorial premise or staging notes
  metadata?: Record<string, unknown>; // Optional scene-wide production metadata & directorial notes
  continuous?: boolean; // When true, shots omitting `start` automatically chain from preceding shot's `end`
  videoUrl: string;    // Local path (/media/...), blob: URL, YouTube URL, or 'procedural://demo'
  aspectRatio: number; // Default 16 / 9 (1.7777778) or 2.39
  durationSec: number;
  offsetSec: number;
  stage: {
    width: number;     // Default 10 (meters)
    depth: number;     // Default 10 (meters)
    gridStep: number;  // Default 1 (meter)
    showRigs?: boolean; // When false, hides 3D tripod legs & dolly track rails across the score (default: true)
    defaultObserverPose: SphericalPose;
    defaultStageCameraPose: SphericalPose;
  };
  entities: SceneEntityDef[];
  shots: ShotCue[];
  observerShots?: ObserverShotCue[];
  blocking?: BlockingCueSpec[];
  optics?: ScoreOpticsConfig;
}

export interface EvaluatedCameraTrack {
  active: boolean;
  isHold: boolean;
  shotId: string | null;
  maneuver: CameraManeuver;
  transform: CameraTransform3D;
  trajectoryPoints: Vec3[]; // 3D world points showing the camera's movement path
  baseTarget?: Vec3;        // Anchor point before target_offset displacement
  targetOffset?: Vec3;      // Active world-space target offset vector at this frame
  rig?: EvaluatedCameraRigState; // Active evaluated rig mount state (if on tripod/track)
}

export interface StageFrame {
  timestampSec: number;
  progress: number;
  activeShot: ShotCue | null;
  shotIndex: number;
  shotProgress: number;
  observerCamera: EvaluatedCameraTrack;
  stageCamera: EvaluatedCameraTrack & {
    frustumDepth: number;
    frustumColor: string;
    showPath: boolean;
    showRig: boolean;
    dof: EvaluatedDofState;
  };
  entitiesById: Map<string, EvaluatedEntityState>;
  entitiesList: EvaluatedEntityState[];
}

/**
 * Diagnostics and location metadata for YAML score syntax and schema errors.
 */
export interface ScoreDiagnostic {
  line: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Result of compiling raw YAML/JSON into a StageScore.
 * Completely backward-compatible with legacy `{ score, error, warning }`.
 */
export interface ParseScoreResult {
  score: StageScore | null;
  error: string | null;
  warning?: string | null;
  diagnostics?: ScoreDiagnostic[];
}

/**
 * Provenance category for StageFlow choreography scores.
 * - 'study': Authentic directorial scene studies authored by Taruma Sakti (e.g. Vector Field).
 * - 'blueprint': Synthetic educational camera-blocking presets and testbeds (BP 01–07).
 * - 'custom': User-authored, imported, or forked projects persisted in browser IndexedDB.
 */
export type ScoreCategory = 'study' | 'blueprint' | 'custom';

/**
 * Filter tab categories available in the Score Library modal.
 */
export type LibraryFilterTab = 'all' | ScoreCategory;

/**
 * Media source filters supported by the Score Library toolbar.
 */
export type LibrarySourceFilter = 'all' | 'youtube' | 'other';

/**
 * Film gate / aspect ratio filter buckets in the Score Library toolbar.
 */
export type LibraryAspectFilter = 'all' | '16:9' | 'scope' | 'other';

/**
 * Sort keys available in the Score Library.
 */
export type LibrarySortField = 'recent' | 'title' | 'duration' | 'shots';

/**
 * Sort direction for Score Library ordering.
 */
export type LibrarySortDirection = 'asc' | 'desc';


