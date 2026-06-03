import Anthropic from '@anthropic-ai/sdk';
import { runSimulation } from './openvsp-mock.js';
import { simulationTool } from './tools.js';

const MAX_TOOL_ROUNDS = 5;
const MAX_RETRIES = 4; // SDK retries 429/500/timeouts with backoff + honors retry-after

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSystemPrompt(id, focus, missionText, mission) {
  return `You are Subagent ${id} in a parallel multi-agent UAV design study.

MISSION BRIEF (verbatim from the user):
${missionText}

Quantitative constraints parsed from the brief:
• Payload: ${mission.payloadKg} kg
• Cruise speed: ${mission.cruiseMs} m/s
• Wingspan HARD LIMIT: ≤ ${mission.wingspanLimit} m
• Maximize L/D (Lift-to-Drag) ratio
• Longitudinally stable: static margin 5–25% MAC
• Directionally stable: Cnβ > 0
• Laterally stable: Clβ < 0

Longitudinal balance: static margin SM = NP − cg_position. Your two levers are cg_position
(move it forward = larger SM, but that adds trim drag and costs L/D) and tail_volume_coeff_h
(a bigger tail pushes the neutral point aft = larger SM). Aim for SM ≈ 8–15% MAC for a good
stability/efficiency balance; SM < 5% or > 25% fails. If SM is out of range, adjust cg_position
first (cheapest), then resize the tail.

Your design focus: ${focus}

Workflow:
1. Call run_simulation with your initial parameters.
2. Analyze the result — identify what to improve (L/D too low? margin out of range?).
3. Run 1–2 refinement simulations.
4. Conclude with your best design and a brief engineering rationale.

Be concise. Cite specific numbers. One final recommendation only.`;
}

export async function runSubagent({
  id, focus, initialParams, onProgress, signal, missionText, mission, apiKey,
  startDelayMs = 0,
}) {
  const client = new Anthropic({ apiKey, maxRetries: MAX_RETRIES });
  const simulations = [];
  let runError = null;

  // Stagger the initial burst across the 5 agents to ease API rate limits.
  if (startDelayMs > 0) await sleep(startDelayMs);

  const messages = [
    {
      role: 'user',
      content: `Start the design study. Try these initial parameters first:\n${JSON.stringify(initialParams, null, 2)}\n\nRun simulations, analyze results, and report your best design.`,
    },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (signal?.aborted) break;

    let response;
    try {
      response = await client.messages.create(
        {
          model: 'claude-opus-4-8',
          max_tokens: 1024,
          system: buildSystemPrompt(id, focus, missionText, mission),
          tools: [simulationTool],
          messages,
        },
        { signal }
      );
    } catch (err) {
      if (signal?.aborted) break;     // cancelled — stop quietly
      runError = err;                 // real error — fail THIS agent only, not the study
      break;
    }

    // Abort may have fired during the request — don't emit a cancelled run's events.
    if (signal?.aborted) break;

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    const textBlocks = response.content.filter((b) => b.type === 'text');

    if (textBlocks.length > 0) {
      onProgress({
        type: 'subagent_text',
        subagentId: id,
        text: textBlocks.map((b) => b.text).join('\n'),
      });
    }

    if (response.stop_reason === 'end_turn' || toolUses.length === 0) {
      break;
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults = [];
    for (const tu of toolUses) {
      if (tu.name === 'run_simulation') {
        const sim = runSimulation(tu.input, mission);
        simulations.push(sim);

        onProgress({
          type: 'simulation_result',
          subagentId: id,
          simulation: sim,
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(sim, null, 2),
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }

  // Pick best passing simulation; fall back to last successful one
  const passing = simulations.filter((s) => s.success && s.passed);
  const successful = simulations.filter((s) => s.success);
  const bestSimulation =
    passing.sort((a, b) => b.results.LD_ratio - a.results.LD_ratio)[0] ||
    successful.sort((a, b) => b.results.LD_ratio - a.results.LD_ratio)[0] ||
    null;

  const finalText =
    messages
      .filter((m) => m.role === 'assistant')
      .flatMap((m) => (Array.isArray(m.content) ? m.content : [m.content]))
      .filter((b) => b?.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim() || 'No analysis text.';

  return {
    id,
    focus,
    simulations,
    bestSimulation,
    finalAnalysis: finalText,
    error: runError ? (runError.message || String(runError)) : null,
  };
}
