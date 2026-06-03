---
name: project-openvsp-agent
description: 72-hour test assignment — Electron app with AI agent for aerodynamic UAV design via OpenVSP
metadata: 
  node_type: memory
  type: project
  originSessionId: e2c38d33-13cc-4aad-b939-08e0e9997eee
---

OpenVSP Agent is the current 72-hour test assignment project at `C:\Work\openvsp-agent`.

**What:** Electron desktop app — AI harness for OpenVSP (drone aerodynamic design tool). Orchestrator + 5 parallel subagents (Claude API), each running mock OpenVSP simulations to design a fixed-wing surveillance drone.

**Stack:** Electron Forge + Vite + React + plain JSX/CSS + Node.js main process + @anthropic-ai/sdk + recharts

**Why:** Mock simulation (no real OpenVSP calls yet) — see future_work.md for integration path.

**How to apply:** All agent logic is in `src/agent/`. UI split: chat panel (left 38%) + report panel (right 62%). User must create `.env` with `ANTHROPIC_API_KEY=sk-ant-...` before running.

**Status:** Codebase complete, builds and launches. User needs to insert real API key.
