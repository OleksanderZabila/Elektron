export const simulationTool = {
  name: 'run_simulation',
  description: `Run aerodynamic analysis for a fixed-wing UAV via OpenVSP (mock).
Returns: CL/CD breakdown (incl. trim drag), L/D ratio, neutral point, static margin, Cnβ, wing geometry, power.
Mission: payload 1.5 kg, cruise 22 m/s, wingspan ≤ 2 m, maximize L/D, must be stable.
Tip: high AR reduces induced drag; static margin SM = NP − cg_position, set by CG position AND tail volume.`,
  input_schema: {
    type: 'object',
    properties: {
      wingspan: {
        type: 'number',
        description: 'Wing span in meters. Hard limit: ≤ 2.0 m.',
      },
      aspect_ratio: {
        type: 'number',
        description: 'AR = b²/S. Range 6–13. Higher AR → lower induced drag but heavier structure.',
      },
      taper_ratio: {
        type: 'number',
        description: 'λ = c_tip/c_root. Range 0.3–0.9. Near-elliptical at λ≈0.45.',
      },
      sweep_angle_deg: {
        type: 'number',
        description: 'Quarter-chord sweep in degrees. Range 0–15. Low sweep preferred for low-speed UAVs.',
      },
      airfoil: {
        type: 'string',
        enum: ['NACA 2412', 'NACA 4412', 'Clark-Y'],
        description: 'Wing section. NACA 4412: more camber/lift. NACA 2412: lower drag at low CL. Clark-Y: classic glider.',
      },
      tail_volume_coeff_h: {
        type: 'number',
        description: 'Horizontal tail volume Vh = Sh·lh/(S·MAC). Controls pitch stability. Range 0.30–0.55.',
      },
      tail_volume_coeff_v: {
        type: 'number',
        description: 'Vertical tail volume Vv = Sv·lv/(S·b). Controls yaw stability. Range 0.030–0.070.',
      },
      cg_position: {
        type: 'number',
        description:
          'Centre of gravity as a fraction of MAC. Range 0.15–0.45. PRIMARY longitudinal-stability ' +
          'lever: static margin SM = NP − cg_position. Move CG forward (smaller) to raise SM, aft ' +
          '(larger) to lower it; target SM 5–25% MAC. Forward CG also adds trim drag (costs L/D).',
      },
    },
    required: [
      'wingspan',
      'aspect_ratio',
      'taper_ratio',
      'sweep_angle_deg',
      'airfoil',
      'tail_volume_coeff_h',
      'tail_volume_coeff_v',
      'cg_position',
    ],
  },
};
