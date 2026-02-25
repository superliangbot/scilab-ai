import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Planet {
  name: string;
  color: string;
  semiMajorAU: number;
  eccentricity: number;
  periodYears: number;
  drawRadius: number;
  angle: number; // true anomaly
  trailX: number[];
  trailY: number[];
}

const KeplersLawFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("keplers-law") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let timeScale = 2;
  let eccentricity = 0.5;
  let showAreas = 1;
  let lawSelect = 0; // 0=all, 1=first, 2=second, 3=third

  const planets: Planet[] = [
    { name: "Mercury", color: "#a3a3a3", semiMajorAU: 0.39, eccentricity: 0.206, periodYears: 0.24, drawRadius: 3, angle: 0, trailX: [], trailY: [] },
    { name: "Venus", color: "#fbbf24", semiMajorAU: 0.72, eccentricity: 0.007, periodYears: 0.615, drawRadius: 4, angle: Math.PI / 3, trailX: [], trailY: [] },
    { name: "Earth", color: "#3b82f6", semiMajorAU: 1.0, eccentricity: 0.017, periodYears: 1.0, drawRadius: 5, angle: Math.PI / 2, trailX: [], trailY: [] },
    { name: "Mars", color: "#ef4444", semiMajorAU: 1.52, eccentricity: 0.093, periodYears: 1.88, drawRadius: 4, angle: Math.PI, trailX: [], trailY: [] },
  ];

  // Area sweep tracking for 2nd law
  let areaAngle1 = 0;
  let areaAngle2 = 0;
  let areaTimer = 0;
  const areaDuration = 0.3; // years

  function solveKepler(M: number, e: number): number {
    // Solve Kepler's equation M = E - e*sin(E) using Newton's method
    let E = M;
    for (let i = 0; i < 10; i++) {
      E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    }
    return E;
  }

  function trueAnomaly(M: number, e: number): number {
    const E = solveKepler(M, e);
    return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  }

  function orbitRadius(theta: number, a: number, e: number): number {
    return a * (1 - e * e) / (1 + e * Math.cos(theta));
  }

  let centerX = 0;
  let centerY = 0;
  let scale = 1;

  function auToPixel(au: number): number {
    return au * scale;
  }

  return {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      centerX = width * 0.45;
      centerY = height * 0.48;
      scale = Math.min(width, height) * 0.22;
      // Reset trails
      for (const p of planets) { p.trailX = []; p.trailY = []; }
    },
    update(dt: number, params: Record<string, number>) {
      timeScale = params.timeScale ?? 2;
      eccentricity = params.eccentricity ?? 0.5;
      showAreas = params.showAreas ?? 1;
      lawSelect = Math.round(params.lawSelect ?? 0);

      const dtYears = dt * timeScale;
      time += dtYears;
      areaTimer += dtYears;

      // Override Earth's eccentricity with parameter for demonstration
      planets[2].eccentricity = eccentricity;

      for (const p of planets) {
        const M = (2 * Math.PI / p.periodYears) * time;
        p.angle = trueAnomaly(M % (2 * Math.PI), p.eccentricity);

        const r = orbitRadius(p.angle, p.semiMajorAU, p.eccentricity);
        const px = centerX + auToPixel(r * Math.cos(p.angle));
        const py = centerY - auToPixel(r * Math.sin(p.angle));

        p.trailX.push(px);
        p.trailY.push(py);
        if (p.trailX.length > 500) { p.trailX.shift(); p.trailY.shift(); }
      }

      // Reset area sweep periodically
      if (areaTimer > areaDuration * 3) {
        areaAngle1 = planets[2].angle;
        areaTimer = 0;
      }
      areaAngle2 = planets[2].angle;
    },
    render() {
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(0, 0, width, height);

      // Stars
      const rng = (seed: number) => {
        const x = Math.sin(seed) * 43758.5453;
        return x - Math.floor(x);
      };
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.2 + rng(i * 7) * 0.6})`;
        ctx.fillRect(rng(i * 3) * width, rng(i * 5) * height, 1.5, 1.5);
      }

      // Title
      ctx.fillStyle = "#e2e8f0";
      ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Kepler's Laws of Planetary Motion", width / 2, 24);

      // Sun
      const sunGrad = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, 18);
      sunGrad.addColorStop(0, "#fef08a");
      sunGrad.addColorStop(0.6, "#fbbf24");
      sunGrad.addColorStop(1, "#f59e0b00");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
      ctx.fill();

      // Draw orbits and planets
      for (const p of planets) {
        drawOrbit(p);
        drawPlanet(p);
      }

      // Law-specific visualization
      if (lawSelect === 0 || lawSelect === 1) drawFirstLaw();
      if (lawSelect === 0 || lawSelect === 2) drawSecondLaw();
      if (lawSelect === 0 || lawSelect === 3) drawThirdLaw();

      // Legend
      drawLegend();
    },
    reset() {
      time = 0;
      areaTimer = 0;
      for (const p of planets) { p.trailX = []; p.trailY = []; p.angle = 0; }
    },
    destroy() {},
    getStateDescription(): string {
      const earth = planets[2];
      const r = orbitRadius(earth.angle, earth.semiMajorAU, earth.eccentricity);
      return `Kepler's Laws: Showing ${planets.length} planets. Earth eccentricity=${eccentricity.toFixed(3)}. ` +
        `1st Law: Elliptical orbits with Sun at one focus. ` +
        `2nd Law: Equal areas swept in equal times. ` +
        `3rd Law: T²∝a³ (Mercury T=${planets[0].periodYears}yr a=${planets[0].semiMajorAU}AU, ` +
        `Earth T=${planets[2].periodYears}yr a=${planets[2].semiMajorAU}AU). ` +
        `Earth current radius: ${r.toFixed(3)} AU.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
      centerX = width * 0.45;
      centerY = height * 0.48;
      scale = Math.min(width, height) * 0.22;
    },
  };

  function drawOrbit(p: Planet) {
    ctx.strokeStyle = p.color + "40";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let theta = 0; theta <= Math.PI * 2; theta += 0.02) {
      const r = orbitRadius(theta, p.semiMajorAU, p.eccentricity);
      const x = centerX + auToPixel(r * Math.cos(theta));
      const y = centerY - auToPixel(r * Math.sin(theta));
      if (theta === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawPlanet(p: Planet) {
    const r = orbitRadius(p.angle, p.semiMajorAU, p.eccentricity);
    const px = centerX + auToPixel(r * Math.cos(p.angle));
    const py = centerY - auToPixel(r * Math.sin(p.angle));

    // Glow
    const glow = ctx.createRadialGradient(px, py, 1, px, py, p.drawRadius * 3);
    glow.addColorStop(0, p.color);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, p.drawRadius * 3, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(px, py, p.drawRadius, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = p.color;
    ctx.font = "9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(p.name, px + p.drawRadius + 4, py + 3);
  }

  function drawFirstLaw() {
    // Show foci of Earth's orbit
    const earth = planets[2];
    const c = earth.semiMajorAU * earth.eccentricity;
    const f1x = centerX; // Sun is at one focus
    const f2x = centerX + auToPixel(2 * c);
    const f2y = centerY;

    ctx.fillStyle = "#ffffff40";
    ctx.beginPath();
    ctx.arc(f2x, f2y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("F₂", f2x, f2y + 14);
    ctx.fillText("F₁ (Sun)", f1x, centerY + 26);
  }

  function drawSecondLaw() {
    if (!showAreas) return;
    const earth = planets[2];
    const e = earth.eccentricity;
    const a = earth.semiMajorAU;

    // Draw swept area
    ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    const startA = areaAngle1;
    const endA = areaAngle2;
    const step = (endA - startA) / 30;
    if (Math.abs(step) > 0.001) {
      for (let theta = startA; theta <= endA || (step < 0 && theta >= endA); theta += step) {
        const r = orbitRadius(theta, a, e);
        const x = centerX + auToPixel(r * Math.cos(theta));
        const y = centerY - auToPixel(r * Math.sin(theta));
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawThirdLaw() {
    // Info box showing T²/a³ ratios
    const bx = width - 170;
    const by = 50;
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(bx, by, 160, 20 + planets.length * 18);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, 160, 20 + planets.length * 18);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("T²/a³ (Kepler's 3rd)", bx + 8, by + 14);

    ctx.font = "9px monospace";
    for (let i = 0; i < planets.length; i++) {
      const p = planets[i];
      const ratio = (p.periodYears * p.periodYears) / (p.semiMajorAU ** 3);
      ctx.fillStyle = p.color;
      ctx.fillText(`${p.name.padEnd(8)} T²/a³ = ${ratio.toFixed(3)}`, bx + 8, by + 32 + i * 18);
    }
  }

  function drawLegend() {
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "center";
    const laws = [
      "1st: Orbits are ellipses with the Sun at one focus",
      "2nd: Equal areas are swept in equal times",
      "3rd: T² ∝ a³ (period² ∝ semi-major axis³)",
    ];
    const ly = height - 40;
    for (let i = 0; i < laws.length; i++) {
      const highlight = lawSelect === 0 || lawSelect === i + 1;
      ctx.fillStyle = highlight ? "#e2e8f0" : "#475569";
      ctx.fillText(laws[i], width / 2, ly + i * 14);
    }
  }
};

export default KeplersLawFactory;
