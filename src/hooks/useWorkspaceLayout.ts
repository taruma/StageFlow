/**
 * Custom hook encapsulating resizable 3-column studio layout state,
 * subpanel expansion, [Visual | YAML] edit mode toggles, and localStorage persistence.
 * Layer 3 hook.
 */

import { useState, useCallback, useRef } from 'react';
import type {
  EditorStudioMode,
  SplitPreset,
  ToastNotification,
} from '../core/types';
import {
  loadStoredEditMode,
  loadStoredEditorMode,
  loadStoredLeftSplitPct,
  loadStoredRightSplitPct,
  loadStoredSplitPreset,
  loadStoredSubpanelCollapsed,
  loadStoredVideoHeightPct,
  saveStoredEditMode,
  saveStoredEditorMode,
  saveStoredLeftSplitPct,
  saveStoredRightSplitPct,
  saveStoredSplitPreset,
  saveStoredSubpanelCollapsed,
  saveStoredVideoHeightPct,
} from '../core/storage/localStorageUi';

export interface UseWorkspaceLayoutOptions {
  onNotify?: (message: string, type?: ToastNotification['type']) => void;
}

export function useWorkspaceLayout(options?: UseWorkspaceLayoutOptions) {
  const [splitPreset, setSplitPresetState] = useState<SplitPreset>(
    () => loadStoredSplitPreset() ?? 'split'
  );

  const [isEditMode, setIsEditModeState] = useState<boolean>(
    () => loadStoredEditMode() ?? false
  );

  const [editorMode, setEditorModeState] = useState<EditorStudioMode>(
    () => loadStoredEditorMode() ?? 'visual'
  );

  const isEditModeRef = useRef(isEditMode);
  isEditModeRef.current = isEditMode;
  const editorModeRef = useRef(editorMode);
  editorModeRef.current = editorMode;

  const [leftSplitPct, setLeftSplitPctState] = useState<number>(
    () => loadStoredLeftSplitPct() ?? 30
  );

  const [rightSplitPct, setRightSplitPctState] = useState<number>(
    () => loadStoredRightSplitPct() ?? 30
  );

  const [videoHeightPct, setVideoHeightPctState] = useState<number>(
    () => loadStoredVideoHeightPct() ?? 45
  );

  const [isSubpanelCollapsed, setIsSubpanelCollapsedState] = useState<boolean>(
    () => loadStoredSubpanelCollapsed() ?? false
  );

  const handleSelectSplitPreset = useCallback((preset: SplitPreset) => {
    setSplitPresetState(preset);
    saveStoredSplitPreset(preset);
  }, []);

  const handleToggleEditMode = useCallback(() => {
    const next = !isEditModeRef.current;
    isEditModeRef.current = next;
    setIsEditModeState(next);
    saveStoredEditMode(next);
    if (next) {
      setIsSubpanelCollapsedState(false);
      saveStoredSubpanelCollapsed(false);
    }
  }, []);

  const handleSelectEditorMode = useCallback((mode: EditorStudioMode) => {
    if (!isEditModeRef.current) {
      isEditModeRef.current = true;
      editorModeRef.current = mode;
      setIsEditModeState(true);
      saveStoredEditMode(true);
      setEditorModeState(mode);
      saveStoredEditorMode(mode);
      setIsSubpanelCollapsedState(false);
      saveStoredSubpanelCollapsed(false);
      return;
    }

    if (editorModeRef.current === mode) {
      isEditModeRef.current = false;
      setIsEditModeState(false);
      saveStoredEditMode(false);
      return;
    }

    editorModeRef.current = mode;
    setEditorModeState(mode);
    saveStoredEditorMode(mode);
  }, []);

  const openEditMode = useCallback((mode?: EditorStudioMode) => {
    isEditModeRef.current = true;
    setIsEditModeState(true);
    saveStoredEditMode(true);
    if (mode) {
      editorModeRef.current = mode;
      setEditorModeState(mode);
      saveStoredEditorMode(mode);
    }
    setIsSubpanelCollapsedState(false);
    saveStoredSubpanelCollapsed(false);
  }, []);

  const closeEditMode = useCallback(() => {
    isEditModeRef.current = false;
    setIsEditModeState(false);
    saveStoredEditMode(false);
  }, []);

  const handleToggleSubpanelCollapse = useCallback(() => {
    setIsSubpanelCollapsedState((prev) => {
      const next = !prev;
      saveStoredSubpanelCollapsed(next);
      return next;
    });
  }, []);

  const handleLeftSplitChange = useCallback((pct: number) => {
    setLeftSplitPctState(pct);
    saveStoredLeftSplitPct(pct);
  }, []);

  const handleRightSplitChange = useCallback((pct: number) => {
    setRightSplitPctState(pct);
    saveStoredRightSplitPct(pct);
  }, []);

  const handleVideoHeightChange = useCallback((pct: number) => {
    setVideoHeightPctState(pct);
    saveStoredVideoHeightPct(pct);
  }, []);

  const handleResetLayout = useCallback(() => {
    setSplitPresetState('split');
    saveStoredSplitPreset('split');

    setLeftSplitPctState(30);
    saveStoredLeftSplitPct(30);

    setRightSplitPctState(30);
    saveStoredRightSplitPct(30);

    setVideoHeightPctState(45);
    saveStoredVideoHeightPct(45);

    setIsSubpanelCollapsedState(false);
    saveStoredSubpanelCollapsed(false);

    options?.onNotify?.('Reset workspace layout to default (30/40/30)', 'info');
  }, [options]);

  return {
    splitPreset,
    isEditMode,
    editorMode,
    leftSplitPct,
    rightSplitPct,
    videoHeightPct,
    isSubpanelCollapsed,
    handleSelectSplitPreset,
    handleToggleEditMode,
    handleSelectEditorMode,
    openEditMode,
    closeEditMode,
    handleToggleSubpanelCollapse,
    handleLeftSplitChange,
    handleRightSplitChange,
    handleVideoHeightChange,
    handleResetLayout,
  };
}
