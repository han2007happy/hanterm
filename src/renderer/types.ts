export type LayoutMode = 'split' | 'stack';
export type ThemeMode = 'dark' | 'light';

export interface Tab {
  id: string;
  name: string;
  panels: { id: string; tabId: string }[];
  restoredContent?: string;
  restoredCwd?: string;
}

export interface Bookmark {
  id: string;
  name: string;
  cwd: string;
  content: string;
  createdAt: string;
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
      getPtyCwd: (panelId: string) => Promise<string | null>;
      saveBookmark: (bookmark: Bookmark) => Promise<{ success?: boolean; error?: string }>;
      listBookmarks: () => Promise<Bookmark[]>;
      deleteBookmark: (id: string) => Promise<{ success?: boolean; error?: string }>;
    };
  }
}
