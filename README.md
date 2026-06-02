# OpenVSP Agent

An AI-driven aerodynamic design harness for fixed-wing UAVs, built as an Electron desktop app.

## What it does

Runs a multi-agent design study for a fixed-wing surveillance drone:
- **Orchestrator** (Claude Sonnet) coordinates the study and synthesizes results
- **5 parallel subagents** (Claude Opus) each explore different design strategies using OpenVSP simulation tools
- Results are shown in a real-time chat panel + structured report with charts

## Stack

- Electron Forge + Vite
- React + plain JSX + CSS
- Anthropic SDK (Claude API)
- Recharts

## Setup

1. Clone the repo
2. Install dependencies:
   ```
   npm install
   ```
3. Provide an Anthropic API key (either option works):
   - **In-app:** launch the app, click the ⚙ (Settings) button, paste your key. It is stored
     locally and encrypted via the OS keychain (DPAPI on Windows). This is the only option for
     the packaged `.exe`.
   - **Dev / .env:** create a `.env` file in the project root:
     ```
     ANTHROPIC_API_KEY=sk-ant-...
     ```
4. Run:
   ```
   npm start
   ```

## Usage

1. Edit the **Mission Prompt** at the top of the left panel (it is pre-filled with the default
   surveillance-drone brief). The payload mass, cruise speed, and wingspan limit are parsed
   straight from this text and drive the simulation.
2. Press **Run Study** to launch the 5 parallel subagents.
3. The left panel shows live agent activity; the right panel displays the final report with
   charts and design cards once the study completes (~2–3 minutes depending on API speed).

## Building a Windows .exe

```
npm run build:win
```

This builds the production Vite bundles and assembles a runnable Windows app at:

```
out/openvsp-agent-win32-x64/openvsp-agent.exe
```

Double-click `openvsp-agent.exe` to launch. The packaged app has no `.env`, so enter the
API key via the in-app ⚙ Settings dialog on first run.

> **Why not `electron-forge make`?** Under Node 26, `@electron/packager` (used by Forge's
> `package`/`make`) silently aborts during its finalize step, so it produces no output. The
> `build:win` script reuses Forge's production Vite build and then assembles the app around the
> prebuilt Electron runtime via `scripts/assemble.mjs`, which is immune to that bug. See
> `future_work.md` for the path to a signed installer.

## Note on OpenVSP

The current implementation uses a high-fidelity aerodynamic mock based on lifting-line theory and DATCOM empirical methods. See `future_work.md` for real OpenVSP integration details.
