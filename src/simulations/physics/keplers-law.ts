import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Planet {
  name: string;
  a: number; // semi-major axis (AU)
  e: number; // eccentricity
  T: number; // period (years)
  color: string;
  radius: number;
  angle: number; // current true anomaly
}

const KeplersLawFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("keplers-law") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let speed = 1;
  let eccentricity = 0.5;
  let lawDisplay = 0; // 0=first law, 1=second law, 2=third law
  let showOrbits = 1;

  const planets: Planet[] = [
    { name: "Mercury", a: 0.387, e: 0.206, T: 0.241, color: "#b0bec5", radius: 3, angle: 0 },
    { name: "Venus", a: 0.723, e: 0.007, T: 0.615, color: "#ffcc80", radius: 5, angle: Math.PI * 0.5 },
    { name: "Earth", a: 1.0, e: 0.017, T: 1.0, color: "#42a5f5", radius: 5, angle: Math.PI },
    { name: "Mars", a: 1.524, e: 0.093, T: 1.881, color: "#ef5350", radius: 4, angle: Math.PI * 1.5 },
    { name: "Jupiter", a: 5.203, e: 0.049, T: 11.86, color: "#ff9800", radius: 9, angle: 0.3 },
  ];

  // Swept area tracking for 2nd law
  const sweepAngles: number[] = [];
  let sweepStartAngle = 0;
  let sweepTimer = 0;
  const sweepInterval = 0.5; // years

  function solveKepler(M: number, e: number): number {
    // Solve M = E - e*sin(E) for E using Newton's method
    let E = M;
    for (let i = 0; i < 20; i++) {
      E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    }
    return E;
  }

  function trueAnomaly(E: number, e: number): number {
    return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  }

  function orbitRadius(a: number, e: number, theta: number): number {
    return a * (1 - e * e) / (1 + e * Math.cos(theta));
  }

  function toCanvas(ax: number, ay: number, scale: number): { x: number; y: number } {
    const cx = width * 0.45;
    const cy = height * 0.45;
    return { x: cx + ax * scale, y: cy - ay * scale };
  }

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
    },
    update(dt: number, params: Record<string, number>) {
      speed = params.speed ?? 1;
      eccentricity = params.eccentricity ?? 0.5;
      lawDisplay = params.lawDisplay ?? 0;
      showOrbits = params.showOrbits ?? 1;

      time += dt * speed;

      // Update planet angles
      for (const p of planets) {
        const M = (2 * Math.PI * time) / p.T;
        const E = solveKepler(M % (2 * Math.PI), p.e);
        p.angle = trueAnomaly(E, p.e);
      }

      // Custom orbit for 1st law demo
      sweepTimer += dt * speed;
      if (sweepTimer >= sweepInterval) {
        sweepAngles.push(planets[2].angle); // track Earth's angle
        if (sweepAngles.length > 20) sweepAngles.shift();
        sweepTimer = 0;
      }
    },
    render() {
      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#0a0a1a");
      bg.addColorStop(1, "#1a1a2e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Stars
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      for (let i = 0; i < 50; i++) {
        const sx = (Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5) * width;
        const sy = (Math.sin(i * 269.5 + 183.3) * 0.5 + 0.5) * height;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.5 + Math.random() * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      const lawNames = ["1st Law: Elliptical Orbits", "2nd Law: Equal Areas", "3rd Law: T² ∝ a³"];
      ctx.fillText(`Kepler's Laws — ${lawNames[Math.round(lawDisplay)] || lawNames[0]}`, width / 2, 22);

      const scale = Math.min(width, height) * 0.06;

      // Sun
      const sun = toCanvas(0, 0, scale);
      const sunGrad = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, 15);
      sunGrad.addColorStop(0, "#ffeb3b");
      sunGrad.addColorStop(0.7, "#ff9800");
      sunGrad.addColorStop(1, "rgba(255, 152, 0, 0)");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffeb3b";
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 8, 0, Math.PI * 2);
      ctx.fill();

      const law = Math.round(lawDisplay);

      // Draw orbits and planets
      for (const p of planets) {
        if (p.a * scale > Math.max(width, height) * 0.5) continue; // skip if too large

        // Orbit path
        if (showOrbits > 0.5) {
          ctx.strokeStyle = `${p.color}40`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let i = 0; i <= 100; i++) {
            const theta = (i / 100) * Math.PI * 2;
            const r = orbitRadius(p.a, p.e, theta);
            const ox = r * Math.cos(theta);
            const oy = r * Math.sin(theta);
            const cp = toCanvas(ox, oy, scale);
            if (i === 0) ctx.moveTo(cp.x, cp.y); else ctx.lineTo(cp.x, cp.y);
          }
          ctx.closePath();
          ctx.stroke();
        }

        // Planet position
        const r = orbitRadius(p.a, p.e, p.angle);
        const px = r * Math.cos(p.angle);
        const py = r * Math.sin(p.angle);
        const pp = toCanvas(px, py, scale);

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Planet label
        ctx.fillStyle = p.color;
        ctx.font = "10px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(p.name, pp.x + p.radius + 3, pp.y - 3);
      }

      // Law-specific visualizations
      if (law === 0) {
        // First law: Show foci
        const demoE = eccentricity;
        const demoA = 3;
        const c = demoA * demoE;

        // Custom orbit with adjustable eccentricity
        ctx.strokeStyle = "#e040fb";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 100; i++) {
          const theta = (i / 100) * Math.PI * 2;
          const r = orbitRadius(demoA, demoE, theta);
          const ox = r * Math.cos(theta);
          const oy = r * Math.sin(theta);
          const cp = toCanvas(ox, oy, scale);
          if (i === 0) ctx.moveTo(cp.x, cp.y); else ctx.lineTo(cp.x, cp.y);
        }
        ctx.closePath();
        ctx.stroke();

        // Second focus
        const f2 = toCanvas(-2 * c, 0, scale);
        ctx.fillStyle = "#e040fb";
        ctx.beginPath();
        ctx.arc(f2.x, f2.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e040fb";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("F₂", f2.x, f2.y - 8);
        ctx.fillText("F₁ (Sun)", sun.x, sun.y + 22);

        ctx.fillStyle = "#aaa";
        ctx.font = "11px sans-serif";
        ctx.fillText(`e = ${demoE.toFixed(2)} | The orbit is an ellipse with the Sun at one focus`, width / 2, height * 0.82);
      } else if (law === 1) {
        // Second law: Equal area swept
        const p = planets[2]; // Earth
        const sweepDuration = 0.15; // fraction of orbit
        const rCurrent = orbitRadius(p.a, p.e, p.angle);

        // Draw swept area wedge
        ctx.fillStyle = "rgba(76, 175, 80, 0.3)";
        ctx.beginPath();
        ctx.moveTo(sun.x, sun.y);
        const startAngle = p.angle - sweepDuration * Math.PI * 2;
        for (let i = 0; i <= 30; i++) {
          const t = startAngle + (i / 30) * sweepDuration * Math.PI * 2;
          const rr = orbitRadius(p.a, p.e, t);
          const cp = toCanvas(rr * Math.cos(t), rr * Math.sin(t), scale);
          ctx.lineTo(cp.x, cp.y);
        }
        ctx.closePath();
        ctx.fill();

        // Draw another wedge at different position for comparison
        ctx.fillStyle = "rgba(255, 152, 0, 0.3)";
        ctx.beginPath();
        ctx.moveTo(sun.x, sun.y);
        const start2 = p.angle + Math.PI - sweepDuration * Math.PI * 2;
        for (let i = 0; i <= 30; i++) {
          const t = start2 + (i / 30) * sweepDuration * Math.PI * 2;
          const rr = orbitRadius(p.a, p.e, t);
          const cp = toCanvas(rr * Math.cos(t), rr * Math.sin(t), scale);
          ctx.lineTo(cp.x, cp.y);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#aaa";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Equal areas (green & orange wedges) are swept in equal time intervals", width / 2, height * 0.82);
      } else if (law === 2) {
        // Third law: T² ∝ a³ graph
        const gx = width * 0.55;
        const gy = height * 0.35;
        const gw = width * 0.4;
        const gh = height * 0.4;

        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(gx, gy, gw, gh);
        ctx.strokeStyle = "#555";
        ctx.strokeRect(gx, gy, gw, gh);

        // Plot T² vs a³
        const maxA3 = 150;
        const maxT2 = 150;

        // Theoretical line
        ctx.strokeStyle = "rgba(255,235,59,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx, gy + gh);
        ctx.lineTo(gx + gw, gy);
        ctx.stroke();

        for (const p of planets) {
          const a3 = Math.pow(p.a, 3);
          const t2 = Math.pow(p.T, 2);
          const px = gx + (a3 / maxA3) * gw;
          const py = gy + gh - (t2 / maxT2) * gh;

          if (px > gx && px < gx + gw && py > gy && py < gy + gh) {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(px, py, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = "9px sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(p.name, px + 7, py + 3);
          }
        }

        ctx.fillStyle = "#aaa";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("a³ (AU³)", gx + gw / 2, gy + gh + 14);
        ctx.save();
        ctx.translate(gx - 10, gy + gh / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText("T² (yr²)", 0, 0);
        ctx.restore();

        ctx.fillStyle = "#aaa";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("T² = a³: orbital period squared proportional to semi-major axis cubed", width / 2, height * 0.82);
      }

      // Time display
      ctx.fillStyle = "#888";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Time: ${(time).toFixed(1)} yr | Speed: ${speed.toFixed(1)}×`, 10, height - 10);
    },
    reset() {
      time = 0;
      sweepAngles.length = 0;
      sweepTimer = 0;
      for (const p of planets) p.angle = 0;
    },
    destroy() {},
    getStateDescription(): string {
      const law = Math.round(lawDisplay);
      const lawDescs = [
        "1st Law: Planets move in elliptical orbits with the Sun at one focus.",
        "2nd Law: A line from Sun to planet sweeps equal areas in equal times (planet moves faster near Sun).",
        "3rd Law: T²=a³ — the square of the orbital period is proportional to the cube of the semi-major axis.",
      ];
      return `Kepler's Laws visualization: ${lawDescs[law]} Currently showing ${planets.length} planets. Time=${time.toFixed(1)} years. Eccentricity=${eccentricity.toFixed(2)}.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default KeplersLawFactory;
