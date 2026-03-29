import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './Sidebar';
import PanelArea, { PanelAreaHandle } from './PanelArea';
import { Tab, LayoutMode, ThemeMode, Bookmark } from '../types';
import '../styles/sidebar.css';
import '../styles/panels.css';

let tabIdSeq = 0;

function createTab(name?: string, restoredContent?: string, restoredCwd?: string): Tab {
  tabIdSeq++;
  const id = `tab-${Date.now()}-${tabIdSeq}`;
  return {
    id,
    name: name || `Tab ${tabIdSeq}`,
    panels: [{ id: `panel-${id}`, tabId: id }],
    restoredContent,
    restoredCwd,
  };
}

export default function App() {
  const initialTab = useRef(createTab());
  const [tabs, setTabs] = useState<Tab[]>(() => [initialTab.current]);
  const [activeTabId, setActiveTabId] = useState<string>(() => initialTab.current.id);
  const [layout, setLayout] = useState<LayoutMode>('stack');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const activeTabRef = useRef(activeTabId);
  activeTabRef.current = activeTabId;
  const panelAreaRef = useRef<PanelAreaHandle>(null);

  // Load bookmarks on mount
  useEffect(() => {
    window.hanterm?.listBookmarks().then(setBookmarks);
  }, []);

  // Receive config from main process
  useEffect(() => {
    const cleanup = window.hanterm?.onInitConfig((config) => {
      if (config.layout === 'split' || config.layout === 'stack') setLayout(config.layout);
      if (config.theme === 'dark' || config.theme === 'light') setTheme(config.theme);
    });
    return cleanup;
  }, []);

  // Apply theme class
  useEffect(() => {
    document.documentElement.className = theme === 'light' ? 'theme-light' : '';
  }, [theme]);

  const addTab = useCallback(() => {
    setTabs((prev) => {
      const usedNums = new Set(
        prev.map((t) => {
          const m = t.name.match(/^Tab (\d+)$/);
          return m ? parseInt(m[1], 10) : 0;
        })
      );
      let n = 1;
      while (usedNums.has(n)) n++;
      const tab = createTab(`Tab ${n}`);
      setActiveTabId(tab.id);
      return [...prev, tab];
    });
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      if (next.length === 0) {
        const tab = createTab('Tab 1');
        setActiveTabId(tab.id);
        return [tab];
      }
      setActiveTabId((current) => {
        if (current === tabId) {
          const idx = prev.findIndex((t) => t.id === tabId);
          const fallback = prev[idx - 1] || prev[idx + 1];
          return fallback?.id || next[0]?.id || '';
        }
        return current;
      });
      return next;
    });
  }, []);

  const renameTab = useCallback((tabId: string, name: string) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, name } : t)));
  }, []);

  const reorderTabs = useCallback((fromTabId: string, toTabId: string) => {
    setTabs((prev) => {
      const fromIdx = prev.findIndex((t) => t.id === fromTabId);
      const toIdx = prev.findIndex((t) => t.id === toTabId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const newTabs = [...prev];
      const [moved] = newTabs.splice(fromIdx, 1);
      newTabs.splice(toIdx, 0, moved);
      return newTabs;
    });
  }, []);

  // Bookmark a tab
  const bookmarkTab = useCallback(async (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || !window.hanterm) return;

    const panelId = tab.panels[0]?.id;
    if (!panelId) return;

    // Get current working directory
    const cwd = await window.hanterm.getPtyCwd(panelId) || '~';

    // Get terminal content
    const content = panelAreaRef.current?.getTerminalContent(panelId) || '';

    const bookmark: Bookmark = {
      id: `bm-${Date.now()}`,
      name: tab.name,
      cwd,
      content,
      createdAt: new Date().toISOString(),
    };

    const result = await window.hanterm.saveBookmark(bookmark);
    if (result.success) {
      const updated = await window.hanterm.listBookmarks();
      setBookmarks(updated);
    }
  }, [tabs]);

  // Open a bookmark as a new tab
  const openBookmark = useCallback((bookmark: Bookmark) => {
    const tab = createTab(bookmark.name, bookmark.content, bookmark.cwd);
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  // Delete a bookmark
  const deleteBookmark = useCallback(async (id: string) => {
    if (!window.hanterm) return;
    await window.hanterm.deleteBookmark(id);
    const updated = await window.hanterm.listBookmarks();
    setBookmarks(updated);
  }, []);

  const toggleLayout = useCallback(() => {
    setLayout((prev) => (prev === 'split' ? 'stack' : 'split'));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Keyboard shortcuts
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key === 't') {
        e.preventDefault();
        addTab();
      }
      if (meta && e.key === 'w') {
        e.preventDefault();
        closeTab(activeTabRef.current);
      }
      if (meta && e.key === '\\') {
        e.preventDefault();
        toggleLayout();
      }
      if (meta && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        const currentTabs = tabsRef.current;
        if (idx < currentTabs.length) {
          setActiveTabId(currentTabs[idx].id);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addTab, closeTab, toggleLayout]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100vh' }}>
      <div className="titlebar">
        <div className="titlebar-drag" />
        <span className="titlebar-title">HanTerm</span>
      </div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          tabs={tabs}
          activeTabId={activeTabId}
          layout={layout}
          theme={theme}
          bookmarks={bookmarks}
          onSelectTab={setActiveTabId}
          onAddTab={addTab}
          onCloseTab={closeTab}
          onRenameTab={renameTab}
          onReorderTabs={reorderTabs}
          onBookmarkTab={bookmarkTab}
          onOpenBookmark={openBookmark}
          onDeleteBookmark={deleteBookmark}
          onToggleLayout={toggleLayout}
          onToggleTheme={toggleTheme}
        />
        <PanelArea
          ref={panelAreaRef}
          tabs={tabs}
          activeTabId={activeTabId}
          layout={layout}
          theme={theme}
          onSelectTab={setActiveTabId}
          onReorderTabs={reorderTabs}
        />
      </div>
    </div>
  );
}
