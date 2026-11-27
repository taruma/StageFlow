/**
 * Reusable `entities:` override sub-block renderer shared by BlockingSection and ShotCard.
 */

import React from 'react';
import type { VisualNamedBlockNode } from '../../../core/scoreYamlProjectionHelpers';
import type { VisualEditorCallbacks } from './visualEditorTypes';
import { AddPropertyPopover } from './AddPropertyPopover';
import { SchemaFieldRow } from './SchemaFieldRow';

export interface EntityOverridesBlockProps {
  overrides: VisualNamedBlockNode[];
  keyPrefix?: string;
  callbacks: VisualEditorCallbacks;
}

export const EntityOverridesBlock: React.FC<EntityOverridesBlockProps> =
  React.memo(({ overrides, keyPrefix = '', callbacks }) => {
    if (overrides.length === 0) return null;

    return (
      <>
        {overrides.map((ov) => (
          <div
            key={ov.name}
            className="mt-1 pl-2.5 border-l-2 border-emerald-500/40 space-y-0.5"
          >
            <div className="flex items-center justify-between gap-2 py-0.5">
              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {keyPrefix}
                {ov.name}:
              </span>
              <AddPropertyPopover
                section="blockingEntity"
                parentPath={ov.yamlPath}
                authoredRawKeys={ov.fields.map((f) => f.key)}
                label="+ Key"
                disabled={callbacks.disabled}
                onCommand={callbacks.onCommand}
              />
            </div>
            {ov.fields.map((f) => (
              <SchemaFieldRow key={f.key} field={f} callbacks={callbacks} />
            ))}
          </div>
        ))}
      </>
    );
  });
