/**
 * Pure deterministic layout resolution, DP/AC shot metadata formatting, and
 * sheet-level summary aggregation for the Storyboard Contact Sheet.
 * Zero React, DOM, or Three.js runtime dependencies.
 */

import { matchEntityTargetKey } from './cameraTargetResolver';
import {
  formatLocalClockTag,
  sanitizeExportSlug,
  type ExportResolutionTier,
  type ExportTargetCamera,
} from './exportMath';
import { formatApertureFStop } from './opticsMath';
import { radToDeg } from './sphericalMath';
import type {
  StoryboardBeatTag,
  StoryboardPanelMeta,
  StoryboardSampleMode,
  StoryboardSamplePoint,
  StoryboardSheetSummary,
  StoryboardShotGroup,
} from './storyboardMath';
import type { SceneEntityDef, TargetAnchor, Vec3 } from './types';

export type StoryboardDensity = 'compact' | 'balanced' | 'large';
export type StoryboardGridColumns = 1 | 2 | 3 | 4 | 6;
export type StoryboardExportFormat = 'png' | 'webp' | 'jpeg';

export interface ResolvedTargetInfo {
  label: string;
  color?: string;
  isEntity: boolean;
}

export interface StoryboardLayoutSpec {
  isPortrait: boolean;
  effectiveDensity: StoryboardDensity;
  columns: StoryboardGridColumns;
  isEvenLocked: boolean;
  isSingleRowLocked: boolean;
  disabledDensities: StoryboardDensity[];
}

/**
 * Strips redundant "Shot ## · ", "Shot ##: ", or "Shot ## - " prefixes from user labels
 * since panel badges already display the shot number.
 */
export function cleanShotLabel(rawLabel: string): string {
  if (!rawLabel || typeof rawLabel !== 'string') return '';
  return rawLabel.replace(/^Shot\s*\d+\s*[·:–-]\s*/i, '').trim() || rawLabel;
}

function formatEntityTargetEntry(
  rawId: string,
  entities: SceneEntityDef[]
): ResolvedTargetInfo {
  const trimmed = rawId.trim();
  const match = matchEntityTargetKey(
    trimmed,
    entities,
    (e) => e.id,
    (e) => e.label
  );
  if (match) {
    const baseName = (match.item.label || match.item.id).trim();
    return {
      label: match.recognizedPart
        ? `${baseName} · ${match.recognizedPart}`
        : baseName,
      color: match.item.color,
      isEntity: true,
    };
  }
  return { label: trimmed, isEntity: false };
}

/**
 * Resolves a shot's Look-At target into a display label and optional entity theme color.
 * Supports entity identifiers, multiple entity arrays, raw 3D vectors, and fallback base targets.
 */
export function resolveShotTargetInfo(
  target: TargetAnchor | undefined,
  entities: SceneEntityDef[] = [],
  baseTarget?: Vec3
): ResolvedTargetInfo {
  if (typeof target === 'string') {
    return formatEntityTargetEntry(target, entities);
  }

  if (Array.isArray(target) && target.length > 0) {
    let firstColor: string | undefined;
    let matchedCount = 0;
    const names = target.map((id) => {
      const entry = formatEntityTargetEntry(String(id), entities);
      if (entry.isEntity) {
        matchedCount++;
        if (!firstColor) {
          firstColor = entry.color;
        }
      }
      return entry.label;
    });
    return {
      label: names.join(' + '),
      color: firstColor,
      isEntity: matchedCount > 0,
    };
  }

  if (target && typeof target === 'object' && 'x' in target) {
    const v = target as Vec3;
    return {
      label: `[${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)}]`,
      isEntity: false,
    };
  }

  if (baseTarget) {
    return {
      label: `[${baseTarget.x.toFixed(1)}, ${baseTarget.y.toFixed(1)}, ${baseTarget.z.toFixed(1)}]`,
      isEntity: false,
    };
  }

  return { label: 'Center Stage', isEntity: false };
}

/**
 * Resolves orientation-aware grid column density from the rendered frame aspect ratio,
 * sampling mode, annotation visibility, and user-selected density preset.
 */
