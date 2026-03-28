import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './Sidebar';
import PanelArea from './PanelArea';
import { Tab, LayoutMode, ThemeMode } from '../types';
import '../styles/sidebar.css';
import '../styles/panels.css';

let tabIdSeq = 0;

function createTab(name?: string): Tab {
  tabIdSeq++;
  const id = `tab-${Date.now()}-${tabIdSeq}`;
  return {
    id,
    name: name || `Tab ${tabIdSeq}`,
    panels: [{ id: `panel-${id}`, tabId: id }],
  };
}

export default function App() {
  const initialTab = useRef(createTab());
  const [tabs, setTabs] = useState<Tab[]>(() => [initialTab.current]);
  const [activeTabId, setActiveTabId] = useState<string>(() => initialTab.current.id);
  const [layout, setLayout] = useState<LayoutMode>('stack');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const activeTabRef = useRef(activeTabId);
  activeTabRef.current = activeTabId;

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
      // Fix active tab selection using current prev state (not stale closure)
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

  const toggleLayout = useCallback(() => {
    setLayout((prev) => (prev === 'split' ? 'stack' : 'split'));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Keyboard shortcuts — use refs to avoid stale closures
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
          onSelectTab={setActiveTabId}
          onAddTab={addTab}
          onCloseTab={closeTab}
          onRenameTab={renameTab}
          onReorderTabs={reorderTabs}
          onToggleLayout={toggleLayout}
          onToggleTheme={toggleTheme}
          theme={theme}
        />
        <PanelArea
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
