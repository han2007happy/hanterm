import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import TerminalPanel, { TerminalPanelHandle } from './TerminalPanel';
import { Tab, LayoutMode, ThemeMode } from '../types';

interface Props {
  tabs: Tab[];
  activeTabId: string;
  layout: LayoutMode;
  theme: ThemeMode;
  onSelectTab: (tabId: string) => void;
  onReorderTabs: (fromTabId: string, toTabId: string) => void;
}

interface PanelEntry {
  panel: { id: string; tabId: string };
  tab: Tab;
}

function getAllPanels(tabs: Tab[]): PanelEntry[] {
  return tabs.map((tab) => ({ panel: tab.panels[0], tab }));
}

function computeGrid(count: number) {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count === 3) return { cols: 3, rows: 1 };
  if (count === 4) return { cols: 2, rows: 2 };
  // 5+: try to fill a grid with minimal empty cells
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

export default function PanelArea({ tabs, activeTabId, layout, theme, onSelectTab, onReorderTabs }: Props) {
  const allPanels = useMemo(() => getAllPanels(tabs), [tabs]);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Map<string, TerminalPanelHandle>>(new Map());

  // Drag state
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const dragSourceTabId = useRef<string | null>(null);

  // Visible panels
  const visiblePanelIds = useMemo(() => {
    const set = new Set<string>();
    if (layout === 'split') {
      allPanels.forEach(({ panel }) => set.add(panel.id));
    } else {
      allPanels
        .filter(({ tab }) => tab.id === activeTabId)
        .forEach(({ panel }) => set.add(panel.id));
    }
    return set;
  }, [allPanels, layout, activeTabId]);

  const visibleCount = visiblePanelIds.size;
  const { cols, rows } = useMemo(() => computeGrid(visibleCount), [visibleCount]);

  const [colSizes, setColSizes] = useState<number[]>([]);
  const [rowSizes, setRowSizes] = useState<number[]>([]);

  useEffect(() => { setColSizes(Array(cols).fill(100 / cols)); }, [cols]);
  useEffect(() => { setRowSizes(Array(rows).fill(100 / rows)); }, [rows]);

  // Focus first panel of active tab on switch (cancels stale requests)
  const focusTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab && activeTab.panels.length > 0) {
      const targetPanelId = activeTab.panels[0].id;
      focusTimerRef.current = setTimeout(() => {
        const handle = panelRefs.current.get(targetPanelId);
        handle?.focus();
      }, 50);
    }
  }, [activeTabId, tabs]);

  // Resize divider drag
  const resizeDragging = useRef<{ type: 'col' | 'row'; index: number; startPos: number; startSizes: number[] } | null>(null);

  const onResizeDragStart = useCallback((type: 'col' | 'row', index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const startPos = type === 'col' ? e.clientX : e.clientY;
    const startSizes = type === 'col' ? [...colSizes] : [...rowSizes];
    resizeDragging.current = { type, index, startPos, startSizes };

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalSize = resizeDragging.current.type === 'col' ? rect.width : rect.height;
      const currentPos = resizeDragging.current.type === 'col' ? moveEvent.clientX : moveEvent.clientY;
      const delta = currentPos - resizeDragging.current.startPos;
      const deltaPercent = (delta / totalSize) * 100;
      const idx = resizeDragging.current.index;
      const newSizes = [...resizeDragging.current.startSizes];
      const minSize = 10;
      const newA = newSizes[idx] + deltaPercent;
      const newB = newSizes[idx + 1] - deltaPercent;
      if (newA >= minSize && newB >= minSize) {
        newSizes[idx] = newA;
        newSizes[idx + 1] = newB;
        if (resizeDragging.current.type === 'col') setColSizes(newSizes);
        else setRowSizes(newSizes);
      }
    };

    const onMouseUp = () => {
      resizeDragging.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = type === 'col' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [colSizes, rowSizes]);

  // Panel drag-and-drop handlers
  const handlePanelDragStart = useCallback((tabId: string, e: React.DragEvent) => {
    dragSourceTabId.current = tabId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
  }, []);

  const handlePanelDragOver = useCallback((tabId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTabId(tabId);
  }, []);

  const handlePanelDrop = useCallback((tabId: string, e: React.DragEvent) => {
    e.preventDefault();
    const fromTabId = dragSourceTabId.current;
    if (fromTabId && fromTabId !== tabId) {
      onReorderTabs(fromTabId, tabId);
    }
    setDragOverTabId(null);
    dragSourceTabId.current = null;
  }, [onReorderTabs]);

  const handlePanelDragEnd = useCallback(() => {
    setDragOverTabId(null);
    dragSourceTabId.current = null;
  }, []);

  if (tabs.length === 0) {
    return (
      <div className="panel-area">
        <div className="empty-state">Press Cmd+T to create a new tab</div>
      </div>
    );
  }

  const dividerSize = 5;

  // Grid positions for visible panels
  const visibleList = allPanels.filter(({ panel }) => visiblePanelIds.has(panel.id));
  const gridPositions = new Map<string, { row: number; col: number }>();
  visibleList.forEach(({ panel }, idx) => {
    gridPositions.set(panel.id, { row: Math.floor(idx / cols), col: idx % cols });
  });

  return (
    <div
      ref={containerRef}
      className="panel-area"
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      {/* Row dividers */}
      {Array.from({ length: rows - 1 }, (_, r) => {
        const topPercent = rowSizes.slice(0, r + 1).reduce((a, b) => a + b, 0);
        return (
          <div
            key={`rdiv-${r}`}
            onMouseDown={(e) => onResizeDragStart('row', r, e)}
            style={{
              position: 'absolute', left: 0, right: 0,
              top: `calc(${topPercent}% - ${dividerSize / 2}px)`,
              height: dividerSize, backgroundColor: 'var(--border-color)',
              cursor: 'row-resize', zIndex: 10, transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = 'var(--accent)'; }}
            onMouseLeave={(e) => { if (!resizeDragging.current) (e.target as HTMLElement).style.backgroundColor = 'var(--border-color)'; }}
          />
        );
      })}

      {/* Column dividers */}
      {Array.from({ length: cols - 1 }, (_, c) => {
        const leftPercent = colSizes.slice(0, c + 1).reduce((a, b) => a + b, 0);
        return (
          <div
            key={`cdiv-${c}`}
            onMouseDown={(e) => onResizeDragStart('col', c, e)}
            style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `calc(${leftPercent}% - ${dividerSize / 2}px)`,
              width: dividerSize, backgroundColor: 'var(--border-color)',
              cursor: 'col-resize', zIndex: 10, transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = 'var(--accent)'; }}
            onMouseLeave={(e) => { if (!resizeDragging.current) (e.target as HTMLElement).style.backgroundColor = 'var(--border-color)'; }}
          />
        );
      })}

      {/* All panels */}
      {allPanels.map(({ panel, tab }) => {
        const isVisible = visiblePanelIds.has(panel.id);
        const pos = gridPositions.get(panel.id);
        const isDragOver = dragOverTabId === tab.id && dragSourceTabId.current !== tab.id;

        let style: React.CSSProperties;

        if (!isVisible || !pos) {
          style = {
            position: 'absolute', left: -9999, top: -9999,
            width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none',
          };
        } else {
          const leftPercent = colSizes.slice(0, pos.col).reduce((a, b) => a + b, 0);
          const topPercent = rowSizes.slice(0, pos.row).reduce((a, b) => a + b, 0);
          const widthPercent = colSizes[pos.col] || 100 / cols;
          const heightPercent = rowSizes[pos.row] || 100 / rows;

          style = {
            position: 'absolute',
            left: `${leftPercent}%`, top: `${topPercent}%`,
            width: `${widthPercent}%`, height: `${heightPercent}%`,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            outline: isDragOver ? '2px solid var(--accent)' : 'none',
            outlineOffset: '-2px',
          };
        }

        const showHeader = isVisible && (layout === 'split' || tabs.length > 1);

        return (
          <div key={panel.id} style={style}>
            <TerminalPanel
              ref={(handle) => { if (handle) panelRefs.current.set(panel.id, handle); else panelRefs.current.delete(panel.id); }}
              panelId={panel.id}
              tabName={tab.name}
              showHeader={showHeader}
              isVisible={isVisible}
              theme={theme}
              draggable={isVisible && layout === 'split'}
              onFocus={() => onSelectTab(tab.id)}
              onDragStart={(e) => handlePanelDragStart(tab.id, e)}
              onDragOver={(e) => handlePanelDragOver(tab.id, e)}
              onDrop={(e) => handlePanelDrop(tab.id, e)}
              onDragEnd={handlePanelDragEnd}
            />
          </div>
        );
      })}
    </div>
  );
}
