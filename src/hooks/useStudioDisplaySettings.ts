/**
 * Custom hook managing 3D diorama display preferences (label display modes,
 * viewfinder composition guides, optical DoF blur, session-only diorama HUD visibility)
 * and global studio keyboard shortcuts ('L' / 'G' / 'B' / 'M' / 'H').
 * Layer 3 hook.
 */

import { useState, useCallback, useEffect } from 'react';
import { getNextLabelDisplayMode } from '../core/constants';
import {
  DEFAULT_STAGE_DISPLAY_OPTIONS,
  toggleHiddenCharacterId,
  type StageDisplayFlagKey,
} from '../core/stageDisplayOptions';
import type {
  LabelDisplayMode,
  StageDisplayOptions,
  StageFloorMode,
} from '../core/types';
import {
  loadStoredDioramaMinimap,
  loadStoredDofBlur,
  loadStoredLabelMode,
  loadStoredViewfinderGuides,
  saveStoredDioramaMinimap,
  saveStoredDofBlur,
  saveStoredLabelMode,
  saveStoredViewfinderGuides,
} from '../core/storage/localStorageUi';

export function useStudioDisplaySettings() {
  const [labelMode, setLabelModeState] = useState<LabelDisplayMode>(
    () => loadStoredLabelMode() ?? 'all'
  );

  const [showGuides, setShowGuidesState] = useState<boolean>(
    () => loadStoredViewfinderGuides() ?? true
  );

  const [dofBlurEnabled, setDofBlurState] = useState<boolean>(
    () => loadStoredDofBlur() ?? false
  );

  const [showMinimap, setShowMinimapState] = useState<boolean>(
    () => loadStoredDioramaMinimap() ?? true
  );

  // Session-only main 3D diorama HUD visibility (intentionally resets on page reload)
  const [showDioramaHud, setShowDioramaHud] = useState<boolean>(true);

  const handleToggleDioramaHud = useCallback(() => {
    setShowDioramaHud((prev) => !prev);
  }, []);

  // Session-only visual diorama display filters (intentionally reset on page reload)
  const [stageDisplay, setStageDisplay] = useState<StageDisplayOptions>(
    DEFAULT_STAGE_DISPLAY_OPTIONS
  );

  const handleSelectFloorMode = useCallback((floorMode: StageFloorMode) => {
    setStageDisplay((prev) =>
      prev.floorMode === floorMode ? prev : { ...prev, floorMode }
    );
  }, []);

  const handleToggleStageDisplayFlag = useCallback((key: StageDisplayFlagKey) => {
    setStageDisplay((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleToggleCharacterVisible = useCallback((characterId: string) => {
    setStageDisplay((prev) => ({
      ...prev,
      hiddenCharacterIds: toggleHiddenCharacterId(
        prev.hiddenCharacterIds,
        characterId
      ),
    }));
  }, []);

  const handleClearHiddenCharacters = useCallback(() => {
    setStageDisplay((prev) =>
      prev.hiddenCharacterIds.length === 0
        ? prev
        : { ...prev, hiddenCharacterIds: [] }
    );
  }, []);

  const handleResetStageDisplay = useCallback(() => {
    setStageDisplay(DEFAULT_STAGE_DISPLAY_OPTIONS);
  }, []);

  const handleSelectLabelMode = useCallback((mode: LabelDisplayMode) => {
    setLabelModeState(mode);
    saveStoredLabelMode(mode);
  }, []);

  const handleCycleLabelMode = useCallback(() => {
    setLabelModeState((prev) => {
      const next = getNextLabelDisplayMode(prev);
      saveStoredLabelMode(next);
      return next;
    });
  }, []);

  const handleToggleGuides = useCallback(() => {
    setShowGuidesState((prev) => {
      const next = !prev;
      saveStoredViewfinderGuides(next);
      return next;
    });
  }, []);

  const handleToggleDofBlur = useCallback(() => {
    setDofBlurState((prev) => {
      const next = !prev;
      saveStoredDofBlur(next);
      return next;
    });
  }, []);

  const setDofBlurEnabled = useCallback((enabled: boolean) => {
    setDofBlurState(enabled);
    saveStoredDofBlur(enabled);
  }, []);

  const handleToggleMinimap = useCallback(() => {
    setShowMinimapState((prev) => {
      const next = !prev;
      saveStoredDioramaMinimap(next);
      return next;
    });
  }, []);

  // Global hotkeys: 'L' labels, 'G' guides, 'B' DoF blur, 'M' top-down minimap, 'H' diorama HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        handleCycleLabelMode();
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        handleToggleGuides();
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        handleToggleDofBlur();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleMinimap();
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        handleToggleDioramaHud();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleCycleLabelMode,
    handleToggleGuides,
    handleToggleDofBlur,
    handleToggleMinimap,
    handleToggleDioramaHud,
  ]);

  return {
    labelMode,
    showGuides,
    dofBlurEnabled,
    showMinimap,
    stageDisplay,
    showDioramaHud,
    handleSelectLabelMode,
    handleCycleLabelMode,
    handleToggleGuides,
    handleToggleDofBlur,
    handleToggleMinimap,
    setDofBlurEnabled,
    handleSelectFloorMode,
    handleToggleStageDisplayFlag,
    handleToggleCharacterVisible,
    handleClearHiddenCharacters,
    handleResetStageDisplay,
    handleToggleDioramaHud,
  };
}
