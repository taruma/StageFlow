/**
 * Studio Editor Panel for StageFlow's 3-Column Directorial Workspace.
 * Hosts both the YAML-mirrored Visual Score Editor (`editorMode === 'visual'`)
 * and the CodeMirror 6 YAML Score Studio (`editorMode === 'yaml'`), sharing a
 * single Plain-Text-as-Truth history stack.
 * Wrapped in React.memo to ensure zero re-render overhead during 60fps WebGL playback.
 */

import React, { useRef, useCallback, useState } from 'react';
import type {
  EditorStudioMode,
  SceneEntityDef,
  ScoreDiagnostic,
  ShotTimingEditMode,
} from '../../core/types';
import type { VisualScoreIR } from '../../core/scoreYamlProjectionHelpers';
import type { YamlPath } from '../../core/schema/scoreSchemaTypes';
import type {
  ScalarFormatHint,
  ScoreYamlCommand,
} from '../../core/scoreYamlMutator';
import {
  loadStoredEditorWordWrap,
  saveStoredEditorWordWrap,
} from '../../core/storage/localStorageUi';
import type { StoragePersistenceStatus } from '../StorageStatusBadge';
import { YamlEditorHeader } from './YamlEditorHeader';
import { YamlActionBar } from './YamlActionBar';
import { YamlDiagnosticsBanner } from './YamlDiagnosticsBanner';
import { YamlEditorCanvas, type YamlEditorHandle } from './YamlEditorCanvas';
import {
  VisualScoreEditor,
  type VisualScoreEditorHandle,
} from './visual/VisualScoreEditor';

export interface YamlStudioPanelProps {
  isOpen: boolean;
  editorMode: EditorStudioMode;
  onChangeEditorMode: (mode: EditorStudioMode) => void;
  rawYaml: string;
  historyRevision: number;
  canUndo: boolean;
  canRedo: boolean;
  sceneId?: string;
  visualIR: VisualScoreIR | null;
  visualIRError: string | null;
  entities: readonly SceneEntityDef[];
  activeShotId: string | null;
  parseError: string | null;
  parseWarning?: string | null;
  diagnostics?: ScoreDiagnostic[];
  storageStatus?: StoragePersistenceStatus;
  isBundled?: boolean;
  effectiveTheme?: 'dark' | 'warm' | 'light';
  onChangeYaml: (newYaml: string) => void;
  onVisualCommand: (command: ScoreYamlCommand) => void;
  onScrubPreview: (
    path: YamlPath,
    rawHumanValue: unknown,
    format?: ScalarFormatHint
  ) => void;
  onTimingScrubPreview: (
    shotIndex: number,
    edge: 'start' | 'end',
    nextValueSec: number,
    mode: ShotTimingEditMode
  ) => void;
  onCommitScrub: (
    path: YamlPath,
    finalValue: unknown,
    format?: ScalarFormatHint
  ) => void;
  onCancelScrub: () => void;
  onSeekToTime: (sec: number) => void;
  getCurrentTimeSec: () => number;
  onUndo: () => void;
  onRedo: () => void;
  onForkScore?: () => void;
  onClose: () => void;
}

