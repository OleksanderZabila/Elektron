// Ensures the electron binary is present after npm install.
// extract-zip fails silently when the path contains non-ASCII characters;
// on Windows we fall back to PowerShell's Expand-Archive which handles it correctly.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

(async () => {
  const electronDir = path.dirname(require.resolve('electron/package.json'));
  const { version } = JSON.parse(fs.readFileSync(path.join(electronDir, 'package.json'), 'utf8'));

  const platform = process.platform;
  const exeRelative = platform === 'win32' ? 'electron.exe'
    : platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron'
    : 'electron';
  const exePath = path.join(electronDir, 'dist', exeRelative.split('/')[0]);
  const pathTxt = path.join(electronDir, 'path.txt');

  if (fs.existsSync(exePath)) {
    process.exit(0);
  }

  console.log('[fix-electron] electron binary missing — extracting from cache...');

  const arch = process.arch;
  const zipName = `electron-v${version}-${platform}-${arch}.zip`;

  const cacheDir = process.env.electron_config_cache ||
    (platform === 'win32'
      ? path.join(process.env.LOCALAPPDATA || '', 'electron', 'Cache')
      : path.join(process.env.HOME || '', '.cache', 'electron'));

  let zipPath = null;
  if (fs.existsSync(cacheDir)) {
    const flat = path.join(cacheDir, zipName);
    if (fs.existsSync(flat)) {
      zipPath = flat;
    } else {
      for (const entry of fs.readdirSync(cacheDir)) {
        const candidate = path.join(cacheDir, entry, zipName);
        if (fs.existsSync(candidate)) { zipPath = candidate; break; }
      }
    }
  }

  if (!zipPath) {
    console.log('[fix-electron] no cached zip — running electron/install.js...');
    try {
      execFileSync(process.execPath, ['install.js'], { cwd: electronDir, stdio: 'inherit' });
    } catch {
      console.error('[fix-electron] failed. Try: node node_modules/electron/install.js');
      process.exit(1);
    }
    process.exit(0);
  }

  console.log(`[fix-electron] found: ${zipPath}`);
  const distDir = path.join(electronDir, 'dist');
  fs.mkdirSync(distDir, { recursive: true });

  if (platform === 'win32') {
    // extract-zip fails with non-ASCII paths on Windows; use PowerShell instead
    execFileSync('powershell.exe', [
      '-NonInteractive', '-NoProfile', '-Command',
      `Expand-Archive -Path '${zipPath}' -DestinationPath '${distDir}' -Force`,
    ], { stdio: 'inherit' });
  } else {
    const extractZip = require('extract-zip');
    await extractZip(zipPath, { dir: distDir });
  }

  fs.writeFileSync(pathTxt, Buffer.from(exeRelative));
  console.log(`[fix-electron] OK -> ${exePath}`);
})();
