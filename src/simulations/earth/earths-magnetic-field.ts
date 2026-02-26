import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const earthsMagneticFieldFactory: SimulationFactory = () => {
  const config = getSimConfig("earths-magnetic-field")!;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W = 800, H = 600, time = 0;

  let fieldStrength = 1;
  let solarWindStrength = 1;
  let showAurora = 1;
  let dipoleTilt = 11.5;

  // Solar wind particles
  interface WindParticle { x: number; y: number; vx: number; vy: number; trapped: boolean; life: number; }
  let solarParticles: WindParticle[] = [];

  // Dipole field: B_r = (2M cos θ)/r³, B_θ = (M sin θ)/r³
  function fieldLine(startTheta: number, steps: number): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    const tiltRad = (dipoleTilt * Math.PI) / 180;
    // Parametric dipole field line: r = L * cos²(λ), where L is the L-shell
    const L = 3.0;
    for (let i = 0; i <= steps; i++) {
      const lambda = -Math.PI / 2 + (i / steps) * Math.PI; // -90° to +90°
      const r = L * Math.cos(lambda) * Math.cos(lambda);
      if (r < 0.3) continue;
      const x = r * Math.cos(lambda + tiltRad + startTheta);
      const y = r * Math.sin(lambda + tiltRad + startTheta);
      points.push({ x, y });
    }
    return points;
  }

  function drawEarth(cx: number, cy: number, r: number) {
    // Earth
    const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
    grad.addColorStop(0, "#3b82f6");
    grad.addColorStop(0.4, "#2563eb");
    grad.addColorStop(0.7, "#1d4ed8");
    grad.addColorStop(1, "#1e3a8a");
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Continents hint (simple green patches)
    ctx.fillStyle = "rgba(34, 197, 94, 0.4)";
    ctx.beginPath();
    ctx.arc(cx - r * 0.15, cy - r * 0.1, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + r * 0.2, cy + r * 0.15, r * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Rotation axis
    const tiltRad = (dipoleTilt * Math.PI) / 180;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx - Math.sin(tiltRad) * r * 1.8, cy - Math.cos(tiltRad) * r * 1.8);
    ctx.lineTo(cx + Math.sin(tiltRad) * r * 1.8, cy + Math.cos(tiltRad) * r * 1.8);
    ctx.stroke();
    ctx.setLineDash([]);

    // N/S labels on magnetic axis
    ctx.font = "bold 11px Arial";
    ctx.fillStyle = "#ef4444";
    ctx.textAlign = "center";
    ctx.fillText("N", cx - Math.sin(tiltRad) * r * 1.4, cy - Math.cos(tiltRad) * r * 1.4);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("S", cx + Math.sin(tiltRad) * r * 1.4, cy + Math.cos(tiltRad) * r * 1.4);
  }

  function drawFieldLines(cx: number, cy: number, earthR: number) {
    const scale = earthR * 0.6;
    const numLines = 8;
    for (let i = 0; i < numLines; i++) {
      const startTheta = (i / numLines) * Math.PI * 2;
      const pts = fieldLine(startTheta, 60);
      if (pts.length < 2) continue;

      const hue = 200 + (i / numLines) * 60;
      ctx.strokeStyle = `hsla(${hue}, 70%, 60%, ${0.3 * fieldStrength})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let j = 0; j < pts.length; j++) {
        const sx = cx + pts[j].x * scale;
        const sy = cy - pts[j].y * scale;
        if (j === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // Arrow at midpoint
      if (pts.length > 10) {
        const mid = Math.floor(pts.length / 2);
        const sx = cx + pts[mid].x * scale;
        const sy = cy - pts[mid].y * scale;
        const dx = pts[mid + 1].x - pts[mid - 1].x;
        const dy = -(pts[mid + 1].y - pts[mid - 1].y);
        const angle = Math.atan2(dy, dx);
        ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${0.5 * fieldStrength})`;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(angle) * 5, sy + Math.sin(angle) * 5);
        ctx.lineTo(sx + Math.cos(angle + 2.5) * 5, sy + Math.sin(angle + 2.5) * 5);
        ctx.lineTo(sx + Math.cos(angle - 2.5) * 5, sy + Math.sin(angle - 2.5) * 5);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawMagnetosphere(cx: number, cy: number, earthR: number) {
    // Bow shock / magnetopause
    const compressFactor = 1 / (0.5 + solarWindStrength * 0.5);
    ctx.strokeStyle = "rgba(147, 51, 234, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Dayside (compressed)
    for (let a = -Math.PI / 2; a <= Math.PI / 2; a += 0.05) {
      const r = earthR * (2.5 + compressFactor) / (1 + 0.3 * Math.cos(a));
      const sx = cx + r * Math.cos(a);
      const sy = cy + r * Math.sin(a);
      if (a === -Math.PI / 2) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Magnetotail (nightside)
    ctx.strokeStyle = "rgba(147, 51, 234, 0.15)";
    ctx.beginPath();
    ctx.moveTo(cx - earthR * 3, cy - earthR * 2.5);
    ctx.lineTo(cx - earthR * 8, cy - earthR * 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - earthR * 3, cy + earthR * 2.5);
    ctx.lineTo(cx - earthR * 8, cy + earthR * 3);
    ctx.stroke();

    ctx.font = "10px Arial";
    ctx.fillStyle = "rgba(147, 51, 234, 0.5)";
    ctx.textAlign = "center";
    ctx.fillText("Magnetopause", cx + earthR * 4, cy - earthR * 2);
    ctx.fillText("Magnetotail", cx - earthR * 5.5, cy);
  }

  function drawSolarWind(cx: number, cy: number, earthR: number) {
    // Spawn
    if (Math.random() < 0.3 * solarWindStrength) {
      solarParticles.push({
        x: W + 10, y: Math.random() * H,
        vx: -120 * solarWindStrength - Math.random() * 40,
        vy: (Math.random() - 0.5) * 20,
        trapped: false, life: 5,
      });
    }

    ctx.fillStyle = "rgba(251, 191, 36, 0.6)";
    for (const p of solarParticles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Label
    ctx.font = "12px Arial";
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "right";
    ctx.fillText("Solar Wind →", W - 15, 25);
  }

  function drawAurora(cx: number, cy: number, earthR: number) {
    if (!showAurora) return;
    const tiltRad = (dipoleTilt * Math.PI) / 180;
    // Aurora ovals at ~65-75° magnetic latitude
    for (const pole of [-1, 1]) {
      const baseAngle = pole * (Math.PI / 2 - tiltRad);
      for (let i = 0; i < 15; i++) {
        const angle = baseAngle + (Math.random() - 0.5) * 0.5;
        const r = earthR * (1.02 + Math.random() * 0.15);
        const ax = cx + r * Math.cos(angle) + (Math.random() - 0.5) * 8;
        const ay = cy - r * Math.sin(angle) + (Math.random() - 0.5) * 8;
        const intensity = 0.3 + Math.sin(time * 3 + i) * 0.2;
        ctx.fillStyle = pole > 0
          ? `rgba(34, 197, 94, ${intensity})`
          : `rgba(147, 51, 234, ${intensity})`;
        ctx.beginPath();
        ctx.arc(ax, ay, 2 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawVanAllenBelts(cx: number, cy: number, earthR: number) {
    // Inner belt (~1.5 R_E) and outer belt (~4 R_E)
    for (const { r, color, label } of [
      { r: 1.5, color: "rgba(239, 68, 68, 0.1)", label: "Inner Belt" },
      { r: 3.5, color: "rgba(59, 130, 246, 0.07)", label: "Outer Belt" },
    ]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx, cy, earthR * r * 1.2, earthR * r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "9px Arial";
      ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
      ctx.textAlign = "center";
      ctx.fillText(label, cx, cy + earthR * r * 0.5 + 10);
    }
  }

  function drawInfoPanel() {
    const px = W * 0.02, py = H * 0.78, pw = W * 0.96, ph = H * 0.2;
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeRect(px, py, pw, ph);

    ctx.font = "12px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    const y0 = py + 18;
    ctx.fillText(`Field Strength: ${(fieldStrength * 30).toFixed(0)} μT (at equator)`, px + 15, y0);
    ctx.fillText(`Dipole Tilt: ${dipoleTilt.toFixed(1)}° from rotation axis`, px + 15, y0 + 18);
    ctx.fillText(`Solar Wind: ${solarWindStrength.toFixed(1)}× normal`, px + 15, y0 + 36);

    ctx.textAlign = "right";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("B_r = (2μ₀m cos θ) / (4πr³)", px + pw - 15, y0);
    ctx.fillText("B_θ = (μ₀m sin θ) / (4πr³)", px + pw - 15, y0 + 18);
    ctx.fillText("Dipole field approximation", px + pw - 15, y0 + 36);
  }

  const engine: SimulationEngine = {
    config,
    init(c) {
      canvas = c; ctx = c.getContext("2d")!; W = c.width; H = c.height;
      time = 0; solarParticles = [];
    },
    update(dt, params) {
      fieldStrength = params.fieldStrength ?? fieldStrength;
      solarWindStrength = params.solarWindStrength ?? solarWindStrength;
      showAurora = Math.round(params.showAurora ?? showAurora);
      dipoleTilt = params.dipoleTilt ?? dipoleTilt;
      time += dt;

      for (const p of solarParticles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      solarParticles = solarParticles.filter(p => p.life > 0 && p.x > -10);
    },
    render() {
      ctx.fillStyle = "#050510";
      ctx.fillRect(0, 0, W, H);

      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Earth's Magnetic Field", W / 2, 28);

      const cx = W * 0.45, cy = H * 0.4;
      const earthR = Math.min(W, H) * 0.09;

      drawVanAllenBelts(cx, cy, earthR);
      drawMagnetosphere(cx, cy, earthR);
      drawFieldLines(cx, cy, earthR);
      drawEarth(cx, cy, earthR);
      drawAurora(cx, cy, earthR);
      drawSolarWind(cx, cy, earthR);
      drawInfoPanel();
    },
    reset() {
      time = 0;
      solarParticles = [];
    },
    destroy() {},
    getStateDescription() {
      return `Earth's magnetic field: dipole tilt ${dipoleTilt.toFixed(1)}°, field strength ${(fieldStrength * 30).toFixed(0)} μT at equator, solar wind ${solarWindStrength.toFixed(1)}× normal. ${showAurora ? "Aurora visible at magnetic poles." : "Aurora display off."}`;
    },
    resize(w, h) { W = w; H = h; },
  };
  return engine;
};

export default earthsMagneticFieldFactory;
