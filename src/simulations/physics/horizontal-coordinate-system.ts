import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const HorizontalCoordinateSystemFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("horizontal-coordinate-system") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let azimuth = 45; // degrees from North, clockwise
  let altitude = 30; // degrees above horizon

  // 3D projection helpers
  const cameraElevation = 25; // degrees
  const cameraDistance = 5;

  function project3D(
    x: number,
    y: number,
    z: number,
    cx: number,
    cy: number,
    scale: number
  ): { px: number; py: number; depth: number } {
    // Simple isometric-like 3D projection
    const camElRad = (cameraElevation * Math.PI) / 180;
    const cosE = Math.cos(camElRad);
    const sinE = Math.sin(camElRad);

    // Rotate around x-axis for camera elevation
    const y2 = y * cosE - z * sinE;
    const z2 = y * sinE + z * cosE;

    const px = cx + x * scale;
    const py = cy - y2 * scale;
    return { px, py, depth: z2 };
  }

  function drawHorizonPlane(cx: number, cy: number, radius: number) {
    // Draw the horizon as an ellipse
    ctx.strokeStyle = "rgba(100,150,200,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();

    const segments = 72;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const p = project3D(x, 0, z, cx, cy, 1);
      if (i === 0) ctx.moveTo(p.px, p.py);
      else ctx.lineTo(p.px, p.py);
    }
    ctx.closePath();
    ctx.stroke();

    // Fill with translucent color
    ctx.fillStyle = "rgba(30,60,40,0.2)";
    ctx.fill();

    // Cardinal directions
    const directions = [
      { label: "N", angle: 0, color: "#ff4444" },
      { label: "E", angle: 90, color: "#44aaff" },
      { label: "S", angle: 180, color: "#ffaa44" },
      { label: "W", angle: 270, color: "#44ff88" },
    ];

    for (const dir of directions) {
      const rad = (dir.angle * Math.PI) / 180;
      const x = Math.sin(rad) * (radius + 20);
      const z = -Math.cos(rad) * (radius + 20);
      const p = project3D(x, 0, z, cx, cy, 1);

      ctx.fillStyle = dir.color;
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(dir.label, p.px, p.py);

      // Tick on horizon
      const x1 = Math.sin(rad) * (radius - 5);
      const z1 = -Math.cos(rad) * (radius - 5);
      const x2 = Math.sin(rad) * (radius + 5);
      const z2 = -Math.cos(rad) * (radius + 5);
      const p1 = project3D(x1, 0, z1, cx, cy, 1);
      const p2 = project3D(x2, 0, z2, cx, cy, 1);
      ctx.strokeStyle = dir.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
    }

    // Intermediate directions (30° marks)
    ctx.strokeStyle = "rgba(100,150,200,0.3)";
    ctx.lineWidth = 1;
    for (let a = 0; a < 360; a += 30) {
      if (a % 90 === 0) continue;
      const rad = (a * Math.PI) / 180;
      const x1 = Math.sin(rad) * (radius - 3);
      const z1 = -Math.cos(rad) * (radius - 3);
      const x2 = Math.sin(rad) * (radius + 3);
      const z2 = -Math.cos(rad) * (radius + 3);
      const p1 = project3D(x1, 0, z1, cx, cy, 1);
      const p2 = project3D(x2, 0, z2, cx, cy, 1);
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
    }
  }

  function drawAzimuthArc(cx: number, cy: number, radius: number) {
    // Azimuth arc on horizon plane from North
    ctx.strokeStyle = "rgba(255,200,0,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();

    const steps = Math.max(2, Math.floor(Math.abs(azimuth) / 3));
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * azimuth;
      const rad = (a * Math.PI) / 180;
      const x = Math.sin(rad) * radius * 0.5;
      const z = -Math.cos(rad) * radius * 0.5;
      const p = project3D(x, 0, z, cx, cy, 1);
      if (i === 0) ctx.moveTo(p.px, p.py);
      else ctx.lineTo(p.px, p.py);
    }
    ctx.stroke();

    // Azimuth label
    const midAngle = (azimuth / 2) * Math.PI / 180;
    const lx = Math.sin(midAngle) * radius * 0.35;
    const lz = -Math.cos(midAngle) * radius * 0.35;
    const lp = project3D(lx, 0, lz, cx, cy, 1);
    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`Az: ${azimuth.toFixed(0)}°`, lp.px, lp.py - 5);
  }

  function drawAltitudeArc(cx: number, cy: number, radius: number) {
    // Altitude arc from horizon to star
    const azRad = (azimuth * Math.PI) / 180;
    ctx.strokeStyle = "rgba(255,100,100,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();

    const steps = Math.max(2, Math.floor(altitude / 3));
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * altitude;
      const altRad = (a * Math.PI) / 180;
      const r = radius * 0.7;
      const x = Math.sin(azRad) * Math.cos(altRad) * r;
      const y = Math.sin(altRad) * r;
      const z = -Math.cos(azRad) * Math.cos(altRad) * r;
      const p = project3D(x, y, z, cx, cy, 1);
      if (i === 0) ctx.moveTo(p.px, p.py);
      else ctx.lineTo(p.px, p.py);
    }
    ctx.stroke();

    // Altitude label
    const midAlt = (altitude / 2) * Math.PI / 180;
    const llx = Math.sin(azRad) * Math.cos(midAlt) * radius * 0.55;
    const lly = Math.sin(midAlt) * radius * 0.55;
    const llz = -Math.cos(azRad) * Math.cos(midAlt) * radius * 0.55;
    const llp = project3D(llx, lly, llz, cx, cy, 1);
    ctx.fillStyle = "#ff8888";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`Alt: ${altitude.toFixed(0)}°`, llp.px + 15, llp.py);
  }

  function drawStar(cx: number, cy: number, radius: number) {
    const azRad = (azimuth * Math.PI) / 180;
    const altRad = (altitude * Math.PI) / 180;
    const r = radius * 0.7;

    const x = Math.sin(azRad) * Math.cos(altRad) * r;
    const y = Math.sin(altRad) * r;
    const z = -Math.cos(azRad) * Math.cos(altRad) * r;
    const p = project3D(x, y, z, cx, cy, 1);

    // Star glow
    const starGrad = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, 15);
    starGrad.addColorStop(0, "rgba(255,255,150,1)");
    starGrad.addColorStop(0.3, "rgba(255,255,100,0.6)");
    starGrad.addColorStop(1, "rgba(255,255,50,0)");
    ctx.fillStyle = starGrad;
    ctx.beginPath();
    ctx.arc(p.px, p.py, 15, 0, Math.PI * 2);
    ctx.fill();

    // Star core
    ctx.fillStyle = "#ffffaa";
    ctx.beginPath();
    ctx.arc(p.px, p.py, 5, 0, Math.PI * 2);
    ctx.fill();

    // Dashed line from star down to horizon
    const horizX = Math.sin(azRad) * Math.cos(0) * r;
    const horizZ = -Math.cos(azRad) * Math.cos(0) * r;
    const pH = project3D(horizX, 0, horizZ, cx, cy, 1);

    ctx.strokeStyle = "rgba(255,255,150,0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p.px, p.py);
    ctx.lineTo(pH.px, pH.py);
    ctx.stroke();
    ctx.setLineDash([]);

    // Line from center to horizon point
    const pC = project3D(0, 0, 0, cx, cy, 1);
    ctx.strokeStyle = "rgba(255,200,0,0.3)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pC.px, pC.py);
    ctx.lineTo(pH.px, pH.py);
    ctx.stroke();
    ctx.setLineDash([]);

    // Line from center to star
    ctx.strokeStyle = "rgba(255,100,100,0.3)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pC.px, pC.py);
    ctx.lineTo(p.px, p.py);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawZenith(cx: number, cy: number, radius: number) {
    const p = project3D(0, radius * 0.7, 0, cx, cy, 1);
    ctx.fillStyle = "rgba(150,150,255,0.5)";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Zenith (90°)", p.px, p.py - 8);

    ctx.strokeStyle = "rgba(150,150,255,0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    const pC = project3D(0, 0, 0, cx, cy, 1);
    ctx.beginPath();
    ctx.moveTo(pC.px, pC.py);
    ctx.lineTo(p.px, p.py);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawObserver(cx: number, cy: number) {
    const p = project3D(0, 0, 0, cx, cy, 1);
    // Simple stick figure
    ctx.fillStyle = "#88aacc";
    ctx.beginPath();
    ctx.arc(p.px, p.py - 18, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#88aacc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.px, p.py - 12);
    ctx.lineTo(p.px, p.py);
    ctx.stroke();
    // Arms
    ctx.beginPath();
    ctx.moveTo(p.px - 8, p.py - 8);
    ctx.lineTo(p.px + 8, p.py - 8);
    ctx.stroke();
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
      azimuth = params.azimuth ?? 45;
      altitude = params.altitude ?? 30;
      time += dt;
    },

    render() {
      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, "#0a0a2e");
      skyGrad.addColorStop(0.5, "#1a1a4e");
      skyGrad.addColorStop(1, "#0c1222");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Stars in background
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 80; i++) {
        const sx = (i * 137.5 + 42) % width;
        const sy = (i * 97.3 + 13) % (height * 0.6);
        ctx.globalAlpha = 0.2 + 0.3 * ((i * 31) % 100) / 100;
        const size = 0.5 + ((i * 17) % 100) / 100;
        ctx.fillRect(sx, sy, size, size);
      }
      ctx.globalAlpha = 1;

      // Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Horizontal Coordinate System", width / 2, 28);

      const centerX = width / 2;
      const centerY = height * 0.52;
      const radius = Math.min(width, height) * 0.32;

      // Draw components
      drawHorizonPlane(centerX, centerY, radius);
      drawZenith(centerX, centerY, radius);
      drawAzimuthArc(centerX, centerY, radius);
      drawAltitudeArc(centerX, centerY, radius);
      drawStar(centerX, centerY, radius);
      drawObserver(centerX, centerY);

      // Info panel
      const panelX = 15;
      const panelY = height - 110;
      ctx.fillStyle = "rgba(10,15,30,0.85)";
      ctx.strokeStyle = "rgba(100,150,255,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, 230, 95, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Coordinates", panelX + 12, panelY + 20);

      ctx.fillStyle = "#ffcc00";
      ctx.font = "12px monospace";
      ctx.fillText(`Azimuth:  ${azimuth.toFixed(1)}° (from N, clockwise)`, panelX + 12, panelY + 40);
      ctx.fillStyle = "#ff8888";
      ctx.fillText(`Altitude: ${altitude.toFixed(1)}° (above horizon)`, panelX + 12, panelY + 58);

      const direction = azimuth < 45 || azimuth > 315 ? "N" :
        azimuth < 135 ? "E" : azimuth < 225 ? "S" : "W";
      ctx.fillStyle = "#88aacc";
      ctx.fillText(`Direction: ${direction}`, panelX + 12, panelY + 76);

      // Bottom description
      ctx.fillStyle = "#556";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Azimuth: compass direction from North | Altitude: angle above horizon", width / 2, height - 10);
    },

    reset() {
      time = 0;
    },

    destroy() {},

    getStateDescription() {
      return `Horizontal coordinate system showing celestial object at azimuth=${azimuth.toFixed(1)}° and altitude=${altitude.toFixed(1)}°. Azimuth is measured clockwise from North (0-360°), altitude from horizon to zenith (0-90°).`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default HorizontalCoordinateSystemFactory;
