import React from 'react';
import SimCard from './SimCard.jsx';
import { LDBarChart, DragPolarChart, WingspanLDScatter, RadarCompare } from './Charts.jsx';
import './ReportPanel.css';

function ChartBlock({ title, children }) {
  return (
    <div className="chart-block">
      <div className="chart-title">{title}</div>
      {children}
    </div>
  );
}

function EmptyState({ status }) {
  if (status === 'idle') {
    return (
      <div className="report-empty">
        <div className="report-empty-icon">✈</div>
        <div className="report-empty-title">Ready to design</div>
        <div className="report-empty-body">
          Press <strong>Run Study</strong> to launch 5 parallel AI subagents.<br />
          Each agent will test different wing configurations and report back.
        </div>
      </div>
    );
  }
  return (
    <div className="report-empty">
      <div className="report-empty-icon spin">⟳</div>
      <div className="report-empty-title">Simulations running...</div>
      <div className="report-empty-body">
        Results will appear here as subagents complete their studies.
      </div>
    </div>
  );
}

export default function ReportPanel({ report, simulations, subagentSummaries, status }) {
  const hasData = subagentSummaries.length > 0;
  const winnerId = report?.winner?.subagentId ?? null;

  if (!hasData && status !== 'done') {
    return (
      <div className="report-panel">
        <div className="panel-header">
          <span className="panel-title">Simulation Report</span>
        </div>
        <EmptyState status={status} />
      </div>
    );
  }

  const winnerSim = report?.winner ?? null;
  const passingCount = subagentSummaries.filter((s) => s.bestSimulation?.passed).length;

  return (
    <div className="report-panel">
      <div className="panel-header">
        <span className="panel-title">Simulation Report</span>
        <span className="panel-count">
          {passingCount}/{subagentSummaries.length} designs passed
        </span>
      </div>

      <div className="report-body">

        {/* ── Summary bar ──────────────────────────────────────────────────── */}
        {winnerSim && (
          <div className="winner-banner">
            <div className="winner-banner-left">
              <span className="winner-label">★ SELECTED DESIGN</span>
              <span className="winner-subagent">Agent {winnerSim.subagentId}</span>
            </div>
            <div className="winner-metrics">
              <div className="winner-metric">
                <span className="wm-val">{winnerSim.results?.LD_ratio}</span>
                <span className="wm-lbl">L/D</span>
              </div>
              <div className="winner-metric">
                <span className="wm-val">{winnerSim.params?.wingspan} m</span>
                <span className="wm-lbl">Wingspan</span>
              </div>
              <div className="winner-metric">
                <span className="wm-val">{winnerSim.results?.SM_pct}%</span>
                <span className="wm-lbl">Static Margin</span>
              </div>
              <div className="winner-metric">
                <span className="wm-val">{winnerSim.results?.power_W} W</span>
                <span className="wm-lbl">Cruise Power</span>
              </div>
              <div className="winner-metric">
                <span className="wm-val">{winnerSim.params?.airfoil}</span>
                <span className="wm-lbl">Airfoil</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Charts ───────────────────────────────────────────────────────── */}
        <div className="charts-section">
          <div className="charts-row">
            <ChartBlock title="L/D Ratio — Design Comparison">
              <LDBarChart subagentSummaries={subagentSummaries} winnerId={winnerId} />
            </ChartBlock>
            <ChartBlock title="Wingspan vs L/D Trade-off">
              <WingspanLDScatter subagentSummaries={subagentSummaries} winnerId={winnerId} />
            </ChartBlock>
          </div>
          <div className="charts-row">
            <ChartBlock title={`Drag Polar — Winner (Agent ${winnerId ?? '?'})`}>
              <DragPolarChart winnerSim={winnerSim} />
            </ChartBlock>
            <ChartBlock title="Multi-Criteria Radar">
              <RadarCompare subagentSummaries={subagentSummaries} />
            </ChartBlock>
          </div>
        </div>

        {/* ── Synthesis ────────────────────────────────────────────────────── */}
        {report?.synthesis && (
          <div className="synthesis-block">
            <div className="synthesis-title">Chief Engineer Analysis</div>
            <div className="synthesis-text">{report.synthesis}</div>
          </div>
        )}

        {/* ── Design cards ─────────────────────────────────────────────────── */}
        <div className="cards-section-title">All Explored Designs</div>
        <div className="cards-grid">
          {subagentSummaries
            .slice()
            .sort((a, b) => {
              const aLD = a.bestSimulation?.results?.LD_ratio ?? -1;
              const bLD = b.bestSimulation?.results?.LD_ratio ?? -1;
              return bLD - aLD;
            })
            .map((s) => (
              <SimCard key={s.id} summary={s} isWinner={s.id === winnerId} />
            ))}
        </div>
      </div>
    </div>
  );
}
