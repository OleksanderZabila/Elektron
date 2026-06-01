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
3. Create a `.env` file in the project root:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
4. Run:
   ```
   npm start
   ```

## Usage

Press **Run Study** to launch the multi-agent simulation. The left panel shows live agent activity; the right panel displays the final report with charts and design cards once the study completes (~2–3 minutes depending on API speed).

## Note on OpenVSP

The current implementation uses a high-fidelity aerodynamic mock based on lifting-line theory and DATCOM empirical methods. See `future_work.md` for real OpenVSP integration details.
