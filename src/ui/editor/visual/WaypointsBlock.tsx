/**
 * Reusable `waypoints:` list sub-block renderer shared by CameraBlockCard and ObserverShotsSection.
 */

import React from 'react';
import type { VisualWaypointItem } from '../../../core/scoreYamlProjectionHelpers';
import type { VisualEditorCallbacks } from './visualEditorTypes';
import { AddPropertyPopover } from './AddPropertyPopover';
import { SchemaFieldRow } from './SchemaFieldRow';

export interface WaypointsBlockProps {
  waypoints?: VisualWaypointItem[];
  callbacks: VisualEditorCallbacks;
}

export const WaypointsBlock: React.FC<WaypointsBlockProps> = React.memo(
  ({ waypoints, callbacks }) => {
    if (!waypoints || waypoints.length === 0) return null;

    return (
      <div className="mt-1.5 pl-2.5 border-l-2 border-violet-500/40 space-y-1">
        <div className="text-[10px] font-mono font-bold text-violet-600 dark:text-violet-400">
          waypoints: ({waypoints.length})
        </div>
        {waypoints.map((wp) => (
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
              <SchemaFieldRow key={wf.key} field={wf} callbacks={callbacks} />
            ))}
          </div>
        ))}
      </div>
    );
  }
);
