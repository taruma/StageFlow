import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STAGE_DISPLAY_OPTIONS,
  hasCustomStageDisplayOptions,
  isEntityVisuallyVisible,
  isStageFloorMode,
  resolveStageDisplayOptions,
  toggleHiddenCharacterId,
} from '../../src/core/stageDisplayOptions';

describe('stageDisplayOptions — Pure Visual Diorama Display Helpers', () => {
  it('validates StageFloorMode values strictly', () => {
    expect(isStageFloorMode('solid')).toBe(true);
    expect(isStageFloorMode('grid')).toBe(true);
    expect(isStageFloorMode('off')).toBe(true);
    expect(isStageFloorMode('wireframe')).toBe(false);
    expect(isStageFloorMode('')).toBe(false);
  });

  it('merges partial options safely onto defaults', () => {
    expect(resolveStageDisplayOptions()).toEqual(DEFAULT_STAGE_DISPLAY_OPTIONS);
    expect(
      resolveStageDisplayOptions({ floorMode: 'grid', showArrows: false })
    ).toEqual({
      ...DEFAULT_STAGE_DISPLAY_OPTIONS,
      floorMode: 'grid',
      showArrows: false,
    });
  });

  it('evaluates category and per-character entity visibility accurately', () => {
    const hero = { id: 'hero', kind: 'character' as const };
    const partner = { id: 'partner', kind: 'character' as const };
    const table = { id: 'table', kind: 'prop' as const };
    const mark = { id: 'mark_1', kind: 'marker' as const };

    // Default: all visible
    expect(isEntityVisuallyVisible(hero, DEFAULT_STAGE_DISPLAY_OPTIONS)).toBe(true);
    expect(isEntityVisuallyVisible(table, DEFAULT_STAGE_DISPLAY_OPTIONS)).toBe(true);
    expect(isEntityVisuallyVisible(mark, DEFAULT_STAGE_DISPLAY_OPTIONS)).toBe(true);

    // Individual character hidden leaves other characters, props, and markers visible
    const hideHero = {
      ...DEFAULT_STAGE_DISPLAY_OPTIONS,
      hiddenCharacterIds: ['hero'],
    };
    expect(isEntityVisuallyVisible(hero, hideHero)).toBe(false);
    expect(isEntityVisuallyVisible(partner, hideHero)).toBe(true);
    expect(isEntityVisuallyVisible(table, hideHero)).toBe(true);
    expect(isEntityVisuallyVisible(mark, hideHero)).toBe(true);

    // Category showCharacters=false hides all characters regardless of hiddenCharacterIds
    const hideAllChars = {
      ...DEFAULT_STAGE_DISPLAY_OPTIONS,
      showCharacters: false,
    };
    expect(isEntityVisuallyVisible(hero, hideAllChars)).toBe(false);
    expect(isEntityVisuallyVisible(partner, hideAllChars)).toBe(false);
    expect(isEntityVisuallyVisible(table, hideAllChars)).toBe(true);

    // Props and markers category toggles
    const hidePropsMarkers = {
      ...DEFAULT_STAGE_DISPLAY_OPTIONS,
      showProps: false,
      showMarkers: false,
    };
    expect(isEntityVisuallyVisible(hero, hidePropsMarkers)).toBe(true);
    expect(isEntityVisuallyVisible(table, hidePropsMarkers)).toBe(false);
    expect(isEntityVisuallyVisible(mark, hidePropsMarkers)).toBe(false);
  });

  it('detects customized options and toggles character IDs without duplicates', () => {
    expect(hasCustomStageDisplayOptions(DEFAULT_STAGE_DISPLAY_OPTIONS)).toBe(false);
    expect(
      hasCustomStageDisplayOptions({
        ...DEFAULT_STAGE_DISPLAY_OPTIONS,
        floorMode: 'grid',
      })
    ).toBe(true);
    expect(
      hasCustomStageDisplayOptions({
        ...DEFAULT_STAGE_DISPLAY_OPTIONS,
        showTrails: false,
      })
    ).toBe(true);
    expect(
      hasCustomStageDisplayOptions({
        ...DEFAULT_STAGE_DISPLAY_OPTIONS,
        hiddenCharacterIds: ['hero'],
      })
    ).toBe(true);

    const added = toggleHiddenCharacterId([], 'hero');
    expect(added).toEqual(['hero']);
    const addedSecond = toggleHiddenCharacterId(added, 'partner');
    expect(addedSecond).toEqual(['hero', 'partner']);
    const removed = toggleHiddenCharacterId(addedSecond, 'hero');
    expect(removed).toEqual(['partner']);
  });
});
