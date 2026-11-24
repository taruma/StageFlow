/**
 * Pure synchronization & timestamp math helpers for the Headless Viewport Recorder.
 * Keeps init() and stepFrame() aligned on shard start frames and guards R3F inner
 * fiber commit barriers without React/DOM/Three.js runtime dependencies.
 */

/**
 * Resolve the deterministic timeline timestamp (seconds) for a given frame index.
 */
export function resolveRecorderFrameTimestampSec(
  frameIndex: number,
  fps: number,
  startSec: number,
  endSec: number,
  scoreDurationSec: number
): number {
  const safeFrameIndex = Math.max(0, frameIndex);
  const safeFps = Math.max(1e-6, fps);
  const effectiveEnd = endSec > startSec ? endSec : scoreDurationSec;
  return Math.min(startSec + safeFrameIndex / safeFps, effectiveEnd);
}

/**
 * Returns true once the inner React Three Fiber reconciler has committed
 * the target uiFrame revision to the scene graph.
 */
export function isRecorderR3fReadyForStep(
  committedRevision: number,
  targetRevision: number
): boolean {
  return committedRevision >= targetRevision;
}

/**
 * Returns true when init() may begin pumping R3F advance() warm-up ticks:
 * requires an active advance handle, all expected .glb/.gltf skins settled,
 * and the inner R3F tree committed at or past the init target revision.
 */
export function shouldAdvanceDuringRecorderInit(
  hasAdvance: boolean,
  allSkinsSettled: boolean,
  committedRevision: number,
  targetRevision: number
): boolean {
  return hasAdvance && allSkinsSettled && committedRevision >= targetRevision;
}
