// Ensures the electron binary is present after npm install.
// extract-zip fails silently when the path contains non-ASCII characters (e.g. Cyrillic).
// On Windows we use PowerShell's Expand-Archive which handles Unicode paths correctly.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function findZipInCache(cacheDir, zipName) {
  if (!fs.existsSync(cacheDir)) return null;
  const flat = path.join(cacheDir, zipName);
  if (fs.existsSync(flat)) return flat;
  for (const entry of fs.readdirSync(cacheDir)) {
    const candidate = path.join(cacheDir, entry, zipName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function extractWithPowershell(zipPath, distDir) {
  fs.mkdirSync(distDir, { recursive: true });
  execFileSync('powershell.exe', [
    '-NonInteractive', '-NoProfile', '-Command',
    `Expand-Archive -Path '${zipPath}' -DestinationPath '${distDir}' -Force`,
  ], { stdio: 'inherit' });
}

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

  let zipPath = findZipInCache(cacheDir, zipName);

  if (!zipPath) {
    // No cache — download via install.js
    console.log('[fix-electron] no cache found — downloading via electron/install.js...');
    try {
      execFileSync(process.execPath, ['install.js'], { cwd: electronDir, stdio: 'inherit' });
    } catch { /* extract-zip may fail silently — we check below */ }

    // After install.js, binary may still be missing if extract-zip failed on non-ASCII path.
    // Try to find the freshly downloaded zip and extract with PowerShell.
    if (!fs.existsSync(exePath)) {
      zipPath = findZipInCache(cacheDir, zipName);
    }
  }

  if (fs.existsSync(exePath)) {
    // install.js succeeded on its own
    if (!fs.existsSync(pathTxt)) {
      fs.writeFileSync(pathTxt, Buffer.from(exeRelative));
    }
    console.log(`[fix-electron] OK -> ${exePath}`);
    process.exit(0);
  }

  if (!zipPath) {
    console.error(`[fix-electron] could not find zip ${zipName} in ${cacheDir}`);
    console.error('[fix-electron] check your internet connection and try npm install again.');
    process.exit(1);
  }

  console.log(`[fix-electron] extracting with PowerShell: ${zipPath}`);
  const distDir = path.join(electronDir, 'dist');

  if (platform === 'win32') {
    extractWithPowershell(zipPath, distDir);
  } else {
    const extractZip = require('extract-zip');
    await extractZip(zipPath, { dir: distDir });
  }

  fs.writeFileSync(pathTxt, Buffer.from(exeRelative));
  console.log(`[fix-electron] OK -> ${exePath}`);
})();
