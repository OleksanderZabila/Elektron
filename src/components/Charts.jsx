import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
  ScatterChart, Scatter, ZAxis,
  LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend,
} from 'recharts';
import { generateDragPolar } from '../agent/openvsp-mock.js';

const AGENT_COLORS = ['', '#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#f97316'];
const CHART_STYLE = { background: 'transparent', fontSize: 11, fontFamily: 'inherit' };
const AXIS_STYLE = { fill: '#94a3b8', fontSize: 11 };
const GRID_COLOR = '#2d3548';
const TT_STYLE = {
  backgroundColor: '#1e2537',
  border: '1px solid #2d3548',
  borderRadius: 6,
  fontSize: 11,
  color: '#f1f5f9',
};

// ── L/D Bar Chart ─────────────────────────────────────────────────────────────
export function LDBarChart({ subagentSummaries, winnerId }) {
  const data = subagentSummaries
    .filter((s) => s.bestSimulation?.success)
    .map((s) => ({
      name: `Agent ${s.id}`,
      id: s.id,
      LD: s.bestSimulation.results.LD_ratio,
      passed: s.bestSimulation.passed,
    }))
    .sort((a, b) => b.LD - a.LD);

  if (!data.length) return <EmptyChart text="No simulation data yet" />;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="name" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
        <Tooltip contentStyle={TT_STYLE} formatter={(v) => [v.toFixed(2), 'L/D']} />
        <ReferenceLine y={12} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Min req.', fill: '#ef4444', fontSize: 10, position: 'right' }} />
        <Bar dataKey="LD" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.id}
              fill={entry.id === winnerId ? '#22c55e' : entry.passed ? AGENT_COLORS[entry.id] : '#374151'}
              opacity={entry.passed ? 1 : 0.5}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Drag Polar (CL vs CD) for winner ──────────────────────────────────────────
export function DragPolarChart({ winnerSim }) {
  if (!winnerSim?.success) return <EmptyChart text="Run study to see drag polar" />;

  const polarData = generateDragPolar(winnerSim);
  const cruisePt = { CL: winnerSim.results.CL_cruise, CD: winnerSim.results.CD_total };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={polarData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis dataKey="CD" tick={AXIS_STYLE} axisLine={false} tickLine={false}
          label={{ value: 'CD', position: 'insideBottom', offset: -2, fill: '#94a3b8', fontSize: 10 }}
          tickFormatter={(v) => v.toFixed(4)} />
        <YAxis dataKey="CL" tick={AXIS_STYLE} axisLine={false} tickLine={false}
          label={{ value: 'CL', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }} />
        <Tooltip contentStyle={TT_STYLE}
          formatter={(v, name) => [typeof v === 'number' ? v.toFixed(4) : v, name]} />
        <Line type="monotone" dataKey="CL" stroke="#3b82f6" dot={false} strokeWidth={2} />
        {/* cruise point marker */}
        <ReferenceLine x={cruisePt.CD} stroke="#22c55e" strokeDasharray="4 4" />
        <ReferenceLine y={cruisePt.CL} stroke="#22c55e" strokeDasharray="4 4"
          label={{ value: 'Cruise', fill: '#22c55e', fontSize: 10, position: 'right' }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Scatter: Wingspan vs L/D ──────────────────────────────────────────────────
export function WingspanLDScatter({ subagentSummaries, winnerId }) {
  const allPoints = subagentSummaries.flatMap((s) =>
    s.bestSimulation?.success
      ? [{
          x: s.bestSimulation.params.wingspan,
          y: s.bestSimulation.results.LD_ratio,
          id: s.id,
          passed: s.bestSimulation.passed,
          AR: s.bestSimulation.params.aspect_ratio,
        }]
      : []
  );

  if (!allPoints.length) return <EmptyChart text="No data yet" />;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ScatterChart margin={{ top: 4, right: 12, left: 0, bottom: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis type="number" dataKey="x" name="Wingspan" tick={AXIS_STYLE} axisLine={false}
          tickLine={false} domain={[1.4, 2.1]}
          label={{ value: 'Wingspan (m)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 10 }} />
        <YAxis type="number" dataKey="y" name="L/D" tick={AXIS_STYLE} axisLine={false} tickLine={false}
          label={{ value: 'L/D', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }} />
        <ZAxis range={[60, 60]} />
        <Tooltip contentStyle={TT_STYLE}
          formatter={(v, name) => [typeof v === 'number' ? v.toFixed(3) : v, name]} />
        {allPoints.map((pt) => (
          <Scatter
            key={pt.id}
            name={`Agent ${pt.id}`}
            data={[pt]}
            fill={pt.id === winnerId ? '#22c55e' : pt.passed ? AGENT_COLORS[pt.id] : '#374151'}
            opacity={pt.passed ? 1 : 0.5}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ── Radar: Multi-criteria comparison ─────────────────────────────────────────
export function RadarCompare({ subagentSummaries }) {
  const passing = subagentSummaries.filter((s) => s.bestSimulation?.success && s.bestSimulation?.passed);
  if (passing.length < 2) return <EmptyChart text="Need ≥ 2 passing designs for radar" />;

  // Normalise each metric to 0–100
  const all = passing.map((s) => s.bestSimulation.results);
  const norm = (val, key, invert = false) => {
    const vals = all.map((r) => r[key]);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    if (mx === mn) return 50;
    const n = ((val - mn) / (mx - mn)) * 100;
    return invert ? 100 - n : n;
  };

  const metrics = ['L/D', 'CL', 'e', 'SM', 'Cnβ'];

  const radarData = metrics.map((m) => {
    const entry = { metric: m };
    passing.forEach((s) => {
      const r = s.bestSimulation.results;
      const val =
        m === 'L/D' ? norm(r.LD_ratio, 'LD_ratio') :
        m === 'CL'  ? norm(r.CL_cruise, 'CL_cruise', true) : // lower CL_cruise = more margin from stall
        m === 'e'   ? norm(r.e_oswald, 'e_oswald') :
        m === 'SM'  ? Math.min(100, Math.abs(r.SM_pct - 12) < 5 ? 90 : 60) :
        norm(r.Cnbeta, 'Cnbeta');
      entry[`Agent ${s.id}`] = Math.round(val);
    });
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadarChart data={radarData} margin={{ top: 4, right: 20, left: 20, bottom: 4 }}>
        <PolarGrid stroke={GRID_COLOR} />
        <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
        {passing.map((s) => (
          <Radar
            key={s.id}
            name={`Agent ${s.id}`}
            dataKey={`Agent ${s.id}`}
            stroke={AGENT_COLORS[s.id]}
            fill={AGENT_COLORS[s.id]}
            fillOpacity={0.12}
            strokeWidth={2}
          />
        ))}
        <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Tooltip contentStyle={TT_STYLE} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ text }) {
  return (
    <div style={{
      height: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#64748b',
      fontSize: 12,
      border: '1px dashed #2d3548',
      borderRadius: 8,
    }}>
      {text}
    </div>
  );
}
