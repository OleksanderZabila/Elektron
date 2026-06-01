import React from 'react';
import './SimCard.css';

const AGENT_COLORS = ['', '#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#f97316'];

function MetricRow({ label, value, unit = '' }) {
  return (
    <div className="sc-metric">
      <span className="sc-metric-label">{label}</span>
      <span className="sc-metric-value">{value}<span className="sc-metric-unit">{unit}</span></span>
    </div>
  );
}

function ReqRow({ label, req }) {
  if (!req) return null;
  return (
    <div className={`sc-req ${req.passed ? 'pass' : 'fail'}`}>
      <span className="sc-req-icon">{req.passed ? '✓' : '✗'}</span>
      <span className="sc-req-label">{label}</span>
      <span className="sc-req-value">{req.value}</span>
    </div>
  );
}

export default function SimCard({ summary, isWinner }) {
  const { id, focus, bestSimulation: sim, simCount } = summary;

  const color = AGENT_COLORS[id] || '#64748b';

  if (!sim?.success) {
    return (
      <div className="sim-card failed" style={{ borderTopColor: color }}>
        <div className="sc-header">
          <span className="sc-agent-label" style={{ color }}>AGENT {id}</span>
          <span className="sc-status-badge fail">NO VALID DESIGN</span>
        </div>
        <div className="sc-focus">{focus}</div>
        <div className="sc-error">{sim?.error || 'No successful simulation.'}</div>
      </div>
    );
  }

  const { results, requirements, params, passed } = sim;

  return (
    <div className={`sim-card ${passed ? 'passed' : 'failed'} ${isWinner ? 'winner' : ''}`}
      style={{ borderTopColor: isWinner ? '#22c55e' : color }}>

      <div className="sc-header">
        <span className="sc-agent-label" style={{ color: isWinner ? '#22c55e' : color }}>
          AGENT {id}
        </span>
        {isWinner && <span className="sc-winner-crown">★ WINNER</span>}
        <span className={`sc-status-badge ${passed ? 'pass' : 'fail'}`}>
          {passed ? 'ALL PASS' : 'REQ FAILED'}
        </span>
        <span className="sc-sim-count">{simCount} sim{simCount !== 1 ? 's' : ''}</span>
      </div>

      <div className="sc-focus">{focus}</div>

      <div className="sc-params">
        <span>b = {params.wingspan} m</span>
        <span>AR = {params.aspect_ratio}</span>
        <span>λ = {params.taper_ratio}</span>
        <span>Λ = {params.sweep_angle_deg}°</span>
        <span>{params.airfoil}</span>
        <span>Vh = {params.tail_volume_coeff_h}</span>
        <span>Vv = {params.tail_volume_coeff_v}</span>
      </div>

      <div className="sc-divider" />

      <div className="sc-metrics-grid">
        <MetricRow label="L/D" value={results.LD_ratio} />
        <MetricRow label="CL cruise" value={results.CL_cruise} />
        <MetricRow label="CD total" value={results.CD_total} />
        <MetricRow label="CD₀" value={results.CD_0} />
        <MetricRow label="CD_i" value={results.CD_induced} />
        <MetricRow label="Oswald e" value={results.e_oswald} />
        <MetricRow label="Static margin" value={results.SM_pct} unit="% MAC" />
        <MetricRow label="Cnβ" value={results.Cnbeta} />
        <MetricRow label="Power" value={results.power_W} unit=" W" />
        <MetricRow label="Wing area" value={results.S_wing_m2} unit=" m²" />
        <MetricRow label="MAC" value={results.MAC_m} unit=" m" />
        <MetricRow label="c_root" value={results.c_root_m} unit=" m" />
      </div>

      <div className="sc-divider" />

      <div className="sc-reqs">
        <ReqRow label="Wingspan" req={requirements?.wingspan} />
        <ReqRow label="L/D ≥ 12" req={requirements?.ld_ratio} />
        <ReqRow label="Long. stability" req={requirements?.long_stab} />
        <ReqRow label="Dir. stability" req={requirements?.dir_stab} />
        <ReqRow label="Lat. stability" req={requirements?.lat_stab} />
        <ReqRow label="CL feasibility" req={requirements?.cl_valid} />
      </div>
    </div>
  );
}
