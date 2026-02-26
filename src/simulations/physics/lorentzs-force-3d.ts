import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Lorentz Force 3D: Helical Motion of Charged Particle in Magnetic Field
 *
 * Demonstrates:
 * - Helical trajectory when v has components parallel and perpendicular to B
 * - Cyclotron radius r = mv_perp / (|q|B)
 * - Pitch of helix depends on v_parallel
 * - 3D visualization via isometric projection on Canvas 2D
 */

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface TrailPoint3D {
  pos: Vec3;
  speed: number;
}

const LorentzForce3DFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("lorentzs-force-3d") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Particle state
  let pos: Vec3 = { x: 0, y: 0, z: 0 };
  let vel: Vec3 = { x: 0, y: 0, z: 0 };

  // Parameters
  let charge = 1.0;
  let Bstrength = 1.0; // B field along z-axis
  let mass = 1.0;
  let vx0 = 1.0;
  let vy0 = 1.0;
  let vz0 = 0.5; // parallel to B gives helical pitch

  // Trail
  let trail: TrailPoint3D[] = [];
  const MAX_TRAIL = 3000;

  // Camera
  let camAngleX = 0.45; // rotation around vertical axis
  let camAngleY = 0.35; // tilt
  let camZoom = 1.0;
  let camOriginZ = 0; // auto-follow z

  // --- 3D projection ---
  function rotateY(v: Vec3, angle: number): Vec3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
  }

  function rotateX(v: Vec3, angle: number): Vec3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
  }

  function project(world: Vec3): { sx: number; sy: number; depth: number } {
    // Shift for camera follow
    const shifted: Vec3 = { x: world.x, y: world.y, z: world.z - camOriginZ };

    const scaleFactor = Math.min(width, height) * 0.06 * camZoom;
    const rotated = rotateX(rotateY(shifted, camAngleX), camAngleY);

    return {
      sx: width / 2 + rotated.x * scaleFactor,
      sy: height / 2 - rotated.y * scaleFactor,
      depth: rotated.z,
    };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    resetState();
  }

  function resetState(): void {
    time = 0;
    pos = { x: 0, y: 0, z: 0 };
    vel = { x: vx0, y: vy0, z: vz0 };
    trail = [{ pos: { ...pos }, speed: Math.sqrt(vx0 * vx0 + vy0 * vy0 + vz0 * vz0) }];
    camOriginZ = 0;
    camAngleX = 0.45;
    camAngleY = 0.35;
  }

  function update(dt: number, params: Record<string, number>): void {
    charge = params.charge ?? 1.0;
    Bstrength = params.magneticField ?? 1.0;
    mass = params.mass ?? 1.0;
    vx0 = params.vx ?? 1.0;
    vy0 = params.vy ?? 1.0;
    vz0 = params.vz ?? 0.5;

    if (mass < 0.01) mass = 0.01;

    // Slowly rotate camera for 3D feel
    camAngleX += dt * 0.08;

    // Boris integrator for magnetic field (preserves energy exactly)
    const subSteps = 20;
    const subDt = Math.min(dt, 0.016) / subSteps;

    for (let s = 0; s < subSteps; s++) {
      // B = (0, 0, Bstrength)
      // Half electric push (no E field here, skip)
      // Rotation step (Boris method)
      const qOverM = charge / mass;
      const tx = 0;
      const ty = 0;
      const tz = qOverM * Bstrength * subDt * 0.5;

      const tFactor = 2.0 / (1.0 + tx * tx + ty * ty + tz * tz);
      const sx2 = tx * tFactor;
      const sy2 = ty * tFactor;
      const sz2 = tz * tFactor;

      // v_minus = v (no E field)
      const vmx = vel.x;
      const vmy = vel.y;
      const vmz = vel.z;

      // v_prime = v_minus + v_minus x t
      const vpx = vmx + (vmy * tz - vmz * ty);
      const vpy = vmy + (vmz * tx - vmx * tz);
      const vpz = vmz + (vmx * ty - vmy * tx);

      // v_plus = v_minus + v_prime x s
      vel.x = vmx + (vpy * sz2 - vpz * sy2);
      vel.y = vmy + (vpz * sx2 - vpx * sz2);
      vel.z = vmz + (vpx * sy2 - vpy * sx2);

      // Position update
      pos.x += vel.x * subDt;
      pos.y += vel.y * subDt;
      pos.z += vel.z * subDt;
    }

    time += dt;

    // Record trail
    const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
    trail.push({ pos: { ...pos }, speed });
    if (trail.length > MAX_TRAIL) trail.shift();

    // Camera follow z
    camOriginZ += (pos.z - camOriginZ) * 0.03;
  }

  function drawAxes(): void {
    const axisLen = 4;
    const axes: { dir: Vec3; color: string; label: string }[] = [
      { dir: { x: axisLen, y: 0, z: 0 }, color: "#ef4444", label: "X" },
      { dir: { x: 0, y: axisLen, z: 0 }, color: "#22c55e", label: "Y" },
      { dir: { x: 0, y: 0, z: axisLen }, color: "#3b82f6", label: "Z (B)" },
    ];

    const origin3D: Vec3 = { x: 0, y: 0, z: camOriginZ };
    const o = project(origin3D);

    axes.forEach((axis) => {
      const end: Vec3 = {
        x: axis.dir.x,
        y: axis.dir.y,
        z: axis.dir.z + camOriginZ,
      };
      const e = project(end);

      // Axis line
      ctx.strokeStyle = axis.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(o.sx, o.sy);
      ctx.lineTo(e.sx, e.sy);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Arrowhead
      const dx = e.sx - o.sx;
      const dy = e.sy - o.sy;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 10) {
        const angle = Math.atan2(dy, dx);
        ctx.fillStyle = axis.color;
        ctx.beginPath();
        ctx.moveTo(e.sx, e.sy);
        ctx.lineTo(e.sx - 8 * Math.cos(angle - 0.3), e.sy - 8 * Math.sin(angle - 0.3));
        ctx.lineTo(e.sx - 8 * Math.cos(angle + 0.3), e.sy - 8 * Math.sin(angle + 0.3));
        ctx.closePath();
        ctx.fill();
      }

      // Label
      ctx.fillStyle = axis.color;
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(axis.label, e.sx + 15 * (dx / (len || 1)), e.sy + 15 * (dy / (len || 1)));
    });

    // Negative axis dashes
    axes.forEach((axis) => {
      const negEnd: Vec3 = {
        x: -axis.dir.x * 0.5,
        y: -axis.dir.y * 0.5,
        z: -axis.dir.z * 0.5 + camOriginZ,
      };
      const ne = project(negEnd);

      ctx.strokeStyle = axis.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.25;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(o.sx, o.sy);
      ctx.lineTo(ne.sx, ne.sy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    });
  }

  function drawBFieldIndicators(): void {
    // Draw B field arrows along z-axis region
    ctx.globalAlpha = 0.15;
    const spacing = 2;
    for (let ix = -2; ix <= 2; ix += spacing) {
      for (let iy = -2; iy <= 2; iy += spacing) {
        const base: Vec3 = { x: ix, y: iy, z: camOriginZ - 2 };
        const tip: Vec3 = { x: ix, y: iy, z: camOriginZ + 2 };
        const bp = project(base);
        const tp = project(tip);

        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bp.sx, bp.sy);
        ctx.lineTo(tp.sx, tp.sy);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawTrail(): void {
    if (trail.length < 2) return;

    for (let i = 1; i < trail.length; i++) {
      const alpha = 0.1 + 0.9 * (i / trail.length);
      const p1 = project(trail[i - 1].pos);
      const p2 = project(trail[i].pos);

      // Color gradient along trail
      const hue = (i / trail.length) * 280;
      ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${alpha.toFixed(2)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.stroke();
    }
  }

  function drawParticle(): void {
    const p = project(pos);
    const radius = 10;

    // Glow
    const glow = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, radius * 3);
    glow.addColorStop(0, charge > 0 ? "rgba(239,68,68,0.5)" : "rgba(59,130,246,0.5)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, radius * 3, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const grad = ctx.createRadialGradient(p.sx - 2, p.sy - 2, 0, p.sx, p.sy, radius);
    grad.addColorStop(0, charge > 0 ? "#f87171" : "#60a5fa");
    grad.addColorStop(1, charge > 0 ? "#b91c1c" : "#1d4ed8");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Charge label
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(charge >= 0 ? "+" : "\u2212", p.sx, p.sy + 1);
    ctx.textBaseline = "alphabetic";
  }

  function drawForceVectors(): void {
    const p = project(pos);

    // Compute Lorentz force: F = q(v x B), B = (0,0,B)
    // v x B = (vy*B, -vx*B, 0)
    const Fx = charge * (vel.y * Bstrength);
    const Fy = charge * (-vel.x * Bstrength);
    const Fz = 0;

    const forceScale = 1.5;
    const fEnd = project({
      x: pos.x + Fx * forceScale,
      y: pos.y + Fy * forceScale,
      z: pos.z + Fz * forceScale,
    });

    // Force arrow (cyan)
    if (Math.abs(Fx) > 0.001 || Math.abs(Fy) > 0.001) {
      drawArrow2D(p.sx, p.sy, fEnd.sx, fEnd.sy, "#22d3ee", 2.5);
      ctx.fillStyle = "#22d3ee";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("F", fEnd.sx + 6, fEnd.sy - 4);
    }

    // Velocity arrow (green)
    const vScale = 1.2;
    const vEnd = project({
      x: pos.x + vel.x * vScale,
      y: pos.y + vel.y * vScale,
      z: pos.z + vel.z * vScale,
    });
    drawArrow2D(p.sx, p.sy, vEnd.sx, vEnd.sy, "#4ade80", 2);
    ctx.fillStyle = "#4ade80";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("v", vEnd.sx + 6, vEnd.sy - 4);
  }

  function drawArrow2D(x1: number, y1: number, x2: number, y2: number, color: string, lw: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 3) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const headLen = Math.min(10, len * 0.3);
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.35), y2 - headLen * Math.sin(angle - 0.35));
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.35), y2 - headLen * Math.sin(angle + 0.35));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawInfoPanel(): void {
    const px2 = 15;
    const py2 = height - 175;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(px2, py2, 220, 160, 8);
    ctx.fill();

    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`B = ${Bstrength.toFixed(2)} T (z-axis)`, px2 + 12, py2 + 22);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`q = ${charge.toFixed(2)} C,  m = ${mass.toFixed(2)} kg`, px2 + 12, py2 + 44);

    const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
    const vPerp = Math.sqrt(vel.x ** 2 + vel.y ** 2);
    const vPar = Math.abs(vel.z);
    ctx.fillText(`|v| = ${speed.toFixed(2)} m/s`, px2 + 12, py2 + 64);
    ctx.fillText(`v_perp = ${vPerp.toFixed(2)},  v_par = ${vPar.toFixed(2)}`, px2 + 12, py2 + 82);

    const absB = Math.abs(Bstrength);
    const rc = absB > 0.001 && vPerp > 0.001 ? (mass * vPerp) / (Math.abs(charge) * absB) : 0;
    const omega = absB > 0.001 ? (Math.abs(charge) * absB) / mass : 0;
    const pitch = omega > 0 ? (2 * Math.PI * vPar) / omega : 0;

    ctx.fillStyle = "#a78bfa";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText("Helix Properties:", px2 + 12, py2 + 105);
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`Cyclotron r = ${rc.toFixed(3)} m`, px2 + 12, py2 + 122);
    ctx.fillText(`\u03C9_c = ${omega.toFixed(2)} rad/s`, px2 + 12, py2 + 138);
    ctx.fillText(`Pitch = ${pitch.toFixed(3)} m`, px2 + 12, py2 + 154);
  }

  function drawProjectionDiagram(): void {
    // Small inset showing the xy-plane projection (circular component)
    const diagX = width - 170;
    const diagY = height - 170;
    const diagR = 65;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(diagX - diagR - 15, diagY - diagR - 25, diagR * 2 + 30, diagR * 2 + 50, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("XY Projection", diagX, diagY - diagR - 8);

    // Circle for cyclotron radius
    const absB = Math.abs(Bstrength);
    const vPerp = Math.sqrt(vel.x ** 2 + vel.y ** 2);
    const rc = absB > 0.001 && vPerp > 0.001 ? (mass * vPerp) / (Math.abs(charge) * absB) : 1;
    const projScale = (diagR * 0.8) / Math.max(rc, 0.01);

    // Draw recent xy trail
    ctx.strokeStyle = "rgba(168,139,250,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const recentCount = Math.min(trail.length, 500);
    for (let i = trail.length - recentCount; i < trail.length; i++) {
      const t = trail[i];
      const sx = diagX + t.pos.x * projScale;
      const sy = diagY - t.pos.y * projScale;
      if (i === trail.length - recentCount) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Current position dot
    const cpx = diagX + pos.x * projScale;
    const cpy = diagY - pos.y * projScale;
    ctx.fillStyle = charge > 0 ? "#f87171" : "#60a5fa";
    ctx.beginPath();
    ctx.arc(cpx, cpy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Axes
    ctx.strokeStyle = "rgba(148,163,184,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(diagX - diagR, diagY);
    ctx.lineTo(diagX + diagR, diagY);
    ctx.moveTo(diagX, diagY - diagR);
    ctx.lineTo(diagX, diagY + diagR);
    ctx.stroke();

    ctx.fillStyle = "rgba(148,163,184,0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("x", diagX + diagR - 5, diagY - 5);
    ctx.fillText("y", diagX + 8, diagY - diagR + 5);
  }

  function render(): void {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawBFieldIndicators();
    drawAxes();
    drawTrail();
    drawForceVectors();
    drawParticle();
    drawInfoPanel();
    drawProjectionDiagram();

    // Formula
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(width / 2 - 140, height - 45, 280, 35, 8);
    ctx.fill();
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("F = q(v \u00D7 B)   \u2192   Helical Motion", width / 2, height - 22);

    // Title
    ctx.fillStyle = "rgba(226,232,240,0.9)";
    ctx.font = `bold ${Math.max(18, width * 0.026)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Lorentz Force 3D", width / 2, 30);

    ctx.fillStyle = "rgba(148,163,184,0.7)";
    ctx.font = `${Math.max(12, width * 0.016)}px system-ui, sans-serif`;
    ctx.fillText("Helical Motion of Charged Particle in Magnetic Field", width / 2, 50);

    ctx.fillStyle = "rgba(148,163,184,0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(2)} s`, 15, 20);
  }

  function reset(): void {
    resetState();
  }

  function destroy(): void {
    trail = [];
  }

  function getStateDescription(): string {
    const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
    const vPerp = Math.sqrt(vel.x ** 2 + vel.y ** 2);
    const vPar = Math.abs(vel.z);
    const absB = Math.abs(Bstrength);
    const rc = absB > 0.001 ? (mass * vPerp) / (Math.abs(charge) * absB) : Infinity;
    const omega = absB > 0.001 ? (Math.abs(charge) * absB) / mass : 0;
    const pitch = omega > 0 ? (2 * Math.PI * vPar) / omega : 0;

    return (
      `Lorentz Force 3D: q=${charge}C, m=${mass}kg, B=${Bstrength}T along z. ` +
      `Position: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})m. ` +
      `Velocity: (${vel.x.toFixed(2)}, ${vel.y.toFixed(2)}, ${vel.z.toFixed(2)})m/s, |v|=${speed.toFixed(2)}m/s. ` +
      `v_perp=${vPerp.toFixed(2)}, v_par=${vPar.toFixed(2)}. ` +
      `Cyclotron radius=${rc < 1000 ? rc.toFixed(3) : "inf"}m, omega_c=${omega.toFixed(2)}rad/s, pitch=${pitch.toFixed(3)}m. ` +
      `Particle follows helical path: circular in xy-plane, linear along z (B direction). ` +
      `Boris integrator preserves kinetic energy exactly.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LorentzForce3DFactory;
