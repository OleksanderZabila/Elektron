import React, { useState, useEffect, useRef } from 'react';
import ChatPanel from './components/ChatPanel.jsx';
import ReportPanel from './components/ReportPanel.jsx';

export default function App() {
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [messages, setMessages] = useState([]);
  const [simulations, setSimulations] = useState([]);
  const [subagentSummaries, setSubagentSummaries] = useState([]);
  const [report, setReport] = useState(null);
  const msgIdRef = useRef(0);

  const nextId = () => ++msgIdRef.current;

  useEffect(() => {
    const unsub = window.electronAPI.onAgentEvent((event) => {
      handleEvent(event);
    });
    return unsub;
  }, []);

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
        break;

      case 'error':
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: 'error', text: event.message, ts: Date.now() },
        ]);
        setStatus('error');
        break;

      default:
        break;
    }
  }

  async function handleRun() {
    if (status === 'running') {
      await window.electronAPI.cancelAgent();
      setStatus('idle');
      return;
    }
    setStatus('running');
    setMessages([]);
    setSimulations([]);
    setSubagentSummaries([]);
    setReport(null);
    msgIdRef.current = 0;

    const result = await window.electronAPI.startAgent();
    if (result?.error) {
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
            <div className="app-title">OpenVSP Agent</div>
            <div className="app-subtitle">AI-driven aerodynamic design study</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="status-pill">
            <div className={`status-dot ${status}`} />
            <span>{statusLabel}</span>
          </div>
          <button className={`btn-run ${status}`} onClick={handleRun}>
            {btnLabel}
          </button>
        </div>
      </header>

      <div className="app-body">
        <ChatPanel messages={messages} status={status} />
        <ReportPanel
          report={report}
          simulations={simulations}
          subagentSummaries={subagentSummaries}
          status={status}
        />
      </div>
    </div>
  );
}
