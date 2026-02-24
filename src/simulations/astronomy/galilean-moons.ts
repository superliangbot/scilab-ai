import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Moon {
  name: string;
  color: string;
  radius: number;
  orbitalRadius: number;
  period: number; // in Earth days
  angle: number;
  description: string;
}

const GalileanMoonsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("galilean-moons") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let timeScale = 1;
  let showLabels = 1;
  let showOrbits = 1;
  let zoom = 1;

  const moons: Moon[] = [
    {
      name: "Io",
      color: "#f59e0b",
      radius: 5,
      orbitalRadius: 80,
      period: 1.769,
      angle: 0,
      description: "Most volcanically active body in the solar system",
    },
    {
      name: "Europa",
      color: "#e0e7ff",
      radius: 4.5,
      orbitalRadius: 130,
      period: 3.551,
      angle: Math.PI / 3,
      description: "Subsurface ocean beneath icy crust",
    },
    {
      name: "Ganymede",
      color: "#94a3b8",
      radius: 7,
      orbitalRadius: 200,
      period: 7.155,
      angle: Math.PI * 0.7,
      description: "Largest moon in the solar system",
    },
    {
      name: "Callisto",
      color: "#78716c",
      radius: 6,
      orbitalRadius: 260,
      period: 16.689,
      angle: Math.PI * 1.3,
      description: "Most heavily cratered object in the solar system",
    },
  ];

  let trails: { moon: number; x: number; y: number; age: number }[] = [];
  let elapsedDays = 0;

  function initState() {
    time = 0;
    elapsedDays = 0;
    trails = [];
    moons[0].angle = 0;
    moons[1].angle = Math.PI / 3;
    moons[2].angle = Math.PI * 0.7;
    moons[3].angle = Math.PI * 1.3;
  }

  function drawBackground() {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    // Starfield
    const rng = (s: number) => {
      let x = Math.sin(s) * 43758.5453;
      return x - Math.floor(x);
    };
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 150; i++) {
      const sx = rng(i * 7.1) * width;
      const sy = rng(i * 13.3) * height;
      const sr = rng(i * 3.7) * 1.2 + 0.3;
      const alpha = 0.3 + rng(i * 11.1) * 0.5;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawJupiter(cx: number, cy: number) {
    const r = 35 * zoom;

    // Jupiter body
    const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
    grad.addColorStop(0, "#e8c89e");
    grad.addColorStop(0.5, "#c9956b");
    grad.addColorStop(1, "#8b5e3c");
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Bands
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    const bandColors = ["#d4a574", "#b8834a", "#d4a574", "#c09060", "#b8834a", "#d4a574"];
    const bandH = (r * 2) / bandColors.length;
    for (let i = 0; i < bandColors.length; i++) {
      ctx.fillStyle = bandColors[i] + "60";
      ctx.fillRect(cx - r, cy - r + i * bandH, r * 2, bandH);
    }

    // Great Red Spot
    ctx.fillStyle = "#c0503080";
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.3, cy + r * 0.2, r * 0.2, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Label
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Jupiter", cx, cy + r + 20);
  }

  function drawMoons(cx: number, cy: number) {
    for (let i = 0; i < moons.length; i++) {
      const moon = moons[i];
      const orbitR = moon.orbitalRadius * zoom;

      // Orbit path
      if (showOrbits > 0.5) {
        ctx.strokeStyle = moon.color + "30";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, orbitR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Moon position
      const mx = cx + Math.cos(moon.angle) * orbitR;
      const my = cy + Math.sin(moon.angle) * orbitR * 0.3; // Slight inclination for perspective

      // Behind Jupiter check
      const behindJupiter = Math.sin(moon.angle) < -0.1 && Math.abs(mx - cx) < 35 * zoom;

      if (!behindJupiter) {
        // Moon glow
        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, moon.radius * zoom * 3);
        glow.addColorStop(0, moon.color + "40");
        glow.addColorStop(1, moon.color + "00");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(mx, my, moon.radius * zoom * 3, 0, Math.PI * 2);
        ctx.fill();

        // Moon body
        const mGrad = ctx.createRadialGradient(
          mx - moon.radius * zoom * 0.3, my - moon.radius * zoom * 0.3, 0,
          mx, my, moon.radius * zoom
        );
        mGrad.addColorStop(0, "#ffffff");
        mGrad.addColorStop(0.5, moon.color);
        mGrad.addColorStop(1, moon.color + "88");
        ctx.beginPath();
        ctx.arc(mx, my, moon.radius * zoom, 0, Math.PI * 2);
        ctx.fillStyle = mGrad;
        ctx.fill();

        // Label
        if (showLabels > 0.5) {
          ctx.fillStyle = moon.color;
          ctx.font = "12px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(moon.name, mx, my - moon.radius * zoom - 6);
        }
      }
    }
  }

  function drawSideView(cx: number) {
    const sideY = height - 90;
    const sideW = width - 40;

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Side View (as seen from Earth)", width / 2, sideY - 20);

    // Jupiter in center
    ctx.fillStyle = "#c9956b";
    ctx.beginPath();
    ctx.arc(cx, sideY + 15, 12, 0, Math.PI * 2);
    ctx.fill();

    // Moon positions projected on x-axis
    for (let i = 0; i < moons.length; i++) {
      const moon = moons[i];
      const xOffset = Math.cos(moon.angle) * moon.orbitalRadius * zoom * 0.6;
      const mx = cx + xOffset;

      ctx.fillStyle = moon.color;
      ctx.beginPath();
      ctx.arc(mx, sideY + 15, moon.radius * zoom * 0.6, 0, Math.PI * 2);
      ctx.fill();

      if (showLabels > 0.5) {
        ctx.font = "10px sans-serif";
        ctx.fillText(moon.name, mx, sideY + 35);
      }
    }

    // Horizontal line
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, sideY + 15);
    ctx.lineTo(width - 20, sideY + 15);
    ctx.stroke();
  }

  function drawInfo() {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Galilean Moons of Jupiter", width / 2, 28);

    // Time display
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px monospace";
    ctx.fillText(`Day ${elapsedDays.toFixed(1)}  |  Speed: ${timeScale.toFixed(1)}×`, width / 2, 50);

    // Info panel
    const px = 10;
    const py = 70;
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(px, py, 180, 100, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    for (let i = 0; i < moons.length; i++) {
      const moon = moons[i];
      ctx.fillStyle = moon.color;
      ctx.fillText(`${moon.name}: P=${moon.period.toFixed(2)}d`, px + 10, py + 20 + i * 22);
    }
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
      timeScale = params.timeScale ?? 1;
      showLabels = params.showLabels ?? 1;
      showOrbits = params.showOrbits ?? 1;
      zoom = params.zoom ?? 1;

      time += dt;
      elapsedDays += dt * timeScale;

      // Update moon angles
      for (const moon of moons) {
        const angularVelocity = (2 * Math.PI) / (moon.period * 86400); // rad/s in real time
        moon.angle += angularVelocity * dt * timeScale * 86400; // scale simulation time
      }
    },

    render() {
      drawBackground();
      const cx = width / 2;
      const cy = height * 0.4;
      drawMoons(cx, cy);
      drawJupiter(cx, cy);
      drawSideView(cx);
      drawInfo();
    },

    reset() {
      initState();
    },

    destroy() {
      trails = [];
    },

    getStateDescription(): string {
      const moonDescs = moons.map(m => {
        const deg = ((m.angle * 180 / Math.PI) % 360).toFixed(0);
        return `${m.name}: ${deg}° (period ${m.period}d)`;
      }).join(", ");
      return `Galilean Moons: Day ${elapsedDays.toFixed(1)}. ${moonDescs}. Orbital resonance: Io:Europa:Ganymede = 1:2:4. Speed: ${timeScale}×.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };
};

export default GalileanMoonsFactory;
