import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import dotenv from 'dotenv';
import { runOrchestrator } from './agent/orchestrator.js';
import { getEffectiveApiKey, getKeyStatus, setApiKey } from './settings.js';

dotenv.config();

if (started) app.quit();

let mainWindow = null;
let runAbortController = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'OpenVSP Agent',
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
}

function emit(event) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agent:event', event);
  }
}

ipcMain.handle('agent:start', async (_event, missionText) => {
  // W1: main process is authoritative — never run two studies at once.
  if (runAbortController) {
    return { error: 'A study is already running.' };
  }

  const apiKey = getEffectiveApiKey();
  if (!apiKey) {
    return { error: 'No Anthropic API key found. Add it in Settings (gear icon) or a .env file.' };
  }

  const controller = new AbortController();
  runAbortController = controller;

  try {
    await runOrchestrator(emit, controller.signal, missionText, apiKey);
    return { success: true };
  } catch (err) {
    if (controller.signal.aborted || err.name === 'AbortError') return { cancelled: true };
    console.error('[Orchestrator error]', err);
    // Surface once, via the IPC return value (handled in the renderer). No emit
    // here — emitting *and* returning produced duplicate error bubbles.
    return { error: err.message };
  } finally {
    // Only clear the global if it still points to *this* run (cancel→rerun safe).
    if (runAbortController === controller) runAbortController = null;
  }
});

ipcMain.handle('agent:cancel', () => {
  if (runAbortController) {
    runAbortController.abort();
    runAbortController = null;
  }
});

// ── Settings (API key) ───────────────────────────────────────────────────────
ipcMain.handle('settings:getKeyStatus', () => getKeyStatus());
ipcMain.handle('settings:setApiKey', (_event, key) => setApiKey(key));

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
