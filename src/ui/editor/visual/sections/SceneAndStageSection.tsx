/**
 * Collapsible Scene Metadata, Optics, and Stage sections for the Visual Score Editor.
 */

import React, { useCallback } from 'react';
import { X } from 'lucide-react';
import type { VisualScoreIR } from '../../../../core/scoreYamlProjectionHelpers';
import type { VisualEditorCallbacks } from '../visualEditorTypes';
import { CollapsibleYamlSection } from '../CollapsibleYamlSection';
import { SortableFieldList } from '../SortableFieldList';
import { AddPropertyPopover } from '../AddPropertyPopover';
import { CameraBlockCard } from './CameraBlockCard';
import { SceneMetadataBlock } from './SceneMetadataBlock';

export interface SceneAndStageSectionProps {
  ir: VisualScoreIR;
  isSceneExpanded: boolean;
  isStageExpanded: boolean;
  onToggleScene: () => void;
  onToggleStage: () => void;
  callbacks: VisualEditorCallbacks;
}

export const SceneAndStageSection: React.FC<SceneAndStageSectionProps> =
  React.memo(
    ({
      ir,
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
                authoredRawKeys={ir.rootFields.map((f) => f.key)}
                label="+ Key"
                disabled={callbacks.disabled}
                onCommand={callbacks.onCommand}
                onAfterAdd={handleExpandSceneOnAdd}
              />
            }
          >
            <SortableFieldList
              parentPath={[]}
              fields={ir.rootFields}
              callbacks={callbacks}
            />

            <SceneMetadataBlock
              metadata={ir.metadata}
              disabled={callbacks.disabled}
              onCommand={callbacks.onCommand}
            />

            {ir.optics.exists && (
              <div className="mt-2 pl-2.5 border-l-2 border-emerald-500/40 space-y-0.5">
                <div className="flex items-center justify-between gap-2 py-0.5">
                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    optics:
                  </span>
                  <div className="flex items-center gap-1">
                    <AddPropertyPopover
                      section="optics"
                      parentPath={ir.optics.yamlPath}
                      authoredRawKeys={ir.optics.fields.map((f) => f.key)}
                      label="+ Key"
                      disabled={callbacks.disabled}
                      onCommand={callbacks.onCommand}
                    />
                    {!callbacks.disabled && (
                      <button
                        type="button"
                        onClick={() =>
                          callbacks.onCommand({
                            type: 'remove-field',
                            path: ['optics'],
                          })
                        }
                        title="Remove optics: block"
                        aria-label="Remove optics block"
                        className="p-0.5 rounded text-text-faint opacity-70 hover:opacity-100 hover:text-rose-500 transition-opacity cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <SortableFieldList
                  parentPath={ir.optics.yamlPath}
                  fields={ir.optics.fields}
                  callbacks={callbacks}
                />
              </div>
            )}

            {!callbacks.disabled && (!ir.metadata.exists || !ir.optics.exists) && (
              <div className="pt-1.5 flex flex-wrap items-center justify-end gap-3">
                {!ir.metadata.exists && (
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
                {!ir.optics.exists && (
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
                parentPath={ir.stage.yamlPath}
                authoredRawKeys={ir.stage.fields.map((f) => f.key)}
                label="+ Key"
                disabled={callbacks.disabled}
                onCommand={callbacks.onCommand}
                onAfterAdd={handleExpandStageOnAdd}
              />
            }
          >
            {ir.stage.fields.length === 0 &&
              !ir.stage.observerCamera &&
              !ir.stage.stageCamera && (
                <p className="text-[11px] font-mono text-text-faint px-1.5 py-1">
                  Using default 10m × 10m stage floor.
                </p>
              )}

            <SortableFieldList
              parentPath={ir.stage.yamlPath}
              fields={ir.stage.fields}
              callbacks={callbacks}
            />

            {ir.stage.observerCamera && (
              <div className="mt-1.5">
                <CameraBlockCard
                  block={ir.stage.observerCamera}
                  accentClass="text-sky-600 dark:text-sky-400"
                  callbacks={callbacks}
                  defaultExpanded={false}
                />
              </div>
            )}

            {ir.stage.stageCamera && (
              <div className="mt-1.5">
                <CameraBlockCard
                  block={ir.stage.stageCamera}
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
