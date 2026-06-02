import React, { useEffect, useRef } from 'react';
import './ChatPanel.css';

const AGENT_COLORS = ['', '#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#f97316'];

function AgentTag({ role, subagentId }) {
  if (role === 'orchestrator') {
    return <span className="chat-tag orchestrator-tag">ORCHESTRATOR</span>;
  }
  if (role === 'subagent') {
    return (
      <span
        className="chat-tag subagent-tag"
        style={{ borderColor: AGENT_COLORS[subagentId] || '#64748b', color: AGENT_COLORS[subagentId] || '#94a3b8' }}
      >
        SUBAGENT {subagentId}
      </span>
    );
  }
  if (role === 'sim') {
    return (
      <span
        className="chat-tag sim-tag"
        style={{ borderColor: AGENT_COLORS[subagentId] || '#64748b' }}
      >
        SIM · AGENT {subagentId}
      </span>
    );
  }
  if (role === 'error') {
    return <span className="chat-tag error-tag">ERROR</span>;
  }
  return null;
}

function SimResultInline({ simulation }) {
  if (!simulation?.success) {
    return (
      <div className="sim-inline failed">
        <div className="sim-inline-header">
          <span className="sim-badge fail">FAILED</span>
        </div>
        <div className="sim-inline-error">{simulation?.error}</div>
      </div>
    );
  }
  const { results, requirements, passed, params } = simulation;
  const reqEntries = Object.entries(requirements || {});
  return (
    <div className={`sim-inline ${passed ? 'passed' : 'failed'}`}>
      <div className="sim-inline-header">
        <span className={`sim-badge ${passed ? 'pass' : 'fail'}`}>
          {passed ? 'PASSED' : 'FAILED'}
        </span>
        <span className="sim-inline-params">
          b={params.wingspan}m · AR={params.aspect_ratio} · {params.airfoil}
        </span>
        <span className="sim-inline-ld">L/D = {results.LD_ratio}</span>
      </div>
      <div className="sim-inline-reqs">
        {reqEntries.map(([key, r]) => (
          <span key={key} className={`req-chip ${r.passed ? 'ok' : 'ng'}`}>
            {r.passed ? '✓' : '✗'} {r.value}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChatMessage({ msg }) {
  const time = new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className={`chat-msg ${msg.role}`}>
      <div className="chat-msg-meta">
        <AgentTag role={msg.role} subagentId={msg.subagentId} />
        <span className="chat-msg-time">{time}</span>
      </div>

      {msg.role === 'sim' ? (
        <SimResultInline simulation={msg.simulation} />
      ) : (
        <div className="chat-msg-text">{msg.text}</div>
      )}
    </div>
  );
}

export default function ChatPanel({ messages, status, mission, onMissionChange }) {
  const bottomRef = useRef(null);
  const running = status === 'running';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-panel">
      <div className="panel-header">
        <span className="panel-title">Agent Activity</span>
        <span className="panel-count">{messages.length} messages</span>
      </div>

      <div className="mission-box">
        <label className="mission-label" htmlFor="mission-input">Mission Prompt</label>
        <textarea
          id="mission-input"
          className="mission-input"
          value={mission}
          onChange={(e) => onMissionChange(e.target.value)}
          disabled={running}
          spellCheck={false}
          rows={7}
        />
        <div className="mission-hint">
          {running
            ? 'Running this brief — editing is locked until the study finishes.'
            : 'Edit the mission brief, then press Run Study. Payload, cruise speed and wingspan limit are read from this text.'}
        </div>
      </div>

      <div className="chat-body">
        {messages.length === 0 && (
          <div className="chat-empty">
            {status === 'idle'
              ? 'Press Run Study to start the multi-agent simulation.'
              : 'Agent starting...'}
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} msg={msg} />
        ))}
        {status === 'running' && (
          <div className="chat-typing">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
