// Main-process settings store. Persists the Anthropic API key to the app's
// userData folder so a packaged .exe works without a .env file. The key is
// encrypted with the OS keychain (DPAPI on Windows) when available.

import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readRaw() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeRaw(obj) {
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify(obj, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[settings] write failed:', e);
    return false;
  }
}

function maskKey(k) {
  if (!k) return '';
  if (k.length <= 10) return '••••';
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}

// Returns the decrypted stored key ('' if none).
export function getStoredApiKey() {
  const data = readRaw();
  if (!data.apiKey) return '';
  if (data.apiKeyEnc) {
    try {
      return safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(Buffer.from(data.apiKey, 'base64'))
        : '';
    } catch {
      return '';
    }
  }
  return data.apiKey; // plaintext fallback
}

// Stored key wins; otherwise fall back to .env for development.
export function getEffectiveApiKey() {
  return getStoredApiKey() || process.env.ANTHROPIC_API_KEY || '';
}

export function setApiKey(key) {
  const trimmed = (key || '').trim();
  const data = readRaw();

  if (!trimmed) {
    delete data.apiKey;
    delete data.apiKeyEnc;
  } else if (safeStorage.isEncryptionAvailable()) {
    data.apiKey = safeStorage.encryptString(trimmed).toString('base64');
    data.apiKeyEnc = true;
  } else {
    data.apiKey = trimmed;
    data.apiKeyEnc = false;
  }

  writeRaw(data);
  return getKeyStatus();
}

// Safe summary for the renderer — never exposes the raw key.
export function getKeyStatus() {
  const stored = getStoredApiKey();
  const env = process.env.ANTHROPIC_API_KEY || '';
  const effective = stored || env;
  return {
    set: !!effective,
    source: stored ? 'settings' : env ? 'env' : 'none',
    masked: maskKey(effective),
    encrypted: !!stored && safeStorage.isEncryptionAvailable(),
  };
}
