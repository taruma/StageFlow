/// <reference types="vite/client" />

declare module 'virtual:stageflow-catalog-index' {
  export interface BundledScoreIndexEntry {
    id: string;
    file: string;
    category: 'study' | 'blueprint' | 'custom';
    aliases: string[];
    isDefault: boolean;
    title: string;
    subtitle?: string;
    videoUrl: string;
    durationSec: number;
    shotCount: number;
    aspectRatio: number;
  }

  const catalogIndex: BundledScoreIndexEntry[];
  export default catalogIndex;
}
