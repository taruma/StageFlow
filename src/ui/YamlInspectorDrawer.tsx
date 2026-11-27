/**
 * Backward-compatible adapter re-exporting the CodeMirror 6 YamlStudioPanel.
 * Maintained to preserve backward compatibility across tests and legacy imports.
 */

import React from 'react';
import type { ScoreDiagnostic } from '../core/types';
import type { StoragePersistenceStatus } from './StorageStatusBadge';
import { YamlStudioPanel } from './editor/YamlStudioPanel';

export interface YamlInspectorDrawerProps {
  isOpen: boolean;
  rawYaml: string;
  sceneId?: string;
  parseError: string | null;
  parseWarning?: string | null;
  diagnostics?: ScoreDiagnostic[];
  storageStatus?: StoragePersistenceStatus;
  isBundled?: boolean;
  effectiveTheme?: 'dark' | 'warm' | 'light';
  onChangeYaml: (newYaml: string) => void;
  onForkScore?: () => void;
  onResetDefault?: () => void;
  onClose: () => void;
}

const NOOP = () => {};
const ZERO_TIME = () => 0;

export const YamlInspectorDrawer: React.FC<YamlInspectorDrawerProps> = ({
  isOpen,
  rawYaml,
  sceneId,
  parseError,
  parseWarning,
  diagnostics,
  storageStatus = 'bundled',
  isBundled = false,
  effectiveTheme,
  onChangeYaml,
  onForkScore,
  onClose,
}) => {
  return (
    <YamlStudioPanel
      isOpen={isOpen}
      editorMode="yaml"
      onChangeEditorMode={NOOP}
      rawYaml={rawYaml}
      historyRevision={0}
      canUndo={false}
      canRedo={false}
      canReset={false}
      sceneId={sceneId}
      visualIR={null}
      visualIRError={null}
      entities={[]}
      activeShotId={null}
      parseError={parseError}
      parseWarning={parseWarning}
      diagnostics={diagnostics}
      storageStatus={storageStatus}
      isBundled={isBundled}
      effectiveTheme={effectiveTheme}
      onChangeYaml={onChangeYaml}
      onVisualCommand={NOOP}
      onScrubPreview={NOOP}
      onTimingScrubPreview={NOOP}
      onCommitScrub={NOOP}
      onCancelScrub={NOOP}
      onSeekToTime={NOOP}
      getCurrentTimeSec={ZERO_TIME}
      onUndo={NOOP}
      onRedo={NOOP}
      onResetToBaseline={NOOP}
      onForkScore={onForkScore}
      onClose={onClose}
    />
  );
};

export default YamlInspectorDrawer;