export function resolveStoryboardLayoutSpec(
  aspectRatio: number,
  sampleMode: StoryboardSampleMode,
  density: StoryboardDensity,
  annotated: boolean
): StoryboardLayoutSpec {
  const isPortrait =
    Number.isFinite(aspectRatio) && aspectRatio > 0 && aspectRatio < 0.99;

  if (sampleMode === 'start-mid-end') {
    return {
      isPortrait,
      effectiveDensity: density,
      columns: 1,
      isEvenLocked: false,
      isSingleRowLocked: true,
      disabledDensities: ['compact', 'balanced', 'large'],
    };
  }

  if (sampleMode === 'start-end') {
    if (!isPortrait) {
      const effectiveDensity: StoryboardDensity =
        density === 'balanced' ? 'compact' : density;
      return {
        isPortrait: false,
        effectiveDensity,
        columns: effectiveDensity === 'large' ? 2 : 4,
        isEvenLocked: true,
        isSingleRowLocked: false,
        disabledDensities: ['balanced'],
      };
    }

    if (!annotated) {
      const effectiveDensity: StoryboardDensity =
        density === 'large' ? 'balanced' : density;
      return {
        isPortrait: true,
        effectiveDensity,
        columns: effectiveDensity === 'compact' ? 6 : 4,
        isEvenLocked: true,
        isSingleRowLocked: false,
        disabledDensities: ['large'],
      };
    }

    return {
      isPortrait: true,
      effectiveDensity: 'balanced',
      columns: 2,
      isEvenLocked: true,
      isSingleRowLocked: false,
      disabledDensities: ['compact', 'large'],
    };
  }

  if (!isPortrait) {
    const columns: StoryboardGridColumns =
      density === 'compact' ? 4 : density === 'balanced' ? 3 : 2;
    return {
      isPortrait: false,
      effectiveDensity: density,
      columns,
      isEvenLocked: false,
      isSingleRowLocked: false,
      disabledDensities: [],
    };
  }

  if (!annotated) {
    const columns: StoryboardGridColumns =
      density === 'compact' ? 6 : density === 'balanced' ? 4 : 3;
    return {
      isPortrait: true,
      effectiveDensity: density,
      columns,
      isEvenLocked: false,
      isSingleRowLocked: false,
      disabledDensities: [],
    };
  }

  const columns: StoryboardGridColumns =
    density === 'compact' ? 3 : density === 'balanced' ? 2 : 1;
  return {
    isPortrait: true,
    effectiveDensity: density,
    columns,
    isEvenLocked: false,
    isSingleRowLocked: false,
    disabledDensities: [],
  };
}

function formatRangeValue(first: string, last: string): string {
  return first === last ? first : `${first}→${last}`;
}

function formatRigName(type: string): string {
  return type === 'spline_track' ? 'spline' : type;
}

function normalizeRoundedDeg360(rad: number): number {
  const deg = Math.round(radToDeg(rad)) % 360;
  return Object.is(deg, -0) ? 0 : deg;
}

function formatSignedDeg(rad: number, prefix = ''): string {
  const deg = Math.round(radToDeg(rad));
  const val = deg > 0 ? `+${deg}°` : `${deg}°`;
  return `${prefix}${val}`;
}

function formatCompactOffsetVec(v?: Vec3): string | null {
  if (!v) return null;
  if (Math.hypot(v.x, v.y, v.z) < 0.01) return null;
  const fmt = (n: number) => {
    const rounded = Number(n.toFixed(2));
    if (Object.is(rounded, -0) || rounded === 0) return '0';
    return rounded > 0 ? `+${rounded}` : `${rounded}`;
  };
  return `Δ[${fmt(v.x)}, ${fmt(v.y)}, ${fmt(v.z)}]`;
}

function formatVerboseOffsetVec(v?: Vec3): string | null {
  if (!v) return null;
  if (Math.hypot(v.x, v.y, v.z) < 0.01) return null;
  const fmt = (n: number) => {
    const rounded = Number(n.toFixed(2));
    if (Object.is(rounded, -0) || rounded === 0) return '0m';
    return `${rounded > 0 ? `+${rounded}` : rounded}m`;
  };
  return `Δ[X: ${fmt(v.x)}, Y: ${fmt(v.y)}, Z: ${fmt(v.z)}]`;
}

/**
 * Extracts formatted directorial & DP technical metadata for a shot card.
 */
