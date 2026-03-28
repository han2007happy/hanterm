import { app, BrowserWindow, ipcMain, clipboard, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as pty from 'node-pty';
import * as os from 'os';

interface PtyProcess {
  process: pty.IPty;
  panelId: string;
}

const ptys = new Map<string, PtyProcess>();

function parseArgs() {
  const args = process.argv.slice(2);
  let layout: 'split' | 'stack' = 'stack';
  let theme: 'dark' | 'light' = 'dark';

  for (const arg of args) {
    if (arg.startsWith('--layout=')) {
      const val = arg.split('=')[1];
      if (val === 'split' || val === 'stack') layout = val;
    }
    if (arg.startsWith('--theme=')) {
      const val = arg.split('=')[1];
      if (val === 'dark' || val === 'light') theme = val;
    }
  }

  return { layout, theme };
}

function createWindow() {
  const { layout, theme } = parseArgs();

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 10 },
    backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.argv.includes('--dev');

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Send initial config to renderer
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('init-config', { layout, theme });
  });

  return win;
}

// PTY management
// Electron strips SHELL from env, force zsh on macOS
const defaultShell = os.platform() === 'win32' ? 'powershell.exe' : '/bin/zsh';

// Build a proper login shell environment
function getShellEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  env.TERM = 'xterm-256color';
  env.COLORTERM = 'truecolor';
  env.LANG = env.LANG || 'en_US.UTF-8';
  env.SHELL = defaultShell;
  env.SHELL_SESSIONS_DISABLE = '1';
  // Ensure PATH includes common dirs
  if (!env.PATH?.includes('/usr/local/bin')) {
    env.PATH = `/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${env.PATH || ''}`;
  }
  return env;
}

ipcMain.handle('pty-create', (_event, panelId: string, cwd?: string) => {
  try {
    const ptyProcess = pty.spawn(defaultShell, ['--login'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd || os.homedir(),
      env: getShellEnv(),
    });

    ptys.set(panelId, { process: ptyProcess, panelId });

    ptyProcess.onData((data: string) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('pty-data', panelId, data);
      });
    });

    ptyProcess.onExit(({ exitCode }) => {
      ptys.delete(panelId);
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('pty-exit', panelId, exitCode);
      });
    });

    return { panelId };
  } catch (err) {
    console.error(`Failed to create PTY for ${panelId}:`, err);
    return { error: String(err) };
  }
});

ipcMain.on('pty-write', (_event, panelId: string, data: string) => {
  const entry = ptys.get(panelId);
  if (entry) {
    entry.process.write(data);
  }
});

ipcMain.on('pty-resize', (_event, panelId: string, cols: number, rows: number) => {
  const entry = ptys.get(panelId);
  if (entry && cols > 0 && rows > 0) {
    entry.process.resize(Math.floor(cols), Math.floor(rows));
  }
});

ipcMain.handle('pty-kill', (_event, panelId: string) => {
  const entry = ptys.get(panelId);
  if (entry) {
    entry.process.kill();
    ptys.delete(panelId);
  }
  return true;
});

// Clipboard image paste handling
const imageDir = path.join(os.homedir(), '.hanterm', 'images');

ipcMain.handle('clipboard-check-image', () => {
  const img = clipboard.readImage();
  if (img.isEmpty()) return { hasImage: false };
  const size = img.getSize();
  return { hasImage: true, width: size.width, height: size.height };
});

ipcMain.handle('clipboard-save-image', () => {
  const img = clipboard.readImage();
  if (img.isEmpty()) return { error: 'No image in clipboard' };

  try {
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `paste-${timestamp}.png`;
    const filePath = path.join(imageDir, filename);

    const pngBuffer = img.toPNG();
    fs.writeFileSync(filePath, pngBuffer);

    // Create base64 thumbnail for preview (max 200px wide)
    const size = img.getSize();
    const maxWidth = 200;
    const scale = Math.min(1, maxWidth / size.width);
    const thumb = img.resize({
      width: Math.round(size.width * scale),
      height: Math.round(size.height * scale),
    });
    const thumbBase64 = thumb.toDataURL();

    return {
      filePath,
      filename,
      width: size.width,
      height: size.height,
      thumbnail: thumbBase64,
    };
  } catch (err) {
    return { error: String(err) };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Kill all pty processes
  ptys.forEach((entry) => entry.process.kill());
  ptys.clear();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
