/**
 * Pure deterministic layout resolution, DP/AC shot metadata formatting, and
 * sheet-level summary aggregation for the Storyboard Contact Sheet.
 * Zero React, DOM, or Three.js runtime dependencies.
 */

import type { ExportTargetCamera } from './exportMath';
import { formatApertureFStop } from './opticsMath';
import type {
  StoryboardPanelMeta,
  StoryboardSampleMode,
  StoryboardSamplePoint,
  StoryboardSheetSummary,
  StoryboardShotGroup,
} from './storyboardMath';

export type StoryboardDensity = 'compact' | 'balanced' | 'large';
export type StoryboardGridColumns = 1 | 2 | 3 | 4 | 6;

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

    // Annotated portrait cards use horizontal [Frame | Text] splits at 2 columns
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
  return first === last ? first : `${first} → ${last}`;
}

function formatRigName(type: string): string {
  return type === 'spline_track' ? 'spline' : type;
}

/**
 * Extracts formatted directorial & DP optics/rig metadata for a shot card.
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

  let apertureText: string | null = null;
  let focusText: string | null = null;

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
      focusText = `F ${formatRangeValue(f1, f2)}`;
    }
  }

  const rigRaw = firstTrack.rig?.type ?? lastTrack.rig?.type ?? null;

  return {
    shotNumber: shot.shotNumber,
    label: cleanShotLabel(shot.label) || shot.id,
    timeRangeText: `${shot.startSec.toFixed(1)}s–${shot.endSec.toFixed(1)}s`,
    durationText: `${durationSec.toFixed(1)}s`,
    focalLengthText: formatRangeValue(firstLens, lastLens),
    maneuverText: firstTrack.maneuver,
    rigText: rigRaw ? formatRigName(rigRaw) : null,
    apertureText,
    focusText,
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
