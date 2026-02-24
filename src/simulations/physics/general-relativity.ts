import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const GeneralRelativityFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("general-relativity") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let massRatio = 0.1;
  let startDistance = 150;
  let startSpeed = 1.2;
  let showGrid = 1;

  // Bodies
  let body1 = { x: 0, y: 0, vx: 0, vy: 0, mass: 1 };
  let body2 = { x: 0, y: 0, vx: 0, vy: 0, mass: 0.1 };

  let trail1: { x: number; y: number }[] = [];
  let trail2: { x: number; y: number }[] = [];
  let crashed = false;

  const G = 1; // Normalized gravitational constant

  function initState() {
    time = 0;
    crashed = false;
    trail1 = [];
    trail2 = [];

    const cx = width / 2;
    const cy = height / 2;

    body1.mass = 1;
    body2.mass = massRatio;

    const totalMass = body1.mass + body2.mass;
    const r1 = startDistance * body2.mass / totalMass;
    const r2 = startDistance * body1.mass / totalMass;

    body1.x = cx - r1;
    body1.y = cy;
    body2.x = cx + r2;
    body2.y = cy;

    // Circular orbit velocity
    const v = startSpeed * Math.sqrt(G * totalMass / startDistance);
    body1.vx = 0;
    body1.vy = v * body2.mass / totalMass;
    body2.vx = 0;
    body2.vy = -v * body1.mass / totalMass;
  }

  function drawBackground() {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);
  }

  function drawSpacetimeGrid() {
    if (showGrid < 0.5) return;

    const gridSize = 30;
    const gridPoints: { x: number; y: number; dx: number; dy: number }[][] = [];

    for (let gy = 0; gy <= height; gy += gridSize) {
      const row: { x: number; y: number; dx: number; dy: number }[] = [];
      for (let gx = 0; gx <= width; gx += gridSize) {
        let dx = 0, dy = 0;

        // Spacetime warping near masses
        for (const body of [body1, body2]) {
          const bx = gx - body.x;
          const by = gy - body.y;
          const dist = Math.sqrt(bx * bx + by * by);
          if (dist > 5) {
            const warp = body.mass * 600 / (dist * dist + 100);
            dx += bx / dist * warp;
            dy += by / dist * warp;
          }
        }

        row.push({ x: gx, y: gy, dx, dy });
      }
      gridPoints.push(row);
    }

    // Draw grid lines (horizontal)
    ctx.strokeStyle = "rgba(99, 102, 241, 0.2)";
    ctx.lineWidth = 0.5;
    for (const row of gridPoints) {
      ctx.beginPath();
      for (let i = 0; i < row.length; i++) {
        const p = row[i];
        const px = p.x + p.dx;
        const py = p.y + p.dy;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Draw grid lines (vertical)
    for (let col = 0; col < gridPoints[0].length; col++) {
      ctx.beginPath();
      for (let row = 0; row < gridPoints.length; row++) {
        const p = gridPoints[row][col];
        const px = p.x + p.dx;
        const py = p.y + p.dy;
        if (row === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  function drawTrails() {
    // Trail 1
    if (trail1.length > 1) {
      ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < trail1.length; i++) {
        if (i === 0) ctx.moveTo(trail1[i].x, trail1[i].y);
        else ctx.lineTo(trail1[i].x, trail1[i].y);
      }
      ctx.stroke();
    }

    // Trail 2
    if (trail2.length > 1) {
      ctx.strokeStyle = "rgba(34, 211, 238, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < trail2.length; i++) {
        if (i === 0) ctx.moveTo(trail2[i].x, trail2[i].y);
        else ctx.lineTo(trail2[i].x, trail2[i].y);
      }
      ctx.stroke();
    }
  }

  function drawBodies() {
    // Body 1 (larger)
    const r1 = 10 + body1.mass * 12;
    const g1 = ctx.createRadialGradient(body1.x - r1 * 0.2, body1.y - r1 * 0.2, 0, body1.x, body1.y, r1);
    g1.addColorStop(0, "#fde68a");
    g1.addColorStop(0.6, "#f59e0b");
    g1.addColorStop(1, "#92400e");
    ctx.beginPath();
    ctx.arc(body1.x, body1.y, r1, 0, Math.PI * 2);
    ctx.fillStyle = g1;
    ctx.fill();

    // Glow
    const glow1 = ctx.createRadialGradient(body1.x, body1.y, r1, body1.x, body1.y, r1 * 3);
    glow1.addColorStop(0, "rgba(245, 158, 11, 0.3)");
    glow1.addColorStop(1, "rgba(245, 158, 11, 0)");
    ctx.fillStyle = glow1;
    ctx.beginPath();
    ctx.arc(body1.x, body1.y, r1 * 3, 0, Math.PI * 2);
    ctx.fill();

    // Body 2 (smaller)
    const r2 = 6 + body2.mass * 12;
    const g2 = ctx.createRadialGradient(body2.x - r2 * 0.2, body2.y - r2 * 0.2, 0, body2.x, body2.y, r2);
    g2.addColorStop(0, "#a5f3fc");
    g2.addColorStop(0.6, "#22d3ee");
    g2.addColorStop(1, "#0e7490");
    ctx.beginPath();
    ctx.arc(body2.x, body2.y, r2, 0, Math.PI * 2);
    ctx.fillStyle = g2;
    ctx.fill();

    // Labels
    ctx.fillStyle = "#f8fafc";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`M₁ = ${body1.mass.toFixed(1)}`, body1.x, body1.y + r1 + 14);
    ctx.fillText(`M₂ = ${body2.mass.toFixed(2)}`, body2.x, body2.y + r2 + 14);
  }

  function drawEquations() {
    const px = 15;
    const py = height - 80;

    ctx.fillStyle = "rgba(10, 10, 26, 0.85)";
    ctx.beginPath();
    ctx.roundRect(px, py, 350, 70, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Newton: F = GMm/r²  (force between masses)", px + 10, py + 20);
    ctx.fillText("Einstein: Gμν + Λgμν = (8πG/c⁴)Tμν", px + 10, py + 40);
    ctx.fillText("Mass warps spacetime → objects follow geodesics", px + 10, py + 60);
  }

  function drawInfo() {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("General Relativity — Spacetime Curvature", width / 2, 28);

    if (crashed) {
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("COLLISION!", width / 2, 55);
    }

    // Stats panel
    ctx.fillStyle = "rgba(10, 10, 26, 0.85)";
    ctx.beginPath();
    ctx.roundRect(width - 200, 60, 190, 60, 8);
    ctx.fill();

    const dx = body2.x - body1.x;
    const dy = body2.y - body1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Distance: ${dist.toFixed(1)} px`, width - 190, 80);
    ctx.fillText(`Time: ${time.toFixed(1)} s`, width - 190, 96);
    ctx.fillText(`Mass ratio: 1:${massRatio.toFixed(3)}`, width - 190, 112);
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
      const newMR = params.massRatio ?? 0.1;
      const newDist = params.startDistance ?? 150;
      const newSpeed = params.startSpeed ?? 1.2;
      showGrid = params.showGrid ?? 1;

      if (Math.abs(newMR - massRatio) > 0.001 || Math.abs(newDist - startDistance) > 1 || Math.abs(newSpeed - startSpeed) > 0.01) {
        massRatio = newMR;
        startDistance = newDist;
        startSpeed = newSpeed;
        initState();
        return;
      }

      if (crashed) return;

      time += dt;

      // Velocity Verlet integration
      const steps = 4;
      const subDt = dt / steps;

      for (let s = 0; s < steps; s++) {
        const dx = body2.x - body1.x;
        const dy = body2.y - body1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 15) {
          crashed = true;
          return;
        }

        const softened = dist * dist + 10;
        const force = G * body1.mass * body2.mass / softened;
        const nx = dx / dist;
        const ny = dy / dist;

        // Accelerations
        const a1x = force * nx / body1.mass;
        const a1y = force * ny / body1.mass;
        const a2x = -force * nx / body2.mass;
        const a2y = -force * ny / body2.mass;

        body1.vx += a1x * subDt * 60;
        body1.vy += a1y * subDt * 60;
        body2.vx += a2x * subDt * 60;
        body2.vy += a2y * subDt * 60;

        body1.x += body1.vx * subDt;
        body1.y += body1.vy * subDt;
        body2.x += body2.vx * subDt;
        body2.y += body2.vy * subDt;
      }

      // Record trails
      trail1.push({ x: body1.x, y: body1.y });
      trail2.push({ x: body2.x, y: body2.y });
      if (trail1.length > 500) trail1.shift();
      if (trail2.length > 500) trail2.shift();
    },

    render() {
      drawBackground();
      drawSpacetimeGrid();
      drawTrails();
      drawBodies();
      drawEquations();
      drawInfo();
    },

    reset() {
      initState();
    },

    destroy() {
      trail1 = [];
      trail2 = [];
    },

    getStateDescription(): string {
      const dx = body2.x - body1.x;
      const dy = body2.y - body1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return `General Relativity: Two bodies (M₁=1, M₂=${massRatio.toFixed(3)}) orbiting. Distance: ${dist.toFixed(1)}. ${crashed ? "COLLISION occurred." : "Orbiting normally."} The grid shows spacetime curvature — mass warps space, and objects follow curved paths (geodesics) rather than being pulled by a force.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };
};

export default GeneralRelativityFactory;
