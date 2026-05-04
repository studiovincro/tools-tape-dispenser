import { app, BrowserWindow, Menu } from 'electron';
import { execSync } from 'child_process';
import path from 'path';
import { PtyManager } from './pty-manager';
import { registerIpcHandlers } from './ipc-handlers';
import { loadState } from './session-store';

// Squirrel startup handler (Windows only — skip on macOS)
try {
  if (require('electron-squirrel-startup')) app.quit();
} catch {}

// Fix PATH for packaged apps — Finder/Dock launch gives a minimal PATH
// that won't include user-installed tools like claude, homebrew, nvm, etc.
// Spawn a login shell to get the full PATH from shell profiles.
const ALLOWED_SHELLS_FOR_PATH = ['/bin/bash', '/bin/zsh', '/bin/sh', '/bin/fish', '/usr/local/bin/fish', '/opt/homebrew/bin/fish'];
try {
  const requestedShell = process.env.SHELL || '/bin/zsh';
  const shell = ALLOWED_SHELLS_FOR_PATH.includes(requestedShell) ? requestedShell : '/bin/zsh';
  const fullPath = execSync(`${shell} -ilc 'echo -n $PATH'`, { encoding: 'utf8', timeout: 5000 });
  if (fullPath) process.env.PATH = fullPath;
} catch {}

const ptyManager = new PtyManager();
registerIpcHandlers(ptyManager);

const createWindow = () => {
  const persisted = loadState();
  const bounds = persisted.windowBounds;

  const mainWindow = new BrowserWindow({
    width: bounds?.width ?? 1200,
    height: bounds?.height ?? 800,
    x: bounds?.x,
    y: bounds?.y,
    backgroundColor: '#f5f5f5',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  ptyManager.setWindow(mainWindow);

  // Prevent the renderer from navigating away from the app
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  // Block window.open() and similar popup attempts
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Kill all ptys before the window is destroyed to avoid "Object has been destroyed" errors
  mainWindow.on('close', () => {
    ptyManager.killAll();
  });

  // Open devtools only in development (not packaged builds)
  if (!app.isPackaged && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};

app.on('ready', () => {
  // Remove default menu to prevent Cmd+P from triggering print dialog
  const menu = Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]);
  Menu.setApplicationMenu(menu);
  createWindow();
});

app.on('window-all-closed', () => {
  ptyManager.killAll();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
