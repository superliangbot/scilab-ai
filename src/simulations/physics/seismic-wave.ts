import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const SeismicWaveFactory: SimulationFactory = () => {
  const config = getSimConfig("seismic-wave")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let frequency = 2;
  let amplitude = 30;
  let waveType = 0; // 0 = P-wave, 1 = S-wave, 2 = both
  let speed = 3;

  // Grid of particles representing the medium
  const COLS = 40;
  const ROWS = 16;
  interface Particle {
    restX: number;
    restY: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
  }
  let particles: Particle[] = [];

  // Wave pulse tracking
  let waveActive = false;
  let waveOriginTime = 0;

  const BG_TOP = "#0a0e1a";
  const BG_BOT = "#14182a";
  const P_COLOR = "#3b82f6";
  const S_COLOR = "#ef4444";
  const GRID_COLOR = "rgba(148,163,184,0.12)";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#94a3b8";

  function initParticles() {
    particles = [];
    const marginX = width * 0.08;
    const marginY = height * 0.18;
    const areaW = width - 2 * marginX;
    const areaH = height * 0.52;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const rx = marginX + (c / (COLS - 1)) * areaW;
        const ry = marginY + (r / (ROWS - 1)) * areaH;
        particles.push({ restX: rx, restY: ry, x: rx, y: ry, vx: 0, vy: 0 });
      }
    }
  }

  function startWave() {
    waveActive = true;
    waveOriginTime = time;
    // Reset particle positions
    for (const p of particles) {
      p.x = p.restX;
      p.y = p.restY;
      p.vx = 0;
      p.vy = 0;
    }
  }

  function updateParticles() {
    if (!waveActive) return;

    const elapsed = time - waveOriginTime;
    const pixelsPerSec = speed * 80; // scale speed to pixels
    const waveFrontX = particles[0].restX + elapsed * pixelsPerSec;
    const omega = frequency * Math.PI * 2;
    const wavelength = pixelsPerSec / frequency;
    const k = (2 * Math.PI) / wavelength;
    const amp = amplitude;

    for (const p of particles) {
      const dist = p.restX - particles[0].restX;
      // Only displace particles the wave front has reached
      if (dist <= elapsed * pixelsPerSec) {
        const phase = omega * elapsed - k * dist;
        // Envelope: attenuate behind the wave front slightly
        const envelope = Math.exp(-0.0005 * dist);
        // Also taper the leading edge
        const frontDist = waveFrontX - p.restX;
        const frontTaper = frontDist < wavelength ? frontDist / wavelength : 1;

        const showP = waveType === 0 || waveType === 2;
        const showS = waveType === 1 || waveType === 2;

        let dx = 0;
        let dy = 0;

        if (showP) {
          // P-wave: longitudinal displacement (parallel to propagation)
          dx += amp * envelope * frontTaper * Math.sin(phase);
        }
        if (showS) {
          // S-wave: transverse displacement (perpendicular to propagation)
          // S-wave travels slower; use 0.6× speed
          const sElapsed = elapsed;
          const sFrontX = particles[0].restX + sElapsed * pixelsPerSec * 0.6;
          if (dist <= sElapsed * pixelsPerSec * 0.6) {
            const sK = k / 0.6;
            const sPhase = omega * 0.6 * sElapsed - sK * dist;
            const sFrontDist = sFrontX - p.restX;
            const sFrontTaper = sFrontDist < wavelength ? sFrontDist / wavelength : 1;
            dy += amp * envelope * sFrontTaper * Math.sin(sPhase);
          }
        }

        p.x = p.restX + dx;
        p.y = p.restY + dy;
      } else {
        p.x = p.restX;
        p.y = p.restY;
      }
    }
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, BG_TOP);
    grad.addColorStop(1, BG_BOT);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawMediumBg() {
    if (particles.length === 0) return;
    const marginX = width * 0.08;
    const marginY = height * 0.18;
    const areaW = width - 2 * marginX;
    const areaH = height * 0.52;
    ctx.fillStyle = "rgba(30,41,59,0.5)";
    ctx.beginPath();
    ctx.roundRect(marginX - 10, marginY - 10, areaW + 20, areaH + 20, 8);
    ctx.fill();

    // Grid lines
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++) {
      const y = marginY + (r / (ROWS - 1)) * areaH;
      ctx.beginPath();
      ctx.moveTo(marginX, y);
      ctx.lineTo(marginX + areaW, y);
      ctx.stroke();
    }
    for (let c = 0; c < COLS; c++) {
      const x = marginX + (c / (COLS - 1)) * areaW;
      ctx.beginPath();
      ctx.moveTo(x, marginY);
      ctx.lineTo(x, marginY + areaH);
      ctx.stroke();
    }
  }

  function drawParticles() {
    const showP = waveType === 0 || waveType === 2;
    const showS = waveType === 1 || waveType === 2;

    for (const p of particles) {
      const dx = p.x - p.restX;
      const dy = p.y - p.restY;
      const disp = Math.sqrt(dx * dx + dy * dy);
      const maxDisp = amplitude;
      const ratio = Math.min(disp / Math.max(maxDisp, 1), 1);

      // Color based on displacement type
      let color: string;
      if (Math.abs(dy) > Math.abs(dx) && showS) {
        // Predominantly transverse → S-wave color
        const r = 239;
        const g = Math.round(68 + (1 - ratio) * 100);
        const b = Math.round(68 + (1 - ratio) * 100);
        color = `rgb(${r},${g},${b})`;
      } else if (Math.abs(dx) > 0.5 && showP) {
        // Predominantly longitudinal → P-wave color
        const r = Math.round(59 + (1 - ratio) * 80);
        const g = Math.round(130 + (1 - ratio) * 60);
        const b = 246;
        color = `rgb(${r},${g},${b})`;
      } else {
        color = "rgba(148,163,184,0.6)";
      }

      const radius = 3 + ratio * 3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Displacement vector
      if (disp > 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(p.restX, p.restY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawWaveFront() {
    if (!waveActive) return;
    const elapsed = time - waveOriginTime;
    const pixelsPerSec = speed * 80;
    const showP = waveType === 0 || waveType === 2;
    const showS = waveType === 1 || waveType === 2;

    const marginY = height * 0.18;
    const areaH = height * 0.52;
    const x0 = particles.length > 0 ? particles[0].restX : width * 0.08;

    if (showP) {
      const pFrontX = x0 + elapsed * pixelsPerSec;
      if (pFrontX < width * 0.92) {
        ctx.strokeStyle = P_COLOR;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(pFrontX, marginY - 10);
        ctx.lineTo(pFrontX, marginY + areaH + 10);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = P_COLOR;
        ctx.font = "11px monospace";
        ctx.textAlign = "center";
        ctx.fillText("P front", pFrontX, marginY - 14);
      }
    }

    if (showS) {
      const sFrontX = x0 + elapsed * pixelsPerSec * 0.6;
      if (sFrontX < width * 0.92) {
        ctx.strokeStyle = S_COLOR;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(sFrontX, marginY - 10);
        ctx.lineTo(sFrontX, marginY + areaH + 10);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = S_COLOR;
        ctx.font = "11px monospace";
        ctx.textAlign = "center";
        ctx.fillText("S front", sFrontX, marginY - 14);
      }
    }
  }

  function drawDisplacementGraph() {
    if (!waveActive || particles.length === 0) return;
    const gx = width * 0.08;
    const gy = height * 0.78;
    const gw = width * 0.84;
    const gh = height * 0.18;

    ctx.fillStyle = "rgba(15,23,42,0.85)";
    ctx.beginPath();
    ctx.roundRect(gx - 6, gy - 6, gw + 12, gh + 12, 6);
    ctx.fill();

    // Axes
    ctx.strokeStyle = "rgba(148,163,184,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx, gy + gh / 2);
    ctx.lineTo(gx + gw, gy + gh / 2);
    ctx.stroke();

    ctx.fillStyle = TEXT_DIM;
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillText("Displacement", gx - 10, gy + gh / 2 - 4);

    const showP = waveType === 0 || waveType === 2;
    const showS = waveType === 1 || waveType === 2;

    // Take first row for the graph
    const rowParticles = particles.slice(0, COLS);
    const xMin = rowParticles[0].restX;
    const xMax = rowParticles[COLS - 1].restX;

    if (showP) {
      ctx.strokeStyle = P_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < COLS; i++) {
        const p = rowParticles[i];
        const px = gx + ((p.restX - xMin) / (xMax - xMin)) * gw;
        const dx = p.x - p.restX;
        const py = gy + gh / 2 - (dx / (amplitude || 1)) * (gh * 0.4);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    if (showS) {
      ctx.strokeStyle = S_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < COLS; i++) {
        const p = rowParticles[i];
        const px = gx + ((p.restX - xMin) / (xMax - xMin)) * gw;
        const dy = p.y - p.restY;
        const py = gy + gh / 2 - (dy / (amplitude || 1)) * (gh * 0.4);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Legend
    let lx = gx + 6;
    const ly = gy + 4;
    if (showP) {
      ctx.fillStyle = P_COLOR;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText("— P (longitudinal)", lx, ly);
      lx += 130;
    }
    if (showS) {
      ctx.fillStyle = S_COLOR;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText("— S (transverse)", lx, ly);
    }
  }

  function drawInfoPanel() {
    const px = 12;
    const py = 12;
    const pw = 220;
    const lineH = 17;
    const lines = 9;
    const ph = lineH * lines + 16;

    ctx.fillStyle = "rgba(15,23,42,0.9)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100,116,139,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.stroke();

    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let y = py + 8;
    const x = px + 10;

    ctx.fillStyle = "#fbbf24";
    ctx.fillText("Seismic Wave", x, y);
    y += lineH;

    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(`Frequency: ${frequency.toFixed(1)} Hz`, x, y);
    y += lineH;
    ctx.fillText(`Amplitude: ${amplitude.toFixed(0)} px`, x, y);
    y += lineH;
    ctx.fillText(`Speed: ${speed.toFixed(1)} km/s`, x, y);
    y += lineH;

    const typeStr = waveType === 0 ? "P-wave" : waveType === 1 ? "S-wave" : "Both";
    ctx.fillText(`Mode: ${typeStr}`, x, y);
    y += lineH;

    ctx.fillStyle = P_COLOR;
    ctx.fillText("P: longitudinal", x, y);
    y += lineH;
    ctx.fillStyle = S_COLOR;
    ctx.fillText("S: transverse", x, y);
    y += lineH;

    ctx.fillStyle = TEXT_DIM;
    if (waveActive) {
      const el = time - waveOriginTime;
      ctx.fillText(`Elapsed: ${el.toFixed(1)} s`, x, y);
    } else {
      ctx.fillText("Click canvas to send pulse", x, y);
    }
    y += lineH;

    ctx.fillText("v_P ≈ 1.7 × v_S (Earth)", x, y);
  }

  function drawPropagationDiagram() {
    // Small diagram in top-right showing particle motion direction
    const dx = width - 230;
    const dy = 12;
    const dw = 218;
    const dh = 68;

    ctx.fillStyle = "rgba(15,23,42,0.85)";
    ctx.beginPath();
    ctx.roundRect(dx, dy, dw, dh, 6);
    ctx.fill();

    const cx = dx + 10;
    let cy = dy + 14;

    // P-wave arrow diagram
    ctx.fillStyle = P_COLOR;
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("P-wave:", cx, cy);

    // Draw oscillation along propagation direction
    ctx.strokeStyle = P_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 60; i++) {
      const px = cx + 58 + i * 2;
      const py = cy - 2 + 4 * Math.sin(i * 0.5 + time * 5);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Arrow for propagation
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "10px monospace";
    ctx.fillText("→ propagation", cx + 60, cy + 14);

    cy += 34;

    // S-wave arrow diagram
    ctx.fillStyle = S_COLOR;
    ctx.font = "10px monospace";
    ctx.fillText("S-wave:", cx, cy);

    ctx.strokeStyle = S_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 60; i++) {
      const px = cx + 58 + i * 2;
      const py = cy - 2 + 6 * Math.sin(i * 0.4 + time * 3);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function handleClick() {
    startWave();
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      waveActive = false;
      initParticles();
      canvas.addEventListener("click", handleClick);
    },

    update(dt: number, params: Record<string, number>) {
      frequency = params.frequency ?? frequency;
      amplitude = params.amplitude ?? amplitude;
      speed = params.speed ?? speed;
      const newType = Math.round(params.waveType ?? waveType);
      if (newType !== waveType) {
        waveType = newType;
        if (waveActive) startWave();
      }

      const step = Math.min(dt, 0.033);
      time += step;
      updateParticles();
    },

    render() {
      drawBackground();
      drawMediumBg();
      drawParticles();
      drawWaveFront();
      drawDisplacementGraph();
      drawInfoPanel();
      drawPropagationDiagram();
    },

    reset() {
      time = 0;
      waveActive = false;
      waveOriginTime = 0;
      initParticles();
    },

    destroy() {
      particles = [];
      canvas.removeEventListener("click", handleClick);
    },

    getStateDescription(): string {
      const typeStr = waveType === 0 ? "P-wave (longitudinal)" : waveType === 1 ? "S-wave (transverse)" : "Both P and S waves";
      const elapsed = waveActive ? (time - waveOriginTime).toFixed(1) : "0";
      return (
        `Seismic Wave simulation showing ${typeStr} propagation through a grid of particles. ` +
        `Frequency=${frequency.toFixed(1)} Hz, amplitude=${amplitude}, speed=${speed.toFixed(1)} km/s. ` +
        `Elapsed: ${elapsed}s. P-waves are compressional (particles move parallel to wave direction), ` +
        `S-waves are shear (particles move perpendicular). P-waves travel ~1.7× faster than S-waves in Earth's crust. ` +
        `The time difference between P and S arrivals helps determine earthquake distance.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
      initParticles();
    },
  };

  return engine;
};

export default SeismicWaveFactory;
