import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

const GeneralRelativityFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("general-relativity") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let mass = 10; // Mass of central body (solar masses)
  let gridDensity = 15;
  let testParticleSpeed = 2;
  let showGeodesics = 1;

  // Grid deformation
  const GRID_SIZE = 30;

  // Test particles orbiting the mass
  interface TestParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    trail: Array<{ x: number; y: number }>;
    color: string;
  }

  const testParticles: TestParticle[] = [];
  let schwarzschildRadius = 0;

  // Light rays for gravitational lensing
  interface LightRay {
    points: Array<{ x: number; y: number }>;
    color: string;
  }
  const lightRays: LightRay[] = [];

  function initTestParticles(): void {
    testParticles.length = 0;
    const cx = W * 0.5;
    const cy = H * 0.5;

    const colors = ["#42a5f5", "#66bb6a", "#ffa726"];
    const distances = [120, 180, 250];

    for (let i = 0; i < 3; i++) {
      const r = distances[i];
      const angle = (i * Math.PI * 2) / 3;
      const orbitalSpeed = testParticleSpeed * Math.sqrt(mass * 5 / r);
      testParticles.push({
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        vx: -orbitalSpeed * Math.sin(angle),
        vy: orbitalSpeed * Math.cos(angle),
        trail: [],
        color: colors[i],
      });
    }
  }

  function computeLightRays(): void {
    lightRays.length = 0;
    const cx = W * 0.5;
    const cy = H * 0.5;
    const numRays = 8;

    for (let i = 0; i < numRays; i++) {
      const startY = cy - 200 + (i * 400) / (numRays - 1);
      const ray: LightRay = {
        points: [],
        color: `hsla(${50 + i * 20}, 80%, 70%, 0.6)`,
      };

      let x = -20;
      let y = startY;
      let vx = 300;
      let vy = 0;

      for (let step = 0; step < 300; step++) {
        ray.points.push({ x, y });
        const dx = cx - x;
        const dy = cy - y;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r < schwarzschildRadius * 0.8) break;
        if (r > 0) {
          const deflection = (mass * 200) / (r * r + 100);
          vx += (dx / r) * deflection;
          vy += (dy / r) * deflection;
        }
        const speed = Math.sqrt(vx * vx + vy * vy);
        const dt = 3;
        x += (vx / speed) * dt;
        y += (vy / speed) * dt;
        if (x > W + 50 || y < -100 || y > H + 100) break;
      }

      lightRays.push(ray);
    }
  }

  function reset(): void {
    time = 0;
    schwarzschildRadius = mass * 3; // Scaled Schwarzschild radius
    initTestParticles();
    computeLightRays();
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    reset();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newMass = params.mass ?? 10;
    const newGrid = params.gridDensity ?? 15;
    const newSpeed = params.testParticleSpeed ?? 2;
    const newGeo = params.showGeodesics ?? 1;

    if (newMass !== mass || newSpeed !== testParticleSpeed) {
      mass = newMass;
      testParticleSpeed = newSpeed;
      schwarzschildRadius = mass * 3;
      reset();
      return;
    }

    gridDensity = newGrid;
    showGeodesics = newGeo;

    time += dt;

    const cx = W * 0.5;
    const cy = H * 0.5;

    // Update test particles with gravitational attraction
    for (const tp of testParticles) {
      const dx = cx - tp.x;
      const dy = cy - tp.y;
      const r = Math.sqrt(dx * dx + dy * dy);

      if (r < schwarzschildRadius) {
        // Captured by black hole
        tp.x = cx;
        tp.y = cy;
        tp.vx = 0;
        tp.vy = 0;
        continue;
      }

      // Gravitational acceleration: a = GM/r²
      const a = (mass * 500) / (r * r + 10);
      tp.vx += (dx / r) * a * dt;
      tp.vy += (dy / r) * a * dt;

      // GR correction: precession term (perihelion advance)
      const L = tp.x * tp.vy - tp.y * tp.vx; // angular momentum
      const grCorrection = (3 * mass * L * L) / (r * r * r * r * r) * 0.001;
      tp.vx += (dx / r) * grCorrection * dt;
      tp.vy += (dy / r) * grCorrection * dt;

      tp.x += tp.vx * dt;
      tp.y += tp.vy * dt;

      tp.trail.push({ x: tp.x, y: tp.y });
      if (tp.trail.length > 400) tp.trail.shift();
    }
  }

  function drawSpacetimeFabric(): void {
    const cx = W * 0.5;
    const cy = H * 0.5;
    const gridN = Math.round(gridDensity);

    ctx.strokeStyle = "rgba(100, 150, 255, 0.15)";
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = -gridN; i <= gridN; i++) {
      ctx.beginPath();
      for (let j = -gridN * 2; j <= gridN * 2; j++) {
        const baseX = cx + (j / gridN) * (W * 0.5);
        const baseY = cy + (i / gridN) * (H * 0.5);

        const dx = baseX - cx;
        const dy = baseY - cy;
        const r = Math.sqrt(dx * dx + dy * dy);

        // Spacetime curvature deformation
        let deformY = 0;
        if (r > 10) {
          deformY = (mass * 30) / (r * 0.3 + 10);
          // Pull toward center
          deformY *= (dy / r) * 0.5;
        }

        const px = baseX;
        const py = baseY + deformY;

        if (j === -gridN * 2) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Vertical grid lines
    for (let j = -gridN * 2; j <= gridN * 2; j++) {
      ctx.beginPath();
      for (let i = -gridN; i <= gridN; i++) {
        const baseX = cx + (j / gridN) * (W * 0.5);
        const baseY = cy + (i / gridN) * (H * 0.5);

        const dx = baseX - cx;
        const dy = baseY - cy;
        const r = Math.sqrt(dx * dx + dy * dy);

        let deformX = 0;
        if (r > 10) {
          deformX = (mass * 30) / (r * 0.3 + 10);
          deformX *= (dx / r) * 0.5;
        }

        const px = baseX + deformX;
        const py = baseY;

        if (i === -gridN) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  function drawCentralMass(): void {
    const cx = W * 0.5;
    const cy = H * 0.5;

    // Event horizon
    ctx.beginPath();
    ctx.arc(cx, cy, schwarzschildRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 100, 50, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Accretion disk glow
    const glowR = schwarzschildRadius * 2.5;
    const glow = ctx.createRadialGradient(cx, cy, schwarzschildRadius, cx, cy, glowR);
    glow.addColorStop(0, "rgba(255, 100, 30, 0.3)");
    glow.addColorStop(0.5, "rgba(255, 60, 10, 0.1)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Label
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`M = ${mass} M☉`, cx, cy + schwarzschildRadius + 18);
    ctx.fillText(`r_s = ${schwarzschildRadius.toFixed(0)}`, cx, cy + schwarzschildRadius + 32);
  }

  function drawTestParticles(): void {
    if (showGeodesics < 0.5) return;

    for (const tp of testParticles) {
      // Trail (geodesic)
      if (tp.trail.length > 1) {
        ctx.strokeStyle = tp.color + "60";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < tp.trail.length; i++) {
          if (i === 0) ctx.moveTo(tp.trail[i].x, tp.trail[i].y);
          else ctx.lineTo(tp.trail[i].x, tp.trail[i].y);
        }
        ctx.stroke();
      }

      // Particle
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = tp.color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawLightRays(): void {
    for (const ray of lightRays) {
      if (ray.points.length < 2) continue;
      ctx.strokeStyle = ray.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < ray.points.length; i++) {
        if (i === 0) ctx.moveTo(ray.points[i].x, ray.points[i].y);
        else ctx.lineTo(ray.points[i].x, ray.points[i].y);
      }
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = "rgba(255, 235, 59, 0.5)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Light rays (gravitational lensing)", 10, H - 30);
  }

  function drawInfo(): void {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 250, 160, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("General Relativity", 20, 18);

    ctx.font = "11px monospace";
    ctx.fillStyle = "#ccc";
    let y = 40;
    ctx.fillText(`Mass: ${mass} solar masses`, 20, y); y += 16;
    ctx.fillText(`Schwarzschild radius: ${schwarzschildRadius.toFixed(0)}`, 20, y); y += 16;
    ctx.fillText(`Grid density: ${Math.round(gridDensity)}`, 20, y); y += 20;

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px sans-serif";
    ctx.fillText("Einstein Field Equations:", 20, y); y += 14;
    ctx.font = "11px monospace";
    ctx.fillStyle = "#42a5f5";
    ctx.fillText("Gμν + Λgμν = (8πG/c⁴)Tμν", 20, y); y += 18;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px sans-serif";
    ctx.fillText("Mass curves spacetime,", 20, y); y += 13;
    ctx.fillText("curved spacetime guides mass.", 20, y);
  }

  function render(): void {
    // Deep space background
    ctx.fillStyle = "#020210";
    ctx.fillRect(0, 0, W, H);

    // Stars
    const rng = (s: number) => {
      let v = s;
      return () => { v = (v * 16807) % 2147483647; return v / 2147483647; };
    };
    const rand = rng(123);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 80; i++) {
      ctx.beginPath();
      ctx.arc(rand() * W, rand() * H, rand() * 1, 0, Math.PI * 2);
      ctx.fill();
    }

    drawSpacetimeFabric();
    drawLightRays();
    drawCentralMass();
    drawTestParticles();
    drawInfo();

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Spacetime Curvature — General Relativity", W / 2, H - 10);
  }

  function destroy(): void {
    testParticles.length = 0;
    lightRays.length = 0;
  }

  function getStateDescription(): string {
    return (
      `General Relativity Visualization: central mass=${mass} solar masses. ` +
      `Schwarzschild radius=${schwarzschildRadius.toFixed(0)}. ` +
      `Grid shows spacetime curvature (fabric deformation). ` +
      `Test particles follow geodesics (curved paths through spacetime). ` +
      `Light rays demonstrate gravitational lensing. ` +
      `Einstein's equation: Gμν + Λgμν = (8πG/c⁴)Tμν — ` +
      `mass-energy tells spacetime how to curve, spacetime tells matter how to move.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
    computeLightRays();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default GeneralRelativityFactory;
