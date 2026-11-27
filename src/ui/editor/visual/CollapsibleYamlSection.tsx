/**
 * Collapsible top-level YAML section container with monospace key badge,
 * live item count pill, and optional header action slot.
 */

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { UI_TOKENS } from '../../tokens/ui';

export interface CollapsibleYamlSectionProps {
  yamlKey: string;
  title: string;
  count?: number;
  accentClass?: string;
  isExpanded: boolean;
  onToggle: () => void;
  actionSlot?: React.ReactNode;
  children: React.ReactNode;
}

export const CollapsibleYamlSection: React.FC<CollapsibleYamlSectionProps> =
  React.memo(
    ({
      yamlKey,
      title,
      count,
      accentClass = 'text-amber-600 dark:text-amber-400',
      isExpanded,
      onToggle,
      actionSlot,
      children,
    }) => {
      return (
        <section className={UI_TOKENS.inspector.sectionCard}>
          <div
            className={
              isExpanded
                ? UI_TOKENS.inspector.sectionHeader
                : UI_TOKENS.inspector.sectionHeaderCollapsed
            }
          >
            <button
              type="button"
              onClick={onToggle}
              className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
              )}
              <span className={`text-[11px] font-mono font-bold ${accentClass}`}>
                {yamlKey}
              </span>
              <span className="text-[11px] font-sans font-medium text-text-body truncate">
                {title}
              </span>
              {count !== undefined && (
                <span className="px-1.5 py-0.2 rounded-full bg-surface border border-border-main text-[10px] font-mono font-semibold text-text-muted tabular-nums">
                  {count}
                </span>
              )}
            </button>

            {actionSlot && (
              <div className="flex items-center gap-1.5 shrink-0">
                {actionSlot}
              </div>
            )}
          </div>

          {isExpanded && <div className="p-2.5 space-y-1.5">{children}</div>}
        </section>
      );
    }
  );
