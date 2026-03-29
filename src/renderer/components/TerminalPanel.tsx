import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

export interface TerminalPanelHandle {
  focus: () => void;
  getContent: () => string;
}

interface Props {
  panelId: string;
  tabName: string;
  showHeader: boolean;
  isVisible: boolean;
  theme?: 'dark' | 'light';
  restoredContent?: string;
  restoredCwd?: string;
  draggable?: boolean;
  onFocus?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const darkTheme = {
  background: '#1e1e1e',
  foreground: '#cccccc',
  cursor: '#ffffff',
  cursorAccent: '#1e1e1e',
  selectionBackground: '#264f78',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#ffffff',
};

const lightTheme = {
  background: '#ffffff',
  foreground: '#333333',
  cursor: '#000000',
  cursorAccent: '#ffffff',
  selectionBackground: '#add6ff',
  black: '#000000',
  red: '#cd3131',
  green: '#00bc7c',
  yellow: '#949800',
  blue: '#0451a5',
  magenta: '#bc05bc',
  cyan: '#0598bc',
  white: '#555555',
  brightBlack: '#666666',
  brightRed: '#cd3131',
  brightGreen: '#14ce14',
  brightYellow: '#b5ba00',
  brightBlue: '#0451a5',
  brightMagenta: '#bc05bc',
  brightCyan: '#0598bc',
  brightWhite: '#a5a5a5',
};

const TerminalPanel = forwardRef<TerminalPanelHandle, Props>(function TerminalPanel(
  { panelId, tabName, showHeader, isVisible, theme: themeProp, restoredContent, restoredCwd, draggable, onFocus, onDragStart, onDragOver, onDrop, onDragEnd },
  ref
) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const initializedRef = useRef(false);
  const [imagePreview, setImagePreview] = useState<{
    thumbnail: string;
    filePath: string;
    width: number;
    height: number;
  } | null>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      const term = xtermRef.current;
      if (term) {
        term.scrollToBottom();
        term.focus();
      }
      try { fitAddonRef.current?.fit(); } catch (_) {}
    },
    getContent: () => {
      const term = xtermRef.current;
      if (!term) return '';
      const buf = term.buffer.active;
      const lines: string[] = [];
      for (let i = 0; i <= buf.cursorY + buf.baseY; i++) {
        const line = buf.getLine(i);
        if (line) lines.push(line.translateToString(true));
      }
      return lines.join('\n');
    },
  }));

  // Handle clipboard image paste via xterm's custom key handler
  const previewTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pasteImageFromClipboard = useCallback(async () => {
    if (!window.hanterm) return false;

    const check = await window.hanterm.checkClipboardImage();
    if (!check.hasImage) return false;

    const result = await window.hanterm.saveClipboardImage();
    if (result.error || !result.filePath) {
      xtermRef.current?.write(`\r\n\x1b[31m[Paste Error] ${result.error}\x1b[0m\r\n`);
      return true;
    }

    // Show preview
    setImagePreview({
      thumbnail: result.thumbnail!,
      filePath: result.filePath,
      width: result.width!,
      height: result.height!,
    });

    // Type the file path into the terminal
    window.hanterm.writePty(panelId, result.filePath);

    // Auto-hide preview after 5 seconds (with cleanup)
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => setImagePreview(null), 5000);

    return true;
  }, [panelId]);

  const pasteImageRef = useRef(pasteImageFromClipboard);
  pasteImageRef.current = pasteImageFromClipboard;

  // Initialize terminal once and keep it alive
  useEffect(() => {
    if (!termRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const isLight = document.documentElement.classList.contains('theme-light');

    const terminal = new Terminal({
      fontSize: 14,
      fontFamily: "'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
      theme: isLight ? lightTheme : darkTheme,
      cursorBlink: true,
      cursorStyle: 'bar',
      allowTransparency: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    terminal.open(termRef.current);

    // Intercept Cmd+V to check for clipboard images before xterm handles paste
    terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && e.type === 'keydown') {
        pasteImageRef.current().then((handled) => {
          if (!handled) {
            navigator.clipboard.readText().then((text) => {
              if (text && window.hanterm) {
                window.hanterm.writePty(panelId, text);
              }
            }).catch(() => {});
          }
        });
        return false;
      }
      return true;
    });

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Safe fit helper — also scroll to bottom after resize
    const safeFit = () => {
      try {
        const rect = termRef.current?.getBoundingClientRect();
        if (rect && rect.width > 10 && rect.height > 10) {
          fitAddon.fit();
          // Subtract 1 row to prevent last line from being clipped
          const dims = fitAddon.proposeDimensions();
          if (dims && dims.rows > 2) {
            terminal.resize(dims.cols, dims.rows - 1);
          }
          terminal.scrollToBottom();
        }
      } catch (err) {
        console.warn('[HanTerm] fit error:', err);
      }
    };

    // Connect to PTY
    if (window.hanterm) {
      // Delay initial fit and PTY creation to ensure DOM layout is ready
      setTimeout(() => {
        safeFit();

        // Write restored content before PTY connects (so it appears as history)
        if (restoredContent) {
          const lines = restoredContent.split('\n');
          lines.forEach(line => {
            terminal.write(line + '\r\n');
          });
          terminal.write('\x1b[90m--- restored session ---\x1b[0m\r\n');
        }

        window.hanterm.createPty(panelId, restoredCwd || undefined).then((result: { panelId?: string; error?: string }) => {
          if (result?.error) {
            terminal.write(`\r\n\x1b[31m[Error] Failed to create shell: ${result.error}\x1b[0m\r\n`);
            return;
          }

          terminal.onData((data) => {
            window.hanterm.writePty(panelId, data);
          });

          terminal.onResize(({ cols, rows }) => {
            if (cols > 0 && rows > 0) {
              window.hanterm.resizePty(panelId, cols, rows);
            }
          });

          setTimeout(() => {
            safeFit();
            const dims = fitAddon.proposeDimensions();
            if (dims && dims.cols > 0 && dims.rows > 0) {
              window.hanterm.resizePty(panelId, dims.cols, dims.rows);
            }
          }, 100);
        }).catch((err: unknown) => {
          terminal.write(`\r\n\x1b[31m[Error] PTY creation failed: ${err}\x1b[0m\r\n`);
        });
      }, 150);

      const cleanupData = window.hanterm.onPtyData((id, data) => {
        if (id === panelId) {
          terminal.write(data);
        }
      });

      const cleanupExit = window.hanterm.onPtyExit((id, _exitCode) => {
        if (id === panelId) {
          terminal.write('\r\n[Process exited]\r\n');
        }
      });

      // Debounced resize observer
      let resizeTimer: ReturnType<typeof setTimeout>;
      const resizeObserver = new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(safeFit, 50);
      });
      resizeObserver.observe(termRef.current);

      return () => {
        cleanupData();
        cleanupExit();
        resizeObserver.disconnect();
        terminal.dispose();
        window.hanterm.killPty(panelId);
        if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      };
    } else {
      terminal.write('HanTerm - Terminal not connected (dev mode)\r\n');
      return () => terminal.dispose();
    }
  }, [panelId]);

  // Re-fit terminal when becoming visible
  useEffect(() => {
    if (isVisible && fitAddonRef.current && termRef.current) {
      // Delay to ensure container has non-zero dimensions after display change
      setTimeout(() => {
        try {
          const rect = termRef.current?.getBoundingClientRect();
          if (rect && rect.width > 0 && rect.height > 0) {
            fitAddonRef.current?.fit();
            xtermRef.current?.scrollToBottom();
          }
        } catch (_) {
          // ignore fit errors on hidden elements
        }
      }, 50);
    }
  }, [isVisible]);

  // Update terminal theme when theme prop changes
  useEffect(() => {
    if (xtermRef.current && themeProp) {
      xtermRef.current.options.theme = themeProp === 'light' ? lightTheme : darkTheme;
    }
  }, [themeProp]);

  return (
    <div onMouseDown={onFocus} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
      {showHeader && (
        <div
          className="panel-header"
          draggable={draggable}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
          style={{ cursor: draggable ? 'grab' : 'default' }}
        >
          <span className="panel-title">{tabName}</span>
        </div>
      )}
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <div className="terminal-wrapper" ref={termRef} style={{ flex: 1, minHeight: 0 }} />
        {imagePreview && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--accent)',
              borderRadius: 8,
              padding: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              zIndex: 20,
              maxWidth: 220,
              cursor: 'pointer',
            }}
            onClick={() => setImagePreview(null)}
            title="Click to dismiss"
          >
            <img
              src={imagePreview.thumbnail}
              alt="Pasted image"
              style={{ maxWidth: '100%', borderRadius: 4, display: 'block' }}
            />
            <div style={{
              fontSize: 10,
              color: 'var(--text-secondary)',
              marginTop: 4,
              wordBreak: 'break-all',
            }}>
              {imagePreview.width}x{imagePreview.height} - {imagePreview.filePath.split('/').pop()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default TerminalPanel;