export function formatStoryboardShotMeta(
  samples: StoryboardSamplePoint[],
  targetCamera: ExportTargetCamera
): StoryboardPanelMeta {
  const first = samples[0];
  const last = samples[samples.length - 1];
  const { shot } = first;

  const firstTrack =
    targetCamera === 'observer'
      ? first.frame.observerCamera
      : first.frame.stageCamera;
  const lastTrack =
    targetCamera === 'observer'
      ? last.frame.observerCamera
      : last.frame.stageCamera;

  const durationSec = Math.max(0, shot.endSec - shot.startSec);
  const firstLens = `${Math.round(firstTrack.transform.pose.focalLengthMm)}mm`;
  const lastLens = `${Math.round(lastTrack.transform.pose.focalLengthMm)}mm`;
  const focalLengthText = formatRangeValue(firstLens, lastLens);

  let apertureText: string | null = null;
  let focusText: string | null = null;
  let focusTooltip: string | null = null;

  if (targetCamera === 'stage-cam') {
    const firstDof = first.frame.stageCamera.dof;
    const lastDof = last.frame.stageCamera.dof;
    if (firstDof.enabled || lastDof.enabled) {
      const a1 = firstDof.enabled
        ? formatApertureFStop(firstDof.apertureFStop)
        : 'Deep';
      const a2 = lastDof.enabled
        ? formatApertureFStop(lastDof.apertureFStop)
        : 'Deep';
      apertureText = formatRangeValue(a1, a2);
    }
    if (
      firstDof.hasExplicitFocus ||
      lastDof.hasExplicitFocus ||
      firstDof.enabled ||
      lastDof.enabled
    ) {
      const f1 = `${firstDof.focusDistanceM.toFixed(1)}m`;
      const f2 = `${lastDof.focusDistanceM.toFixed(1)}m`;
      const focusDist = formatRangeValue(f1, f2);
      if (firstDof.enabled) {
        const nearStr = firstDof.nearLimitM.toFixed(1);
        const farStr = Number.isFinite(firstDof.farLimitM)
          ? `${firstDof.farLimitM.toFixed(1)}m`
          : '∞';
        focusText = `${focusDist} (${nearStr}–${farStr})`;
        const farVerbose = Number.isFinite(firstDof.farLimitM)
          ? `${firstDof.farLimitM.toFixed(1)}m`
          : 'Infinity';
        focusTooltip = `Focus Depth: ${focusDist} · Sharp DoF Range: ${nearStr}m to ${farVerbose} (Near–Far)`;
      } else {
        focusText = focusDist;
        focusTooltip = `Focus Depth: ${focusDist} (Deep DoF)`;
      }
    }
  }

  const opticsText = apertureText
    ? `${focalLengthText} · ${apertureText}`
    : focalLengthText;
  const opticsTooltip = apertureText
    ? `Focal Length: ${focalLengthText} · Aperture: ${apertureText}`
    : `Focal Length: ${focalLengthText}`;

  const cueSpec =
    targetCamera === 'observer' ? shot.observerCamera : shot.stageCamera;
  const easing = cueSpec?.easing;
  const moveText =
    firstTrack.maneuver !== 'cut' && easing
      ? `${firstTrack.maneuver} (${easing})`
      : firstTrack.maneuver;
  const moveTooltip =
    firstTrack.maneuver !== 'cut' && easing
      ? `Camera Maneuver: ${firstTrack.maneuver} · Easing: ${easing}`
      : `Camera Maneuver: ${firstTrack.maneuver}`;

  const dist1 = `${firstTrack.transform.pose.distance.toFixed(1)}m`;
  const dist2 = `${lastTrack.transform.pose.distance.toFixed(1)}m`;
  const distStr =
    dist1 === dist2
      ? dist1
      : `${firstTrack.transform.pose.distance.toFixed(1)}→${dist2}`;

  const yaw1Deg = normalizeRoundedDeg360(firstTrack.transform.pose.yaw);
  const yaw2Deg = normalizeRoundedDeg360(lastTrack.transform.pose.yaw);
  const yawStr =
    yaw1Deg === yaw2Deg ? `Y${yaw1Deg}°` : `Y${yaw1Deg}→${yaw2Deg}°`;
  const yawVerbose =
    yaw1Deg === yaw2Deg ? `${yaw1Deg}°` : `${yaw1Deg}°→${yaw2Deg}°`;

  const pitch1 = formatSignedDeg(firstTrack.transform.pose.pitch, 'P');
  const pitch2 = formatSignedDeg(lastTrack.transform.pose.pitch, 'P');
  const pitchStr =
    pitch1 === pitch2
      ? pitch1
      : `${pitch1}→${formatSignedDeg(lastTrack.transform.pose.pitch)}`;
  const pitchVerbose = formatRangeValue(
    formatSignedDeg(firstTrack.transform.pose.pitch),
    formatSignedDeg(lastTrack.transform.pose.pitch)
  );

  const rollDeg1 = Math.round(radToDeg(firstTrack.transform.pose.roll));
  const rollDeg2 = Math.round(radToDeg(lastTrack.transform.pose.roll));
  let rollSuffix = '';
  let rollVerboseSuffix = '';
  if (Math.abs(rollDeg1) >= 1 || Math.abs(rollDeg2) >= 1) {
    const r1 = formatSignedDeg(firstTrack.transform.pose.roll, 'R');
    const r2 = formatSignedDeg(lastTrack.transform.pose.roll);
    rollSuffix = rollDeg1 === rollDeg2 ? ` · ${r1}` : ` · ${r1}→${r2}`;
    const rVerbose = formatRangeValue(
      formatSignedDeg(firstTrack.transform.pose.roll),
      r2
    );
    rollVerboseSuffix = ` · Roll: ${rVerbose}`;
  }

  const cameraText = `${distStr} · ${yawStr} · ${pitchStr}${rollSuffix}`;
  const cameraTooltip = `Camera Pose — Distance: ${distStr} · Yaw: ${yawVerbose} · Pitch: ${pitchVerbose}${rollVerboseSuffix}`;

  const entities = first.frame.entitiesList.map((e) => e.def);
  const baseTargetLabel = resolveShotTargetInfo(
    cueSpec?.target,
    entities,
    firstTrack.baseTarget
  ).label;

  const offset1 = formatCompactOffsetVec(firstTrack.targetOffset);
  const offset2 = formatCompactOffsetVec(lastTrack.targetOffset);
  let targetText = baseTargetLabel;
  if (offset1 && offset2 && offset1 !== offset2) {
    targetText = `${baseTargetLabel} · ${offset1}→${offset2}`;
  } else if (offset1 || offset2) {
    targetText = `${baseTargetLabel} · ${offset1 ?? offset2}`;
  }

  const vOffset1 = formatVerboseOffsetVec(firstTrack.targetOffset);
  const vOffset2 = formatVerboseOffsetVec(lastTrack.targetOffset);
  let targetTooltip = `Target: ${baseTargetLabel}`;
  if (vOffset1 && vOffset2 && vOffset1 !== vOffset2) {
    targetTooltip = `Target: ${baseTargetLabel} · Offset ${vOffset1}→${vOffset2}`;
  } else if (vOffset1 || vOffset2) {
    targetTooltip = `Target: ${baseTargetLabel} · Offset ${vOffset1 ?? vOffset2}`;
  }

  const rigRaw = firstTrack.rig?.type ?? lastTrack.rig?.type ?? null;
  const rigText = rigRaw ? formatRigName(rigRaw) : null;
  const rigTooltip = rigText ? `Physical Camera Mount: ${rigText}` : null;

  return {
    shotNumber: shot.shotNumber,
    label: cleanShotLabel(shot.label) || shot.id,
    timeRangeText: `${shot.startSec.toFixed(1)}s–${shot.endSec.toFixed(1)}s`,
    durationText: `${durationSec.toFixed(1)}s`,
    focalLengthText,
    maneuverText: firstTrack.maneuver,
    opticsText,
    opticsTooltip,
    moveText,
    moveTooltip,
    cameraText,
    cameraTooltip,
    targetText,
    targetTooltip,
    rigText,
    rigTooltip,
    apertureText,
    focusText,
    focusTooltip,
    description: (shot.description ?? '').trim(),
  };
}

