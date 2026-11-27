/**
 * Shared callback & context interfaces for Visual YAML Editor components.
 * Layer 5 UI types.
 */

import type { SceneEntityDef, ShotTimingEditMode } from '../../../core/types';
import type { YamlPath } from '../../../core/schema/scoreSchemaTypes';
import type {
  ScalarFormatHint,
  ScoreYamlCommand,
} from '../../../core/scoreYamlMutator';

export interface VisualEditorCallbacks {
  disabled: boolean;
  entities: readonly SceneEntityDef[];
  onCommand: (command: ScoreYamlCommand) => void;
  onScrubPreview: (
    path: YamlPath,
    rawHumanValue: unknown,
    format?: ScalarFormatHint
  ) => void;
  onCommitScrub: (
    path: YamlPath,
    finalValue: unknown,
    format?: ScalarFormatHint
  ) => void;
  onCancelScrub: () => void;
  onSeekToTime: (sec: number) => void;
  onJumpToYamlLine?: (line: number) => void;
}

export interface ShotTimingCallbacks {
  timingMode: ShotTimingEditMode;
  onChangeTimingMode: (mode: ShotTimingEditMode) => void;
  onTimingScrubPreview: (
    shotIndex: number,
    edge: 'start' | 'end',
    nextValueSec: number,
    mode: ShotTimingEditMode
  ) => void;
  getCurrentTimeSec: () => number;
}
