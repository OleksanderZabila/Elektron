// End-to-end proof: runs the REAL orchestrator (same code as the app) with the
// 5 LLM subagents and prints the final pass count + selected winner.
import 'dotenv/config';
import { runOrchestrator } from '../src/agent/orchestrator.js';

(async () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('No ANTHROPIC_API_KEY found in .env');
    process.exit(1);
  }

  let report = null;
  function onEvent(e) {
    if (e.type === 'report_ready') report = e;
    else if (e.type === 'simulation_result') process.stdout.write('.');
    else if (e.type === 'orchestrator_text') console.log(`\n[orchestrator:${e.phase}]`);
    else if (e.type === 'error') console.log('\n[ERROR]', e.message);
  }

  const controller = new AbortController();
  console.log('Running full 5-subagent study (LLM)...');
  await runOrchestrator(onEvent, controller.signal, undefined, apiKey);

  console.log('\n\n=== FINAL REPORT ===');
  if (!report) { console.log('No report produced.'); process.exit(2); }

  let pass = 0;
  for (const s of report.subagentSummaries || []) {
    const ok = s.bestSimulation?.passed;
    if (ok) pass++;
    const sm = s.bestSimulation?.results?.SM_pct;
    const ld = s.bestSimulation?.results?.LD_ratio;
    const cg = s.bestSimulation?.params?.cg_position;
    const tag = s.error ? `ERROR (${s.error})` : ok ? 'PASS' : 'FAIL';
    console.log(`Agent ${s.id}: ${tag}  SM=${sm}%  L/D=${ld}  CG=${cg}  (${s.simCount} sims)`);
  }
  console.log(`\nPASSED: ${pass}/5`);
  console.log(
    'WINNER:',
    report.winner
      ? `Agent ${report.winner.subagentId}  L/D=${report.winner.results?.LD_ratio}  SM=${report.winner.results?.SM_pct}%`
      : 'none'
  );
  console.log('3D "View 3D Model" button (renders only when winner != null):', report.winner ? 'WILL SHOW' : 'HIDDEN');
})();