/**
 * Backward-compatible single-sample metadata formatter wrapper.
 */
export function formatStoryboardPanelMeta(
  sample: StoryboardSamplePoint,
  targetCamera: ExportTargetCamera
): StoryboardPanelMeta {
  return formatStoryboardShotMeta([sample], targetCamera);
}

/**
 * Aggregates unique focal lengths, camera maneuvers, and physical rigs across
 * all grouped shots for the Contact Sheet header summary strip.
 */
export function summarizeStoryboardSheet(
  groups: StoryboardShotGroup[],
  targetCamera: ExportTargetCamera
): StoryboardSheetSummary {
  const lensCounts = new Map<number, number>();
  const maneuverCounts = new Map<string, number>();
  const rigCounts = new Map<string, number>();

  for (const group of groups) {
    const rep = group.samples[0];
    if (!rep) continue;
    const track =
      targetCamera === 'observer'
        ? rep.frame.observerCamera
        : rep.frame.stageCamera;

    const mm = Math.round(track.transform.pose.focalLengthMm);
    lensCounts.set(mm, (lensCounts.get(mm) ?? 0) + 1);

    maneuverCounts.set(
      track.maneuver,
      (maneuverCounts.get(track.maneuver) ?? 0) + 1
    );

    if (track.rig?.type) {
      const rigName = formatRigName(track.rig.type);
      rigCounts.set(rigName, (rigCounts.get(rigName) ?? 0) + 1);
    }
  }

  return {
    lenses: Array.from(lensCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([mm, count]) => ({ label: `${mm}mm`, count })),
    maneuvers: Array.from(maneuverCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, count]) => ({ label, count })),
    rigs: Array.from(rigCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, count]) => ({ label, count })),
  };
}

