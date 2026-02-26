import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

/**
 * Eratosthenes' method: measuring Earth's circumference using shadow angles
 * at two cities (Alexandria and Syene) at the same time on summer solstice.
 */
const MeasuringTheEarthFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("measuring-the-earth") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;

  // Parameters
  let distanceBetweenCities = 800; // km (Alexandria to Syene ~ 800 km)
  let shadowAngle = 7.2; // degrees
  let sunElevation = 0.5; // animation control

  const ACTUAL_CIRCUMFERENCE = 40075; // km
  const ACTUAL_RADIUS = 6371; // km

  function computeCircumference(): number {
    if (shadowAngle <= 0) return Infinity;
    return (360 / shadowAngle) * distanceBetweenCities;
  }

  function computeRadius(): number {
    const c = computeCircumference();
    return c / (2 * Math.PI);
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
      distanceBetweenCities = params.distanceBetweenCities ?? 800;
      shadowAngle = params.shadowAngle ?? 7.2;
      sunElevation = params.sunElevation ?? 0.5;
    },

    render() {
      if (!ctx) return;

      // Background
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Measuring the Earth — Eratosthenes' Method", W / 2, 28);

      const cx = W / 2;
      const cy = H * 0.48;
      const earthR = Math.min(W, H) * 0.28;

      // Draw Earth
      const earthGrad = ctx.createRadialGradient(cx - earthR * 0.2, cy - earthR * 0.2, 0, cx, cy, earthR);
      earthGrad.addColorStop(0, "#2563eb");
      earthGrad.addColorStop(0.7, "#1e40af");
      earthGrad.addColorStop(1, "#1e3a5f");
      ctx.beginPath();
      ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
      ctx.fillStyle = earthGrad;
      ctx.fill();
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Place two cities on the Earth surface
      const angleRad = (shadowAngle * Math.PI) / 180;
      const cityAngleBase = -Math.PI / 2 - angleRad / 2; // center the arc at top

      // Syene (no shadow - sun directly overhead)
      const syeneAngle = cityAngleBase + angleRad;
      const syeneX = cx + earthR * Math.cos(syeneAngle);
      const syeneY = cy + earthR * Math.sin(syeneAngle);

      // Alexandria (has shadow)
      const alexAngle = cityAngleBase;
      const alexX = cx + earthR * Math.cos(alexAngle);
      const alexY = cy + earthR * Math.sin(alexAngle);

      // Draw radii to both cities
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(syeneX, syeneY);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(alexX, alexY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw arc between cities on surface
      ctx.beginPath();
      ctx.arc(cx, cy, earthR, Math.min(alexAngle, syeneAngle), Math.max(alexAngle, syeneAngle));
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Label arc distance
      const midArcAngle = (alexAngle + syeneAngle) / 2;
      const arcLabelX = cx + (earthR + 20) * Math.cos(midArcAngle);
      const arcLabelY = cy + (earthR + 20) * Math.sin(midArcAngle);
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "center";
      ctx.fillText(`d = ${distanceBetweenCities} km`, arcLabelX, arcLabelY);

      // Draw angle arc at center
      ctx.beginPath();
      ctx.arc(cx, cy, 40, Math.min(alexAngle, syeneAngle), Math.max(alexAngle, syeneAngle));
      ctx.strokeStyle = "#ff6b6b";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label the angle
      const angleLabelX = cx + 55 * Math.cos(midArcAngle);
      const angleLabelY = cy + 55 * Math.sin(midArcAngle);
      ctx.fillStyle = "#ff6b6b";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.fillText(`θ = ${shadowAngle.toFixed(1)}°`, angleLabelX, angleLabelY);

      // Sun rays (parallel lines coming from above)
      const sunRayDir = { x: Math.cos(-Math.PI / 2), y: Math.sin(-Math.PI / 2) };
      ctx.strokeStyle = "#ffdd44";
      ctx.lineWidth = 1.5;

      for (let i = -3; i <= 3; i++) {
        const offset = i * 30;
        const startX = cx + offset;
        const startY = 50;
        const endY = Math.min(syeneY - 15, alexY - 15);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX, endY);
        ctx.stroke();

        // Arrow
        ctx.beginPath();
        ctx.moveTo(startX, endY);
        ctx.lineTo(startX - 4, endY - 8);
        ctx.moveTo(startX, endY);
        ctx.lineTo(startX + 4, endY - 8);
        ctx.stroke();
      }

      // Sun label
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#ffdd44";
      ctx.textAlign = "center";
      ctx.fillText("☀ Parallel Sun Rays", W / 2, 45);

      // Draw obelisk at Alexandria (stick casting shadow)
      const stickLen = 35;
      // Stick normal to surface
      const normalAlex = alexAngle - Math.PI; // outward pointing
      const stickEndX = alexX + stickLen * Math.cos(normalAlex);
      const stickEndY = alexY + stickLen * Math.sin(normalAlex);

      ctx.beginPath();
      ctx.moveTo(alexX, alexY);
      ctx.lineTo(stickEndX, stickEndY);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Shadow (angled from vertical sun rays)
      const shadowLen = stickLen * Math.tan(angleRad) * sunElevation;
      const tangent = alexAngle + Math.PI / 2;
      const shadowEndX = alexX + shadowLen * Math.cos(tangent);
      const shadowEndY = alexY + shadowLen * Math.sin(tangent);

      ctx.beginPath();
      ctx.moveTo(alexX, alexY);
      ctx.lineTo(shadowEndX, shadowEndY);
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // City dots
      ctx.beginPath();
      ctx.arc(alexX, alexY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(syeneX, syeneY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#22c55e";
      ctx.fill();

      // City labels
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#ef4444";
      const alexLabelX = alexX + 25 * Math.cos(normalAlex);
      const alexLabelY = alexY + 25 * Math.sin(normalAlex) - 10;
      ctx.fillText("Alexandria", alexLabelX - 10, alexLabelY);

      ctx.fillStyle = "#22c55e";
      const syeneLabelX = syeneX + 25 * Math.cos(syeneAngle - Math.PI);
      const syeneLabelY = syeneY + 25 * Math.sin(syeneAngle - Math.PI) - 10;
      ctx.fillText("Syene", syeneLabelX + 10, syeneLabelY);

      // Draw obelisk at Syene (no shadow - sun directly overhead)
      const normalSyene = syeneAngle - Math.PI;
      const stick2EndX = syeneX + stickLen * Math.cos(normalSyene);
      const stick2EndY = syeneY + stickLen * Math.sin(normalSyene);
      ctx.beginPath();
      ctx.moveTo(syeneX, syeneY);
      ctx.lineTo(stick2EndX, stick2EndY);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Computation panel
      const circumference = computeCircumference();
      const radius = computeRadius();
      const errorPct = Math.abs((circumference - ACTUAL_CIRCUMFERENCE) / ACTUAL_CIRCUMFERENCE * 100);

      const panelY = H - 90;
      ctx.font = "13px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "#94a3b8";
      ctx.fillText("Eratosthenes' Formula:", 16, panelY);

      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`C = (360° / θ) × d = (360° / ${shadowAngle.toFixed(1)}°) × ${distanceBetweenCities} km`, 16, panelY + 20);

      ctx.fillStyle = "#22c55e";
      ctx.fillText(`C = ${Math.round(circumference).toLocaleString()} km`, 16, panelY + 40);
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`R = C / 2π = ${Math.round(radius).toLocaleString()} km`, 16, panelY + 60);

      ctx.textAlign = "right";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Actual circumference: ${ACTUAL_CIRCUMFERENCE.toLocaleString()} km`, W - 16, panelY + 20);
      ctx.fillText(`Actual radius: ${ACTUAL_RADIUS.toLocaleString()} km`, W - 16, panelY + 40);
      ctx.fillStyle = errorPct < 5 ? "#22c55e" : "#fbbf24";
      ctx.fillText(`Error: ${errorPct.toFixed(1)}%`, W - 16, panelY + 60);
    },

    reset() {},

    destroy() {},

    getStateDescription(): string {
      const c = computeCircumference();
      const r = computeRadius();
      const err = Math.abs((c - ACTUAL_CIRCUMFERENCE) / ACTUAL_CIRCUMFERENCE * 100);
      return (
        `Eratosthenes' measurement of Earth: Shadow angle θ=${shadowAngle.toFixed(1)}°, ` +
        `distance between cities d=${distanceBetweenCities} km. ` +
        `Computed circumference C=(360/θ)×d = ${Math.round(c).toLocaleString()} km (actual: ${ACTUAL_CIRCUMFERENCE} km, error: ${err.toFixed(1)}%). ` +
        `Computed radius R=${Math.round(r).toLocaleString()} km (actual: ${ACTUAL_RADIUS} km).`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default MeasuringTheEarthFactory;
