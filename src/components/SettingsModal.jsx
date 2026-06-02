import React, { useState } from 'react';

export default function SettingsModal({ keyStatus, onClose, onSave }) {
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  async function handleSave() {
    if (!value.trim()) return;
    setSaving(true);
    await onSave(value);
    setSaving(false);
    setSavedMsg('Saved ✓');
    setValue('');
    setTimeout(() => setSavedMsg(''), 2500);
  }

  async function handleClear() {
    setSaving(true);
    await onSave('');
    setSaving(false);
    setValue('');
    setSavedMsg('Cleared');
    setTimeout(() => setSavedMsg(''), 2500);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Settings</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-body">
          <div className="setting-label">Anthropic API Key</div>

          <div className={`setting-status ${keyStatus?.set ? 'ok' : 'warn'}`}>
            {keyStatus?.set
              ? `Active: ${keyStatus.masked} · source: ${keyStatus.source}${keyStatus.encrypted ? ' · encrypted' : ''}`
              : 'No key set — the agent cannot run until you add one.'}
          </div>

          <div className="key-input-row">
            <input
              type={show ? 'text' : 'password'}
              className="key-input"
              placeholder="sk-ant-..."
              value={value}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button className="key-toggle" onClick={() => setShow((s) => !s)}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>

          <div className="setting-hint">
            Stored locally on this machine
            {keyStatus?.encrypted !== false ? ', encrypted via the OS keychain' : ''}.
            For development you can also set <code>ANTHROPIC_API_KEY</code> in a <code>.env</code> file.
          </div>

          <div className="modal-actions">
            <span className="saved-msg">{savedMsg}</span>
            {keyStatus?.source === 'settings' && (
              <button className="btn-ghost" onClick={handleClear} disabled={saving}>
                Clear
              </button>
            )}
            <button className="btn-secondary" onClick={onClose}>Close</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving || !value.trim()}>
              {saving ? 'Saving…' : 'Save Key'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
