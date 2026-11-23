/**
 * Layer 4 Render Synchronization Gate for 60fps Refs vs. Throttled React Props.
 *
 * When `frameRef.current` crosses a shot or cue boundary on frame N before React
 * commits the matching `uiFrame` / prop snapshot, imperatively driven 3D rigs and
 * mannequins hold the last rendered 60fps state belonging to the committed shot/cue
 * instead of rewinding to a stale `uiFrame` (~95ms) or React.memo initialSnapshot (3–10s).
 */

export interface GatedStateResult<T> {
  state: T;
  isDesynced: boolean;
}

/**
 * Explicit React Three Fiber `useFrame` execution priority tiers (all <= 0 preserve
 * R3F's automatic `gl.render` pass; positive priorities take over rendering).
 *
 * Execution order per frame:
 *   1. `EVALUATE_FRAME` (-2): Compute `StageFrame` into `frameRef.current`.
 *   2. Drei `OrbitControls` (-1): Apply interactive orbit/pan/zoom input.
 *   3. `RIG_TRANSFORMS` (-0.5): Apply camera, mannequin, and rig transforms before DOM overlays.
 *   4. `DOM_OVERLAYS` (0): Drei `<Html>` & `StageBillboardLabel` project finalized matrices.
 *   5. `POST_EFFECT` (1): `StageCamDofEffect` single-pass FBO + bokeh composite render.
 */
export const STAGE_FRAME_PRIORITY = {
  EVALUATE_FRAME: -2,
  RIG_TRANSFORMS: -0.5,
  DOM_OVERLAYS: 0,
  POST_EFFECT: 1,
} as const;

/**
 * Resolve the synchronized 3D state for the active frame without backward teleports.
 *
 * - Returns `{ state: live, isDesynced: false }` whenever `live` matches `committed`
 *   on boundary ID (or boundary IDs are absent).
 * - During the ~1-frame async commit window after `live` crosses into a new boundary ID,
 *   holds `lastSynced` if `lastSynced` still belongs to `committed`'s boundary ID;
 *   otherwise falls back to `committed` (e.g., initial mount or post-seek commit).
 */
export function resolveGatedState<T>(
  live: T | null | undefined,
  committed: T,
  lastSynced: T | null | undefined,
  getBoundaryId: (value: T) => string | undefined | null
): GatedStateResult<T> {
  if (live === null || live === undefined) {
    return { state: committed, isDesynced: false };
  }

  const liveId = getBoundaryId(live);
  const committedId = getBoundaryId(committed);

  const isDesynced =
    liveId !== undefined &&
    liveId !== null &&
    liveId !== '' &&
    committedId !== undefined &&
    committedId !== null &&
    committedId !== '' &&
    liveId !== committedId;

  if (!isDesynced) {
    return { state: live, isDesynced: false };
  }

  const lastId =
    lastSynced !== undefined && lastSynced !== null
      ? getBoundaryId(lastSynced)
      : undefined;

  const canHoldLastSynced =
    lastSynced !== undefined &&
    lastSynced !== null &&
    lastId === committedId;

  return {
    state: canHoldLastSynced ? lastSynced : committed,
    isDesynced: true,
  };
}
