// Aerodynamic model based on lifting-line theory + DATCOM empirical methods.
// Simulates OpenVSP analysis for a fixed-wing UAV at ISA sea-level conditions.

const RHO = 1.225;   // kg/m³ — sea-level ISA air density
const G = 9.81;      // m/s²
const MTOW = 2.3;    // kg — airframe ~0.8 kg + payload 1.5 kg
const V_CRUISE = 22; // m/s

const AIRFOILS = {
  'NACA 2412': { cl_alpha_2d: 6.28, cl_max: 1.30, cd_profile: 0.0058, cm_ac: -0.048 },
  'NACA 4412': { cl_alpha_2d: 6.30, cl_max: 1.55, cd_profile: 0.0070, cm_ac: -0.098 },
  'Clark-Y':   { cl_alpha_2d: 6.15, cl_max: 1.45, cd_profile: 0.0065, cm_ac: -0.082 },
};

function r(val, dec) {
  return Math.round(val * 10 ** dec) / 10 ** dec;
}

export function runSimulation(params) {
  const {
    wingspan,
    aspect_ratio,
    taper_ratio,
    sweep_angle_deg,
    airfoil,
    tail_volume_coeff_h,
    tail_volume_coeff_v,
  } = params;

  const foil = AIRFOILS[airfoil] || AIRFOILS['NACA 4412'];

  // Wing geometry
  const S_wing = (wingspan ** 2) / aspect_ratio;
  const c_root = (2 * wingspan) / (aspect_ratio * (1 + taper_ratio));
  const c_tip = taper_ratio * c_root;
  const MAC = (2 / 3) * c_root * (1 + taper_ratio + taper_ratio ** 2) / (1 + taper_ratio);

  // Cruise conditions
  const q = 0.5 * RHO * V_CRUISE ** 2;
  const W = MTOW * G;
  const CL_cruise = W / (q * S_wing);

  if (CL_cruise > foil.cl_max * 0.90) {
    return {
      success: false,
      params,
      error: `Wing too small — CL_req=${r(CL_cruise, 3)} exceeds 90% of CLmax (${r(foil.cl_max * 0.9, 2)}). Increase wingspan or decrease AR.`,
    };
  }
  if (CL_cruise < 0.15) {
    return {
      success: false,
      params,
      error: `Wing oversized — CL_req=${r(CL_cruise, 3)} is too low for efficient cruise. Reduce wingspan.`,
    };
  }

  // Oswald efficiency (Raymer empirical, corrected for sweep)
  const sweep_rad = (sweep_angle_deg * Math.PI) / 180;
  const e_raw = 1.78 * (1 - 0.045 * aspect_ratio ** 0.68) - 0.64;
  const e = Math.min(Math.max(e_raw * (1 - 0.08 * Math.sin(sweep_rad) ** 2), 0.5), 0.95);

  // Drag breakdown
  const CD_induced = CL_cruise ** 2 / (Math.PI * aspect_ratio * e);

  // Parasitic: wing profile + fuselage + tail
  const CD_fus = (0.003 * 0.085) / S_wing;            // fuselage wetted area ~0.085 m²
  const CD_tail = foil.cd_profile * (0.12 + tail_volume_coeff_h * 0.12);
  const CD_sweep = 0.0002 * (sweep_angle_deg / 5);
  const CD_0 = foil.cd_profile + CD_fus + CD_tail + CD_sweep;
  const CD_total = CD_0 + CD_induced;

  const LD_ratio = CL_cruise / CD_total;
  const Thrust = W / LD_ratio;
  const Power_W = Thrust * V_CRUISE;

  // Longitudinal stability — Datcom-style neutral point estimate
  const l_tail = wingspan * 0.55;
  const S_tail_h = (tail_volume_coeff_h * S_wing * MAC) / l_tail;
  const CL_alpha_w = foil.cl_alpha_2d * aspect_ratio / (aspect_ratio + 2); // Helmbold
  const eta_h = 0.90; // tail efficiency
  const NP = 0.25 + (eta_h * S_tail_h * l_tail) / (S_wing * MAC * CL_alpha_w) - 0.05;
  const CG = 0.28; // assumed CG at 28% MAC
  const SM = NP - CG;

  // Directional stability (Cnβ > 0 required)
  const S_tail_v = (tail_volume_coeff_v * S_wing * wingspan) / l_tail;
  const Cnbeta = (S_tail_v * l_tail) / (S_wing * wingspan) - 0.0015;

  // Lateral stability (dihedral effect) — simplified
  const Clbeta = -0.05 - 0.003 * aspect_ratio + 0.02 * (sweep_angle_deg / 5);

  // Requirements
  const req = {
    wingspan:   { passed: wingspan <= 2.0,          value: `${r(wingspan,2)} m`,          limit: '≤ 2.0 m' },
    ld_ratio:   { passed: LD_ratio >= 12.0,         value: r(LD_ratio, 2).toString(),     limit: '≥ 12.0' },
    long_stab:  { passed: SM >= 0.05 && SM <= 0.25, value: `SM = ${r(SM*100,1)}% MAC`,   limit: '5%–25% MAC' },
    dir_stab:   { passed: Cnbeta > 0,               value: `Cnβ = ${r(Cnbeta,4)}`,       limit: '> 0' },
    lat_stab:   { passed: Clbeta < 0,               value: `Clβ = ${r(Clbeta,4)}`,       limit: '< 0' },
    cl_valid:   { passed: CL_cruise >= 0.2,         value: `CL = ${r(CL_cruise,3)}`,     limit: '≥ 0.2' },
  };
  const passed = Object.values(req).every((r) => r.passed);

  return {
    success: true,
    params,
    results: {
      CL_cruise:  r(CL_cruise, 4),
      CD_0:       r(CD_0, 5),
      CD_induced: r(CD_induced, 5),
      CD_total:   r(CD_total, 5),
      LD_ratio:   r(LD_ratio, 2),
      e_oswald:   r(e, 3),
      SM_pct:     r(SM * 100, 1),
      Cnbeta:     r(Cnbeta, 4),
      Clbeta:     r(Clbeta, 4),
      S_wing_m2:  r(S_wing, 4),
      MAC_m:      r(MAC, 3),
      c_root_m:   r(c_root, 3),
      power_W:    r(Power_W, 1),
      thrust_N:   r(Thrust, 2),
    },
    requirements: req,
    passed,
  };
}

// Generate drag polar curve (CL vs CD) for a given best simulation result
export function generateDragPolar(simResult) {
  if (!simResult?.success) return [];
  const { aspect_ratio } = simResult.params;
  const { CD_0, e_oswald } = simResult.results;
  const points = [];
  for (let cl = 0.05; cl <= 1.45; cl += 0.05) {
    const cd_i = cl ** 2 / (Math.PI * aspect_ratio * e_oswald);
    const cd = CD_0 + cd_i;
    points.push({ CL: r(cl, 2), CD: r(cd, 5), LD: r(cl / cd, 1) });
  }
  return points;
}
