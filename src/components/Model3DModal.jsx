import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

const COL_WING = '#3b82f6';
const COL_TAIL = '#38bdf8';
const COL_FUSE = '#64748b';

// ── A symmetric tapered, swept wing built parametrically ──────────────────────
// span along X, chord along +Z (aft), thickness along Y. Quarter-chord of the
// root sits at the origin, so changing AR/taper/sweep visibly reshapes it.
function wingGeometry(span, cRoot, cTip, sweepDeg, thickness) {
  const s = span / 2;
  const sweep = (sweepDeg * Math.PI) / 180;
  const chord = (x) => cRoot + (cTip - cRoot) * (Math.abs(x) / s);
  const qc = (x) => Math.abs(x) * Math.tan(sweep); // quarter-chord swept aft
  const LE = (x) => qc(x) - 0.25 * chord(x);
  const TE = (x) => qc(x) + 0.75 * chord(x);

  const shape = new THREE.Shape();
  shape.moveTo(-s, LE(-s));
  shape.lineTo(0, LE(0));
  shape.lineTo(s, LE(s));
  shape.lineTo(s, TE(s));
  shape.lineTo(0, TE(0));
  shape.lineTo(-s, TE(-s));
  shape.closePath();

  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  g.translate(0, 0, -thickness / 2);
  g.rotateX(Math.PI / 2); // chord -> +Z, thickness -> Y
  return g;
}

// ── A single dorsal vertical fin: height along Y, chord along +Z ──────────────
function finGeometry(height, cRoot, cTip, sweepDeg, thickness) {
  const sweep = (sweepDeg * Math.PI) / 180;
  const chord = (u) => cRoot + (cTip - cRoot) * (u / height);
  const qc = (u) => u * Math.tan(sweep);
  const LE = (u) => qc(u) - 0.25 * chord(u);
  const TE = (u) => qc(u) + 0.75 * chord(u);

  const shape = new THREE.Shape();
  shape.moveTo(LE(0), 0); // x = chord, y = height
  shape.lineTo(LE(height), height);
  shape.lineTo(TE(height), height);
  shape.lineTo(TE(0), 0);
  shape.closePath();

  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  g.translate(0, 0, -thickness / 2);
  g.rotateY(-Math.PI / 2); // chord -> +Z, height -> Y, thin in X
  return g;
}

