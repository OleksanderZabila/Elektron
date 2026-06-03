import React, { useState, useEffect, useRef } from 'react';
import ChatPanel from './components/ChatPanel.jsx';
import ReportPanel from './components/ReportPanel.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { DEFAULT_MISSION } from './agent/mission.js';

export default function App() {
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [messages, setMessages] = useState([]);
  const [simulations, setSimulations] = useState([]);
  const [subagentSummaries, setSubagentSummaries] = useState([]);
  const [report, setReport] = useState(null);
  const [mission, setMission] = useState(DEFAULT_MISSION);
  const [showSettings, setShowSettings] = useState(false);
  const [keyStatus, setKeyStatus] = useState(null);
  const msgIdRef = useRef(0);
  const busyRef = useRef(false); // W2: guards against double-start within a tick

  const nextId = () => ++msgIdRef.current;

  function resetStudy() {
    setMessages([]);
    setSimulations([]);
    setSubagentSummaries([]);
    setReport(null);
    msgIdRef.current = 0;
  }

  useEffect(() => {
    const unsub = window.electronAPI.onAgentEvent((event) => {
      handleEvent(event);
    });
    window.electronAPI.getKeyStatus().then(setKeyStatus);
    return unsub;
  }, []);

  async function handleSaveKey(key) {
    const status = await window.electronAPI.setApiKey(key);
    setKeyStatus(status);
  }

  function handleEvent(event) {
    switch (event.type) {
      case 'orchestrator_text':
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'orchestrator',
            phase: event.phase,
            text: event.text,
            ts: Date.now(),
          },
        ]);
        break;

      case 'subagent_text':
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'subagent',
            subagentId: event.subagentId,
            text: event.text,
            ts: Date.now(),
          },
        ]);
        break;

      case 'simulation_result':
        setSimulations((prev) => [...prev, { ...event.simulation, subagentId: event.subagentId }]);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'sim',
            subagentId: event.subagentId,
            simulation: event.simulation,
            ts: Date.now(),
          },
        ]);
        break;

      case 'report_ready':
        setReport(event);
        setSubagentSummaries(event.subagentSummaries || []);
        setStatus('done');
        busyRef.current = false;
        break;

      case 'error':
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: 'error', text: event.message, ts: Date.now() },
        ]);
        setStatus('error');
        busyRef.current = false;
        break;

      default:
        break;
    }
  }

  async function handleRun() {
    if (status === 'running') {
      // W3: cancel returns to a clean, consistent state (both panels agree).
      await window.electronAPI.cancelAgent();
      busyRef.current = false;
      resetStudy();
      setStatus('idle');
      return;
    }
    // W2: block a second synchronous start before `status` has committed.
    if (busyRef.current) return;
    // Can't run without a key — open Settings instead of failing silently.
    if (!keyStatus?.set) {
      setShowSettings(true);
      return;
    }

    busyRef.current = true;
    resetStudy();
    setStatus('running');

    const result = await window.electronAPI.startAgent(mission);
    if (result?.error) {
      busyRef.current = false;
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'error', text: result.error, ts: Date.now() },
      ]);
      setStatus('error');
    }
  }

  const statusLabel =
    status === 'idle' ? 'Ready' :
    status === 'running' ? 'Simulating...' :
    status === 'done' ? 'Study complete' : 'Error';

  const btnLabel =
    status === 'running' ? 'Cancel' :
    status === 'done' ? 'Run Again' : 'Run Study';

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo">✈</div>
          <div>
            <div className="app-title">
              OpenVSP Agent <span className="app-version">v{__APP_VERSION__}</span>
            </div>
            <div className="app-subtitle">AI-driven aerodynamic design study</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="status-pill">
            <div className={`status-dot ${status}`} />
            <span>{statusLabel}</span>
          </div>
          {keyStatus && !keyStatus.set && (
            <span className="key-warning" title="No API key set">⚠ No API key</span>
          )}
          <button
            className="btn-icon"
            onClick={() => setShowSettings(true)}
            title="Settings"
            aria-label="Settings"
          >
            ⚙
          </button>
          <button className={`btn-run ${status}`} onClick={handleRun}>
            {btnLabel}
          </button>
        </div>
      </header>

      <div className="app-body">
        <ChatPanel
          messages={messages}
          status={status}
          mission={mission}
          onMissionChange={setMission}
        />
        <ReportPanel
          report={report}
          simulations={simulations}
          subagentSummaries={subagentSummaries}
          status={status}
        />
      </div>

      {showSettings && (
        <SettingsModal
          keyStatus={keyStatus}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveKey}
        />
      )}
    </div>
  );
}
