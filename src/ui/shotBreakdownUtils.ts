/**
 * Pure helper and formatting functions for the Top-Left Directorial Shot Breakdown HUD.
 * Decoupled from React and Three.js runtime dependencies.
 * Layer 5 UI Utilities.
 */

import type { SceneEntityDef, TargetAnchor, Vec3 } from '../core/types';
import { matchEntityTargetKey } from '../core/cameraTargetResolver';

export interface ResolvedTargetInfo {
  label: string;
  color?: string;
  isEntity: boolean;
}

/**
 * Strips redundant "Shot ## · ", "Shot ##: ", or "Shot ## - " prefixes from user labels
 * since the #xx badge already shows the shot number.
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
 * Formats a 3D vector with explicit sign prefixes: e.g. "Δ [+0.15, -0.12, +0.00]m".
 */
export function formatSignedVector3D(v?: Vec3): string {
  if (!v) return 'Δ [0.00, 0.00, 0.00]m';
  const x = v.x >= 0 ? `+${v.x.toFixed(2)}` : v.x.toFixed(2);
  const y = v.y >= 0 ? `+${v.y.toFixed(2)}` : v.y.toFixed(2);
  const z = v.z >= 0 ? `+${v.z.toFixed(2)}` : v.z.toFixed(2);
  return `Δ [${x}, ${y}, ${z}]m`;
}

/**
 * Formats film gate aspect ratio into human-readable label (e.g. "16:9 Gate", "2.39:1 Gate").
 */
export function formatFilmGateLabel(aspectRatio: number): string {
  if (!aspectRatio || Number.isNaN(aspectRatio)) return '16:9 Gate';
  if (Math.abs(aspectRatio - 16 / 9) < 0.05) return '16:9 Gate';
  if (Math.abs(aspectRatio - 2.39) < 0.08 || Math.abs(aspectRatio - 2.35) < 0.08)
    return '2.39:1 Gate';
  if (Math.abs(aspectRatio - 4 / 3) < 0.05) return '4:3 Gate';
  if (Math.abs(aspectRatio - 1) < 0.05) return '1:1 Gate';
  if (Math.abs(aspectRatio - 9 / 16) < 0.05) return '9:16 Gate';
  return `${aspectRatio.toFixed(2)}:1 Gate`;
}

/**
 * Formats shot start time and duration: e.g. "Start: 42.0s · Dur: 16.0s".
 */
export function formatShotTiming(startSec: number, endSec: number): string {
  const dur = Math.max(0, endSec - startSec);
  return `Start: ${startSec.toFixed(1)}s · Dur: ${dur.toFixed(1)}s`;
}

