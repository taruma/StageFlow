/**
 * Collapsible `shots:` section with Split-Between "+" seams, active shot highlighting,
 * and section-scoped `timingMode` (`Free | Roll | Ripple`) state.
 */

import React, { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import type { ShotTimingEditMode } from '../../../../core/types';
import type { VisualShotItem } from '../../../../core/scoreYamlProjectionHelpers';
import type {
  ShotTimingCallbacks,
  VisualEditorCallbacks,
} from '../visualEditorTypes';
import { CollapsibleYamlSection } from '../CollapsibleYamlSection';
import { InsertBetweenSeam } from '../InsertBetweenSeam';
import { ShotCard } from './ShotCard';

export interface ShotsSectionProps {
  shots: VisualShotItem[];
  activeShotId: string | null;
  isSectionExpanded: boolean;
  focusedShotId: string | null;
  focusedShotSeq: number;
  onToggleSection: () => void;
  onTimingScrubPreview: (
    shotIndex: number,
    edge: 'start' | 'end',
    nextValueSec: number,
    mode: ShotTimingEditMode
  ) => void;
  getCurrentTimeSec: () => number;
  callbacks: VisualEditorCallbacks;
}

export const ShotsSection: React.FC<ShotsSectionProps> = React.memo(
  ({
    shots,
    activeShotId,
    isSectionExpanded,
    focusedShotId,
    focusedShotSeq,
    onToggleSection,
    onTimingScrubPreview,
    getCurrentTimeSec,
    callbacks,
  }) => {
    const { disabled, onCommand } = callbacks;
    const [timingMode, setTimingMode] = useState<ShotTimingEditMode>('roll');

    const timingCallbacks: ShotTimingCallbacks = useMemo(
      () => ({
        timingMode,
        onChangeTimingMode: setTimingMode,
        onTimingScrubPreview,
        getCurrentTimeSec,
      }),
      [timingMode, onTimingScrubPreview, getCurrentTimeSec]
    );

    return (
      <CollapsibleYamlSection
        yamlKey="shots:"
        title="Film Coverage Shots"
        count={shots.length}
        accentClass="text-rose-600 dark:text-rose-400"
        isExpanded={isSectionExpanded}
        onToggle={onToggleSection}
        actionSlot={
          !disabled && (
            <button
              type="button"
              onClick={() =>
                onCommand({
                  type: 'insert-shot-split',
                  afterIndex: shots.length - 1,
                })
              }
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-[10px] font-mono font-semibold text-rose-700 dark:text-rose-300 cursor-pointer transition-colors"
              title="Split last shot to append a new shot"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>Split Shot</span>
            </button>
          )
        }
      >
        <div>
          <InsertBetweenSeam
            label="Insert shot before #01"
            disabled={disabled}
            onInsert={() =>
              onCommand({ type: 'insert-shot-split', afterIndex: -1 })
            }
          />
          {shots.map((shot, idx) => {
            const itemKey = `shot:${idx}:${shot.id}`;
            return (
              <React.Fragment key={itemKey}>
                <ShotCard
                  shot={shot}
                  index={idx}
                  totalShots={shots.length}
                  focusExpandSeq={focusedShotId === shot.id ? focusedShotSeq : 0}
                  isActiveShot={activeShotId === shot.id}
                  timingCallbacks={timingCallbacks}
                  callbacks={callbacks}
                />
                <InsertBetweenSeam
                  label={`Split #${String(shot.shotNumber).padStart(2, '0')} & insert shot`}
                  disabled={disabled}
                  onInsert={() =>
                    onCommand({ type: 'insert-shot-split', afterIndex: idx })
                  }
                />
              </React.Fragment>
            );
          })}
        </div>
      </CollapsibleYamlSection>
    );
  }
);
