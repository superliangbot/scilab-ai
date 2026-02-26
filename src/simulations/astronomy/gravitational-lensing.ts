import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const gravitationalLensingFactory: SimulationFactory = () => {
  const config = getSimConfig("gravitational-lensing")!;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W = 800, H = 600, time = 0;

  let lensMass = 1;
  let sourceDistance = 2;
  let lensDistance = 1;
  let alignment = 0.5;

  // Background star field (fixed)
  const bgStars: { x: number; y: number; r: number; b: number }[] = [];

  function initStars() {
    bgStars.length = 0;
    for (let i = 0; i < 200; i++) {
      bgStars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.5 + Math.random() * 1.5,
        b: 0.3 + Math.random() * 0.7,
      });
    }
  }

  // Einstein radius: θE = sqrt(4GM/c² · Dls/(Dl·Ds))
  function einsteinRadius(): number {
    const dls = sourceDistance - lensDistance;
    if (dls <= 0) return 0;
    return Math.sqrt(4 * lensMass * dls / (lensDistance * sourceDistance)) * 0.5;
  }

  // Lens equation: β = θ - θE²/θ  →  θ± = (β ± sqrt(β² + 4θE²)) / 2
  function imagePositions(beta: number, thetaE: number): number[] {
    if (thetaE <= 0) return [beta];
    const disc = beta * beta + 4 * thetaE * thetaE;
    const sqrtDisc = Math.sqrt(disc);
    return [(beta + sqrtDisc) / 2, (beta - sqrtDisc) / 2];
  }

  function magnification(theta: number, thetaE: number): number {
    if (thetaE <= 0) return 1;
    const u = theta / thetaE;
    const u2 = u * u;
    if (u2 < 0.001) return 10; // cap near-perfect alignment
    return Math.abs(u2 / (u2 - 1));
  }

  function drawLens(cx: number, cy: number) {
    // Dark matter halo representation
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
    grad.addColorStop(0, "rgba(100, 100, 200, 0.4)");
    grad.addColorStop(0.5, "rgba(80, 80, 180, 0.15)");
    grad.addColorStop(1, "rgba(60, 60, 160, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Center point
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#8b8bff";
    ctx.fill();
    ctx.font = "11px Arial";
    ctx.fillStyle = "#8b8bff";
    ctx.textAlign = "center";
    ctx.fillText("Lens", cx, cy + 18);
  }

  function drawDistortedGrid(cx: number, cy: number, thetaE: number) {
    const scale = Math.min(W, H) * 0.3;
    const thetaEpx = thetaE * scale;

    // Einstein ring
    ctx.strokeStyle = "rgba(100, 200, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, thetaEpx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "10px Arial";
    ctx.fillStyle = "rgba(100, 200, 255, 0.6)";
    ctx.textAlign = "left";
    ctx.fillText(`θE = ${thetaE.toFixed(3)}`, cx + thetaEpx + 5, cy);

    // Draw deflected light rays
    ctx.strokeStyle = "rgba(255, 200, 100, 0.15)";
    ctx.lineWidth = 0.5;
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
      for (let r = 0.2; r < 2.5; r += 0.3) {
        const bx = r * Math.cos(angle);
        const by = r * Math.sin(angle);
        const beta = Math.sqrt(bx * bx + by * by);
        if (beta < 0.01) continue;
        const imgs = imagePositions(beta, thetaE);
        for (const theta of imgs) {
          const imgAngle = theta > 0 ? angle : angle + Math.PI;
          const absTheta = Math.abs(theta);
          const ix = cx + absTheta * scale * Math.cos(imgAngle);
          const iy = cy + absTheta * scale * Math.sin(imgAngle);
          const mag = magnification(theta, thetaE);
          const dotR = Math.min(3, 1 + mag * 0.3);
          ctx.fillStyle = `rgba(255, 220, 150, ${Math.min(0.8, 0.1 + mag * 0.05)})`;
          ctx.beginPath();
          ctx.arc(ix, iy, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawSource(cx: number, cy: number, thetaE: number) {
    const scale = Math.min(W, H) * 0.3;
    // Source position (offset by alignment)
    const beta = alignment * thetaE * 2;
    const srcX = cx + beta * scale;
    const srcY = cy;

    // True source position (ghosted)
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(srcX, srcY, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ffdd88";
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = "10px Arial";
    ctx.fillStyle = "#ffdd88";
    ctx.textAlign = "center";
    ctx.fillText("Source (true)", srcX, srcY + 20);

    // Lensed images
    const imgs = imagePositions(beta, thetaE);
    for (let i = 0; i < imgs.length; i++) {
      const theta = imgs[i];
      const ix = cx + theta * scale;
      const iy = cy;
      const mag = magnification(theta, thetaE);
      const r = Math.min(12, 4 + mag * 1.5);

      const grad = ctx.createRadialGradient(ix, iy, 0, ix, iy, r);
      grad.addColorStop(0, `rgba(255, 230, 150, ${Math.min(1, 0.3 + mag * 0.1)})`);
      grad.addColorStop(1, "rgba(255, 200, 100, 0)");
      ctx.beginPath();
      ctx.arc(ix, iy, r * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ix, iy, r, 0, Math.PI * 2);
      ctx.fillStyle = "#ffee99";
      ctx.fill();

      ctx.font = "10px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(`Image ${i + 1} (μ=${mag.toFixed(1)})`, ix, iy - r - 6);
    }

    // If alignment ≈ 0, draw Einstein ring
    if (alignment < 0.05) {
      ctx.strokeStyle = "#ffee99";
      ctx.lineWidth = 2 + lensMass;
      ctx.beginPath();
      ctx.arc(cx, cy, thetaE * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "12px Arial";
      ctx.fillStyle = "#ffee99";
      ctx.fillText("Einstein Ring", cx, cy - thetaE * scale - 10);
    }
  }

  function drawDiagram() {
    const diagramY = H * 0.72;
    const diagramH = H * 0.22;
    const diagramX = W * 0.05;
    const diagramW = W * 0.9;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(diagramX, diagramY, diagramW, diagramH);
    ctx.strokeRect(diagramX, diagramY, diagramW, diagramH);

    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Light Path Diagram (Side View)", diagramX + diagramW / 2, diagramY + 16);

    const midY = diagramY + diagramH / 2 + 5;
    // Observer
    const obsX = diagramX + 30;
    ctx.fillStyle = "#60a5fa";
    ctx.beginPath();
    ctx.arc(obsX, midY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "10px Arial";
    ctx.fillText("Observer", obsX, midY + 18);

    // Lens
    const lensX = diagramX + diagramW * (lensDistance / sourceDistance) * 0.7 + 50;
    ctx.fillStyle = "#8b8bff";
    ctx.fillRect(lensX - 2, midY - 25, 4, 50);
    ctx.fillText("Lens", lensX, midY + 35);

    // Source
    const srcX = diagramX + diagramW - 30;
    ctx.fillStyle = "#ffdd88";
    ctx.beginPath();
    ctx.arc(srcX, midY - alignment * 20, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText("Source", srcX, midY + 18);

    // Light rays (bent)
    ctx.strokeStyle = "rgba(255, 220, 100, 0.5)";
    ctx.lineWidth = 1;
    for (const offset of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(srcX, midY - alignment * 20);
      ctx.lineTo(lensX, midY + offset * 12);
      ctx.lineTo(obsX, midY);
      ctx.stroke();
    }
  }

  const engine: SimulationEngine = {
    config,
    init(c) {
      canvas = c;
      ctx = c.getContext("2d")!;
      W = c.width;
      H = c.height;
      time = 0;
      initStars();
    },
    update(dt, params) {
      lensMass = params.lensMass ?? lensMass;
      sourceDistance = params.sourceDistance ?? sourceDistance;
      lensDistance = params.lensDistance ?? lensDistance;
      alignment = params.alignment ?? alignment;
      time += dt;
    },
    render() {
      ctx.fillStyle = "#050510";
      ctx.fillRect(0, 0, W, H);

      // Background stars
      for (const s of bgStars) {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.b * 0.6})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      const cx = W / 2;
      const cy = H * 0.32;
      const thetaE = einsteinRadius();

      // Title
      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Gravitational Lensing", W / 2, 28);

      drawDistortedGrid(cx, cy, thetaE);
      drawLens(cx, cy);
      drawSource(cx, cy, thetaE);
      drawDiagram();

      // Info
      ctx.font = "12px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "left";
      ctx.fillText(`Einstein radius: θE = ${thetaE.toFixed(4)}`, 15, H * 0.62);
      ctx.fillText(`α = 4GM/(c²b)`, 15, H * 0.62 + 16);
    },
    reset() {
      time = 0;
    },
    destroy() {},
    getStateDescription() {
      const thetaE = einsteinRadius();
      const beta = alignment * thetaE * 2;
      const imgs = imagePositions(beta, thetaE);
      const totalMag = imgs.reduce((s, t) => s + magnification(t, thetaE), 0);
      return `Gravitational lensing: lens mass ${lensMass.toFixed(1)} M☉, Einstein radius ${thetaE.toFixed(4)}, source alignment ${alignment.toFixed(2)}. ${alignment < 0.05 ? "Near-perfect alignment — Einstein ring visible." : `Two images with total magnification μ = ${totalMag.toFixed(1)}.`}`;
    },
    resize(w, h) {
      W = w;
      H = h;
      initStars();
    },
  };
  return engine;
};

export default gravitationalLensingFactory;
