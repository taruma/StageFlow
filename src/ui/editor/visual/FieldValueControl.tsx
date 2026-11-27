/**
 * Renders the appropriate interactive control for a schema-typed YAML field
 * (Figma scrubbers, lens presets, aperture, vec3, enum select, target anchor, toggle, color, or raw text).
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { VisualFieldNode } from '../../../core/scoreYamlProjectionHelpers';
import { STANDARD_LENS_PRESETS_MM } from '../../../core/schema/scoreSchemaTypes';
import type { VisualEditorCallbacks } from './visualEditorTypes';
import { FigmaNumberPill } from './FigmaNumberPill';
import { Vec3ScrubRow, normalizeVec3Tuple } from './Vec3ScrubRow';
import { TargetAnchorControl } from './TargetAnchorControl';

export interface FieldValueControlProps {
  field: VisualFieldNode;
  callbacks: VisualEditorCallbacks;
}

function parseNumericFromRaw(raw: unknown, fallback = 0): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const cleaned = raw
      .trim()
      .toLowerCase()
      .replace(/^(f|t)\s*\/?\s*/, '')
      .replace(/(mm|deg|°|m|s|rad)$/i, '')
      .trim();
    const num = parseFloat(cleaned);
    if (Number.isFinite(num)) return num;
  }
  return fallback;
}