function Part({ geometry, color, position }) {
  return (
    <mesh geometry={geometry} position={position}>
      <meshStandardMaterial
        color={color}
        metalness={0.15}
        roughness={0.55}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Label({ position, children }) {
  return (
    <Html position={position} center distanceFactor={undefined} style={{ pointerEvents: 'none' }}>
      <div className="r3f-label">{children}</div>
    </Html>
  );
}

function DroneModel({ params, results }) {
  const b = Number(params.wingspan) || 1.8;
  const AR = Number(params.aspect_ratio) || 9;
  const taper = Number(params.taper_ratio) || 0.5;
  const sweepDeg = Number(params.sweep_angle_deg) || 0;
  const Vh = Number(params.tail_volume_coeff_h) || 0.45;
  const Vv = Number(params.tail_volume_coeff_v) || 0.05;

  const S = Number(results?.S_wing_m2) || (b * b) / AR;
  const cRoot = Number(results?.c_root_m) || (2 * b) / (AR * (1 + taper));
  const cTip = taper * cRoot;
  const MAC = Number(results?.MAC_m) || (cRoot * (2 / 3) * (1 + taper + taper * taper)) / (1 + taper);

  const tailArm = 0.55 * b;

  // Tail surfaces sized from the volume coefficients → bigger tails are visible.
  const Sh = (Vh * S * MAC) / tailArm;
  const bh = Math.sqrt(4.0 * Sh); // assume tail AR ≈ 4
  const cRootH = (2 * (Sh / bh)) / (1 + 0.6);
  const cTipH = 0.6 * cRootH;

  const Sv = (Vv * S * b) / tailArm;
  const hV = Math.sqrt(1.5 * Sv); // fin AR ≈ 1.5
  const cRootV = (2 * (Sv / hV)) / (1 + 0.5);
  const cTipV = 0.5 * cRootV;

  const wingThick = Math.max(0.02, 0.09 * MAC);
  const tailThick = wingThick * 0.6;
  const fuseR = 0.032 * b;

  const wing = useMemo(() => wingGeometry(b, cRoot, cTip, sweepDeg, wingThick), [b, cRoot, cTip, sweepDeg, wingThick]);
  const htail = useMemo(() => wingGeometry(bh, cRootH, cTipH, 0, tailThick), [bh, cRootH, cTipH, tailThick]);
  const vtail = useMemo(() => finGeometry(hV, cRootV, cTipV, 25, tailThick), [hV, cRootV, cTipV, tailThick]);

  // Fuselage: cylindrical body + a pointed nose cone.
  const bodyFrontZ = -0.10 * b;
  const tailTipZ = tailArm + 0.12 * b;
  const bodyLen = tailTipZ - bodyFrontZ;
  const bodyCenterZ = (bodyFrontZ + tailTipZ) / 2;
  const noseLen = 0.24 * b;

  return (
    <group>
      {/* Fuselage body */}
      <mesh position={[0, 0, bodyCenterZ]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[fuseR, fuseR, bodyLen, 28]} />
        <meshStandardMaterial color={COL_FUSE} metalness={0.2} roughness={0.5} />
      </mesh>
      {/* Nose cone (tip forward, -Z) */}
      <mesh position={[0, 0, bodyFrontZ - noseLen / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[fuseR, noseLen, 28]} />
        <meshStandardMaterial color={COL_FUSE} metalness={0.2} roughness={0.5} />
      </mesh>

      <Part geometry={wing} color={COL_WING} position={[0, 0, 0]} />
      <Part geometry={htail} color={COL_TAIL} position={[0, 0, tailArm]} />
      <Part geometry={vtail} color={COL_TAIL} position={[0, fuseR * 0.5, tailArm]} />

      <Label position={[b * 0.34, 0.05 * b, 0]}>Wing · AR {AR}</Label>
      <Label position={[bh * 0.5, 0, tailArm]}>Horizontal tail</Label>
      <Label position={[0, hV * 0.75, tailArm]}>Vertical tail</Label>
      <Label position={[0, -fuseR * 2.2, bodyFrontZ]}>Fuselage</Label>
    </group>
  );
}

export default function Model3DModal({ winnerSim, onClose }) {
  const params = winnerSim?.params;
  const results = winnerSim?.results;
  const b = Number(params?.wingspan) || 1.8;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="model-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>3D Model — Agent {winnerSim?.subagentId} · parametric from simulation</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="model-canvas-wrap">
          {params ? (
            <Canvas camera={{ position: [b * 1.15, b * 0.85, b * 1.5], fov: 45 }} dpr={[1, 2]}>
              <color attach="background" args={['#0b0e16']} />
              <ambientLight intensity={0.55} />
              <hemisphereLight args={['#9fb4d4', '#1a2030', 0.5]} />
              <directionalLight position={[6, 10, 6]} intensity={1.1} />
              <directionalLight position={[-5, 3, -4]} intensity={0.35} />

              <DroneModel params={params} results={results} />

              <gridHelper args={[b * 2.4, 24, '#1e2537', '#161b27']} position={[0, -0.28 * b, 0.2 * b]} />

              <OrbitControls
                makeDefault
                enablePan={false}
                target={[0, 0, 0.18 * b]}
                minDistance={b * 0.5}
                maxDistance={b * 6}
              />
            </Canvas>
          ) : (
            <div className="model-empty">No design selected.</div>
          )}

          {params && (
            <div className="model-legend">
              <div><b>Wingspan</b> {params.wingspan} m</div>
              <div><b>Aspect ratio</b> {params.aspect_ratio}</div>
              <div><b>Taper</b> {params.taper_ratio}</div>
              <div><b>Sweep</b> {params.sweep_angle_deg}°</div>
              <div><b>Airfoil</b> {params.airfoil}</div>
              <div><b>L/D</b> {results?.LD_ratio}</div>
            </div>
          )}
          <div className="model-hint">Drag to rotate · Scroll to zoom</div>
        </div>
      </div>
    </div>
  );
}
