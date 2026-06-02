import Anthropic from '@anthropic-ai/sdk';
import { runSubagent } from './subagent.js';
import { parseMission, DEFAULT_MISSION } from './mission.js';

// Five distinct design strategies for the parallel search
const SUBAGENT_CONFIGS = [
  {
    id: 1,
    focus: 'High aspect ratio — minimize induced drag for maximum L/D efficiency.',
    initialParams: {
      wingspan: 1.98, aspect_ratio: 11, taper_ratio: 0.45, sweep_angle_deg: 2,
      airfoil: 'NACA 4412', tail_volume_coeff_h: 0.42, tail_volume_coeff_v: 0.048,
    },
  },
  {
    id: 2,
    focus: 'Stability-first — generous tail volume for robust longitudinal and directional margins.',
    initialParams: {
      wingspan: 1.85, aspect_ratio: 9, taper_ratio: 0.50, sweep_angle_deg: 3,
      airfoil: 'NACA 4412', tail_volume_coeff_h: 0.50, tail_volume_coeff_v: 0.062,
    },
  },
  {
    id: 3,
    focus: 'Low parasite drag — NACA 2412 profile, moderate AR, zero sweep.',
    initialParams: {
      wingspan: 1.90, aspect_ratio: 10, taper_ratio: 0.55, sweep_angle_deg: 0,
      airfoil: 'NACA 2412', tail_volume_coeff_h: 0.43, tail_volume_coeff_v: 0.052,
    },
  },
  {
    id: 4,
    focus: 'Compact efficient design — Clark-Y airfoil, moderate span, balanced trade-offs.',
    initialParams: {
      wingspan: 1.78, aspect_ratio: 8, taper_ratio: 0.60, sweep_angle_deg: 5,
      airfoil: 'Clark-Y', tail_volume_coeff_h: 0.38, tail_volume_coeff_v: 0.044,
    },
  },
  {
    id: 5,
    focus: 'Exploratory — push wingspan to limit with very high AR; find unconventional optimum.',
    initialParams: {
      wingspan: 2.00, aspect_ratio: 12, taper_ratio: 0.38, sweep_angle_deg: 6,
      airfoil: 'NACA 4412', tail_volume_coeff_h: 0.36, tail_volume_coeff_v: 0.040,
    },
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runOrchestrator(onEvent, signal, missionText, apiKey) {
  const client = new Anthropic({ apiKey });
  const brief = (missionText && missionText.trim()) || DEFAULT_MISSION;
  const mission = parseMission(brief);

  // ── Phase 1: Strategy ──────────────────────────────────────────────────────
  onEvent({
    type: 'orchestrator_text',
    phase: 'init',
    text:
      'Executing mission brief:\n\n' +
      brief +
      '\n\nParsed targets → payload ' + mission.payloadKg + ' kg · cruise ' +
      mission.cruiseMs + ' m/s · wingspan ≤ ' + mission.wingspanLimit +
      ' m · maximize L/D · stability: SM 5–25% MAC, Cnβ > 0, Clβ < 0.',
  });

  await sleep(200);

  if (signal?.aborted) return;

  const strategyRes = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content:
          'You are orchestrating a 5-agent parallel UAV design study.\n\n' +
          'Mission brief from the user:\n' + brief + '\n\n' +
          `Parsed constraints: payload ${mission.payloadKg} kg, cruise ${mission.cruiseMs} m/s, ` +
          `wingspan ≤ ${mission.wingspanLimit} m, maximize L/D.\n\n` +
          'The five subagents focus on:\n' +
          '1. High AR efficiency (AR≈11, NACA 4412)\n' +
          '2. Stability-first (generous tail, AR≈9)\n' +
          '3. Low parasite drag (NACA 2412, zero sweep)\n' +
          '4. Compact Clark-Y design (AR≈8)\n' +
          '5. Exploratory high AR at wingspan limit (AR≈12)\n\n' +
          'In 3–4 sentences, explain why this multi-strategy search is the right approach ' +
          'and what aerodynamic trade-off each strategy is probing.',
      },
    ],
  });

  onEvent({
    type: 'orchestrator_text',
    phase: 'strategy',
    text: strategyRes.content[0].text,
  });

  await sleep(150);

  onEvent({
    type: 'orchestrator_text',
    phase: 'launch',
    text: 'Launching 5 subagents in parallel...',
  });

  if (signal?.aborted) return;

  // ── Phase 2: Parallel subagents ────────────────────────────────────────────
  const subagentPromises = SUBAGENT_CONFIGS.map((cfg) =>
    runSubagent({
      id: cfg.id,
      focus: cfg.focus,
      initialParams: cfg.initialParams,
      onProgress: onEvent,
      signal,
      missionText: brief,
      mission,
      apiKey,
    })
  );

  const results = await Promise.all(subagentPromises);

  if (signal?.aborted) return;

  onEvent({
    type: 'orchestrator_text',
    phase: 'synthesis',
    text: 'All subagents finished. Synthesizing results and selecting best design...',
  });

  // ── Phase 3: Synthesis ─────────────────────────────────────────────────────
  const summaries = results
    .map((r) => {
      const b = r.bestSimulation;
      if (!b?.success) return `Subagent ${r.id}: no valid design found.`;
      return (
        `Subagent ${r.id} (${r.focus})\n` +
        `  Best params: wingspan=${b.params.wingspan}m, AR=${b.params.aspect_ratio}, ` +
        `taper=${b.params.taper_ratio}, sweep=${b.params.sweep_angle_deg}°, ` +
        `airfoil=${b.params.airfoil}, Vh=${b.params.tail_volume_coeff_h}, Vv=${b.params.tail_volume_coeff_v}\n` +
        `  Results: L/D=${b.results.LD_ratio}, CL=${b.results.CL_cruise}, CD=${b.results.CD_total}, ` +
        `SM=${b.results.SM_pct}% MAC, Cnβ=${b.results.Cnbeta}, power=${b.results.power_W}W\n` +
        `  All requirements passed: ${b.passed}`
      );
    })
    .join('\n\n');

  const synthesisRes = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 900,
    messages: [
      {
        role: 'user',
        content:
          'You are the chief aerodynamics engineer reviewing results from 5 parallel UAV design subagents.\n\n' +
          `Requirements: payload ${mission.payloadKg} kg, cruise ${mission.cruiseMs} m/s, ` +
          `wingspan ≤ ${mission.wingspanLimit} m, maximize L/D, ` +
          'longitudinal SM 5–25% MAC, Cnβ > 0, Clβ < 0.\n\n' +
          `Subagent results:\n${summaries}\n\n` +
          'Please:\n' +
          '1. State which design wins and why (cite L/D and stability numbers).\n' +
          '2. Rank the other designs (Runner-up, Acceptable, or Failed — with reason).\n' +
          '3. Identify the key aerodynamic trade-off that separates the winner from the rest.\n' +
          '4. Note any design recommendation for future refinement.\n\n' +
          'Keep it concise and engineering-focused.',
      },
    ],
  });

  const synthesisText = synthesisRes.content[0].text;

  onEvent({
    type: 'orchestrator_text',
    phase: 'conclusion',
    text: synthesisText,
  });

  // Determine winner: best L/D among fully passing designs
  const winner = results
    .filter((r) => r.bestSimulation?.passed)
    .sort((a, b) => b.bestSimulation.results.LD_ratio - a.bestSimulation.results.LD_ratio)[0] || null;

  // All simulation results flattened for charts
  const allSimulations = results.flatMap((r) =>
    r.simulations.map((s) => ({
      ...s,
      subagentId: r.id,
      isBestOfAgent: s === r.bestSimulation,
    }))
  );

  onEvent({
    type: 'report_ready',
    winner: winner
      ? { subagentId: winner.id, focus: winner.focus, ...winner.bestSimulation }
      : null,
    subagentSummaries: results.map((r) => ({
      id: r.id,
      focus: r.focus,
      bestSimulation: r.bestSimulation,
      finalAnalysis: r.finalAnalysis,
      simCount: r.simulations.length,
    })),
    allSimulations,
    synthesis: synthesisText,
  });
}
