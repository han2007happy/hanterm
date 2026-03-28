export type LayoutMode = 'split' | 'stack';
export type ThemeMode = 'dark' | 'light';

export interface Tab {
  id: string;
  name: string;
  panels: { id: string; tabId: string }[];
}

declare global {
  interface Window {
    hanterm: {
      createPty: (panelId: string, cwd?: string) => Promise<string>;
      writePty: (panelId: string, data: string) => void;
      resizePty: (panelId: string, cols: number, rows: number) => void;
      killPty: (panelId: string) => void;
      onPtyData: (callback: (panelId: string, data: string) => void) => () => void;
      onPtyExit: (callback: (panelId: string, exitCode: number) => void) => () => void;
      onInitConfig: (callback: (config: { layout: string; theme: string }) => void) => () => void;
      checkClipboardImage: () => Promise<{ hasImage: boolean; width?: number; height?: number }>;
      saveClipboardImage: () => Promise<{
        filePath?: string;
        filename?: string;
        width?: number;
        height?: number;
        thumbnail?: string;
        error?: string;
      }>;
    };
  }
}
