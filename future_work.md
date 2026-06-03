# Future Work

## Real OpenVSP Integration

**This is the single most important next step.** The aerodynamics today are a *stub*: a
physics-based mock (lifting-line theory + DATCOM empiricals) in `src/agent/openvsp-mock.js`. It is
plausible and internally consistent, but it is **not** a real CFD/panel-method solve — no design
decision should be trusted operationally until this is replaced. To integrate real OpenVSP:

1. **Install OpenVSP** — download from openvsp.org and expose `vsp` CLI on PATH.
2. **Script generation** — each subagent's `run_simulation` tool call should write a `.vsp3` file (parametric geometry via `vspaero` or the Python API `openvsp`), then invoke `vspaero` for VSPAERO panel-method analysis.
3. **Result parsing** — parse `.adb`, `.lod`, and `.polar` output files to extract CL, CD, moments, and stability derivatives.
4. **Cost** — OpenVSP is free and open-source. The only cost is compute time (~5–30s per simulation on a modern CPU). No licensing required.

## Streaming UI Updates

Currently the chat panel appends complete messages. Switching to streaming (SSE from the main process or Anthropic streaming API) would let users see Claude's reasoning token-by-token, which improves the "watching the AI think" experience significantly.

## Persistent Sessions

Add an SQLite or JSON-based session store so previous design studies can be recalled. Each study would be a timestamped entry with full parameter history, simulation logs, and the final report.

## 3D Model Preview (Optional) — implemented

A parametric 3D preview is built in. The winner banner has a **View 3D Model** button that opens a
dark-themed, orbit-controlled modal (drag = rotate, scroll = zoom) using `@react-three/fiber` +
`@react-three/drei`. The drone is generated programmatically from the winning design's parameters
(`wingspan`, `aspect_ratio`, `taper_ratio`, `sweep_angle_deg`, and the tail volume coefficients)
via `ExtrudeGeometry` + primitives — so a high-AR wing visibly differs from a compact low-AR one,
and larger tail volumes render as visibly larger tails. Parts are labelled (wing, horizontal tail,
vertical tail, fuselage). See `src/components/Model3DModal.jsx`.

Next steps to deepen it:
- Replace the flat extruded plates with true airfoil cross-sections (actual NACA/Clark-Y section
  coordinates) lofted along the span.
- Add dihedral and twist/washout once the mock models them.
- When real OpenVSP is wired in, render the actual `.vsp3` geometry (GLTF export) instead of the
  parametric approximation.

## Agent Refinement Loop

Currently each subagent runs a fixed number of simulations. A more sophisticated agent would:
1. Run a coarse parameter sweep
2. Identify the Pareto-optimal region
3. Refine with a denser grid around that region (Bayesian optimization or gradient-free search)

## API Rate Limiting & Cost Controls

The study fires up to 5 Opus subagents in parallel, each doing several tool rounds. Current
mitigations: subagents stagger their first call, the Anthropic client uses `maxRetries: 4` (the SDK
does exponential backoff and honors `retry-after`), and one subagent failing no longer sinks the
study (`Promise.allSettled`). For production this should become:
- A real concurrency / token-bucket queue that respects the account's requests- and
  tokens-per-minute limits, instead of a fixed stagger.
- A per-run cost/budget cap with a visible estimate before launch (Opus dominates cost).
- Optional model tiering — e.g. Haiku for cheap exploration rounds, Opus only for refinement.

## Packaging & Signed Installer

The app currently ships as an assembled, unpacked Windows app (`npm run build:win` →
`out/openvsp-agent-win32-x64/openvsp-agent.exe`). Two things are needed to ship a polished,
distributable installer:

1. **Working packager.** Under Node 26, `@electron/packager` (used by `electron-forge make`)
   silently aborts in its finalize step and produces no output. Fixes: pin Node to an LTS that
   `@electron/packager` supports, upgrade to a packager release that supports Node 26, or move
   packaging to `electron-builder`. `scripts/assemble.mjs` is the current workaround — it lays
   the built app over the prebuilt Electron runtime by hand.
2. **Code signing.** A real product needs an Authenticode certificate (~$200–400/yr from a CA)
   so Windows SmartScreen does not warn users. Once signed, an NSIS/Squirrel installer with
   auto-update (`electron-updater`) is straightforward. Without a budget for the certificate,
   ship the portable folder + a short "click More info → Run anyway" note.

## Requirements to Reconsider

**"Stick to 5 parallel subagents at max"** — This is a reasonable hard limit for a demo/assignment context. In a production system, the right number of parallel agents depends on the search space dimensionality, not an arbitrary cap. A 7-parameter design space with continuous variables benefits from at least 10–20 initial samples before refinement. The 5-agent constraint means some regions of the design space are not explored; a winner found under this constraint may not be the global optimum.

**"Wingspan must stay under 2 m"** — Operationally sensible for transport/deployment, but aerodynamically this is a tight constraint for a long-endurance platform. A 2.5 m wingspan at the same AR would yield ~20% lower induced drag and meaningfully better L/D. If the startup's transport cases allow larger spans, this limit should be revisited with the mission team.

**"No features to switch between different windows or menus"** — The Settings dialog (⚙) for the API key technically adds a modal overlay, which bends this rule. It was added on explicit request and is the right call for a shippable app: a packaged `.exe` has no `.env`, so the user needs an in-app way to supply their key. It is a single lightweight modal, not a multi-page navigation system, so it preserves the spirit of the constraint (one focused workspace). If strict single-surface UX is required, the key field could instead live inline in the header.
