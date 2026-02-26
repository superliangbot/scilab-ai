import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LatitudeOfPolarisFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("latitude-of-polaris") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let latitude = 40; // degrees N
  let showAngleLines = 1;
  let rotation = 0; // Earth rotation for visual

  // Stars for background
  let stars: { x: number; y: number; brightness: number }[] = [];

  function generateStars() {
    stars = [];
    for (let i = 0; i < 100; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        brightness: 0.3 + Math.random() * 0.7,
      });
    }
  }

  return {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      generateStars();
    },
    update(dt: number, params: Record<string, number>) {
      latitude = params.latitude ?? 40;
      showAngleLines = params.showAngleLines ?? 1;
      time += dt;
      rotation += dt * 0.3;
    },
    render() {
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#e2e8f0";
      ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Latitude of Polaris (North Star)", width / 2, 24);

      // Left: Earth diagram
      const earthCx = width * 0.3;
      const earthCy = height * 0.5;
      const earthR = Math.min(width * 0.2, height * 0.28);
      drawEarthDiagram(earthCx, earthCy, earthR);

      // Right: Observer's sky view
      const skyCx = width * 0.72;
      const skyCy = height * 0.5;
      const skyR = Math.min(width * 0.2, height * 0.28);
      drawSkyView(skyCx, skyCy, skyR);

      // Info panel
      drawInfo();
    },
    reset() {
      time = 0;
      rotation = 0;
    },
    destroy() {},
    getStateDescription(): string {
      return `Latitude of Polaris: Observer at ${latitude.toFixed(1)}°N latitude. ` +
        `Polaris appears at ${latitude.toFixed(1)}° above the horizon. ` +
        `At the North Pole (90°N), Polaris is directly overhead. ` +
        `At the Equator (0°), Polaris is on the horizon. ` +
        `The altitude of Polaris equals the observer's latitude because Earth's rotation axis points at Polaris.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  function drawEarthDiagram(cx: number, cy: number, r: number) {
    // Earth circle
    const earthGrad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
    earthGrad.addColorStop(0, "#1e6091");
    earthGrad.addColorStop(0.7, "#1e3a5f");
    earthGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = earthGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Latitude lines
    ctx.strokeStyle = "#38bdf830";
    ctx.lineWidth = 1;
    for (let lat = -60; lat <= 60; lat += 30) {
      const yOff = r * Math.sin(lat * Math.PI / 180);
      const rAt = r * Math.cos(lat * Math.PI / 180);
      ctx.beginPath();
      ctx.ellipse(cx, cy - yOff, rAt, rAt * 0.15, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Equator
    ctx.strokeStyle = "#fbbf2450";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.15, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Earth's axis
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy - r - 25);
    ctx.lineTo(cx, cy + r + 25);
    ctx.stroke();
    ctx.setLineDash([]);

    // N/S labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("N", cx, cy - r - 30);
    ctx.fillText("S", cx, cy + r + 38);

    // Observer position
    const latRad = latitude * Math.PI / 180;
    const obsX = cx + r * Math.cos(latRad) * Math.sin(rotation * 0.3);
    const obsY = cy - r * Math.sin(latRad);

    // Observer on surface (simplified: just show on the front of earth at correct latitude)
    const obsFrontX = cx + r * Math.cos(latRad) * 0.2;
    const obsFrontY = cy - r * Math.sin(latRad);

    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(obsFrontX, obsFrontY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Latitude arc from equator to observer
    if (showAngleLines) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.4, -Math.PI / 2 + (90 - latitude) * Math.PI / 180, Math.PI / 2 - 0.01, true);
      ctx.stroke();

      // Latitude angle label
      ctx.fillStyle = "#fbbf24";
      ctx.font = `bold ${Math.max(12, width * 0.017)}px sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(`${latitude.toFixed(1)}°N`, cx + r * 0.45, cy - r * Math.sin(latRad / 2) + 5);
    }

    // Polaris direction (parallel light from top)
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, cy - r - 25);
    ctx.lineTo(cx, cy - r - 80);
    ctx.stroke();
    ctx.setLineDash([]);

    // Polaris star
    drawStar(cx, cy - r - 90, 6, "#fef08a");
    ctx.fillStyle = "#fef08a";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Polaris", cx, cy - r - 100);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.fillText("Earth Diagram", cx, cy + r + 52);
  }

  function drawSkyView(cx: number, cy: number, r: number) {
    // Sky dome background
    const skyGrad = ctx.createRadialGradient(cx, cy + r, r * 0.3, cx, cy, r);
    skyGrad.addColorStop(0, "#1e3a5f");
    skyGrad.addColorStop(1, "#0a0a1a");
    ctx.fillStyle = skyGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Stars
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.clip();

    for (const s of stars) {
      const sx = cx + (s.x - 0.5) * r * 2;
      const sy = cy + (s.y - 0.5) * r * 2;
      const twinkle = 0.5 + 0.5 * Math.sin(time * 2 + s.x * 100);
      ctx.fillStyle = `rgba(255,255,255,${s.brightness * twinkle * 0.5})`;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.restore();

    // Horizon line
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + r * 0.7);
    ctx.lineTo(cx + r, cy + r * 0.7);
    ctx.stroke();
    ctx.fillStyle = "#475569";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Horizon", cx, cy + r * 0.7 + 12);

    // Zenith
    ctx.fillStyle = "#64748b";
    ctx.fillText("Zenith", cx, cy - r + 12);

    // Polaris position in sky
    // Altitude of Polaris = observer's latitude
    const horizonY = cy + r * 0.7;
    const zenithY = cy - r * 0.7;
    const polarisAltFrac = latitude / 90;
    const polarisY = horizonY - polarisAltFrac * (horizonY - zenithY);

    drawStar(cx, polarisY, 8, "#fef08a");
    ctx.fillStyle = "#fef08a";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Polaris ★", cx + 12, polarisY + 3);

    // Angle arc from horizon to Polaris
    if (showAngleLines) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      // Vertical line from horizon to polaris
      ctx.beginPath();
      ctx.moveTo(cx, horizonY);
      ctx.lineTo(cx, polarisY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Angle label
      ctx.fillStyle = "#fbbf24";
      ctx.font = `bold ${Math.max(12, width * 0.018)}px sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText(`${latitude.toFixed(1)}°`, cx - 8, (horizonY + polarisY) / 2 + 5);
    }

    // Cardinal directions
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("N", cx, cy + r * 0.7 + 24);
    ctx.fillText("Observer's Sky", cx, cy + r + 16);
  }

  function drawStar(x: number, y: number, size: number, color: string) {
    ctx.fillStyle = color;
    const spikes = 4;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? size : size * 0.4;
      const sx = x + r * Math.cos(angle);
      const sy = y + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawInfo() {
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(10, width * 0.014)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`At latitude ${latitude.toFixed(1)}°N, Polaris appears ${latitude.toFixed(1)}° above the horizon`, width / 2, height - 30);
    ctx.fillText("Altitude of Polaris = Observer's Latitude (parallel starlight on a spherical Earth)", width / 2, height - 12);
  }
};

export default LatitudeOfPolarisFactory;
