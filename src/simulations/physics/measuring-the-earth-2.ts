import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

/**
 * Measuring the Earth 2: Using the horizon distance method.
 * When you stand at height h above sea level, the distance to the horizon
 * is d = sqrt(2Rh + h²) ≈ sqrt(2Rh).
 * By measuring h and d, you can compute R.
 */
const MeasuringTheEarth2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("measuring-the-earth-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;

  // Parameters
  let observerHeight = 30; // meters
  let earthRadiusGuess = 6371; // km
  let showGeometry = 1;

  const ACTUAL_RADIUS = 6371; // km

  function horizonDistance(h: number, R: number): number {
    // d = sqrt(2*R*h + h^2), R in km, h in m => h in km = h/1000
    const hKm = h / 1000;
    return Math.sqrt(2 * R * hKm + hKm * hKm);
  }

  function computeRadiusFromHorizon(h: number, d: number): number {
    // d^2 = 2Rh + h^2 => R = (d^2 - h^2) / (2h)
    const hKm = h / 1000;
    return (d * d - hKm * hKm) / (2 * hKm);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
    },

    update(dt: number, params: Record<string, number>) {
      observerHeight = params.observerHeight ?? 30;
      earthRadiusGuess = params.earthRadiusGuess ?? 6371;
      showGeometry = params.showGeometry ?? 1;
    },

    render() {
      if (!ctx) return;

      // Background: sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, "#0c1445");
      skyGrad.addColorStop(0.4, "#1a3a6c");
      skyGrad.addColorStop(0.7, "#4a8bc2");
      skyGrad.addColorStop(1, "#87ceeb");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Measuring the Earth — Horizon Distance Method", W / 2, 28);

      // Draw Earth as large arc
      const earthDrawR = W * 1.8; // large radius so it looks curved
      const earthCenterX = W / 2;
      const earthCenterY = H * 0.65 + earthDrawR;

      // Ocean
      ctx.beginPath();
      ctx.arc(earthCenterX, earthCenterY, earthDrawR, 0, Math.PI * 2);
      ctx.fillStyle = "#1a5276";
      ctx.fill();

      // Earth surface line
      ctx.beginPath();
      ctx.arc(earthCenterX, earthCenterY, earthDrawR, -Math.PI, 0);
      ctx.strokeStyle = "#2980b9";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Observer position (on the left, elevated)
      const surfaceY = earthCenterY - earthDrawR;
      const heightScale = Math.min(observerHeight * 0.8, H * 0.25);
      const observerX = W * 0.15;
      const observerY = surfaceY - heightScale;

      // Draw cliff/tower
      ctx.fillStyle = "#5d4e37";
      ctx.fillRect(observerX - 12, observerY, 24, heightScale);
      ctx.fillStyle = "#7d6e57";
      ctx.fillRect(observerX - 16, observerY - 6, 32, 8);

      // Observer figure
      ctx.beginPath();
      ctx.arc(observerX, observerY - 16, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#f0c040";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(observerX, observerY - 8);
      ctx.lineTo(observerX, observerY + 2);
      ctx.strokeStyle = "#f0c040";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Height label
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "right";
      ctx.fillText(`h = ${observerHeight} m`, observerX - 20, observerY + heightScale / 2);

      // Draw height arrow
      ctx.beginPath();
      ctx.moveTo(observerX - 14, observerY);
      ctx.lineTo(observerX - 14, surfaceY);
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Horizon point
      const d = horizonDistance(observerHeight, earthRadiusGuess);
      const horizonFraction = Math.min(d / 50, 0.7); // scale for visual
      const horizonX = observerX + W * horizonFraction;
      const horizonY = surfaceY + (horizonX - earthCenterX) * (horizonX - earthCenterX) / (2 * earthDrawR);

      // Line of sight to horizon
      ctx.beginPath();
      ctx.moveTo(observerX, observerY - 10);
      ctx.lineTo(horizonX, horizonY);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Horizon point marker
      ctx.beginPath();
      ctx.arc(horizonX, horizonY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();

      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "center";
      ctx.fillText("Horizon", horizonX, horizonY - 12);

      // Distance label
      ctx.fillStyle = "#38bdf8";
      ctx.textAlign = "center";
      const midX = (observerX + horizonX) / 2;
      const midY = (observerY + horizonY) / 2 - 15;
      ctx.fillText(`d = ${d.toFixed(1)} km`, midX, midY);

      if (showGeometry) {
        // Right triangle diagram on the right side
        const diagramX = W * 0.65;
        const diagramY = H * 0.15;
        const diagramW = W * 0.3;
        const diagramH = H * 0.35;

        // Background panel
        ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(diagramX - 10, diagramY - 10, diagramW + 20, diagramH + 20, 8);
        ctx.fill();
        ctx.stroke();

        ctx.font = "bold 12px system-ui, sans-serif";
        ctx.fillStyle = "#e2e8f0";
        ctx.textAlign = "center";
        ctx.fillText("Geometry", diagramX + diagramW / 2, diagramY + 5);

        // Draw right triangle: center of Earth, observer, horizon point
        const triCx = diagramX + diagramW * 0.2;
        const triCy = diagramY + diagramH * 0.8;
        const triOx = diagramX + diagramW * 0.2;
        const triOy = diagramY + diagramH * 0.2;
        const triHx = diagramX + diagramW * 0.85;
        const triHy = diagramY + diagramH * 0.8;

        // R line (center to horizon)
        ctx.beginPath();
        ctx.moveTo(triCx, triCy);
        ctx.lineTo(triHx, triHy);
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        ctx.stroke();

        // R+h line (center to observer)
        ctx.beginPath();
        ctx.moveTo(triCx, triCy);
        ctx.lineTo(triOx, triOy);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.stroke();

        // d line (observer to horizon - tangent)
        ctx.beginPath();
        ctx.moveTo(triOx, triOy);
        ctx.lineTo(triHx, triHy);
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Right angle marker
        ctx.beginPath();
        ctx.moveTo(triHx - 12, triHy);
        ctx.lineTo(triHx - 12, triHy - 12);
        ctx.lineTo(triHx, triHy - 12);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Labels
        ctx.font = "11px system-ui, sans-serif";
        ctx.fillStyle = "#22c55e";
        ctx.textAlign = "center";
        ctx.fillText("R", (triCx + triHx) / 2, triCy + 15);
        ctx.fillStyle = "#fbbf24";
        ctx.fillText("R + h", triCx - 20, (triCy + triOy) / 2);
        ctx.fillStyle = "#ef4444";
        ctx.fillText("d", (triOx + triHx) / 2 + 10, (triOy + triHy) / 2 - 10);

        // Formula
        ctx.font = "11px system-ui, sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "center";
        ctx.fillText("d² + R² = (R+h)²", diagramX + diagramW / 2, diagramY + diagramH + 5);
      }

      // Computation panel
      const computedR = computeRadiusFromHorizon(observerHeight, d);
      const errorPct = Math.abs((computedR - ACTUAL_RADIUS) / ACTUAL_RADIUS * 100);

      const panelY = H - 75;
      ctx.font = "13px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`d = √(2Rh) = ${d.toFixed(2)} km`, 16, panelY);
      ctx.fillStyle = "#22c55e";
      ctx.fillText(`R (used) = ${earthRadiusGuess.toLocaleString()} km`, 16, panelY + 20);

      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`Observer height: ${observerHeight} m`, 16, panelY + 40);

      ctx.textAlign = "right";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Actual Earth radius: ${ACTUAL_RADIUS.toLocaleString()} km`, W - 16, panelY);
      ctx.fillStyle = "#c084fc";
      ctx.fillText(`Horizon distance from ${observerHeight}m: ${d.toFixed(2)} km`, W - 16, panelY + 20);

      // Info
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText(
        "The farther you can see to the horizon, the larger the Earth must be. d ≈ √(2Rh) for h << R.",
        W / 2, H - 10
      );
    },

    reset() {},

    destroy() {},

    getStateDescription(): string {
      const d = horizonDistance(observerHeight, earthRadiusGuess);
      return (
        `Horizon distance method: Observer height h=${observerHeight}m, ` +
        `Earth radius (guess) R=${earthRadiusGuess} km. ` +
        `Horizon distance d=√(2Rh)=${d.toFixed(2)} km. ` +
        `Formula: d² + R² = (R+h)², so R = (d²-h²)/(2h).`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default MeasuringTheEarth2Factory;
