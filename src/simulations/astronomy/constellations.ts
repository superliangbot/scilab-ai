import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// ─── Star & Constellation data ──────────────────────────────────────
// Positions are in a normalised coordinate system [-1, 1] centred on each
// constellation's anchor point.  Brightness is apparent magnitude (lower = brighter).

interface StarDef {
  name: string;
  x: number; // normalised x relative to constellation centre
  y: number; // normalised y relative to constellation centre
  mag: number; // apparent magnitude (0-6, lower = brighter)
}

interface ConstellationDef {
  name: string;
  cx: number; // centre x in sky coords (0-1 = fraction of full 360 sky)
  cy: number; // centre y in sky coords (0 = zenith, 1 = horizon)
  stars: StarDef[];
  lines: [number, number][]; // pairs of star indices to connect
}

const CONSTELLATIONS: ConstellationDef[] = [
  {
    name: "Orion",
    cx: 0.15,
    cy: 0.45,
    stars: [
      { name: "Betelgeuse", x: -0.035, y: -0.07, mag: 0.5 },
      { name: "Rigel", x: 0.03, y: 0.08, mag: 0.1 },
      { name: "Bellatrix", x: 0.035, y: -0.06, mag: 1.6 },
      { name: "Saiph", x: -0.025, y: 0.075, mag: 2.1 },
      { name: "Alnitak", x: -0.008, y: 0.005, mag: 1.7 },
      { name: "Alnilam", x: 0.0, y: 0.0, mag: 1.7 },
      { name: "Mintaka", x: 0.01, y: -0.005, mag: 2.2 },
    ],
    lines: [
      [0, 4], [4, 5], [5, 6], [6, 2],
      [0, 3], [2, 1], [3, 4], [6, 1],
    ],
  },
  {
    name: "Ursa Major",
    cx: 0.35,
    cy: 0.2,
    stars: [
      { name: "Dubhe", x: -0.04, y: -0.01, mag: 1.8 },
      { name: "Merak", x: -0.04, y: 0.02, mag: 2.4 },
      { name: "Phecda", x: -0.01, y: 0.025, mag: 2.4 },
      { name: "Megrez", x: -0.005, y: 0.0, mag: 3.3 },
      { name: "Alioth", x: 0.015, y: -0.005, mag: 1.8 },
      { name: "Mizar", x: 0.035, y: 0.005, mag: 2.1 },
      { name: "Alkaid", x: 0.055, y: 0.02, mag: 1.9 },
    ],
    lines: [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [3, 4], [4, 5], [5, 6],
    ],
  },
  {
    name: "Cassiopeia",
    cx: 0.52,
    cy: 0.15,
    stars: [
      { name: "Schedar", x: -0.04, y: 0.005, mag: 2.2 },
      { name: "Caph", x: -0.06, y: -0.01, mag: 2.3 },
      { name: "Gamma Cas", x: -0.015, y: -0.015, mag: 2.5 },
      { name: "Ruchbah", x: 0.015, y: 0.005, mag: 2.7 },
      { name: "Segin", x: 0.04, y: -0.01, mag: 3.4 },
    ],
    lines: [
      [0, 1], [0, 2], [2, 3], [3, 4],
    ],
  },
  {
    name: "Leo",
    cx: 0.68,
    cy: 0.38,
    stars: [
      { name: "Regulus", x: -0.025, y: 0.04, mag: 1.4 },
      { name: "Denebola", x: 0.06, y: 0.01, mag: 2.1 },
      { name: "Algieba", x: -0.015, y: -0.01, mag: 2.6 },
      { name: "Zosma", x: 0.035, y: 0.005, mag: 2.6 },
      { name: "Ras Elased", x: -0.04, y: -0.03, mag: 3.0 },
      { name: "Chertan", x: 0.02, y: 0.02, mag: 3.3 },
    ],
    lines: [
      [0, 2], [2, 4], [2, 3], [3, 1],
      [0, 5], [5, 3],
    ],
  },
  {
    name: "Scorpius",
    cx: 0.82,
    cy: 0.65,
    stars: [
      { name: "Antares", x: 0.0, y: 0.0, mag: 1.0 },
      { name: "Shaula", x: 0.06, y: 0.06, mag: 1.6 },
      { name: "Sargas", x: 0.05, y: 0.045, mag: 1.9 },
      { name: "Dschubba", x: -0.02, y: -0.04, mag: 2.3 },
      { name: "Graffias", x: -0.035, y: -0.05, mag: 2.6 },
      { name: "Lesath", x: 0.062, y: 0.062, mag: 2.7 },
      { name: "Epsilon Sco", x: 0.025, y: 0.02, mag: 2.3 },
    ],
    lines: [
      [4, 3], [3, 0], [0, 6], [6, 2], [2, 1], [1, 5],
    ],
  },
  {
    name: "Cygnus",
    cx: 0.45,
    cy: 0.35,
    stars: [
      { name: "Deneb", x: 0.0, y: -0.05, mag: 1.3 },
      { name: "Albireo", x: 0.0, y: 0.05, mag: 3.1 },
      { name: "Sadr", x: 0.0, y: 0.0, mag: 2.2 },
      { name: "Gienah", x: -0.035, y: 0.01, mag: 2.5 },
      { name: "Delta Cyg", x: 0.035, y: 0.005, mag: 2.9 },
    ],
    lines: [
      [0, 2], [2, 1], [3, 2], [2, 4],
    ],
  },
  {
    name: "Gemini",
    cx: 0.22,
    cy: 0.25,
    stars: [
      { name: "Castor", x: -0.01, y: -0.04, mag: 1.6 },
      { name: "Pollux", x: 0.015, y: -0.025, mag: 1.1 },
      { name: "Alhena", x: 0.005, y: 0.04, mag: 1.9 },
      { name: "Tejat", x: -0.03, y: 0.03, mag: 2.9 },
      { name: "Mebsuta", x: -0.015, y: 0.0, mag: 3.1 },
      { name: "Wasat", x: 0.01, y: 0.01, mag: 3.5 },
    ],
    lines: [
      [0, 4], [4, 3], [1, 5], [5, 2], [0, 1],
    ],
  },
  {
    name: "Taurus",
    cx: 0.05,
    cy: 0.3,
    stars: [
      { name: "Aldebaran", x: 0.0, y: 0.0, mag: 0.9 },
      { name: "Elnath", x: 0.05, y: -0.04, mag: 1.7 },
      { name: "Theta2 Tau", x: 0.01, y: 0.005, mag: 3.4 },
      { name: "Zeta Tau", x: 0.055, y: -0.02, mag: 3.0 },
      { name: "Lambda Tau", x: 0.025, y: -0.01, mag: 3.5 },
      { name: "Ain", x: -0.005, y: -0.01, mag: 3.5 },
    ],
    lines: [
      [0, 2], [2, 4], [4, 1], [4, 3], [0, 5],
    ],
  },
  {
    name: "Lyra",
    cx: 0.42,
    cy: 0.28,
    stars: [
      { name: "Vega", x: 0.0, y: 0.0, mag: 0.0 },
      { name: "Sheliak", x: 0.012, y: 0.025, mag: 3.5 },
      { name: "Sulafat", x: 0.02, y: 0.02, mag: 3.3 },
      { name: "Delta1 Lyr", x: -0.01, y: 0.03, mag: 4.2 },
      { name: "Delta2 Lyr", x: -0.005, y: 0.028, mag: 4.3 },
    ],
    lines: [
      [0, 1], [0, 2], [1, 3], [2, 1], [3, 4],
    ],
  },
  {
    name: "Aquila",
    cx: 0.55,
    cy: 0.48,
    stars: [
      { name: "Altair", x: 0.0, y: 0.0, mag: 0.8 },
      { name: "Tarazed", x: -0.012, y: -0.018, mag: 2.7 },
      { name: "Alshain", x: 0.01, y: 0.015, mag: 3.7 },
      { name: "Theta Aql", x: -0.03, y: 0.02, mag: 3.2 },
      { name: "Delta Aql", x: 0.025, y: -0.025, mag: 3.4 },
    ],
    lines: [
      [1, 0], [0, 2], [3, 0], [0, 4],
    ],
  },
];

