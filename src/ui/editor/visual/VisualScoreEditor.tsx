/**
 * YAML-mirrored Visual Choreography Score Editor.
 * Renders collapsible Scene, Stage, Entities, Blocking, Shots, and Observer Shots
 * directly from `VisualScoreIR` while preserving Plain-Text-as-Truth underneath.
 */

import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { AlertTriangle, Code2 } from 'lucide-react';
import type { SceneEntityDef, ShotTimingEditMode } from '../../../core/types';
import type { VisualScoreIR } from '../../../core/scoreYamlProjectionHelpers';
import type { YamlPath } from '../../../core/schema/scoreSchemaTypes';
import type {
  ScalarFormatHint,
  ScoreYamlCommand,
} from '../../../core/scoreYamlMutator';
import type { VisualEditorCallbacks } from './visualEditorTypes';
import { SceneAndStageSection } from './sections/SceneAndStageSection';
import { EntitiesSection } from './sections/EntitiesSection';
import { BlockingSection } from './sections/BlockingSection';
import { ShotsSection } from './sections/ShotsSection';
import { ObserverShotsSection } from './sections/ObserverShotsSection';

export interface VisualScoreEditorHandle {
  collapseAll: () => void;
  expandAll: () => void;
  scrollToShotId: (shotId: string) => void;
}

export interface VisualScoreEditorProps {
  ir: VisualScoreIR | null;
  irError: string | null;
  entities: readonly SceneEntityDef[];
  activeShotId: string | null;
  isBundled: boolean;
  diagnosticLine?: number;
  onCommand: (command: ScoreYamlCommand) => void;
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
  onSwitchToYamlLine?: (line?: number) => void;
}

