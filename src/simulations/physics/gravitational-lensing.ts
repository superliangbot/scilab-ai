import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const GravitationalLensingFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("gravitational-lensing") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let lensMass = 5;
  let sourceOffset = 0; // vertical offset of background source
  let showRays = 1;
  let showEinsteinRing = 1;

  // Positions
  let lensX = 0;
  let lensY = 0;
  let sourceX = 0;
  let observerX = 0;
  let observerY = 0;

  function initState() {
    time = 0;
    lensX = width * 0.5;
    lensY = height * 0.45;
    sourceX = width * 0.12;
    observerX = width * 0.88;
    observerY = height * 0.45;
  }

  function drawBackground() {
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);

    // Stars
    const rng = (s: number) => {
      let x = Math.sin(s) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 200; i++) {
      const sx = rng(i * 7.1) * width;
      const sy = rng(i * 13.3) * height;
      const sr = rng(i * 3.7) * 1 + 0.2;
      ctx.globalAlpha = 0.15 + rng(i * 11.1) * 0.3;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function computeLensedRays(): { path: { x: number; y: number }[]; visible: boolean }[] {
    const rays: { path: { x: number; y: number }[]; visible: boolean }[] = [];

    const sourceY = lensY + sourceOffset;

    // Einstein radius (proportional to sqrt(mass))
    const einsteinR = lensMass * 20;

    // Generate rays from source that get bent by the lens
    const numRays = 20;
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      const rayPoints: { x: number; y: number }[] = [];

      // Start from source
      let rx = sourceX;
      let ry = sourceY;
      rayPoints.push({ x: rx, y: ry });

      // Propagate ray toward observer side
      const steps = 100;
      const dx = (observerX - sourceX) / steps;

      let vx = 1;
      let vy = Math.sin(angle) * 0.3;

      for (let s = 0; s < steps; s++) {
        rx += dx;
        ry += vy * (observerX - sourceX) / steps;

        // Gravitational deflection
        const distX = rx - lensX;
        const distY = ry - lensY;
        const dist = Math.sqrt(distX * distX + distY * distY);

        if (dist > 10) {
          const deflection = einsteinR * einsteinR / (dist * dist) * 0.3;
          vy -= (distY / dist) * deflection;
        }

        rayPoints.push({ x: rx, y: ry });
      }

      // Check if ray reaches near observer
      const lastPoint = rayPoints[rayPoints.length - 1];
      const distToObserver = Math.sqrt(
        (lastPoint.x - observerX) ** 2 + (lastPoint.y - observerY) ** 2
      );

      rays.push({ path: rayPoints, visible: distToObserver < 80 });
    }

    return rays;
  }

  function drawLensingGalaxy() {
    const r = 25 + lensMass * 3;

    // Galaxy glow
    const glow = ctx.createRadialGradient(lensX, lensY, 0, lensX, lensY, r * 3);
    glow.addColorStop(0, "rgba(168, 85, 247, 0.2)");
    glow.addColorStop(0.5, "rgba(139, 92, 246, 0.08)");
    glow.addColorStop(1, "rgba(139, 92, 246, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lensX, lensY, r * 3, 0, Math.PI * 2);
    ctx.fill();

    // Galaxy body (elliptical)
    ctx.save();
    ctx.translate(lensX, lensY);
    ctx.rotate(0.3);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, "#e9d5ff");
    grad.addColorStop(0.3, "#a855f7");
    grad.addColorStop(0.7, "#7c3aed");
    grad.addColorStop(1, "#4c1d9500");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spiral arms hint
    ctx.strokeStyle = "rgba(233, 213, 255, 0.15)";
    ctx.lineWidth = 2;
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        const armR = (a / (Math.PI * 2)) * r * 0.8;
        const px = Math.cos(a + arm * Math.PI) * armR;
        const py = Math.sin(a + arm * Math.PI) * armR * 0.5;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = "#c4b5fd";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Lensing Galaxy", lensX, lensY + r + 18);
    ctx.fillText(`(Mass: ${lensMass.toFixed(1)})`, lensX, lensY + r + 34);
  }

  function drawSource() {
    const sy = lensY + sourceOffset;
    const r = 8;

    // Quasar
    const glow = ctx.createRadialGradient(sourceX, sy, 0, sourceX, sy, r * 4);
    glow.addColorStop(0, "rgba(250, 204, 21, 0.4)");
    glow.addColorStop(1, "rgba(250, 204, 21, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sourceX, sy, r * 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.arc(sourceX, sy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fbbf24";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Distant Quasar", sourceX, sy + r + 16);
    ctx.fillText("(actual position)", sourceX, sy + r + 30);
  }

  function drawObserver() {
    // Earth/observer
    const r = 12;
    const grad = ctx.createRadialGradient(observerX - 2, observerY - 2, 0, observerX, observerY, r);
    grad.addColorStop(0, "#60a5fa");
    grad.addColorStop(0.7, "#2563eb");
    grad.addColorStop(1, "#1e3a5f");
    ctx.beginPath();
    ctx.arc(observerX, observerY, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Continents hint
    ctx.fillStyle = "#22c55e88";
    ctx.beginPath();
    ctx.arc(observerX + 2, observerY - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(observerX - 3, observerY + 2, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#60a5fa";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Earth", observerX, observerY + r + 16);
    ctx.fillText("(observer)", observerX, observerY + r + 30);
  }

  function drawLightRays() {
    if (showRays < 0.5) return;

    const rays = computeLensedRays();

    for (const ray of rays) {
      if (!ray.visible) continue;
      ctx.strokeStyle = "rgba(250, 204, 21, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < ray.path.length; i++) {
        if (i === 0) ctx.moveTo(ray.path[i].x, ray.path[i].y);
        else ctx.lineTo(ray.path[i].x, ray.path[i].y);
      }
      ctx.stroke();
    }

    // Main bent rays (simplified, showing 2 main paths)
    const sourceY = lensY + sourceOffset;
    const einsteinR = lensMass * 20;

    // Upper path
    drawBentRay(sourceX, sourceY, lensX, lensY - einsteinR * 0.5, observerX, observerY, "#fbbf24aa");
    // Lower path
    drawBentRay(sourceX, sourceY, lensX, lensY + einsteinR * 0.5, observerX, observerY, "#fbbf24aa");

    // Apparent positions (observed images)
    const img1Y = observerY - einsteinR * 0.4 - sourceOffset * 0.3;
    const img2Y = observerY + einsteinR * 0.4 + sourceOffset * 0.3;

    // Observed image 1
    ctx.fillStyle = "#fef08a88";
    ctx.beginPath();
    ctx.arc(sourceX, img1Y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fbbf2488";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Image 1", sourceX - 30, img1Y);

    // Observed image 2
    ctx.fillStyle = "#fef08a88";
    ctx.beginPath();
    ctx.arc(sourceX, img2Y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText("Image 2", sourceX - 30, img2Y);

    // Einstein Ring
    if (showEinsteinRing > 0.5 && Math.abs(sourceOffset) < 5) {
      ctx.strokeStyle = "rgba(250, 204, 21, 0.2)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(lensX, lensY, einsteinR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#fbbf24";
      ctx.font = "10px sans-serif";
      ctx.fillText("Einstein Ring", lensX, lensY - einsteinR - 8);
    }
  }

  function drawBentRay(sx: number, sy: number, lx: number, ly: number, ox: number, oy: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(lx, ly, ox, oy);
    ctx.stroke();
  }

  function drawExplanation() {
    const py = height - 70;
    ctx.fillStyle = "rgba(5, 5, 16, 0.85)";
    ctx.beginPath();
    ctx.roundRect(10, py, width - 20, 60, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Mass curves spacetime → light follows curved paths → multiple images of the same source", width / 2, py + 20);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.fillText(`θ_E = √(4GM/c²) × √(d_LS/(d_L × d_S))  |  Einstein Ring radius ∝ √(mass)`, width / 2, py + 42);
  }

  function drawTitle() {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Gravitational Lensing", width / 2, 28);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText("Light bent by massive objects — Einstein's General Relativity", width / 2, 50);
  }

  return {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initState();
    },

    update(dt: number, params: Record<string, number>) {
      lensMass = params.lensMass ?? 5;
      sourceOffset = params.sourceOffset ?? 0;
      showRays = params.showRays ?? 1;
      showEinsteinRing = params.showEinsteinRing ?? 1;
      time += dt;
    },

    render() {
      drawBackground();
      drawLightRays();
      drawLensingGalaxy();
      drawSource();
      drawObserver();
      drawExplanation();
      drawTitle();
    },

    reset() {
      initState();
    },

    destroy() {},

    getStateDescription(): string {
      const einsteinR = lensMass * 20;
      return `Gravitational Lensing: A massive galaxy (mass=${lensMass}) bends light from a distant quasar. Einstein ring radius: ${einsteinR.toFixed(0)}px. Source offset: ${sourceOffset.toFixed(0)}px. When source is aligned with lens, an Einstein ring forms. Multiple images of the same quasar are observed. This is a prediction of general relativity.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
      initState();
    },
  };
};

export default GravitationalLensingFactory;
