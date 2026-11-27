/**
 * Input & popover primitives for freeform `metadata:` entries inside `SceneMetadataBlock`.
 */

import React, { useState, useEffect, useRef } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Plus } from 'lucide-react';
import type { YamlPath } from '../../../../core/schema/scoreSchemaTypes';
import type { ScoreYamlCommand } from '../../../../core/scoreYamlMutator';
import { UI_TOKENS } from '../../../tokens/ui';
import { AutoSizeTextarea } from '../AutoSizeTextarea';

const METADATA_PRESETS: ReadonlyArray<{
  key: string;
  label: string;
  defaultValue: unknown;
}> = [
  { key: 'director', label: 'Director', defaultValue: '' },
  { key: 'music', label: 'Music / Score', defaultValue: '' },
  { key: 'location', label: 'Location', defaultValue: '' },
  {
    key: 'camera_package',
    label: 'Camera Package (group)',
    defaultValue: { body: '', lens: '' },
  },
  {
    key: 'production_notes',
    label: 'Production Notes (list)',
    defaultValue: [''],
  },
  {
    key: 'directorial_notes',
    label: 'Directorial Notes (list)',
    defaultValue: [''],
  },
];

export function metadataScalarToStr(
  val: string | number | boolean | null
): string {
  return val === null || val === undefined ? '' : String(val);
}

export interface MetadataScalarInputProps {
  value: string | number | boolean | null;
  yamlPath: YamlPath;
  disabled?: boolean;
  forceMultiline?: boolean;
  placeholder?: string;
  ariaLabel: string;
  onCommand: (cmd: ScoreYamlCommand) => void;
}

export const MetadataScalarInput: React.FC<MetadataScalarInputProps> =
  React.memo(
    ({
      value,
      yamlPath,
      disabled,
      forceMultiline = false,
      placeholder = 'Enter value…',
      ariaLabel,
      onCommand,
    }) => {
      const [draft, setDraft] = useState(() => metadataScalarToStr(value));
      const skipBlurRef = useRef(false);

      useEffect(() => {
        setDraft(metadataScalarToStr(value));
      }, [value]);

      const commit = () => {
        if (skipBlurRef.current) {
          skipBlurRef.current = false;
          return;
        }
        if (draft === metadataScalarToStr(value)) return;
        onCommand({
          type: 'set-field',
          path: yamlPath,
          value: draft,
          format: 'plain',
        });
      };

      const cancel = () => {
        skipBlurRef.current = true;
        setDraft(metadataScalarToStr(value));
      };

      const initialStr = metadataScalarToStr(value);
      if (forceMultiline || initialStr.includes('\n') || initialStr.length > 48) {
        return (
          <AutoSizeTextarea
            disabled={disabled}
            value={draft}
            minRows={1}
            placeholder={placeholder}
            ariaLabel={ariaLabel}
            onChange={setDraft}
            onCommit={commit}
            onCancel={cancel}
          />
        );
      }

      return (
        <input
          type="text"
          data-native-undo="true"
          disabled={disabled}
          value={draft}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit();
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              cancel();
              e.currentTarget.blur();
            }
          }}
          className={`flex-1 min-w-[90px] ${UI_TOKENS.inspector.textInput}`}
        />
      );
    }
  );

export interface AddMetadataKeyPopoverProps {
  parentPath: YamlPath;
  authoredKeys: readonly string[];
  allowContainerTypes?: boolean;
  label: string;
  onCommand: (cmd: ScoreYamlCommand) => void;
  onAfterAdd?: () => void;
}

export const AddMetadataKeyPopover: React.FC<AddMetadataKeyPopoverProps> = ({
  parentPath,
  authoredKeys,
  allowContainerTypes = false,
  label,
  onCommand,
  onAfterAdd,
}) => {
  const [open, setOpen] = useState(false);
  const [customKey, setCustomKey] = useState('');
  const [customType, setCustomType] = useState<'text' | 'map' | 'list'>('text');

  const authoredSet = new Set(authoredKeys);
  const availablePresets = allowContainerTypes
    ? METADATA_PRESETS.filter((p) => !authoredSet.has(p.key))
    : [];

  const handleAdd = (key: string, value: unknown) => {
    const clean = key.trim();
    if (!clean) return;
    onCommand({ type: 'add-field', parentPath, key: clean, value, format: 'plain' });
    setCustomKey('');
    setOpen(false);
    onAfterAdd?.();
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={UI_TOKENS.inspector.addPropBtn}>
          <Plus className="w-2.5 h-2.5" />
          <span>{label}</span>
        </button>
      </Popover.Trigger>
      {open && (
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="end"
            sideOffset={6}
            collisionPadding={10}
            className={`${UI_TOKENS.inspector.portalMenu} w-60 p-2 space-y-2`}
          >
            {availablePresets.length > 0 && (
              <div className="space-y-0.5 border-b border-border-subtle pb-1.5">
                <div className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-text-faint">
                  Presets
                </div>
                {availablePresets.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleAdd(p.key, p.defaultValue)}
                    className="w-full text-left px-1.5 py-1 rounded-md hover:bg-surface-subtle flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="text-[11px] font-mono text-text-main">
                      {p.key}
                    </span>
                    <span className="text-[9px] text-text-faint">{p.label}</span>
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val =
                  customType === 'map'
                    ? { note: '' }
                    : customType === 'list'
                    ? ['']
                    : '';
                handleAdd(customKey, val);
              }}
              className="space-y-1.5"
            >
              <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-text-faint px-0.5">
                Custom Key
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  placeholder="key_name"
                  className={`flex-1 min-w-0 ${UI_TOKENS.inspector.textInput}`}
                />
                <button
                  type="submit"
                  disabled={!customKey.trim()}
                  className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono font-semibold text-amber-700 dark:text-amber-300 disabled:opacity-40 cursor-pointer"
                >
                  Add
                </button>
              </div>
              {allowContainerTypes && (
                <div className="flex items-center gap-1 pt-0.5">
                  {(['text', 'map', 'list'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCustomType(t)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono cursor-pointer border ${
                        customType === t
                          ? 'bg-violet-500/15 border-violet-500/40 text-violet-600 dark:text-violet-300'
                          : 'bg-surface-subtle border-border-subtle text-text-muted'
                      }`}
                    >
                      {t === 'map' ? 'group' : t}
                    </button>
                  ))}
                </div>
              )}
            </form>
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
};
