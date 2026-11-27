/**
 * Collapsible Scene Metadata, Optics, and Stage sections for the Visual Score Editor.
 */

import React, { useCallback } from 'react';
import type { VisualScoreIR } from '../../../../core/scoreYamlProjectionHelpers';
import type { VisualEditorCallbacks } from '../visualEditorTypes';
import { CollapsibleYamlSection } from '../CollapsibleYamlSection';
import { ConfirmDeleteButton } from '../ConfirmDeleteButton';
import { SortableFieldList } from '../SortableFieldList';
import { AddPropertyPopover } from '../AddPropertyPopover';
import { CameraBlockCard } from './CameraBlockCard';
import { SceneMetadataBlock } from './SceneMetadataBlock';

export interface SceneAndStageSectionProps {
  rootFields: VisualScoreIR['rootFields'];
  metadata: VisualScoreIR['metadata'];
  optics: VisualScoreIR['optics'];
  stage: VisualScoreIR['stage'];
  isSceneExpanded: boolean;
  isStageExpanded: boolean;
  onToggleScene: () => void;
  onToggleStage: () => void;
  callbacks: VisualEditorCallbacks;
}

export const SceneAndStageSection: React.FC<SceneAndStageSectionProps> =
  React.memo(
    ({
      rootFields,
      metadata,
      optics,
      stage,
      isSceneExpanded,
      isStageExpanded,
      onToggleScene,
      onToggleStage,
      callbacks,
    }) => {
      const handleExpandSceneOnAdd = useCallback(() => {
        if (!isSceneExpanded) onToggleScene();
      }, [isSceneExpanded, onToggleScene]);

      const handleExpandStageOnAdd = useCallback(() => {
        if (!isStageExpanded) onToggleStage();
      }, [isStageExpanded, onToggleStage]);

      return (
        <>
          <CollapsibleYamlSection
            yamlKey="scene:"
            title="Metadata & Optics"
            isExpanded={isSceneExpanded}
            onToggle={onToggleScene}
            accentClass="text-amber-600 dark:text-amber-400"
            actionSlot={
              <AddPropertyPopover
                section="root"
                parentPath={[]}
                authoredRawKeys={rootFields.map((f) => f.key)}
                label="+ Key"
                disabled={callbacks.disabled}
                onCommand={callbacks.onCommand}
                onAfterAdd={handleExpandSceneOnAdd}
              />
            }
          >
            <SortableFieldList
              parentPath={[]}
              fields={rootFields}
              callbacks={callbacks}
            />

            <SceneMetadataBlock
              metadata={metadata}
              disabled={callbacks.disabled}
              onCommand={callbacks.onCommand}
            />

            {optics.exists && (
              <div className="mt-2 pl-2.5 border-l-2 border-emerald-500/40 space-y-0.5">
                <div className="flex items-center justify-between gap-2 py-0.5">
                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    optics:
                  </span>
                  <div className="flex items-center gap-1">
                    <AddPropertyPopover
                      section="optics"
                      parentPath={optics.yamlPath}
                      authoredRawKeys={optics.fields.map((f) => f.key)}
                      label="+ Key"
                      disabled={callbacks.disabled}
                      onCommand={callbacks.onCommand}
                    />
                    {!callbacks.disabled && (
                      <ConfirmDeleteButton
                        onConfirm={() =>
                          callbacks.onCommand({
                            type: 'remove-field',
                            path: ['optics'],
                          })
                        }
                        title="Remove optics: block"
                        ariaLabel="Remove optics block"
                      />
                    )}
                  </div>
                </div>
                <SortableFieldList
                  parentPath={optics.yamlPath}
                  fields={optics.fields}
                  callbacks={callbacks}
                />
              </div>
            )}

            {!callbacks.disabled && (!metadata.exists || !optics.exists) && (
              <div className="pt-1.5 flex flex-wrap items-center justify-end gap-3">
                {!metadata.exists && (
                  <button
                    type="button"
                    onClick={() =>
                      callbacks.onCommand({
                        type: 'add-field',
                        parentPath: ['metadata'],
                        key: 'director',
                        value: '',
                        format: 'plain',
                      })
                    }
                    className="text-[10px] font-mono text-text-muted hover:text-violet-500 cursor-pointer"
                  >
                    + Add metadata: block
                  </button>
                )}
                {!optics.exists && (
                  <button
                    type="button"
                    onClick={() =>
                      callbacks.onCommand({
                        type: 'add-field',
                        parentPath: ['optics'],
                        key: 'dof',
                        value: 'medium',
                      })
                    }
                    className="text-[10px] font-mono text-text-muted hover:text-emerald-500 cursor-pointer"
                  >
                    + Add optics: block
                  </button>
                )}
              </div>
            )}
          </CollapsibleYamlSection>

          <CollapsibleYamlSection
            yamlKey="stage:"
            title="Floor & Baseline Cameras"
            isExpanded={isStageExpanded}
            onToggle={onToggleStage}
            accentClass="text-sky-600 dark:text-sky-400"
            actionSlot={
              <AddPropertyPopover
                section="stage"
                parentPath={stage.yamlPath}
                authoredRawKeys={stage.fields.map((f) => f.key)}
                label="+ Key"
                disabled={callbacks.disabled}
                onCommand={callbacks.onCommand}
                onAfterAdd={handleExpandStageOnAdd}
              />
            }
          >
            {stage.fields.length === 0 &&
              !stage.observerCamera &&
              !stage.stageCamera && (
                <p className="text-[11px] font-mono text-text-faint px-1.5 py-1">
                  Using default 10m × 10m stage floor.
                </p>
              )}

            <SortableFieldList
              parentPath={stage.yamlPath}
              fields={stage.fields}
              callbacks={callbacks}
            />

            {stage.observerCamera && (
              <div className="mt-1.5">
                <CameraBlockCard
                  block={stage.observerCamera}
                  accentClass="text-sky-600 dark:text-sky-400"
                  callbacks={callbacks}
                  defaultExpanded={false}
                />
              </div>
            )}

            {stage.stageCamera && (
              <div className="mt-1.5">
                <CameraBlockCard
                  block={stage.stageCamera}
                  accentClass="text-amber-600 dark:text-amber-400"
                  callbacks={callbacks}
                  defaultExpanded={false}
                />
              </div>
            )}
          </CollapsibleYamlSection>
        </>
      );
    }
  );
