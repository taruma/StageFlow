/**
 * Reusable 3D Blueprint Stage Scene.
 * Shared by both the main Diorama Canvas and the Stage Cam Monitor Canvas.
 * Renders studio lighting, the metric floor grid, and directional character mannequins.
 */

import React from 'react';
import type {
  AppThemeCategory,
  CameraViewMode,
  LabelDisplayMode,
  StageFrame,
  StageScore,
} from '../core/types';
import { BlueprintFloorGrid } from './BlueprintFloorGrid';
import { DirectionalMannequin } from './DirectionalMannequin';
import {
  StageEnvironmentSkin,
  StageSkinEnvironmentLighting,
} from './StageEnvironmentSkin';

export interface BlueprintStageSceneProps {
  score: StageScore;
  frameRef: React.RefObject<StageFrame>;
  uiFrame: StageFrame;
  labelMode?: LabelDisplayMode;
  isPlaying?: boolean;
  cameraMode?: CameraViewMode;
  themeCategory?: AppThemeCategory;
  stageSkinUrl?: string | null;
  stageSkinVisible?: boolean;
  entitySkinUrls?: Record<string, string>;
  onStageSkinError?: (error: Error) => void;
  onEntitySkinError?: (entityId: string, error: Error) => void;
}

export const BlueprintStageScene: React.FC<BlueprintStageSceneProps> = ({
  score,
  frameRef,
  uiFrame,
  labelMode = 'all',
  isPlaying = false,
  cameraMode,
  themeCategory = 'light',
  stageSkinUrl,
  stageSkinVisible = true,
  entitySkinUrls,
  onStageSkinError,
  onEntitySkinError,
}) => {
  const hasVisibleEntitySkin =
    stageSkinVisible &&
    Boolean(
      entitySkinUrls &&
        uiFrame.entitiesList.some((ent) => Boolean(entitySkinUrls[ent.id]))
    );
  const hasAnyVisibleSkin =
    Boolean(stageSkinUrl && stageSkinVisible) || hasVisibleEntitySkin;

  return (
    <group>
      {/* Studio Lighting */}
      <ambientLight intensity={themeCategory === 'dark' ? 0.75 : 0.85} />
      <directionalLight position={[6, 12, 8]} intensity={1.1} />
      <directionalLight
        position={[-6, 8, -6]}
        intensity={0.45}
        color={themeCategory === 'dark' ? '#38bdf8' : '#ffffff'}
      />

      {/* Shared Zero-Network Studio IBL when any .glb skin is visible */}
      {hasAnyVisibleSkin && <StageSkinEnvironmentLighting />}

      {/* Ephemeral Dropped .GLB / .GLTF Stage Environment Skin */}
      {stageSkinUrl && (
        <StageEnvironmentSkin
          url={stageSkinUrl}
          visible={stageSkinVisible}
          onError={onStageSkinError}
        />
      )}

      {/* Metric Blueprint Stage Floor Grid */}
      <BlueprintFloorGrid
        width={score.stage.width}
        depth={score.stage.depth}
        gridStep={score.stage.gridStep}
        showLabels={labelMode !== 'off'}
        cameraMode={cameraMode}
        themeCategory={themeCategory}
      />

      {/* Directional Character Mannequins & Stage Props */}
      {uiFrame.entitiesList.map((entityState) => (
        <DirectionalMannequin
          key={entityState.id}
          entityId={entityState.id}
          initialState={entityState}
          frameRef={frameRef}
          uiFrame={uiFrame}
          labelMode={labelMode}
          isPlaying={isPlaying}
          cameraMode={cameraMode}
          skinUrl={entitySkinUrls?.[entityState.id] ?? null}
          skinVisible={stageSkinVisible}
          onEntitySkinError={onEntitySkinError}
        />
      ))}
    </group>
  );
};