export const YamlStudioPanel: React.FC<YamlStudioPanelProps> = React.memo(
  ({
    isOpen,
    editorMode,
    onChangeEditorMode,
    rawYaml,
    historyRevision,
    canUndo,
    canRedo,
    sceneId,
    visualIR,
    visualIRError,
    entities,
    activeShotId,
    parseError,
    parseWarning,
    diagnostics,
    isBundled = false,
    effectiveTheme = 'light',
    onChangeYaml,
    onVisualCommand,
    onScrubPreview,
    onTimingScrubPreview,
    onCommitScrub,
    onCancelScrub,
    onSeekToTime,
    getCurrentTimeSec,
    onUndo,
    onRedo,
    onForkScore,
    onClose,
  }) => {
    const editorCanvasRef = useRef<YamlEditorHandle | null>(null);
    const visualEditorRef = useRef<VisualScoreEditorHandle | null>(null);

    const [wordWrap, setWordWrap] = useState<boolean>(() => {
      return loadStoredEditorWordWrap() ?? true;
    });

    const handleToggleWordWrap = useCallback(() => {
      setWordWrap((prev) => {
        const next = !prev;
        saveStoredEditorWordWrap(next);
        return next;
      });
    }, []);

    const handleJumpToLine = useCallback(
      (line?: number, column?: number) => {
        if (editorMode !== 'yaml') {
          onChangeEditorMode('yaml');
          if (line !== undefined) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                editorCanvasRef.current?.jumpToLine(line, column);
              });
            });
          }
          return;
        }
        if (line !== undefined) {
          editorCanvasRef.current?.jumpToLine(line, column);
        }
      },
      [editorMode, onChangeEditorMode]
    );

    const handleCollapseAll = useCallback(() => {
      visualEditorRef.current?.collapseAll();
    }, []);

    const handleExpandAll = useCallback(() => {
      visualEditorRef.current?.expandAll();
    }, []);

    const handleJumpToActiveShot = useCallback(() => {
      if (activeShotId) {
        visualEditorRef.current?.scrollToShotId(activeShotId);
      }
    }, [activeShotId]);

    if (!isOpen) return null;

    return (
      <aside
        aria-label="Choreography Score Editor"
        className="w-full h-full bg-surface border-l border-border-main flex flex-col text-text-main overflow-hidden select-none"
      >
        {/* 1. Top Panel Header */}
        <YamlEditorHeader
          editorMode={editorMode}
          isBundled={isBundled}
          onClose={onClose}
        />

        {/* 2. Directorial Action Bar */}
        <YamlActionBar
          editorMode={editorMode}
          rawYaml={rawYaml}
          isBundled={isBundled}
          wordWrap={wordWrap}
          canUndo={canUndo}
          canRedo={canRedo}
          hasActiveShot={Boolean(activeShotId)}
          onUndo={onUndo}
          onRedo={onRedo}
          onToggleWordWrap={handleToggleWordWrap}
          onCollapseAll={handleCollapseAll}
          onExpandAll={handleExpandAll}
          onJumpToActiveShot={handleJumpToActiveShot}
          onForkScore={onForkScore}
        />

        {/* 3. Conditional Diagnostics Banner */}
        <YamlDiagnosticsBanner
          parseError={parseError}
          parseWarning={parseWarning}
          diagnostics={diagnostics}
          onJumpToLine={handleJumpToLine}
        />

        {/* 4. Visual Score Editor OR CodeMirror 6 YAML Canvas */}
        {editorMode === 'visual' ? (
          <VisualScoreEditor
            ref={visualEditorRef}
            ir={visualIR}
            irError={visualIRError}
            entities={entities}
            activeShotId={activeShotId}
            isBundled={isBundled}
            diagnosticLine={diagnostics?.[0]?.line}
            onCommand={onVisualCommand}
            onScrubPreview={onScrubPreview}
            onTimingScrubPreview={onTimingScrubPreview}
            onCommitScrub={onCommitScrub}
            onCancelScrub={onCancelScrub}
            onSeekToTime={onSeekToTime}
            getCurrentTimeSec={getCurrentTimeSec}
            onSwitchToYamlLine={handleJumpToLine}
          />
        ) : (
          <YamlEditorCanvas
            ref={editorCanvasRef}
            rawYaml={rawYaml}
            sceneId={sceneId}
            historyRevision={historyRevision}
            isBundled={isBundled}
            effectiveTheme={effectiveTheme}
            wordWrap={wordWrap}
            onChangeYaml={onChangeYaml}
            onUndo={onUndo}
            onRedo={onRedo}
          />
        )}
      </aside>
    );
  }
);
