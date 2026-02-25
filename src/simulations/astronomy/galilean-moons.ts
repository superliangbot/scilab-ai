import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Moon {
  name: string;
  orbitalRadius: number; // in Jupiter radii
  period: number; // in Earth days
  radius: number; // display radius in px
  color: string;
  angle: number;
}

const GalileanMoonsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("galilean-moons") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let timeScale = 1;
  let viewMode = 0; // 0=top, 1=side (as seen from Earth)
  let showOrbits = 1;
  let showLabels = 1;

  // Galilean moons — real orbital data
  const moons: Moon[] = [
    { name: "Io", orbitalRadius: 5.9, period: 1.769, radius: 6, color: "#ffeb3b", angle: 0 },
    { name: "Europa", orbitalRadius: 9.4, period: 3.551, radius: 5, color: "#90caf9", angle: Math.PI * 0.5 },
    { name: "Ganymede", orbitalRadius: 15.0, period: 7.155, radius: 8, color: "#bcaaa4", angle: Math.PI },
    { name: "Callisto", orbitalRadius: 26.3, period: 16.689, radius: 7, color: "#78909c", angle: Math.PI * 1.5 },
  ];

  // Trail data for each moon
  const trails: Array<Array<{ x: number; y: number }>> = [[], [], [], []];
  const MAX_TRAIL = 300;

  function reset(): void {
    time = 0;
    moons[0].angle = 0;
    moons[1].angle = Math.PI * 0.5;
    moons[2].angle = Math.PI;
    moons[3].angle = Math.PI * 1.5;
    for (const t of trails) t.length = 0;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    reset();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newTS = params.timeScale ?? 1;
    const newVM = params.viewMode ?? 0;
    const newSO = params.showOrbits ?? 1;
    const newSL = params.showLabels ?? 1;

    if (newVM !== viewMode) {
      viewMode = newVM;
      for (const t of trails) t.length = 0;
    }
    timeScale = newTS;
    showOrbits = newSO;
    showLabels = newSL;

    time += dt * timeScale;

    // Update moon angles based on orbital periods
    for (let i = 0; i < moons.length; i++) {
      const angularVel = (2 * Math.PI) / (moons[i].period * 86400); // radians per second
      moons[i].angle += angularVel * dt * timeScale * 86400; // scale dt to days

      // Record trail
      const pos = getMoonCanvasPos(i);
      trails[i].push(pos);
      if (trails[i].length > MAX_TRAIL) trails[i].shift();
    }
  }

  function getMoonCanvasPos(idx: number): { x: number; y: number } {
    const moon = moons[idx];
    const cx = W * 0.45;
    const cy = H * 0.5;
    const scale = Math.min(W, H) * 0.013;
    const r = moon.orbitalRadius * scale;

    if (viewMode < 0.5) {
      // Top-down view
      return {
        x: cx + r * Math.cos(moon.angle),
        y: cy + r * Math.sin(moon.angle),
      };
    } else {
      // Side view (as seen from Earth) — only x displacement visible
      return {
        x: cx + r * Math.cos(moon.angle),
        y: cy,
      };
    }
  }

  function drawBackground(): void {
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, W, H);

    // Stars
    const rng = (seed: number) => {
      let s = seed;
      return () => {
        s = (s * 16807 + 0) % 2147483647;
        return s / 2147483647;
      };
    };
    const rand = rng(42);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    for (let i = 0; i < 120; i++) {
      const sx = rand() * W;
      const sy = rand() * H;
      const sr = rand() * 1.2;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawJupiter(): void {
    const cx = W * 0.45;
    const cy = H * 0.5;
    const jupR = Math.min(W, H) * 0.06;

    // Jupiter bands
    const grad = ctx.createLinearGradient(cx, cy - jupR, cx, cy + jupR);
    grad.addColorStop(0, "#d4a574");
    grad.addColorStop(0.2, "#c49660");
    grad.addColorStop(0.35, "#e8c89e");
    grad.addColorStop(0.5, "#b87333");
    grad.addColorStop(0.6, "#d4a574");
    grad.addColorStop(0.75, "#c49660");
    grad.addColorStop(0.9, "#e8c89e");
    grad.addColorStop(1, "#b87333");

    ctx.beginPath();
    ctx.arc(cx, cy, jupR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Great Red Spot
    ctx.fillStyle = "rgba(200, 80, 60, 0.6)";
    ctx.beginPath();
    ctx.ellipse(cx + jupR * 0.3, cy + jupR * 0.2, jupR * 0.15, jupR * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shadow for 3D effect
    const shadowGrad = ctx.createRadialGradient(cx - jupR * 0.3, cy, jupR * 0.5, cx, cy, jupR);
    shadowGrad.addColorStop(0, "rgba(0,0,0,0)");
    shadowGrad.addColorStop(1, "rgba(0,0,0,0.3)");
    ctx.beginPath();
    ctx.arc(cx, cy, jupR, 0, Math.PI * 2);
    ctx.fillStyle = shadowGrad;
    ctx.fill();

    if (showLabels >= 0.5) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("Jupiter", cx, cy - jupR - 8);
    }
  }

  function drawOrbits(): void {
    if (showOrbits < 0.5) return;
    const cx = W * 0.45;
    const cy = H * 0.5;
    const scale = Math.min(W, H) * 0.013;

    for (const moon of moons) {
      const r = moon.orbitalRadius * scale;
      ctx.strokeStyle = `${moon.color}33`;
      ctx.lineWidth = 1;
      if (viewMode < 0.5) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Side view — horizontal line
        ctx.beginPath();
        ctx.moveTo(cx - r, cy);
        ctx.lineTo(cx + r, cy);
        ctx.stroke();
      }
    }
  }

  function drawMoons(): void {
    for (let i = 0; i < moons.length; i++) {
      const moon = moons[i];
      const pos = getMoonCanvasPos(i);

      // Trail
      if (trails[i].length > 1) {
        ctx.strokeStyle = `${moon.color}40`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let j = 0; j < trails[i].length; j++) {
          if (j === 0) ctx.moveTo(trails[i][j].x, trails[i][j].y);
          else ctx.lineTo(trails[i][j].x, trails[i][j].y);
        }
        ctx.stroke();
      }

      // Moon body
      const grad = ctx.createRadialGradient(
        pos.x - moon.radius * 0.3, pos.y - moon.radius * 0.3, 1,
        pos.x, pos.y, moon.radius
      );
      grad.addColorStop(0, lightenColor(moon.color, 30));
      grad.addColorStop(1, moon.color);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, moon.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // In side view, if moon is behind Jupiter, draw dimmer
      if (viewMode >= 0.5) {
        const sinAngle = Math.sin(moon.angle);
        if (sinAngle > 0) {
          // Behind Jupiter (farther)
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, moon.radius, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0,0,0,0.4)";
          ctx.fill();
        }
      }

      // Label
      if (showLabels >= 0.5) {
        ctx.fillStyle = moon.color;
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(moon.name, pos.x, pos.y - moon.radius - 4);
      }
    }
  }

  function lightenColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0xff) + amount);
    const b = Math.min(255, (num & 0xff) + amount);
    return `rgb(${r},${g},${b})`;
  }

  function drawInfoPanel(): void {
    const px = W * 0.72;
    const py = 20;
    const pw = W * 0.26;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, 260, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Galilean Moons", px + 10, py + 10);

    ctx.font = "10px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("Discovered by Galileo, 1610", px + 10, py + 28);

    let y = py + 50;
    for (const moon of moons) {
      ctx.fillStyle = moon.color;
      ctx.beginPath();
      ctx.arc(px + 16, y + 6, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(moon.name, px + 28, y);
      ctx.font = "10px monospace";
      ctx.fillStyle = "#aaa";
      ctx.fillText(`Period: ${moon.period.toFixed(3)} days`, px + 28, y + 14);
      ctx.fillText(`Radius: ${moon.orbitalRadius.toFixed(1)} Rj`, px + 28, y + 26);
      y += 48;
    }

    // Orbital resonance note
    y += 5;
    ctx.fillStyle = "#ffa726";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText("Laplace Resonance:", px + 10, y);
    ctx.fillStyle = "#ccc";
    ctx.font = "10px sans-serif";
    ctx.fillText("Io : Europa : Ganymede", px + 10, y + 14);
    ctx.fillText("= 1 : 2 : 4 (orbital periods)", px + 10, y + 26);
  }

  function drawViewLabel(): void {
    const label = viewMode < 0.5 ? "Top-Down View" : "Side View (from Earth)";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(label, W * 0.45, H - 10);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Day ${(time / 86400).toFixed(1)}  |  Speed: ${timeScale}×`, 10, H - 10);
  }

  function render(): void {
    drawBackground();
    drawOrbits();
    drawJupiter();
    drawMoons();
    drawInfoPanel();
    drawViewLabel();
  }

  function destroy(): void {
    for (const t of trails) t.length = 0;
  }

  function getStateDescription(): string {
    const dayTime = time / 86400;
    const moonDescs = moons.map((m) => {
      const angleDeg = ((m.angle * 180) / Math.PI) % 360;
      return `${m.name}: angle=${angleDeg.toFixed(0)}°, period=${m.period} days, orbital radius=${m.orbitalRadius} Rj`;
    });
    return (
      `Galilean Moons of Jupiter. Day ${dayTime.toFixed(1)}, time scale=${timeScale}×. ` +
      `View: ${viewMode < 0.5 ? "top-down" : "side (Earth perspective)"}. ` +
      `Moons: ${moonDescs.join("; ")}. ` +
      `Note: Io, Europa, Ganymede are in 1:2:4 Laplace resonance.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default GalileanMoonsFactory;
