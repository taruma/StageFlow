/**
 * Indented YAML child camera block renderer (`stage_camera:`, `observer_camera:`, `camera:`)
 * with nested `rig:` and `waypoints:` sub-cards.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Video, X } from 'lucide-react';
import type { VisualCameraBlockNode } from '../../../../core/scoreYamlProjectionHelpers';
import type { VisualEditorCallbacks } from '../visualEditorTypes';
import { SchemaFieldRow } from '../SchemaFieldRow';
import { AddPropertyPopover } from '../AddPropertyPopover';

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

    return (
      <div className="pl-2.5 border-l-2 border-border-main space-y-1">
        <div className="flex items-center justify-between gap-2 py-0.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-left cursor-pointer"
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
            />
            {removable && !callbacks.disabled && (
              <button
                type="button"
                onClick={() =>
                  callbacks.onCommand({
                    type: 'remove-field',
                    path: block.yamlPath,
                  })
                }
                className="p-0.5 rounded text-text-faint hover:text-rose-500 cursor-pointer"
                title={`Remove ${block.key}`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {expanded && (
          <div className="space-y-0.5">
            {block.fields.map((f) => (
              <SchemaFieldRow key={f.key} field={f} callbacks={callbacks} />
            ))}

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
                {block.rig.fields.map((rf) => (
                  <SchemaFieldRow
                    key={rf.key}
                    field={rf}
                    callbacks={callbacks}
                  />
                ))}
                {block.rig.points && (
                  <div className="px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
                    points: {block.rig.points.length} spline rail pts
                  </div>
                )}
              </div>
            )}

            {block.waypoints.length > 0 && (
              <div className="mt-1.5 pl-2.5 border-l-2 border-violet-500/40 space-y-1">
                <div className="text-[10px] font-mono font-bold text-violet-600 dark:text-violet-400">
                  waypoints: ({block.waypoints.length})
                </div>
                {block.waypoints.map((wp) => (
                  <div
                    key={wp.index}
                    className="rounded-lg bg-surface-subtle/60 border border-border-subtle p-1.5 space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-mono font-semibold text-text-muted">
                        #{wp.index + 1}
                      </span>
                      <AddPropertyPopover
                        section="waypoint"
                        parentPath={wp.yamlPath}
                        authoredRawKeys={wp.fields.map((f) => f.key)}
                        label="+ Key"
                        disabled={callbacks.disabled}
                        onCommand={callbacks.onCommand}
                      />
                    </div>
                    {wp.fields.map((wf) => (
                      <SchemaFieldRow
                        key={wf.key}
                        field={wf}
                        callbacks={callbacks}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);