// Background field stars (random dim stars)
interface FieldStar {
  sx: number; // sky x 0-1
  sy: number; // sky y 0-1
  mag: number;
  twinklePhase: number;
}

// ─── Factory ────────────────────────────────────────────────────────
const ConstellationsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("constellations") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let rotation = 0;
  let showLines = 1;
  let showNames = 1;
  let starBrightness = 100;

  // Background field stars
  let fieldStars: FieldStar[] = [];
  const FIELD_STAR_COUNT = 400;

  function generateFieldStars(): void {
    fieldStars = [];
    for (let i = 0; i < FIELD_STAR_COUNT; i++) {
      fieldStars.push({
        sx: Math.random(),
        sy: Math.random(),
        mag: 3.5 + Math.random() * 3,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  /** Convert sky coordinates (with rotation) to canvas pixel coords */
  function skyToCanvas(sx: number, sy: number): { px: number; py: number } {
    // Apply rotation: shift x by rotation angle (0-360 maps to 0-1 in sky coords)
    const rotFrac = rotation / 360;
    let rx = (sx + rotFrac) % 1;
    if (rx < 0) rx += 1;
    const px = rx * width;
    const py = sy * height;
    return { px, py };
  }

  /** Map apparent magnitude to visual size. Lower mag = bigger/brighter. */
  function magToRadius(mag: number): number {
    const base = Math.max(0.5, 4.5 - mag * 0.7);
    return base * (starBrightness / 100);
  }

  /** Map apparent magnitude to alpha. */
  function magToAlpha(mag: number): number {
    const a = Math.max(0.15, 1.0 - mag * 0.14);
    return Math.min(1, a * (starBrightness / 100));
  }

  function drawStarGlow(px: number, py: number, radius: number, alpha: number, hue: number): void {
    // Outer glow
    const glowR = radius * 4;
    const glow = ctx.createRadialGradient(px, py, 0, px, py, glowR);
    glow.addColorStop(0, `hsla(${hue}, 60%, 90%, ${alpha * 0.5})`);
    glow.addColorStop(0.3, `hsla(${hue}, 50%, 80%, ${alpha * 0.2})`);
    glow.addColorStop(1, `hsla(${hue}, 40%, 70%, 0)`);
    ctx.beginPath();
    ctx.arc(px, py, glowR, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Star body
    const bodyGrad = ctx.createRadialGradient(px, py, 0, px, py, radius);
    bodyGrad.addColorStop(0, `hsla(${hue}, 20%, 100%, ${alpha})`);
    bodyGrad.addColorStop(0.5, `hsla(${hue}, 40%, 85%, ${alpha * 0.9})`);
    bodyGrad.addColorStop(1, `hsla(${hue}, 60%, 70%, ${alpha * 0.3})`);
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Diffraction spikes for bright stars
    if (radius > 2.5) {
      ctx.save();
      ctx.globalAlpha = alpha * 0.35;
      ctx.strokeStyle = `hsla(${hue}, 30%, 95%, 1)`;
      ctx.lineWidth = 0.6;
      const spikeLen = radius * 3.5;
      for (let a = 0; a < 4; a++) {
        const angle = (a * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(px - Math.cos(angle) * spikeLen, py - Math.sin(angle) * spikeLen);
        ctx.lineTo(px + Math.cos(angle) * spikeLen, py + Math.sin(angle) * spikeLen);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function renderBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#050510");
    bgGrad.addColorStop(0.4, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle Milky Way band
    ctx.save();
    ctx.globalAlpha = 0.04;
    const mwGrad = ctx.createLinearGradient(0, height * 0.2, width, height * 0.6);
    mwGrad.addColorStop(0, "transparent");
    mwGrad.addColorStop(0.3, "#8888cc");
    mwGrad.addColorStop(0.5, "#aaaadd");
    mwGrad.addColorStop(0.7, "#8888cc");
    mwGrad.addColorStop(1, "transparent");
    ctx.fillStyle = mwGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function renderFieldStars(): void {
    for (const fs of fieldStars) {
      const { px, py } = skyToCanvas(fs.sx, fs.sy);
      // Twinkling
      const twinkle = 0.6 + 0.4 * Math.sin(time * 2.5 + fs.twinklePhase);
      const alpha = magToAlpha(fs.mag) * twinkle;
      const radius = magToRadius(fs.mag) * 0.6;

      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.3, radius), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220, 225, 255, ${alpha})`;
      ctx.fill();
    }
  }

  function renderConstellations(): void {
    for (const constellation of CONSTELLATIONS) {
      // Convert all star positions to canvas coords
      const canvasStars: Array<{ px: number; py: number; star: StarDef }> = [];
      for (const star of constellation.stars) {
        const sx = constellation.cx + star.x;
        const sy = constellation.cy + star.y;
        const pos = skyToCanvas(sx, sy);
        canvasStars.push({ px: pos.px, py: pos.py, star });
      }

      // Draw constellation lines
      if (showLines >= 0.5) {
        ctx.save();
        ctx.strokeStyle = "rgba(100, 140, 220, 0.25)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([]);
        for (const [a, b] of constellation.lines) {
          if (a < canvasStars.length && b < canvasStars.length) {
            const sa = canvasStars[a];
            const sb = canvasStars[b];
            // Avoid drawing lines that wrap around the screen
            const dx = Math.abs(sa.px - sb.px);
            if (dx > width * 0.5) continue;

            ctx.beginPath();
            ctx.moveTo(sa.px, sa.py);
            ctx.lineTo(sb.px, sb.py);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // Draw stars with glow
      for (const cs of canvasStars) {
        const twinkle = 0.85 + 0.15 * Math.sin(time * 3.0 + cs.star.x * 100 + cs.star.y * 200);
        const radius = magToRadius(cs.star.mag) * twinkle;
        const alpha = magToAlpha(cs.star.mag) * twinkle;

        // Star colour temperature approximation (bright stars tend toward blue/white)
        let hue = 220; // default blue-white
        if (cs.star.name === "Betelgeuse" || cs.star.name === "Antares" || cs.star.name === "Aldebaran") {
          hue = 15; // red giant
        } else if (cs.star.name === "Rigel" || cs.star.name === "Vega" || cs.star.name === "Deneb") {
          hue = 210; // blue-white
        } else if (cs.star.name === "Pollux" || cs.star.name === "Albireo") {
          hue = 40; // yellowish
        } else if (cs.star.mag < 1.5) {
          // Deterministic hue based on star position to avoid flickering
          const hash = Math.abs(Math.sin(cs.star.x * 12.9898 + cs.star.y * 78.233) * 43758.5453);
          hue = 200 + (hash % 1) * 30;
        }

        drawStarGlow(cs.px, cs.py, radius, alpha, hue);
      }

      // Draw constellation name
      if (showNames >= 0.5) {
        // Find centroid of constellation stars
        let cx = 0;
        let cy = 0;
        for (const cs of canvasStars) {
          cx += cs.px;
          cy += cs.py;
        }
        cx /= canvasStars.length;
        cy /= canvasStars.length;

        ctx.save();
        ctx.font = `bold ${Math.max(11, Math.min(width, height) * 0.018)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        // Shadow for readability
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
        ctx.shadowBlur = 4;
        ctx.fillStyle = "rgba(180, 200, 255, 0.7)";
        ctx.fillText(constellation.name, cx, cy - 12);
        ctx.restore();
      }
    }
  }

  function renderStarNames(): void {
    if (showNames < 0.5) return;

    ctx.save();
    ctx.font = `${Math.max(9, Math.min(width, height) * 0.012)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 3;

    for (const constellation of CONSTELLATIONS) {
      for (const star of constellation.stars) {
        // Only label bright stars (mag < 2.0)
        if (star.mag > 2.0) continue;

        const sx = constellation.cx + star.x;
        const sy = constellation.cy + star.y;
        const { px, py } = skyToCanvas(sx, sy);
        const radius = magToRadius(star.mag);

        ctx.fillStyle = "rgba(200, 210, 240, 0.55)";
        ctx.fillText(star.name, px + radius + 5, py);
      }
    }
    ctx.restore();
  }

  function renderHUD(): void {
    // Title
    ctx.save();
    ctx.font = `bold ${Math.max(14, Math.min(width, height) * 0.024)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(200, 210, 240, 0.6)";
    ctx.fillText("Night Sky - Major Constellations", width / 2, 12);

    // Subtitle
    ctx.font = `${Math.max(10, Math.min(width, height) * 0.015)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(160, 170, 200, 0.45)";
    ctx.fillText(
      `${CONSTELLATIONS.length} constellations | Rotation: ${rotation.toFixed(0)}deg`,
      width / 2,
      34
    );
    ctx.restore();

    // Time display - bottom left
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);

    // Compass directions
    ctx.save();
    ctx.font = `bold ${Math.max(11, Math.min(width, height) * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(200, 180, 140, 0.5)";
    ctx.fillText("N", width / 2, height - 8);
    ctx.textBaseline = "top";
    ctx.fillText("S", width / 2, 50);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("E", 8, height / 2);
    ctx.textAlign = "right";
    ctx.fillText("W", width - 8, height / 2);
    ctx.restore();

    // Educational annotation
    ctx.save();
    ctx.font = `${Math.max(9, Math.min(width, height) * 0.013)}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(160, 180, 220, 0.4)";
    ctx.fillText("Star brightness ~ 1/distance^2 (inverse square law)", width - 12, height - 12);
    ctx.restore();
  }

  function renderHorizonLine(): void {
    // Subtle horizon gradient at the very bottom
    const horizGrad = ctx.createLinearGradient(0, height - 40, 0, height);
    horizGrad.addColorStop(0, "rgba(20, 30, 60, 0)");
    horizGrad.addColorStop(1, "rgba(20, 30, 60, 0.3)");
    ctx.fillStyle = horizGrad;
    ctx.fillRect(0, height - 40, width, 40);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    generateFieldStars();
  }

  function update(dt: number, params: Record<string, number>): void {
    rotation = params.rotation ?? 0;
    showLines = params.showLines ?? 1;
    showNames = params.showNames ?? 1;
    starBrightness = params.starBrightness ?? 100;
    time += dt;
  }

  function render(): void {
    renderBackground();
    renderFieldStars();
    renderConstellations();
    renderStarNames();
    renderHorizonLine();
    renderHUD();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    fieldStars = [];
  }

  function getStateDescription(): string {
    const visibleConstellations = CONSTELLATIONS.map((c) => c.name).join(", ");
    const totalStars = CONSTELLATIONS.reduce((sum, c) => sum + c.stars.length, 0);
    return (
      `Night Sky Constellation Viewer: Showing ${CONSTELLATIONS.length} constellations ` +
      `(${visibleConstellations}) with ${totalStars} named stars. ` +
      `Sky rotation: ${rotation.toFixed(0)} deg. ` +
      `Constellation lines: ${showLines >= 0.5 ? "visible" : "hidden"}. ` +
      `Names: ${showNames >= 0.5 ? "visible" : "hidden"}. ` +
      `Star brightness: ${starBrightness}%. ` +
      `Stars twinkle due to atmospheric scintillation. ` +
      `Apparent magnitude scale: lower values = brighter stars (Vega = 0.0, Rigel = 0.1).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    generateFieldStars();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ConstellationsFactory;
