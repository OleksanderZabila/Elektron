// Shared mission definition + a small parser that pulls the quantitative
// constraints out of the free-text brief so the mock physics and the agents
// react to whatever the user actually typed.

export const DEFAULT_MISSION = `Design a fixed-wing surveillance drone for long-endurance flight.

Mission:
- Payload: 1.5 kg camera/sensor package
- Target cruise speed: 22 m/s
- The design needs to maximize L/D (Lift to Drag) ratio
- Wingspan must stay under 2 m
- The design must be longitudinally, directionally, and laterally stable - so the tail must be sized accordingly`;

export const MISSION_DEFAULTS = { payloadKg: 1.5, cruiseMs: 22, wingspanLimit: 2.0 };

function clamp(v, lo, hi) {
  if (Number.isNaN(v)) return lo;
  return Math.min(Math.max(v, lo), hi);
}

// Extract payload mass (kg), cruise speed (m/s), and wingspan limit (m).
// Falls back to the standard mission defaults when a value is not present.
export function parseMission(text) {
  const t = (text || '').toString();
  const out = { ...MISSION_DEFAULTS, raw: t };

  // Payload mass — prefer a number near the word "payload", else first "N kg".
  const payload =
    t.match(/payload[^\n]*?([\d.]+)\s*kg/i) || t.match(/([\d.]+)\s*kg/i);
  if (payload) out.payloadKg = clamp(parseFloat(payload[1]), 0.05, 50);

  // Cruise speed — "22 m/s", "22 mps", "22 meters per second".
  const cruise =
    t.match(/([\d.]+)\s*m\s*\/?\s*s\b/i) ||
    t.match(/([\d.]+)\s*mps\b/i) ||
    t.match(/([\d.]+)\s*meters?\s*per\s*second/i);
  if (cruise) out.cruiseMs = clamp(parseFloat(cruise[1]), 5, 120);

  // Wingspan upper limit — "under 2 m", "<= 2 m", "below 2m", "max 2 m".
  const span =
    t.match(
      /wing\s*span[^\n]*?(?:under|below|less\s+than|<=|<|≤|max(?:imum)?|up\s+to|stay\s+under|no\s+more\s+than)\s*([\d.]+)\s*m\b/i
    ) ||
    t.match(/(?:under|below|≤|<=|<)\s*([\d.]+)\s*m\b[^\n]*wing\s*span/i) ||
    t.match(/wing\s*span[^\n]*?([\d.]+)\s*m\b/i);
  if (span) out.wingspanLimit = clamp(parseFloat(span[1]), 0.3, 20);

  return out;
}
