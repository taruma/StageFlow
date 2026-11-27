/**
 * Editable, collapsible freeform `metadata:` block inside the Scene section.
 * Supports scalar strings, nested key-value maps (e.g. `camera_package`),
 * and bullet string lists (e.g. `production_notes`, `directorial_notes`).
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type {
  VisualMetadataBlock,
  VisualMetadataEntry,
} from '../../../../core/scoreYamlProjectionHelpers';
import type { YamlPath } from '../../../../core/schema/scoreSchemaTypes';
import type { ScoreYamlCommand } from '../../../../core/scoreYamlMutator';
import { UI_TOKENS } from '../../../tokens/ui';
import { ConfirmDeleteButton } from '../ConfirmDeleteButton';
import {
  AddMetadataKeyPopover,
  MetadataScalarInput,
  metadataScalarToStr,
} from './SceneMetadataControls';

export interface SceneMetadataBlockProps {
  metadata: VisualMetadataBlock;
  disabled?: boolean;
  onCommand: (cmd: ScoreYamlCommand) => void;
}

export const SceneMetadataBlock: React.FC<SceneMetadataBlockProps> = React.memo(
  ({ metadata, disabled = false, onCommand }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (!metadata.exists) return null;

    const removeBtn = (path: YamlPath, title: string, alwaysVisible = false) =>
      !disabled && (
        <ConfirmDeleteButton
          onConfirm={() => onCommand({ type: 'remove-field', path })}
          title={title}
          ariaLabel={title}
          revealOnGroupHover={!alwaysVisible}
        />
      );

    const renderEntry = (entry: VisualMetadataEntry) => {
      if (entry.kind === 'scalar') {
        const str = metadataScalarToStr(entry.value);
        const stacked = str.includes('\n') || str.length > 48;
        return (
          <div
            key={entry.key}
            className={`group px-1.5 py-1 rounded-md hover:bg-surface-subtle/75 ${
              stacked
                ? 'flex flex-col gap-1'
                : 'grid grid-cols-[minmax(92px,116px)_minmax(0,1fr)] items-center gap-2'
            }`}
          >
            <div className="flex items-center justify-between gap-1 min-w-0">
              <span className="text-[10px] font-mono text-text-muted truncate">
                {entry.key}
              </span>
              {stacked && removeBtn(entry.yamlPath, `Remove ${entry.key}`)}
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <MetadataScalarInput
                value={entry.value}
                yamlPath={entry.yamlPath}
                disabled={disabled}
                ariaLabel={`metadata ${entry.key}`}
                onCommand={onCommand}
              />
              {!stacked && removeBtn(entry.yamlPath, `Remove ${entry.key}`)}
            </div>
          </div>
        );
      }

      if (entry.kind === 'map') {
        return (
          <div
            key={entry.key}
            className="mt-1 pl-2 border-l border-violet-500/30 space-y-0.5"
          >
            <div className="group flex items-center justify-between gap-2 px-1 py-0.5">
              <span className="text-[10px] font-mono font-semibold text-text-body">
                {entry.key}:
              </span>
              <div className="flex items-center gap-1">
                {!disabled && (
                  <AddMetadataKeyPopover
                    parentPath={entry.yamlPath}
                    authoredKeys={entry.entries.map((c) => c.key)}
                    label="Field"
                    onCommand={onCommand}
                  />
                )}
                {removeBtn(entry.yamlPath, `Remove ${entry.key}`)}
              </div>
            </div>
            {entry.entries.map((child) => (
              <div
                key={child.key}
                className="group grid grid-cols-[minmax(84px,108px)_minmax(0,1fr)] items-center gap-2 px-1 py-0.5 rounded-md hover:bg-surface-subtle/75"
              >
                <span className="text-[10px] font-mono text-text-muted truncate">
                  {child.key}
                </span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <MetadataScalarInput
                    value={child.value}
                    yamlPath={child.yamlPath}
                    disabled={disabled}
                    ariaLabel={`${entry.key} ${child.key}`}
                    onCommand={onCommand}
                  />
                  {removeBtn(child.yamlPath, `Remove ${child.key}`)}
                </div>
              </div>
            ))}
          </div>
        );
      }

      return (
        <div
          key={entry.key}
          className="mt-1 pl-2 border-l border-violet-500/30 space-y-1"
        >
          <div className="group flex items-center justify-between gap-2 px-1 py-0.5">
            <span className="text-[10px] font-mono font-semibold text-text-body">
              {entry.key}:
            </span>
            <div className="flex items-center gap-1">
              {!disabled && (
                <button
                  type="button"
                  onClick={() =>
                    onCommand({
                      type: 'append-seq-item',
                      path: entry.yamlPath,
                      value: '',
                    })
                  }
                  className={UI_TOKENS.inspector.addPropBtn}
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>Item</span>
                </button>
              )}
              {removeBtn(entry.yamlPath, `Remove ${entry.key}`)}
            </div>
          </div>
          {entry.items.map((item) => (
            <div
              key={`${entry.key}-${item.index}`}
              className="group flex items-start gap-1.5 px-1"
            >
              <span className="text-[10px] font-mono text-text-faint pt-1 shrink-0">
                −
              </span>
              <MetadataScalarInput
                value={item.value}
                yamlPath={item.yamlPath}
                disabled={disabled}
                forceMultiline
                placeholder="Note item…"
                ariaLabel={`${entry.key} item ${item.index + 1}`}
                onCommand={onCommand}
              />
              {removeBtn(item.yamlPath, `Remove item ${item.index + 1}`)}
            </div>
          ))}
        </div>
      );
    };

    return (
      <div className="mt-2 pl-2.5 border-l-2 border-violet-500/40 space-y-1">
        <div className="flex items-center justify-between gap-2 py-0.5">
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="flex-1 min-w-0 flex items-center gap-1.5 text-left cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-text-faint shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-text-faint shrink-0" />
            )}
            <span className="text-[10px] font-mono font-bold text-violet-600 dark:text-violet-400">
              metadata:
            </span>
            <span className="px-1 py-0 rounded text-[9px] font-mono bg-surface-subtle border border-border-subtle text-text-faint">
              {metadata.entries.length}
            </span>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            {!disabled && (
              <AddMetadataKeyPopover
                parentPath={metadata.yamlPath}
                authoredKeys={metadata.entries.map((e) => e.key)}
                allowContainerTypes
                label="Entry"
                onCommand={onCommand}
                onAfterAdd={() => setIsExpanded(true)}
              />
            )}
            {removeBtn(metadata.yamlPath, 'Remove metadata: block', true)}
          </div>
        </div>

        {isExpanded &&
          (metadata.entries.length === 0 ? (
            <p className="text-[10px] font-mono text-text-faint px-1.5 py-0.5">
              Empty metadata block — use + Entry to add notes or crew credits.
            </p>
          ) : (
            <div className="space-y-0.5">{metadata.entries.map(renderEntry)}</div>
          ))}
      </div>
    );
  }
);
