import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LatitudeOfPolarisFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("latitude-of-polaris") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let latitude = 45; // degrees
  let showGrid = 1;
  let showAngles = 1;

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
    },
    update(dt: number, params: Record<string, number>) {
      latitude = params.latitude ?? 45;
      showGrid = params.showGrid ?? 1;
      showAngles = params.showAngles ?? 1;
      time += dt;
    },
    render() {
      ctx.clearRect(0, 0, width, height);

      // Night sky background
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#050520");
      bg.addColorStop(0.6, "#0a0a30");
      bg.addColorStop(1, "#1a3a1a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Stars
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      for (let i = 0; i < 80; i++) {
        const sx = (Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5) * width;
        const sy = (Math.sin(i * 269.5 + 183.3) * 0.5 + 0.5) * height * 0.65;
        const sr = 0.3 + Math.random() * 0.7;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Altitude of Polaris = Observer's Latitude", width / 2, 22);

      // === LEFT PANEL: Observer's sky view ===
      const panelW = width * 0.48;
      const skyViewX = width * 0.02;
      const skyViewCY = height * 0.5;

      // Ground
      const groundY = height * 0.7;
      ctx.fillStyle = "#1a3a1a";
      ctx.fillRect(skyViewX, groundY, panelW, height - groundY);
      ctx.strokeStyle = "#2e7d32";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(skyViewX, groundY);
      ctx.lineTo(skyViewX + panelW, groundY);
      ctx.stroke();

      // Horizon label
      ctx.fillStyle = "#4caf50";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Horizon", skyViewX + 5, groundY + 15);

      // Observer
      const obsX = skyViewX + panelW * 0.3;
      const obsY = groundY;

      // Observer figure
      ctx.fillStyle = "#ffcc80";
      ctx.beginPath();
      ctx.arc(obsX, obsY - 25, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffcc80";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(obsX, obsY - 17);
      ctx.lineTo(obsX, obsY - 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(obsX, obsY - 2);
      ctx.lineTo(obsX - 6, obsY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(obsX, obsY - 2);
      ctx.lineTo(obsX + 6, obsY);
      ctx.stroke();

      // Zenith line
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(obsX, obsY - 30);
      ctx.lineTo(obsX, height * 0.08);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#aaa";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Zenith", obsX, height * 0.07);

      // Polaris position
      const altRad = (latitude * Math.PI) / 180;
      const polarisAngle = Math.PI / 2 - altRad; // from vertical
      const lineLen = groundY - height * 0.1;

      // Line of sight to Polaris
      const polarisEndX = obsX + lineLen * Math.sin(polarisAngle);
      const polarisEndY = obsY - 30 - lineLen * Math.cos(polarisAngle);

      ctx.strokeStyle = "#ffeb3b";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(obsX, obsY - 30);
      ctx.lineTo(polarisEndX, Math.max(polarisEndY, height * 0.05));
      ctx.stroke();
      ctx.setLineDash([]);

      // Polaris star
      const starX = polarisEndX;
      const starY = Math.max(polarisEndY, height * 0.05);
      ctx.fillStyle = "#ffeb3b";
      ctx.beginPath();
      ctx.arc(starX, starY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Star glow
      const starGlow = ctx.createRadialGradient(starX, starY, 0, starX, starY, 15);
      starGlow.addColorStop(0, "rgba(255, 235, 59, 0.4)");
      starGlow.addColorStop(1, "transparent");
      ctx.fillStyle = starGlow;
      ctx.beginPath();
      ctx.arc(starX, starY, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffeb3b";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Polaris ★", starX + 10, starY + 4);

      // Altitude angle arc
      if (showAngles > 0.5) {
        ctx.strokeStyle = "#e040fb";
        ctx.lineWidth = 2;
        const arcR = 50;
        ctx.beginPath();
        // Arc from horizon to line of sight
        const horizonAngle = 0;
        ctx.arc(obsX, obsY - 30, arcR, -Math.PI / 2, -Math.PI / 2 + altRad, false);
        ctx.stroke();

        // Angle label
        const midAngle = -Math.PI / 2 + altRad / 2;
        ctx.fillStyle = "#e040fb";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${latitude.toFixed(1)}°`, obsX + (arcR + 18) * Math.cos(midAngle), obsY - 30 + (arcR + 18) * Math.sin(midAngle));

        // Horizontal reference line
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(obsX, obsY - 30);
        ctx.lineTo(obsX + arcR + 30, obsY - 30);
        ctx.stroke();
      }

      ctx.fillStyle = "#ccc";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Observer's Sky View", skyViewX + panelW / 2, height * 0.04 + 30);

      // === RIGHT PANEL: Earth diagram ===
      const earthCX = width * 0.75;
      const earthCY = height * 0.45;
      const earthR = Math.min(width * 0.18, height * 0.28);

      // Earth
      const earthGrad = ctx.createRadialGradient(earthCX - earthR * 0.2, earthCY - earthR * 0.2, 0, earthCX, earthCY, earthR);
      earthGrad.addColorStop(0, "#1565c0");
      earthGrad.addColorStop(0.5, "#0d47a1");
      earthGrad.addColorStop(1, "#01579b");
      ctx.fillStyle = earthGrad;
      ctx.beginPath();
      ctx.arc(earthCX, earthCY, earthR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#42a5f5";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Earth grid
      if (showGrid > 0.5) {
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 0.5;
        // Latitude lines
        for (let lat = -60; lat <= 60; lat += 30) {
          const r = (lat * Math.PI) / 180;
          const y = earthCY - earthR * Math.sin(r);
          const xW = earthR * Math.cos(r);
          ctx.beginPath();
          ctx.ellipse(earthCX, y, xW, xW * 0.1, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Equator
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath();
        ctx.ellipse(earthCX, earthCY, earthR, earthR * 0.1, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Earth axis
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(earthCX, earthCY - earthR - 25);
      ctx.lineTo(earthCX, earthCY + earthR + 25);
      ctx.stroke();

      // N and S labels
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("N", earthCX, earthCY - earthR - 30);
      ctx.fillText("S", earthCX, earthCY + earthR + 35);

      // Observer on Earth
      const obsAngle = ((90 - latitude) * Math.PI) / 180;
      const obsEX = earthCX + earthR * Math.sin(obsAngle) * 0.0;
      const obsEY = earthCY - earthR * Math.cos(obsAngle);
      const obsSurfX = earthCX + earthR * Math.sin((90 - latitude) * Math.PI / 180);
      const obsSurfY = earthCY - earthR * Math.cos((90 - latitude) * Math.PI / 180);

      // Actually place on right side of earth
      const latRad = (latitude * Math.PI) / 180;
      const osx = earthCX + earthR * Math.cos(latRad);
      const osy = earthCY - earthR * Math.sin(latRad);

      // Observer dot
      ctx.fillStyle = "#ff9800";
      ctx.beginPath();
      ctx.arc(osx, osy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff9800";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Observer", osx + 8, osy + 4);

      // Line to Polaris (upward, parallel to axis since Polaris is very far)
      ctx.strokeStyle = "#ffeb3b";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(osx, osy);
      ctx.lineTo(osx, osy - earthR * 1.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // The line to Polaris should be parallel to Earth's axis
      ctx.strokeStyle = "rgba(255, 235, 59, 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(osx, osy);
      ctx.lineTo(earthCX, earthCY - earthR - 25);
      ctx.stroke();
      ctx.setLineDash([]);

      // Horizon line (tangent at observer's position)
      const tangentAngle = latRad + Math.PI / 2;
      const tangentLen = earthR * 0.7;
      ctx.strokeStyle = "#4caf50";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(osx - tangentLen * Math.cos(tangentAngle), osy + tangentLen * Math.sin(tangentAngle));
      ctx.lineTo(osx + tangentLen * Math.cos(tangentAngle), osy - tangentLen * Math.sin(tangentAngle));
      ctx.stroke();

      // Latitude angle at center
      if (showAngles > 0.5) {
        ctx.strokeStyle = "#ff9800";
        ctx.lineWidth = 1.5;
        const latArcR = earthR * 0.4;
        ctx.beginPath();
        ctx.arc(earthCX, earthCY, latArcR, -Math.PI / 2, -Math.PI / 2 + (Math.PI / 2 - latRad), false);
        ctx.stroke();
        ctx.fillStyle = "#ff9800";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`φ=${latitude.toFixed(1)}°`, earthCX + latArcR * 0.8, earthCY - latArcR * 0.4);
      }

      ctx.fillStyle = "#ccc";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Earth Diagram", earthCX, height * 0.04 + 30);

      // Arrow to Polaris at top
      ctx.fillStyle = "#ffeb3b";
      ctx.font = "12px sans-serif";
      ctx.fillText("↑ To Polaris (∞ far away)", earthCX, earthCY - earthR - 45);

      // Info panel
      const infoY = height * 0.84;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(width * 0.05, infoY, width * 0.9, 50);

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Latitude = ${latitude.toFixed(1)}° → Polaris altitude = ${latitude.toFixed(1)}°`, width / 2, infoY + 18);
      ctx.fillStyle = "#aaa";
      ctx.fillText("Since Polaris is extremely far, its light arrives parallel to Earth's axis → altitude = latitude", width / 2, infoY + 38);
    },
    reset() {
      time = 0;
    },
    destroy() {},
    getStateDescription(): string {
      return `Latitude of Polaris: Observer at latitude ${latitude.toFixed(1)}°N sees Polaris at an altitude of ${latitude.toFixed(1)}° above the horizon. This works because Polaris is so far away that its light arrives nearly parallel to Earth's rotation axis. At the equator (0°), Polaris is on the horizon. At the North Pole (90°), Polaris is directly overhead.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default LatitudeOfPolarisFactory;
