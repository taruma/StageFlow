/**
 * Unified Plain-Text-as-Truth document state hook for StageFlow.
 * Owns `ScoreHistoryState` (`rawYaml` + Undo/Redo + `revision`), single-parse
 * `VisualScoreIR`, 60fps ephemeral `previewScore` during Figma-pill scrubs,
 * and global Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z shortcuts.
 * Layer 3 hook.
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type {
  ParseScoreResult,
  ScoreDiagnostic,
  ShotTimingEditMode,
  StageScore,
} from '../core/types';
import {
  canRedoScore,
  canResetScore,
  canUndoScore,
  commitScoreHistory,
  createScoreHistory,
  redoScoreHistory,
  resetScoreHistory,
  undoScoreHistory,
  type ScoreHistoryState,
} from '../core/scoreHistory';
import {
  normalizeParsedStageScore,
  parseStageScore,
} from '../core/scoreParser';
import {
  projectVisualScoreIR,
  projectVisualScoreIRFromDoc,
  type VisualScoreIRResult,
} from '../core/scoreYamlProjection';
import {
  applyScoreYamlCommand,
  applyScoreYamlCommandDetailed,
  type ScalarFormatHint,
  type ScoreYamlCommand,
} from '../core/scoreYamlMutator';
import {
  applyScoreHotPatch,
  applyShotTimingHotPatch,
} from '../core/scoreHotPatch';
import type { YamlPath } from '../core/schema/scoreSchemaTypes';

export interface UseScoreDocumentOptions {
  initialYaml: string;
  initialScore: StageScore;
  activeSceneId: string;
  isBundled: boolean;
  isVisualModeActive?: boolean;
  onSaveDraftDebounced?: (nextYaml: string, parsedScore: StageScore) => void;
  onVideoUrlActive?: () => void;
}

export function useScoreDocument({
  initialYaml,
  initialScore,
  activeSceneId,
  isBundled,
  isVisualModeActive = true,
  onSaveDraftDebounced,
  onVideoUrlActive,
}: UseScoreDocumentOptions) {
  const [history, setHistory] = useState<ScoreHistoryState>(() =>
    createScoreHistory(initialYaml)
  );
  const [activeScore, setActiveScore] = useState<StageScore>(initialScore);
  const [previewScore, setPreviewScore] = useState<StageScore | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  const [parseDiagnostics, setParseDiagnostics] = useState<
    ScoreDiagnostic[] | undefined
  >(undefined);

  const historyRef = useRef(history);
  historyRef.current = history;

  const activeScoreRef = useRef(activeScore);
  activeScoreRef.current = activeScore;

  const activeSceneIdRef = useRef(activeSceneId);
  activeSceneIdRef.current = activeSceneId;

  const isBundledRef = useRef(isBundled);
  isBundledRef.current = isBundled;

  const onSaveDraftRef = useRef(onSaveDraftDebounced);
  onSaveDraftRef.current = onSaveDraftDebounced;

  const onVideoUrlActiveRef = useRef(onVideoUrlActive);
  onVideoUrlActiveRef.current = onVideoUrlActive;

  const isVisualModeActiveRef = useRef(isVisualModeActive);
  isVisualModeActiveRef.current = isVisualModeActive;

  const precomputedIrRef = useRef<{
    yaml: string;
    score: StageScore;
    result: VisualScoreIRResult;
  } | null>(null);

  const lastFallbackScrubMsRef = useRef(0);

  const applyParsedYamlResult = useCallback(
    (
      nextYaml: string,
      persistDraft: boolean,
      preParsedResult?: ParseScoreResult
    ) => {
      const result =
        preParsedResult ?? parseStageScore(nextYaml, activeSceneIdRef.current);
      if (result.score) {
        activeScoreRef.current = result.score;
        setActiveScore(result.score);
        setParseError(null);
        setParseWarning(result.warning ?? null);
        setParseDiagnostics(undefined);

        if (
          result.score.videoUrl &&
          result.score.videoUrl !== 'procedural://demo'
        ) {
          onVideoUrlActiveRef.current?.();
        }
        if (persistDraft) {
          onSaveDraftRef.current?.(nextYaml, result.score);
        }
      } else {
        setParseError(result.error);
        setParseWarning(null);
        setParseDiagnostics(result.diagnostics);
      }
    },
    []
  );

  /**
   * Resets canonical YAML & history stack for scene switches, forks, imports, and hydration.
   */
  const resetDocument = useCallback(
    (nextYaml: string, nextScore?: StageScore | null) => {
      setPreviewScore(null);
      const nextHistory = createScoreHistory(nextYaml);
      historyRef.current = nextHistory;
      setHistory(nextHistory);
      if (nextScore) {
        activeScoreRef.current = nextScore;
        setActiveScore(nextScore);
        setParseError(null);
        setParseWarning(null);
        setParseDiagnostics(undefined);
      } else {
        applyParsedYamlResult(nextYaml, false);
      }
    },
    [applyParsedYamlResult]
  );

  /**
   * Compatibility setter for `useScorePersistence` external YAML updates (resets history).
   */
  const setRawYamlExternal = useCallback((nextYaml: string) => {
    setPreviewScore(null);
    const nextHistory = createScoreHistory(nextYaml);
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  }, []);

  const setActiveScoreExternal = useCallback((nextScore: StageScore) => {
    setPreviewScore(null);
    activeScoreRef.current = nextScore;
    setActiveScore(nextScore);
    setParseError(null);
    setParseWarning(null);
    setParseDiagnostics(undefined);
  }, []);

  /**
   * Handles debounced raw text edits from CodeMirror YAML mode (coalescing bursts).
   */
  const commitYamlText = useCallback(
    (nextYaml: string) => {
      if (isBundledRef.current) return;
      setPreviewScore(null);
      const nextHistory = commitScoreHistory(historyRef.current, nextYaml, {
        mode: 'coalesce',
        groupKey: 'yaml-source',
        timestamp: Date.now(),
      });
      historyRef.current = nextHistory;
      setHistory(nextHistory);
      applyParsedYamlResult(nextYaml, true);
    },
    [applyParsedYamlResult]
  );

  /**
   * Executes a discrete structural or field command from the Visual Editor (checkpoint).
   */
  const applyVisualCommand = useCallback(
    (command: ScoreYamlCommand) => {
      if (isBundledRef.current) return;
      const currentYaml = historyRef.current.present;
      const { nextYaml, doc, changed } = applyScoreYamlCommandDetailed(
        currentYaml,
        command
      );
      if (!changed) return;

      setPreviewScore(null);
      const nextHistory = commitScoreHistory(historyRef.current, nextYaml, {
        mode: 'checkpoint',
        groupKey: 'visual',
        timestamp: Date.now(),
      });
      historyRef.current = nextHistory;
      setHistory(nextHistory);

      const parsedResult = doc
        ? normalizeParsedStageScore(doc.toJS(), activeSceneIdRef.current)
        : parseStageScore(nextYaml, activeSceneIdRef.current);

      if (parsedResult.score && doc && isVisualModeActiveRef.current) {
        precomputedIrRef.current = {
          yaml: nextYaml,
          score: parsedResult.score,
          result: projectVisualScoreIRFromDoc(doc, parsedResult.score),
        };
      }

      applyParsedYamlResult(nextYaml, true, parsedResult);
    },
    [applyParsedYamlResult]
  );

  /**
   * High-frequency 60fps scrub preview during Figma-pill horizontal dragging.
   */
  const updateScrubPreview = useCallback(
    (path: YamlPath, rawHumanValue: unknown, format?: ScalarFormatHint) => {
      if (isBundledRef.current) return;
      const hot = applyScoreHotPatch(
        activeScoreRef.current,
        path,
        rawHumanValue
      );
      if (hot) {
        setPreviewScore(hot);
        return;
      }

      // Fallback for fields not directly hot-patched (e.g. blocking cues): throttle AST preview
      const now = performance.now();
      if (now - lastFallbackScrubMsRef.current < 120) return;
      lastFallbackScrubMsRef.current = now;

      const candidateYaml = applyScoreYamlCommand(historyRef.current.present, {
        type: 'set-field',
        path,
        value: rawHumanValue,
        format,
      });
      const parsed = parseStageScore(candidateYaml, activeSceneIdRef.current);
      if (parsed.score) {
        setPreviewScore(parsed.score);
      }
    },
    []
  );

  const updateTimingScrubPreview = useCallback(
    (
      shotIndex: number,
      edge: 'start' | 'end',
      nextValueSec: number,
      mode: ShotTimingEditMode
    ) => {
      if (isBundledRef.current) return;
      const hot = applyShotTimingHotPatch(
        activeScoreRef.current,
        shotIndex,
        edge,
        nextValueSec,
        mode
      );
      if (hot) {
        setPreviewScore(hot);
      }
    },
    []
  );

  const commitScrub = useCallback(
    (path: YamlPath, finalValue: unknown, format?: ScalarFormatHint) => {
      setPreviewScore(null);
      if (isBundledRef.current) return;
      applyVisualCommand({
        type: 'set-field',
        path,
        value: finalValue,
        format,
      });
    },
    [applyVisualCommand]
  );

  const cancelScrub = useCallback(() => {
    setPreviewScore(null);
  }, []);

  const undo = useCallback(() => {
    if (isBundledRef.current) return;
    const prev = historyRef.current;
    if (!canUndoScore(prev)) return;
    const nextState = undoScoreHistory(prev);
    setPreviewScore(null);
    historyRef.current = nextState;
    setHistory(nextState);
    applyParsedYamlResult(nextState.present, true);
  }, [applyParsedYamlResult]);

  const redo = useCallback(() => {
    if (isBundledRef.current) return;
    const prev = historyRef.current;
    if (!canRedoScore(prev)) return;
    const nextState = redoScoreHistory(prev);
    setPreviewScore(null);
    historyRef.current = nextState;
    setHistory(nextState);
    applyParsedYamlResult(nextState.present, true);
  }, [applyParsedYamlResult]);

  const resetToBaseline = useCallback(() => {
    if (isBundledRef.current) return;
    const prev = historyRef.current;
    if (!canResetScore(prev)) return;
    const nextState = resetScoreHistory(prev);
    setPreviewScore(null);
    historyRef.current = nextState;
    setHistory(nextState);
    applyParsedYamlResult(nextState.present, true);
  }, [applyParsedYamlResult]);

  // Global document-level Undo/Redo handler (skips modals and native-undo inputs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isBundledRef.current) return;
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;

      const key = e.key.toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo =
        (key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey && !e.metaKey);

      if (!isUndo && !isRedo) return;

      // Never intercept inside open modal dialogs
      if (document.querySelector('[aria-modal="true"]')) {
        return;
      }

      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl) {
        if (activeEl.closest('[data-native-undo="true"]')) {
          return;
        }
        const tag = activeEl.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
          return;
        }
      }

      e.preventDefault();
      if (isUndo) {
        undo();
      } else {
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const visualIRResult: VisualScoreIRResult = useMemo(() => {
    if (!isVisualModeActive) {
      return { ir: null, error: null };
    }
    const cached = precomputedIrRef.current;
    if (
      cached &&
      cached.yaml === history.present &&
      cached.score === activeScore
    ) {
      return cached.result;
    }
    const projected = projectVisualScoreIR(history.present, activeScore);
    precomputedIrRef.current = {
      yaml: history.present,
      score: activeScore,
      result: projected,
    };
    return projected;
  }, [isVisualModeActive, history.present, activeScore]);

  return {
    rawYaml: history.present,
    historyRevision: history.revision,
    canUndo: !isBundled && canUndoScore(history),
    canRedo: !isBundled && canRedoScore(history),
    canReset: !isBundled && canResetScore(history),
    activeScore,
    effectiveScore: previewScore ?? activeScore,
    isScrubbing: previewScore !== null,
    visualIR: visualIRResult.ir,
    visualIRError: visualIRResult.error,
    parseError,
    parseWarning,
    parseDiagnostics,
    setParseError,
    setParseWarning,
    setParseDiagnostics,
    resetDocument,
    setRawYamlExternal,
    setActiveScoreExternal,
    commitYamlText,
    applyVisualCommand,
    updateScrubPreview,
    updateTimingScrubPreview,
    commitScrub,
    cancelScrub,
    undo,
    redo,
    resetToBaseline,
  };
}
