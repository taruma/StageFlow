/**
 * Pure helper and formatting functions for the Top-Left Directorial Shot Breakdown HUD.
 * Decoupled from React and Three.js runtime dependencies.
 * Layer 5 UI Utilities.
 */

import type { Vec3 } from '../core/types';
import {
  cleanShotLabel,
  resolveShotTargetInfo,
  type ResolvedTargetInfo,
} from '../core/storyboardLayout';

export { cleanShotLabel, resolveShotTargetInfo, type ResolvedTargetInfo };

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

