/**
 * Custom hook managing 3D diorama display preferences (label display modes,
 * viewfinder composition guides, optical DoF blur) and global studio keyboard shortcuts ('L' / 'G' / 'B').
 * Layer 3 hook.
 */

import { useState, useCallback, useEffect } from 'react';
import type { LabelDisplayMode } from '../core/types';
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

  const handleSelectLabelMode = useCallback((mode: LabelDisplayMode) => {
    setLabelModeState(mode);
    saveStoredLabelMode(mode);
  }, []);

  const handleCycleLabelMode = useCallback(() => {
    setLabelModeState((prev) => {
      const next: LabelDisplayMode =
        prev === 'all' ? 'camera-only' : prev === 'camera-only' ? 'off' : 'all';
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

  // Global hotkeys: 'L' labels, 'G' guides, 'B' DoF blur, 'M' top-down minimap
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleCycleLabelMode,
    handleToggleGuides,
    handleToggleDofBlur,
    handleToggleMinimap,
  ]);

  return {
    labelMode,
    showGuides,
    dofBlurEnabled,
    showMinimap,
    handleSelectLabelMode,
    handleCycleLabelMode,
    handleToggleGuides,
    handleToggleDofBlur,
    handleToggleMinimap,
    setDofBlurEnabled,
  };
}
