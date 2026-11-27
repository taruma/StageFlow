/**
 * Indented YAML child camera block renderer (`stage_camera:`, `observer_camera:`, `camera:`)
 * with nested `rig:` and `waypoints:` sub-cards.
 */

import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Video } from 'lucide-react';
import type { VisualCameraBlockNode } from '../../../../core/scoreYamlProjectionHelpers';
import type { VisualEditorCallbacks } from '../visualEditorTypes';
import { UI_TOKENS } from '../../../tokens/ui';
import { ConfirmDeleteButton } from '../ConfirmDeleteButton';
import { SortableFieldList } from '../SortableFieldList';
import { AddPropertyPopover } from '../AddPropertyPopover';
import { WaypointsBlock } from '../WaypointsBlock';

export interface CameraBlockCardProps {
  block: VisualCameraBlockNode;
  accentClass?: string;
  callbacks: VisualEditorCallbacks;
  removable?: boolean;
  defaultExpanded?: boolean;
}

export const CameraBlockCard: React.FC<CameraBlockCardProps> = React.memo(
  ({
    block,
    accentClass = 'text-sky-600 dark:text-sky-400',
    callbacks,
    removable = false,
    defaultExpanded = true,
  }) => {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const handleExpandOnAdd = useCallback(() => setExpanded(true), []);

    return (
      <div className={`${UI_TOKENS.inspector.treeRail} space-y-1`}>
        <div className="flex items-center justify-between gap-2 py-0.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-text-faint" />
            ) : (
              <ChevronRight className="w-3 h-3 text-text-faint" />
            )}
            <Video className={`w-3 h-3 ${accentClass}`} />
            <span className={`text-[10px] font-mono font-bold ${accentClass}`}>
              {block.key}:
            </span>
          </button>

          <div className="flex items-center gap-1">
            <AddPropertyPopover
              section="cameraCue"
              parentPath={block.yamlPath}
              authoredRawKeys={block.fields.map((f) => f.key)}
              label="+ Key"
              disabled={callbacks.disabled}
              onCommand={callbacks.onCommand}
              onAfterAdd={handleExpandOnAdd}
            />
            {removable && !callbacks.disabled && (
              <ConfirmDeleteButton
                onConfirm={() =>
                  callbacks.onCommand({
                    type: 'remove-field',
                    path: block.yamlPath,
                  })
                }
                title={`Remove ${block.key}`}
                ariaLabel={`Remove ${block.key}`}
              />
            )}
          </div>
        </div>

        {expanded && (
          <div className="space-y-0.5">
            <SortableFieldList
              parentPath={block.yamlPath}
              fields={block.fields}
              callbacks={callbacks}
            />

            {block.rig && (
              <div className="mt-1.5 pl-2.5 border-l-2 border-amber-500/40 space-y-0.5">
                <div className="flex items-center justify-between gap-2 py-0.5">
                  <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                    rig:
                  </span>
                  <AddPropertyPopover
                    section="rig"
                    parentPath={block.rig.yamlPath}
                    authoredRawKeys={block.rig.fields.map((f) => f.key)}
                    label="+ Rig"
                    disabled={callbacks.disabled}
                    onCommand={callbacks.onCommand}
                  />
                </div>
                <SortableFieldList
                  parentPath={block.rig.yamlPath}
                  fields={block.rig.fields}
                  callbacks={callbacks}
                />
                {block.rig.points && (
                  <div className="px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
                    points: {block.rig.points.length} spline rail pts
                  </div>
                )}
              </div>
            )}

            <WaypointsBlock waypoints={block.waypoints} callbacks={callbacks} />
          </div>
        )}
      </div>
    );
  }
);
