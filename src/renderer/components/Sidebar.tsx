import React, { useState, useRef } from 'react';
import { Tab, LayoutMode, ThemeMode } from '../types';

interface Props {
  tabs: Tab[];
  activeTabId: string;
  layout: LayoutMode;
  theme: ThemeMode;
  onSelectTab: (id: string) => void;
  onAddTab: () => void;
  onCloseTab: (id: string) => void;
  onRenameTab: (id: string, name: string) => void;
  onReorderTabs: (fromTabId: string, toTabId: string) => void;
  onToggleLayout: () => void;
  onToggleTheme: () => void;
}

export default function Sidebar({
  tabs,
  activeTabId,
  layout,
  theme,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onRenameTab,
  onReorderTabs,
  onToggleLayout,
  onToggleTheme,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragSourceId = useRef<string | null>(null);

  const startRename = (tab: Tab) => {
    setEditingId(tab.id);
    setEditName(tab.name);
  };

  const commitRename = () => {
    if (editingId && editName.trim()) {
      onRenameTab(editingId, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>HanTerm</span>
        <button onClick={onAddTab} title="New Tab (Cmd+T)">+</button>
      </div>

      <div className="tab-list">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-item ${tab.id === activeTabId ? 'active' : ''} ${dragOverId === tab.id && dragSourceId.current !== tab.id ? 'drag-over' : ''}`}
            onClick={() => onSelectTab(tab.id)}
            onDoubleClick={() => startRename(tab)}
            draggable={editingId !== tab.id}
            onDragStart={(e) => {
              dragSourceId.current = tab.id;
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', tab.id);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDragOverId(tab.id);
            }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e) => {
              e.preventDefault();
              const fromId = dragSourceId.current;
              if (fromId && fromId !== tab.id) {
                onReorderTabs(fromId, tab.id);
              }
              setDragOverId(null);
              dragSourceId.current = null;
            }}
            onDragEnd={() => {
              setDragOverId(null);
              dragSourceId.current = null;
            }}
          >
            {editingId === tab.id ? (
              <input
                className="tab-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                autoFocus
                maxLength={32}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--accent)',
                  color: 'var(--text-active)',
                  outline: 'none',
                  fontSize: '13px',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  width: '100%',
                }}
              />
            ) : (
              <span className="tab-name">{tab.name}</span>
            )}
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              title="Close Tab"
            >
              x
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button
          className={layout === 'split' ? 'active' : ''}
          onClick={onToggleLayout}
          title="Toggle Layout (Cmd+\\)"
        >
          {layout === 'split' ? 'Split' : 'Stack'}
        </button>
        <button onClick={onToggleTheme} title="Toggle Theme">
          {theme === 'dark' ? 'Dark' : 'Light'}
        </button>
      </div>
    </div>
  );
}
