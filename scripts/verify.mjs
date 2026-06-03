// Deterministic proof that the stability fix in openvsp-mock.js works.
// Runs the ACTUAL runSimulation (no LLM) on the 5 initial strategies and
// scans the achievable static-margin envelope across the allowed parameter box.
import { runSimulation } from '../src/agent/openvsp-mock.js';

// Mirror of SUBAGENT_CONFIGS initialParams in orchestrator.js
const CONFIGS = [
  { id: 1, name: 'High-AR',         p: { wingspan: 1.98, aspect_ratio: 11, taper_ratio: 0.45, sweep_angle_deg: 2, airfoil: 'NACA 4412', tail_volume_coeff_h: 0.42, tail_volume_coeff_v: 0.048, cg_position: 0.30 } },
  { id: 2, name: 'Stability-first', p: { wingspan: 1.85, aspect_ratio: 9,  taper_ratio: 0.50, sweep_angle_deg: 3, airfoil: 'NACA 4412', tail_volume_coeff_h: 0.50, tail_volume_coeff_v: 0.062, cg_position: 0.18 } },
  { id: 3, name: 'Low-drag',        p: { wingspan: 1.90, aspect_ratio: 10, taper_ratio: 0.55, sweep_angle_deg: 0, airfoil: 'NACA 2412', tail_volume_coeff_h: 0.43, tail_volume_coeff_v: 0.052, cg_position: 0.32 } },
  { id: 4, name: 'Compact ClarkY',  p: { wingspan: 1.78, aspect_ratio: 8,  taper_ratio: 0.60, sweep_angle_deg: 5, airfoil: 'Clark-Y',   tail_volume_coeff_h: 0.38, tail_volume_coeff_v: 0.044, cg_position: 0.30 } },
  { id: 5, name: 'Exploratory',     p: { wingspan: 2.00, aspect_ratio: 12, taper_ratio: 0.38, sweep_angle_deg: 6, airfoil: 'NACA 4412', tail_volume_coeff_h: 0.36, tail_volume_coeff_v: 0.040, cg_position: 0.40 } },
];

console.log('=== Initial 5 strategies (deterministic, no LLM) ===');
const results = [];
for (const c of CONFIGS) {
  const s = runSimulation(c.p);
  results.push({ id: c.id, name: c.name, sim: s });
  if (!s.success) { console.log(`Agent ${c.id} ${c.name.padEnd(15)} INFEASIBLE — ${s.error}`); continue; }
  const fails = Object.entries(s.requirements).filter(([, v]) => !v.passed).map(([k]) => k).join(',') || '-';
  console.log(
    `Agent ${c.id} ${c.name.padEnd(15)} NP=${s.results.NP_pct}%  CG=${s.results.CG_pct}%  ` +
    `SM=${String(s.results.SM_pct).padStart(5)}%  L/D=${String(s.results.LD_ratio).padStart(5)}  ` +
    `CL=${s.results.CL_cruise}  => ${s.passed ? 'PASS' : 'FAIL [' + fails + ']'}`
  );
}
const passing = results.filter((r) => r.sim.success && r.sim.passed);
console.log(`\nInitial mix: ${passing.length}/5 pass`);

// Winner selection mirrors orchestrator.js: best L/D among fully-passing designs.
const winner = passing.slice().sort((a, b) => b.sim.results.LD_ratio - a.sim.results.LD_ratio)[0] || null;
console.log(
  'Winner (best L/D among passing):',
  winner ? `Agent ${winner.id} ${winner.name} — L/D=${winner.sim.results.LD_ratio}, SM=${winner.sim.results.SM_pct}%` : 'none'
);
console.log('"View 3D Model" button (renders only when winner != null):', winner ? 'WILL SHOW' : 'HIDDEN');
console.log('');

// Achievable static-margin envelope across the allowed parameter box.
let smMin = Infinity, smMax = -Infinity, inWindow = 0, total = 0;
for (let AR = 6; AR <= 13; AR++) {
  for (const Vh of [0.30, 0.40, 0.50, 0.55]) {
    for (const cg of [0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45]) {
      const s = runSimulation({ wingspan: 1.9, aspect_ratio: AR, taper_ratio: 0.5, sweep_angle_deg: 0, airfoil: 'NACA 4412', tail_volume_coeff_h: Vh, tail_volume_coeff_v: 0.05, cg_position: cg });
      if (!s.success) continue;
      total++;
      smMin = Math.min(smMin, s.results.SM_pct);
      smMax = Math.max(smMax, s.results.SM_pct);
      if (s.results.SM_pct >= 5 && s.results.SM_pct <= 25) inWindow++;
    }
  }
}
console.log(`Achievable SM envelope: ${smMin}% .. ${smMax}%  (requirement: 5–25%)`);
console.log(`Parameter combos landing inside 5–25%: ${inWindow}/${total}`);
