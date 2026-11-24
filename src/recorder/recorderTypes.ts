/**
 * Shared types for headless deterministic recording and Playwright bridge communication.
 */

import type {
  AppThemeCategory,
  CameraViewMode,
  LabelDisplayMode,
  StageDisplayOptions,
} from '../core/types';

export interface RecorderConfig {
  scoreYaml: string;
  cameraMode: CameraViewMode;
  labelMode: LabelDisplayMode;
  stageDisplay?: StageDisplayOptions;
  showGuides: boolean;
  showHud: boolean;
  dofBlur?: boolean;
  theme?: AppThemeCategory;
  fps: number;
  width: number;
  height: number;
  startSec: number;
  endSec: number;
  stageSkinUrl?: string;
  entitySkinUrls?: Record<string, string>;
  customPose?: {
    pitchDeg?: number;
    yawDeg?: number;
    distanceM?: number;
    target?: [number, number, number];
  };
}

export interface RecorderFrameResult {
  frameIndex: number;
  timestampSec: number;
  shotId: string | null;
  totalFrames: number;
}

export interface HeadlessRecorderBridge {
  init: (
    config: RecorderConfig
  ) => Promise<{
    totalFrames: number;
    durationSec: number;
    fps: number;
    rendererInfo?: string;
  }>;
  stepFrame: (frameIndex: number) => Promise<RecorderFrameResult>;
  ready: boolean;
}

declare global {
  interface Window {
    __STAGEFLOW_RECORDER__?: HeadlessRecorderBridge;
    __STAGEFLOW_RECORDER_CONFIG__?: RecorderConfig;
  }
}
