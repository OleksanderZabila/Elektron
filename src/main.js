import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import dotenv from 'dotenv';
import { runOrchestrator } from './agent/orchestrator.js';

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

ipcMain.handle('agent:start', async () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: 'ANTHROPIC_API_KEY is not set. Create a .env file with your key.' };
  }

  runAbortController = new AbortController();

  try {
    await runOrchestrator(emit, runAbortController.signal);
    return { success: true };
  } catch (err) {
    if (err.name === 'AbortError') return { cancelled: true };
    console.error('[Orchestrator error]', err);
    emit({ type: 'error', message: err.message });
    return { error: err.message };
  } finally {
    runAbortController = null;
  }
});

ipcMain.handle('agent:cancel', () => {
  if (runAbortController) {
    runAbortController.abort();
    runAbortController = null;
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