export const VisualScoreEditor = React.memo(
  forwardRef<VisualScoreEditorHandle, VisualScoreEditorProps>(
    (
      {
        ir,
        irError,
        entities,
        activeShotId,
        isBundled,
        diagnosticLine,
        onCommand,
        onScrubPreview,
        onTimingScrubPreview,
        onCommitScrub,
        onCancelScrub,
        onSeekToTime,
        getCurrentTimeSec,
        onSwitchToYamlLine,
      },
      ref
    ) => {
      const scrollContainerRef = useRef<HTMLDivElement | null>(null);
      const [timingMode, setTimingMode] = useState<ShotTimingEditMode>('roll');

      const [expandedSections, setExpandedSections] = useState<{
        scene: boolean;
        stage: boolean;
        entities: boolean;
        blocking: boolean;
        shots: boolean;
        observerShots: boolean;
      }>({
        scene: false,
        stage: false,
        entities: true,
        blocking: true,
        shots: true,
        observerShots: false,
      });

      const [expandedItems, setExpandedItems] = useState<Set<string>>(
        () => new Set()
      );

      const toggleItem = useCallback((key: string) => {
        setExpandedItems((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
      }, []);

      useImperativeHandle(
        ref,
        () => ({
          collapseAll: () => {
            setExpandedSections({
              scene: false,
              stage: false,
              entities: false,
              blocking: false,
              shots: false,
              observerShots: false,
            });
            setExpandedItems(new Set());
          },
          expandAll: () => {
            setExpandedSections({
              scene: true,
              stage: true,
              entities: true,
              blocking: true,
              shots: true,
              observerShots: true,
            });
            if (!ir) return;
            const next = new Set<string>();
            ir.entities.forEach((e, i) => next.add(`entity:${i}:${e.id}`));
            ir.blocking.forEach((b, i) => next.add(`blocking:${i}:${b.id}`));
            ir.shots.forEach((s, i) => next.add(`shot:${i}:${s.id}`));
            ir.observerShots.forEach((o, i) => next.add(`obs:${i}:${o.id}`));
            setExpandedItems(next);
          },
          scrollToShotId: (shotId: string) => {
            setExpandedSections((prev) => ({ ...prev, shots: true }));
            if (ir) {
              const idx = ir.shots.findIndex((s) => s.id === shotId);
              if (idx >= 0) {
                setExpandedItems((prev) => {
                  const next = new Set(prev);
                  next.add(`shot:${idx}:${shotId}`);
                  return next;
                });
              }
            }
            requestAnimationFrame(() => {
              const el = scrollContainerRef.current?.querySelector(
                `[data-shot-id="${CSS.escape(shotId)}"]`
              );
              el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
          },
        }),
        [ir]
      );

      const callbacks: VisualEditorCallbacks = useMemo(
        () => ({
          disabled: isBundled,
          entities,
          timingMode,
          onChangeTimingMode: setTimingMode,
          onCommand,
          onScrubPreview,
          onTimingScrubPreview,
          onCommitScrub,
          onCancelScrub,
          onSeekToTime,
          getCurrentTimeSec,
        }),
        [
          isBundled,
          entities,
          timingMode,
          onCommand,
          onScrubPreview,
          onTimingScrubPreview,
          onCommitScrub,
          onCancelScrub,
          onSeekToTime,
          getCurrentTimeSec,
        ]
      );

      if (!ir) {
        return (
          <div className="flex-1 p-5 flex flex-col items-center justify-center text-center gap-3 bg-app">
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 max-w-sm space-y-2">
              <div className="flex items-center justify-center gap-2 text-rose-600 dark:text-rose-300 font-mono text-xs font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>Cannot Render Visual Tree</span>
              </div>
              <p className="text-[11px] font-mono text-text-muted break-words">
                {irError ?? 'Invalid YAML syntax detected.'}
              </p>
              {onSwitchToYamlLine && (
                <button
                  type="button"
                  onClick={() => onSwitchToYamlLine(diagnosticLine)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-mono font-semibold cursor-pointer transition-colors"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>
                    {diagnosticLine
                      ? `Fix in YAML (Line ${diagnosticLine})`
                      : 'Open in YAML Mode'}
                  </span>
                </button>
              )}
            </div>
          </div>
        );
      }

      return (
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-app p-3 space-y-2.5 select-none text-left"
        >
          <SceneAndStageSection
            ir={ir}
            isSceneExpanded={expandedSections.scene}
            isStageExpanded={expandedSections.stage}
            onToggleScene={() =>
              setExpandedSections((p) => ({ ...p, scene: !p.scene }))
            }
            onToggleStage={() =>
              setExpandedSections((p) => ({ ...p, stage: !p.stage }))
            }
            callbacks={callbacks}
          />

          <EntitiesSection
            entities={ir.entities}
            isSectionExpanded={expandedSections.entities}
            expandedIds={expandedItems}
            onToggleSection={() =>
              setExpandedSections((p) => ({ ...p, entities: !p.entities }))
            }
            onToggleItem={toggleItem}
            callbacks={callbacks}
          />

          <BlockingSection
            blocking={ir.blocking}
            isSectionExpanded={expandedSections.blocking}
            expandedIds={expandedItems}
            onToggleSection={() =>
              setExpandedSections((p) => ({ ...p, blocking: !p.blocking }))
            }
            onToggleItem={toggleItem}
            callbacks={callbacks}
          />

          <ShotsSection
            shots={ir.shots}
            activeShotId={activeShotId}
            isSectionExpanded={expandedSections.shots}
            expandedIds={expandedItems}
            onToggleSection={() =>
              setExpandedSections((p) => ({ ...p, shots: !p.shots }))
            }
            onToggleItem={toggleItem}
            callbacks={callbacks}
          />

          <ObserverShotsSection
            observerShots={ir.observerShots}
            isSectionExpanded={expandedSections.observerShots}
            expandedIds={expandedItems}
            onToggleSection={() =>
              setExpandedSections((p) => ({
                ...p,
                observerShots: !p.observerShots,
              }))
            }
            onToggleItem={toggleItem}
            callbacks={callbacks}
          />
        </div>
      );
    }
  )
);
