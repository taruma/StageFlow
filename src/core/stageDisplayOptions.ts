/**
 * Pure Layer 1 types and visibility helpers for session-only 3D Stage Display Options.
 * Governs purely visual diorama presentation (floor rendering, entity category & per-character
 * filtering, and entity visual cues) without altering core math or frame evaluation.
 */

import type {
  SceneEntityDef,
  StageDisplayOptions,
  StageFloorMode,
} from './types';

export const STAGE_FLOOR_MODES: readonly StageFloorMode[] = [
  'solid',
  'grid',
  'off',
] as const;

export type StageDisplayFlagKey =
  | 'showCharacters'
  | 'showProps'
  | 'showMarkers'
  | 'showArrows'
  | 'showFootprints'
  | 'showTrails';

export const DEFAULT_STAGE_DISPLAY_OPTIONS: StageDisplayOptions = {
  floorMode: 'solid',
  showCharacters: true,
  showProps: true,
  showMarkers: true,
  hiddenCharacterIds: [],
  showArrows: true,
  showFootprints: true,
  showTrails: true,
};

/** Type guard verifying whether a string is a valid StageFloorMode. */
export function isStageFloorMode(value: string): value is StageFloorMode {
  return (STAGE_FLOOR_MODES as readonly string[]).includes(value);
}

/** Merges partial visual display options onto DEFAULT_STAGE_DISPLAY_OPTIONS. */
export function resolveStageDisplayOptions(
  options?: Partial<StageDisplayOptions>
): StageDisplayOptions {
  if (!options) return DEFAULT_STAGE_DISPLAY_OPTIONS;
  return {
    floorMode: options.floorMode ?? DEFAULT_STAGE_DISPLAY_OPTIONS.floorMode,
    showCharacters:
      options.showCharacters ?? DEFAULT_STAGE_DISPLAY_OPTIONS.showCharacters,
    showProps: options.showProps ?? DEFAULT_STAGE_DISPLAY_OPTIONS.showProps,
    showMarkers:
      options.showMarkers ?? DEFAULT_STAGE_DISPLAY_OPTIONS.showMarkers,
    hiddenCharacterIds:
      options.hiddenCharacterIds ??
      DEFAULT_STAGE_DISPLAY_OPTIONS.hiddenCharacterIds,
    showArrows: options.showArrows ?? DEFAULT_STAGE_DISPLAY_OPTIONS.showArrows,
    showFootprints:
      options.showFootprints ?? DEFAULT_STAGE_DISPLAY_OPTIONS.showFootprints,
    showTrails: options.showTrails ?? DEFAULT_STAGE_DISPLAY_OPTIONS.showTrails,
  };
}

/** Evaluates whether a scene entity should render visually in the 3D diorama. */
export function isEntityVisuallyVisible(
  entity: Pick<SceneEntityDef, 'id' | 'kind'>,
  options?: StageDisplayOptions
): boolean {
  if (!options) return true;
  if (entity.kind === 'character') {
    return (
      options.showCharacters &&
      !options.hiddenCharacterIds.includes(entity.id)
    );
  }
  if (entity.kind === 'prop') return options.showProps;
  if (entity.kind === 'marker') return options.showMarkers;
  return true;
}

/** Returns true when any stage display setting deviates from its default state. */
export function hasCustomStageDisplayOptions(
  options: StageDisplayOptions
): boolean {
  return (
    options.floorMode !== 'solid' ||
    !options.showCharacters ||
    !options.showProps ||
    !options.showMarkers ||
    options.hiddenCharacterIds.length > 0 ||
    !options.showArrows ||
    !options.showFootprints ||
    !options.showTrails
  );
}

/** Toggles a character ID inside the hiddenCharacterIds list without duplicates. */
export function toggleHiddenCharacterId(
  currentIds: readonly string[],
  characterId: string
): string[] {
  if (currentIds.includes(characterId)) {
    return currentIds.filter((id) => id !== characterId);
  }
  return [...currentIds, characterId];
}
