/**
 * Shared Stage Display Controls section rendered inside both the desktop
 * StageDisplayPopover and the narrow-viewport CompactDioramaHeader [ View ▾ ] menu.
 * Controls pure visual diorama layers (floor mode, object categories, per-character
 * toggles, and entity cues) without altering core math or evaluation state.
 */

import React from 'react';
import { RotateCcw } from 'lucide-react';
import {
  hasCustomStageDisplayOptions,
  STAGE_FLOOR_MODES,
  type StageDisplayFlagKey,
} from '../core/stageDisplayOptions';
import type {
  StageDisplayOptions,
  StageFloorMode,
  StageScore,
} from '../core/types';

export interface StageDisplayControlsSectionProps {
  score: StageScore;
  stageDisplay: StageDisplayOptions;
  onSelectFloorMode: (mode: StageFloorMode) => void;
  onToggleStageDisplayFlag: (key: StageDisplayFlagKey) => void;
  onToggleCharacterVisible: (characterId: string) => void;
  onResetStageDisplay: () => void;
}

const FLOOR_LABELS: Record<StageFloorMode, string> = {
  solid: 'Solid',
  grid: 'Grid',
  off: 'Off',
};

const CUE_FLAGS: Array<{ key: StageDisplayFlagKey; label: string }> = [
  { key: 'showArrows', label: 'Facing Arrows' },
  { key: 'showFootprints', label: 'Footprints' },
  { key: 'showTrails', label: 'Trails' },
];

export const StageDisplayControlsSection: React.FC<
  StageDisplayControlsSectionProps
> = ({
  score,
  stageDisplay,
  onSelectFloorMode,
  onToggleStageDisplayFlag,
  onToggleCharacterVisible,
  onResetStageDisplay,
}) => {
  const characters = score.entities.filter((e) => e.kind === 'character');
  const propsCount = score.entities.filter((e) => e.kind === 'prop').length;
  const markersCount = score.entities.filter((e) => e.kind === 'marker').length;
  const isModified = hasCustomStageDisplayOptions(stageDisplay);

  return (
    <div className="flex flex-col gap-2 text-[10.5px] font-mono">
      {/* 1. Stage Floor (3-State: Solid | Grid | Off) */}
      <div>
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-[9px] font-bold text-text-faint uppercase tracking-wider">
            Stage Floor
          </span>
          {isModified && (
            <button
              type="button"
              onClick={onResetStageDisplay}
              className="flex items-center gap-0.5 text-[9px] text-amber-500 hover:text-amber-400 font-semibold cursor-pointer"
              title="Reset stage display options to defaults"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5 bg-surface-subtle p-0.5 rounded-lg border border-border-subtle">
          {STAGE_FLOOR_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onSelectFloorMode(mode)}
              title={
                mode === 'solid'
                  ? 'Solid matte floor + metric grid'
                  : mode === 'grid'
                    ? 'Wireframe grid only (reveals -Y sub-floor geometry)'
                    : 'Hide floor plane and grid'
              }
              className={`flex-1 py-0.5 text-center rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                stageDisplay.floorMode === mode
                  ? 'bg-surface text-text-main font-bold shadow-xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {FLOOR_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-[1px] bg-border-subtle" />

      {/* 2. Scene Objects (Characters w/ per-entity toggles, Props, Markers) */}
      <div>
        <span className="text-[9px] font-bold text-text-faint uppercase tracking-wider block px-1 pb-1">
          Scene Objects
        </span>
        <div className="flex flex-col gap-0.5">
          <label className="flex items-center justify-between px-1.5 py-0.5 rounded-md hover:bg-surface-subtle cursor-pointer text-text-main">
            <span className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={stageDisplay.showCharacters}
                onChange={() => onToggleStageDisplayFlag('showCharacters')}
                className="accent-sky-500 cursor-pointer"
              />
              <span>Characters</span>
            </span>
            {characters.length > 0 && (
              <span className="text-[9px] text-text-faint">
                {characters.length}
              </span>
            )}
          </label>

          {characters.length > 0 && (
            <div className="pl-4 flex flex-col gap-0.5 max-h-32 overflow-y-auto">
              {characters.map((char) => {
                const isCharChecked =
                  stageDisplay.showCharacters &&
                  !stageDisplay.hiddenCharacterIds.includes(char.id);
                return (
                  <label
                    key={char.id}
                    className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-md transition-colors ${
                      stageDisplay.showCharacters
                        ? 'hover:bg-surface-subtle cursor-pointer text-text-muted hover:text-text-main'
                        : 'opacity-45 cursor-not-allowed text-text-faint'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isCharChecked}
                      disabled={!stageDisplay.showCharacters}
                      onChange={() => onToggleCharacterVisible(char.id)}
                      className="accent-sky-500 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: char.color }}
                    />
                    <span className="truncate text-[10px]">{char.label}</span>
                  </label>
                );
              })}
            </div>
          )}

          <label className="flex items-center justify-between px-1.5 py-0.5 rounded-md hover:bg-surface-subtle cursor-pointer text-text-main">
            <span className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={stageDisplay.showProps}
                onChange={() => onToggleStageDisplayFlag('showProps')}
                className="accent-sky-500 cursor-pointer"
              />
              <span>Props</span>
            </span>
            {propsCount > 0 && (
              <span className="text-[9px] text-text-faint">{propsCount}</span>
            )}
          </label>

          <label className="flex items-center justify-between px-1.5 py-0.5 rounded-md hover:bg-surface-subtle cursor-pointer text-text-main">
            <span className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={stageDisplay.showMarkers}
                onChange={() => onToggleStageDisplayFlag('showMarkers')}
                className="accent-sky-500 cursor-pointer"
              />
              <span>Markers</span>
            </span>
            {markersCount > 0 && (
              <span className="text-[9px] text-text-faint">{markersCount}</span>
            )}
          </label>
        </div>
      </div>

      <div className="w-full h-[1px] bg-border-subtle" />

      {/* 3. Entity Visual Cues */}
      <div>
        <span className="text-[9px] font-bold text-text-faint uppercase tracking-wider block px-1 pb-1">
          Entity Cues
        </span>
        <div className="flex flex-col gap-0.5">
          {CUE_FLAGS.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-surface-subtle cursor-pointer text-text-main"
            >
              <input
                type="checkbox"
                checked={Boolean(stageDisplay[key])}
                onChange={() => onToggleStageDisplayFlag(key)}
                className="accent-sky-500 cursor-pointer"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};
