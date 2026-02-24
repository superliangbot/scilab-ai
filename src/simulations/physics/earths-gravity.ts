import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const EarthsGravityFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("earths-gravity") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let testMass = 1; // kg
  let showVectors = 1;
  let showValues = 1;

  const G = 6.674e-11; // gravitational constant
  const M_EARTH = 5.972e24; // kg
  const R_EARTH = 6.371e6; // meters

  interface ForceVector {
    x: number;
    y: number;
    distKm: number;
    gAccel: number;
    force: number;
  }

  let vectors: ForceVector[] = [];
  let selectedVector = -1;

  // Pre-generate vectors at various distances
  function generateVectors(): void {
    vectors = [];
    const earthCX = width * 0.4;
    const earthCY = height * 0.5;
    const earthPixelR = Math.min(width, height) * 0.18;

    // Place vectors at various distances
    const distances = [1, 1.5, 2, 3, 4, 5, 6];
    const angles = [-60, -30, 0, 30, 60, 90, 120];

    for (let i = 0; i < distances.length; i++) {
      const d = distances[i];
      const angleDeg = angles[i % angles.length];
      const angleRad = (angleDeg * Math.PI) / 180;
      const px = earthCX + earthPixelR * d * Math.cos(angleRad);
      const py = earthCY - earthPixelR * d * Math.sin(angleRad);

      const distKm = d * R_EARTH / 1000;
      const distM = d * R_EARTH;
      const gAccel = (G * M_EARTH) / (distM * distM);
      const force = testMass * gAccel;

      vectors.push({ x: px, y: py, distKm, gAccel, force });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    generateVectors();
  }

  function update(dt: number, params: Record<string, number>): void {
    testMass = params.testMass ?? 1;
    showVectors = params.showVectors ?? 1;
    showValues = params.showValues ?? 1;
    time += dt;

    // Regenerate vectors with updated mass
    generateVectors();
  }

  function render(): void {
    // Space background
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);

    // Stars
    for (let i = 0; i < 100; i++) {
      const sx = (i * 137.5) % width;
      const sy = (i * 97.3) % height;
      ctx.fillStyle = `rgba(255,255,255,${0.2 + (i % 5) * 0.1})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    const earthCX = width * 0.4;
    const earthCY = height * 0.5;
    const earthPixelR = Math.min(width, height) * 0.18;

    // Earth glow
    const earthGlow = ctx.createRadialGradient(earthCX, earthCY, earthPixelR, earthCX, earthCY, earthPixelR * 3);
    earthGlow.addColorStop(0, "rgba(50,100,200,0.2)");
    earthGlow.addColorStop(1, "rgba(50,100,200,0)");
    ctx.fillStyle = earthGlow;
    ctx.beginPath();
    ctx.arc(earthCX, earthCY, earthPixelR * 3, 0, Math.PI * 2);
    ctx.fill();

    // Distance circles
    ctx.setLineDash([4, 8]);
    for (let d = 2; d <= 6; d++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.05 + (d === 2 ? 0.05 : 0)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(earthCX, earthCY, earthPixelR * d, 0, Math.PI * 2);
      ctx.stroke();

      // Distance label
      const labelAngle = -Math.PI / 4;
      const lx = earthCX + earthPixelR * d * Math.cos(labelAngle);
      const ly = earthCY + earthPixelR * d * Math.sin(labelAngle);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${d}R`, lx, ly - 5);
    }
    ctx.setLineDash([]);

    // Earth body
    const earthBody = ctx.createRadialGradient(
      earthCX - earthPixelR * 0.2,
      earthCY - earthPixelR * 0.2,
      0,
      earthCX,
      earthCY,
      earthPixelR
    );
    earthBody.addColorStop(0, "#6fa8dc");
    earthBody.addColorStop(0.5, "#3d85c6");
    earthBody.addColorStop(1, "#1a5276");
    ctx.fillStyle = earthBody;
    ctx.beginPath();
    ctx.arc(earthCX, earthCY, earthPixelR, 0, Math.PI * 2);
    ctx.fill();

    // Continents (simplified)
    ctx.fillStyle = "rgba(76,175,80,0.5)";
    const continentAngle = time * 0.1;
    for (let i = 0; i < 5; i++) {
      const ca = continentAngle + i * 1.3;
      const cx = earthCX + earthPixelR * 0.5 * Math.cos(ca);
      const cy = earthCY + earthPixelR * 0.3 * Math.sin(ca * 0.8);
      ctx.beginPath();
      ctx.arc(cx, cy, earthPixelR * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Atmosphere glow
    ctx.strokeStyle = "rgba(100,180,255,0.3)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(earthCX, earthCY, earthPixelR + 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Earth", earthCX, earthCY + earthPixelR + 20);
    ctx.fillStyle = "#aaa";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`M = 5.97×10²⁴ kg`, earthCX, earthCY + earthPixelR + 34);
    ctx.fillText(`R = 6,371 km`, earthCX, earthCY + earthPixelR + 48);

    // Draw force vectors
    if (showVectors) {
      for (let i = 0; i < vectors.length; i++) {
        const v = vectors[i];
        if (v.x < 0 || v.x > width || v.y < 0 || v.y > height) continue;

        // Direction toward Earth center
        const dx = earthCX - v.x;
        const dy = earthCY - v.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const nx = dx / dist;
        const ny = dy / dist;

        // Arrow length proportional to g (scaled)
        const maxArrowLen = 60;
        const arrowLen = maxArrowLen * (v.gAccel / 9.81);
        const clampedLen = Math.min(maxArrowLen, Math.max(8, arrowLen));

        // Color: green if inside surface reference, red if outside
        const isNear = dist < earthPixelR * 1.5;
        const color = isNear ? "#44ff88" : "#ff4444";

        // Draw arrow
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(v.x, v.y);
        ctx.lineTo(v.x + nx * clampedLen, v.y + ny * clampedLen);
        ctx.stroke();

        // Arrowhead
        const headLen = 8;
        const headAngle = 0.4;
        const angle = Math.atan2(ny, nx);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(v.x + nx * clampedLen, v.y + ny * clampedLen);
        ctx.lineTo(
          v.x + nx * clampedLen - headLen * Math.cos(angle - headAngle),
          v.y + ny * clampedLen - headLen * Math.sin(angle - headAngle)
        );
        ctx.lineTo(
          v.x + nx * clampedLen - headLen * Math.cos(angle + headAngle),
          v.y + ny * clampedLen - headLen * Math.sin(angle + headAngle)
        );
        ctx.fill();

        // Test mass circle
        ctx.beginPath();
        ctx.arc(v.x, v.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Values
        if (showValues) {
          ctx.fillStyle = "rgba(255,255,255,0.8)";
          ctx.font = "10px system-ui, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(`g=${v.gAccel.toFixed(2)} m/s²`, v.x + 10, v.y - 8);
          ctx.fillText(`d=${(v.distKm / 1000).toFixed(0)}×10³ km`, v.x + 10, v.y + 5);
        }
      }
    }

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath();
    ctx.roundRect(width - 260, 8, 250, 110, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Newton's Law of Gravitation", width - 250, 28);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#FFD700";
    ctx.fillText("F = GMm/r²", width - 250, 48);

    ctx.fillStyle = "#ccc";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`Test mass: ${testMass} kg`, width - 250, 68);
    ctx.fillText(`Surface g: 9.81 m/s²`, width - 250, 84);
    ctx.fillText(`2× distance → g/4 (inverse square)`, width - 250, 100);
    ctx.fillText(`3× distance → g/9`, width - 250, 114);

    // Graph panel
    const graphX = width * 0.7;
    const graphY = height * 0.55;
    const graphW = width * 0.25;
    const graphH = height * 0.35;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(graphX, graphY, graphW, graphH, 6);
    ctx.fill();

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(graphX + 30, graphY + 10);
    ctx.lineTo(graphX + 30, graphY + graphH - 20);
    ctx.lineTo(graphX + graphW - 10, graphY + graphH - 20);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("g vs distance", graphX + graphW / 2, graphY + graphH - 4);
    ctx.save();
    ctx.translate(graphX + 10, graphY + graphH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("g (m/s²)", 0, 0);
    ctx.restore();

    // Plot 1/r² curve
    ctx.strokeStyle = "#44aaff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const plotW = graphW - 45;
    const plotH = graphH - 35;
    const plotX0 = graphX + 35;
    const plotY0 = graphY + 15;
    for (let i = 0; i <= plotW; i++) {
      const r = 1 + (i / plotW) * 5; // 1R to 6R
      const g = 9.81 / (r * r);
      const px = plotX0 + i;
      const py = plotY0 + plotH - (g / 10) * plotH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("1R", plotX0, graphY + graphH - 10);
    ctx.fillText("6R", plotX0 + plotW, graphY + graphH - 10);
    ctx.textAlign = "right";
    ctx.fillText("9.81", plotX0 - 3, plotY0 + 4);
    ctx.fillText("0", plotX0 - 3, plotY0 + plotH + 4);
  }

  function reset(): void {
    time = 0;
    generateVectors();
  }

  function destroy(): void {
    vectors = [];
  }

  function getStateDescription(): string {
    const surfaceG = 9.81;
    return (
      `Earth's Gravity: test mass=${testMass} kg, surface gravity=${surfaceG} m/s². ` +
      `F = GMm/r² where G=6.674×10⁻¹¹, M_Earth=5.972×10²⁴ kg, R_Earth=6371 km. ` +
      `Gravity follows inverse-square law: at 2R, g=2.45 m/s²; at 3R, g=1.09 m/s². ` +
      `${vectors.length} force vectors shown at various distances from Earth.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    generateVectors();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default EarthsGravityFactory;
