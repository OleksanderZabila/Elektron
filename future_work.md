# Future Work

## Real OpenVSP Integration

The app currently uses a physics-based aerodynamic mock (lifting-line theory + DATCOM empiricals). To integrate real OpenVSP:

1. **Install OpenVSP** — download from openvsp.org and expose `vsp` CLI on PATH.
2. **Script generation** — each subagent's `run_simulation` tool call should write a `.vsp3` file (parametric geometry via `vspaero` or the Python API `openvsp`), then invoke `vspaero` for VSPAERO panel-method analysis.
3. **Result parsing** — parse `.adb`, `.lod`, and `.polar` output files to extract CL, CD, moments, and stability derivatives.
4. **Cost** — OpenVSP is free and open-source. The only cost is compute time (~5–30s per simulation on a modern CPU). No licensing required.

## Streaming UI Updates

Currently the chat panel appends complete messages. Switching to streaming (SSE from the main process or Anthropic streaming API) would let users see Claude's reasoning token-by-token, which improves the "watching the AI think" experience significantly.

## Persistent Sessions

Add an SQLite or JSON-based session store so previous design studies can be recalled. Each study would be a timestamped entry with full parameter history, simulation logs, and the final report.

## 3D Model Preview (Optional)

The task allows breaking the single-window rule for this feature. Implementation path:
- Generate a `.vsp3` model during each simulation
- Render it using Three.js + a GLTF export from OpenVSP
- Show via a secondary BrowserWindow or in-panel WebGL canvas

## Agent Refinement Loop

Currently each subagent runs a fixed number of simulations. A more sophisticated agent would:
1. Run a coarse parameter sweep
2. Identify the Pareto-optimal region
3. Refine with a denser grid around that region (Bayesian optimization or gradient-free search)

## Requirements to Reconsider

**"Stick to 5 parallel subagents at max"** — This is a reasonable hard limit for a demo/assignment context. In a production system, the right number of parallel agents depends on the search space dimensionality, not an arbitrary cap. A 7-parameter design space with continuous variables benefits from at least 10–20 initial samples before refinement. The 5-agent constraint means some regions of the design space are not explored; a winner found under this constraint may not be the global optimum.

**"Wingspan must stay under 2 m"** — Operationally sensible for transport/deployment, but aerodynamically this is a tight constraint for a long-endurance platform. A 2.5 m wingspan at the same AR would yield ~20% lower induced drag and meaningfully better L/D. If the startup's transport cases allow larger spans, this limit should be revisited with the mission team.