function formatFieldText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export const FieldValueControl: React.FC<FieldValueControlProps> = React.memo(
  ({ field, callbacks }) => {
    const {
      disabled,
      entities,
      onCommand,
      onScrubPreview,
      onCommitScrub,
      onCancelScrub,
    } = callbacks;
    const desc = field.descriptor;
    const kind = desc?.kind ?? 'raw-yaml';

    const [textDraft, setTextDraft] = useState<string>(() =>
      formatFieldText(field.value)
    );

    useEffect(() => {
      setTextDraft(formatFieldText(field.value));
    }, [field.value]);

    const handleCommitPlain = useCallback(
      (val: unknown) => {
        onCommand({
          type: 'set-field',
          path: field.yamlPath,
          value: val,
          format: desc?.formatHint,
        });
      },
      [desc?.formatHint, field.yamlPath, onCommand]
    );

    const commitTextInput = useCallback(() => {
      const prevStr =
        field.value === null || field.value === undefined
          ? ''
          : String(field.value);
      if (textDraft === prevStr) return;

      if (kind === 'raw-yaml') {
        const trimmed = textDraft.trim();
        if (trimmed === 'true') return handleCommitPlain(true);
        if (trimmed === 'false') return handleCommitPlain(false);
        const asNum = Number(trimmed);
        if (trimmed !== '' && Number.isFinite(asNum)) {
          return handleCommitPlain(asNum);
        }
      }
      handleCommitPlain(textDraft);
    }, [field.value, handleCommitPlain, kind, textDraft]);

    if (kind === 'number' || kind === 'angle-deg' || kind === 'timestamp') {
      return (
        <FigmaNumberPill
          value={parseNumericFromRaw(field.value, 0)}
          unit={desc?.unit}
          min={desc?.min}
          max={desc?.max}
          step={desc?.step ?? 0.1}
          precision={kind === 'timestamp' ? 3 : 2}
          disabled={disabled}
          onScrubPreview={(v) => onScrubPreview(field.yamlPath, v)}
          onCommit={(v) => onCommitScrub(field.yamlPath, v)}
          onCancelScrub={onCancelScrub}
        />
      );
    }

    if (kind === 'lens-mm') {
      const mm = Math.round(parseNumericFromRaw(field.value, 50));
      return (
        <div className="flex flex-wrap items-center gap-1">
          <FigmaNumberPill
            value={mm}
            unit="mm"
            min={desc?.min ?? 12}
            max={desc?.max ?? 200}
            step={1}
            precision={0}
            disabled={disabled}
            onScrubPreview={(v) => onScrubPreview(field.yamlPath, v, 'lens-mm')}
            onCommit={(v) => onCommitScrub(field.yamlPath, v, 'lens-mm')}
            onCancelScrub={onCancelScrub}
          />
          {!disabled && (
            <div className="flex items-center gap-0.5">
              {STANDARD_LENS_PRESETS_MM.slice(1, 5).map((presetMm) => (
                <button
                  key={presetMm}
                  type="button"
                  onClick={() =>
                    onCommitScrub(field.yamlPath, presetMm, 'lens-mm')
                  }
                  className={`px-1 py-0.5 rounded text-[9px] font-mono cursor-pointer transition-colors ${
                    mm === presetMm
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold'
                      : 'text-text-faint hover:text-text-main hover:bg-surface-hover'
                  }`}
                  title={`Set ${presetMm}mm lens`}
                >
                  {presetMm}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (kind === 'aperture') {
      const fStop = parseNumericFromRaw(field.value, 2.8);
      return (
        <FigmaNumberPill
          value={fStop}
          prefix="f/"
          min={desc?.min ?? 0.7}
          max={desc?.max ?? 64}
          step={0.2}
          precision={1}
          disabled={disabled}
          onScrubPreview={(v) => onScrubPreview(field.yamlPath, v, 'aperture')}
          onCommit={(v) => onCommitScrub(field.yamlPath, v, 'aperture')}
          onCancelScrub={onCancelScrub}
        />
      );
    }

    if (kind === 'vec3') {
      return (
        <Vec3ScrubRow
          value={normalizeVec3Tuple(field.value)}
          unit={desc?.unit ?? 'm'}
          min={desc?.min}
          max={desc?.max}
          step={desc?.step ?? 0.05}
          disabled={disabled}
          onScrubPreview={(v) => onScrubPreview(field.yamlPath, v, 'vec3-flow')}
          onCommit={(v) => onCommitScrub(field.yamlPath, v, 'vec3-flow')}
          onCancelScrub={onCancelScrub}
        />
      );
    }

    if (kind === 'enum' && desc?.options) {
      const currentVal = String(field.value ?? desc.options[0] ?? '');
      const options = desc.options.includes(currentVal)
        ? desc.options
        : [currentVal, ...desc.options];
      return (
        <select
          disabled={disabled}
          value={currentVal}
          onChange={(e) => handleCommitPlain(e.target.value)}
          className="px-2 py-0.5 rounded-md bg-surface-subtle border border-border-main text-[11px] font-mono text-text-main outline-none focus:border-amber-500/60 cursor-pointer"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (kind === 'entity-ref' || kind === 'target-anchor') {
      return (
        <TargetAnchorControl
          yamlPath={field.yamlPath}
          value={field.value}
          allowVec3={kind === 'target-anchor'}
          entities={entities}
          disabled={disabled}
          onScrubPreview={onScrubPreview}
          onCommit={onCommitScrub}
          onCancelScrub={onCancelScrub}
        />
      );
    }

    if (kind === 'boolean') {
      const checked =
        field.value === true ||
        field.value === 'true' ||
        field.value === 'yes';
      return (
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => handleCommitPlain(!checked)}
          className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-semibold transition-colors cursor-pointer ${
            checked
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
              : 'bg-surface-subtle border-border-main text-text-muted'
          }`}
        >
          {checked ? 'true' : 'false'}
        </button>
      );
    }

    if (kind === 'color') {
      const hex = typeof field.value === 'string' ? field.value : '#38bdf8';
      return (
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            disabled={disabled}
            value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#38bdf8'}
            onChange={(e) => handleCommitPlain(e.target.value)}
            className="w-5 h-5 rounded border border-border-main bg-transparent cursor-pointer p-0"
          />
          <input
            type="text"
            data-native-undo="true"
            disabled={disabled}
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            onBlur={commitTextInput}
            onKeyDown={(e) => e.key === 'Enter' && commitTextInput()}
            className="w-20 px-1.5 py-0.5 rounded bg-surface-subtle border border-border-main text-[11px] font-mono text-text-main outline-none focus:border-amber-500/60"
          />
        </div>
      );
    }

    return (
      <input
        type="text"
        data-native-undo="true"
        disabled={disabled}
        value={textDraft}
        onChange={(e) => setTextDraft(e.target.value)}
        onBlur={commitTextInput}
        onKeyDown={(e) => e.key === 'Enter' && commitTextInput()}
        className="flex-1 min-w-[90px] px-2 py-0.5 rounded-md bg-surface-subtle border border-border-main text-[11px] font-mono text-text-main outline-none focus:border-amber-500/60"
      />
    );
  }
);
