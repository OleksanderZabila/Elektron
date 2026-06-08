// One-shot Windows build: ensures the electron binary is present, runs the
// Forge production Vite build + packaging, assembles a runnable app, and drops
// a Desktop shortcut. Designed to work even when:
//   - the project path contains non-ASCII characters (Cyrillic), and
//   - GitHub is slow/unreachable (the 504 that breaks `electron-forge package`).
//
// Usage:  npm run build:win     (or double-click build.bat)

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootNM = path.join(root, 'node_modules');
const electronDir = path.join(rootNM, 'electron');
const distDir = path.join(electronDir, 'dist');

function run(cmd, args, extraEnv = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
}

// ── 1. Make sure electron.exe exists (re-extracts from cache if needed) ────────
console.log('[build] ensuring electron binary...');
run(process.execPath, [path.join(root, 'scripts', 'fix-electron.mjs')]);

if (!fs.existsSync(path.join(distDir, 'electron.exe'))) {
  console.error('[build] electron.exe still missing after fix-electron — aborting.');
  process.exit(1);
}

// ── 2. Forge production Vite build ─────────────────────────────────────────────
// We run `electron-forge package` only for its Vite production build (the
// prePackage hook). Its later "packaging" step calls @electron/get, which fetches
// SHASUMS256.txt from GitHub to verify the runtime — and THAT is what fails with a
// 504 Gateway Time-out (or ECONNREFUSED when GitHub is unreachable).
//
// We don't need that step: assemble.mjs builds the final app itself from the local
// node_modules/electron/dist. So we let Forge run, and if it fails *after* the Vite
// build is on disk, we swallow the error and continue. This makes the build immune
// to network flakiness and to the @electron/packager Node-26 abort bug alike.
const cacheDir = process.env.electron_config_cache ||
  path.join(process.env.LOCALAPPDATA || '', 'electron', 'Cache');
const viteMain = path.join(root, '.vite', 'build', 'main.js');
const viteHtml = path.join(root, '.vite', 'renderer', 'main_window', 'index.html');

const forgeCli = require.resolve('@electron-forge/cli/dist/electron-forge.js');
console.log('[build] running production Vite build via electron-forge...');
try {
  execFileSync(process.execPath, [forgeCli, 'package'], {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...process.env, electron_config_cache: cacheDir },
  });
  console.log('[build] forge package completed.');
} catch (err) {
  if (fs.existsSync(viteMain) && fs.existsSync(viteHtml)) {
    console.log('[build] Forge\'s packaging step failed (network/offline), but the');
    console.log('        production Vite build is complete — continuing with our own');
    console.log('        assembler. This is expected and the result is identical.');
  } else {
    console.error('[build] Production Vite build did not complete. Forge output:\n');
    console.error((err.stdout || '') + '\n' + (err.stderr || ''));
    process.exit(1);
  }
}

// ── 3. Assemble the runnable app (immune to the @electron/packager Node bug) ───
console.log('[build] assembling app...');
run(process.execPath, [path.join(root, 'scripts', 'assemble.mjs')]);

const exePath = path.join(root, 'out', 'openvsp-agent-win32-x64', 'openvsp-agent.exe');
if (!fs.existsSync(exePath)) {
  console.error('[build] expected exe not found:', exePath);
  process.exit(1);
}

// ── 4. Desktop shortcut ────────────────────────────────────────────────────────
console.log('[build] creating Desktop shortcut...');
try {
  const ps = [
    '$ws = New-Object -ComObject WScript.Shell',
    "$desktop = [Environment]::GetFolderPath('Desktop')",
    "$lnk = $ws.CreateShortcut((Join-Path $desktop 'OpenVSP Agent.lnk'))",
    `$lnk.TargetPath = '${exePath}'`,
    `$lnk.WorkingDirectory = '${path.dirname(exePath)}'`,
    `$lnk.IconLocation = '${exePath},0'`,
    "$lnk.Description = 'OpenVSP Agent'",
    '$lnk.Save()',
  ].join('; ');
  execFileSync('powershell.exe', ['-NonInteractive', '-NoProfile', '-Command', ps], { stdio: 'inherit' });
  console.log('[build] shortcut created on Desktop: "OpenVSP Agent"');
} catch (err) {
  console.warn('[build] could not create Desktop shortcut:', err.message);
}

console.log(`\n✅ DONE`);
console.log(`   App:      ${exePath}`);
console.log(`   Shortcut: Desktop \\ OpenVSP Agent`);
console.log(`   Run it from the Desktop shortcut, or double-click the exe above.`);