const ORDERED_BEAT_TOKEN: Record<'START' | 'MID' | 'END', string> = {
  START: '01_start',
  MID: '02_mid',
  END: '03_end',
};

/**
 * Formats a deterministic single-panel storyboard export filename, e.g.:
 * - Single download (`orderedBeat = false`): `afraid_01_shot_01_start_0s_1080p.png`
 * - ZIP entry (`orderedBeat = true`): `afraid_01_shot_01_01_start_0s_1080p.png`
 */
export function formatStoryboardFrameFilename(params: {
  scoreIdOrTitle: string;
  shotNumber: number;
  shotId: string;
  beatTag: StoryboardBeatTag;
  stageTimeSec: number;
  tier: ExportResolutionTier;
  format: StoryboardExportFormat;
  targetCamera: ExportTargetCamera;
  orderedBeat?: boolean;
}): string {
  const slug = sanitizeExportSlug(params.scoreIdOrTitle);
  const shotNum = String(Math.max(1, Math.round(params.shotNumber))).padStart(
    2,
    '0'
  );
  const shotSlug = sanitizeExportSlug(params.shotId);
  const beatPart = params.beatTag
    ? `_${params.orderedBeat ? ORDERED_BEAT_TOKEN[params.beatTag] : params.beatTag.toLowerCase()}`
    : '';
  const secRounded = Number(Math.max(0, params.stageTimeSec).toFixed(2));
  const secPart = `${String(secRounded).replace('.', '_')}s`;
  const camPart = params.targetCamera === 'observer' ? '_observer' : '';
  const ext = params.format === 'jpeg' ? 'jpg' : params.format;
  return `${slug}_${shotNum}_${shotSlug}${beatPart}_${secPart}${camPart}_${params.tier}p.${ext}`;
}

/**
 * Formats a deterministic Storyboard Contact Sheet PNG filename, e.g.:
 * `afraid_storyboard_stage_cam.png` or `vector_field_storyboard_observer_clean.png`.
 */
export function formatStoryboardContactSheetFilename(params: {
  scoreIdOrTitle: string;
  targetCamera: ExportTargetCamera;
  annotated: boolean;
}): string {
  const slug = sanitizeExportSlug(params.scoreIdOrTitle);
  const camPart = params.targetCamera === 'observer' ? '_observer' : '';
  const cleanPart = params.annotated ? '' : '_clean';
  return `${slug}_storyboard${camPart}${cleanPart}.png`;
}

/**
 * Formats a deterministic Storyboard batch frames ZIP filename with download date/time, e.g.:
 * `afraid_frames_20261116_163601_1080p.zip` or `vector_field_frames_observer_20261116_163601_720p.zip`.
 */
export function formatStoryboardZipFilename(params: {
  scoreIdOrTitle: string;
  targetCamera: ExportTargetCamera;
  tier: ExportResolutionTier;
  downloadedAt?: Date;
}): string {
  const slug = sanitizeExportSlug(params.scoreIdOrTitle);
  const camPart = params.targetCamera === 'observer' ? '_observer' : '';
  const clockTag = formatLocalClockTag(params.downloadedAt ?? new Date());
  return `${slug}_frames${camPart}_${clockTag}_${params.tier}p.zip`;
}
