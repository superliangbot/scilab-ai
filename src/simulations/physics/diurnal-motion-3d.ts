import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const DiurnalMotion3DFactory = (): SimulationEngine => {
  const config = getSimConfig("diurnal-motion-3d") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;
  let currentParams: Record<string, number> = {};

  interface Star3D {
    x: number; y: number; z: number;
    brightness: number;
    color: string;
  }

  let stars: Star3D[] = [];
  let viewRotY = 0.3;
  let viewRotX = 0.2;

  function generateStars(): void {
    stars = [];
    const colors = ["#ffffff", "#ffddaa", "#aaccff", "#ffaa88", "#ddddff"];

    for (let i = 0; i < 300; i++) {
      // Uniform distribution on sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 400; // celestial sphere radius

      stars.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi),
        brightness: 0.3 + Math.random() * 0.7,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    generateStars();
  }

  function update(dt: number, params: Record<string, number>): void {
    currentParams = params;
    const speed = params.speed ?? 1;
    time += dt * speed;
  }

  // 3D rotation and projection
  function rotateX(p: { x: number; y: number; z: number }, angle: number): { x: number; y: number; z: number } {
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
  }

  function rotateY(p: { x: number; y: number; z: number }, angle: number): { x: number; y: number; z: number } {
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
  }

  function rotateZ(p: { x: number; y: number; z: number }, angle: number): { x: number; y: number; z: number } {
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
  }

  function project(p: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    const fov = 600;
    const z = p.z + 500;
    if (z < 1) return { x: width / 2, y: height / 2, z: -1 };
    return {
      x: width / 2 + (p.x * fov) / z,
      y: height / 2 - (p.y * fov) / z,
      z: z,
    };
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);

    // Deep space background
    ctx.fillStyle = "#000005";
    ctx.fillRect(0, 0, width, height);

    const latitude = (currentParams.latitude ?? 40) * Math.PI / 180;
    const tilt = (currentParams.tilt ?? 23.5) * Math.PI / 180;
    const showEarth = currentParams.showEarth ?? 1;

    // Earth rotation angle
    const earthRotation = time * 0.15;

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Diurnal Motion — 3D View", width / 2, 25);

    // Transform and draw stars
    const transformedStars: { px: number; py: number; pz: number; brightness: number; color: string }[] = [];

    for (const star of stars) {
      let p = { x: star.x, y: star.y, z: star.z };

      // Apply Earth's rotation (stars appear to rotate opposite)
      p = rotateY(p, -earthRotation);

      // Tilt for latitude viewing
      p = rotateX(p, -latitude + Math.PI / 2);

      // View rotation
      p = rotateX(p, viewRotX);
      p = rotateY(p, viewRotY);

      const proj = project(p);
      if (proj.z > 0) {
        transformedStars.push({
          px: proj.x,
          py: proj.y,
          pz: proj.z,
          brightness: star.brightness,
          color: star.color,
        });
      }
    }

    // Sort by depth
    transformedStars.sort((a, b) => b.pz - a.pz);

    // Draw stars
    for (const star of transformedStars) {
      const size = Math.max(0.5, 3 * star.brightness * (500 / star.pz));
      ctx.fillStyle = star.color;
      ctx.globalAlpha = star.brightness * Math.min(1, 800 / star.pz);
      ctx.beginPath();
      ctx.arc(star.px, star.py, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Draw Earth
    if (showEarth >= 0.5) {
      const earthR = 50;

      // Earth outline circles
      const numCircles = 12;

      // Latitude lines
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 0.5;
      for (let lat = -60; lat <= 60; lat += 30) {
        const latRad = lat * Math.PI / 180;
        const circleR = earthR * Math.cos(latRad);
        const circleY = earthR * Math.sin(latRad);

        ctx.beginPath();
        let started = false;
        for (let a = 0; a <= 360; a += 5) {
          const aRad = a * Math.PI / 180;
          let p = {
            x: circleR * Math.cos(aRad + earthRotation),
            y: circleY,
            z: circleR * Math.sin(aRad + earthRotation),
          };

          // Apply tilt
          p = rotateX(p, tilt);
          p = rotateX(p, viewRotX);
          p = rotateY(p, viewRotY);

          const proj = project(p);
          if (!started) { ctx.moveTo(proj.x, proj.y); started = true; }
          else ctx.lineTo(proj.x, proj.y);
        }
        ctx.stroke();
      }

      // Longitude lines
      for (let lon = 0; lon < 360; lon += 30) {
        const lonRad = (lon * Math.PI / 180) + earthRotation;
        ctx.beginPath();
        let started = false;
        for (let lat = -90; lat <= 90; lat += 5) {
          const latRad = lat * Math.PI / 180;
          let p = {
            x: earthR * Math.cos(latRad) * Math.cos(lonRad),
            y: earthR * Math.sin(latRad),
            z: earthR * Math.cos(latRad) * Math.sin(lonRad),
          };

          p = rotateX(p, tilt);
          p = rotateX(p, viewRotX);
          p = rotateY(p, viewRotY);

          const proj = project(p);
          if (!started) { ctx.moveTo(proj.x, proj.y); started = true; }
          else ctx.lineTo(proj.x, proj.y);
        }
        ctx.stroke();
      }

      // Earth sphere outline
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, earthR * 600 / 500, 0, Math.PI * 2);
      ctx.stroke();

      // Fill earth with semi-transparent blue
      ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, earthR * 600 / 500, 0, Math.PI * 2);
      ctx.fill();

      // Observer marker
      let obsP = {
        x: earthR * Math.cos(latitude) * Math.cos(earthRotation),
        y: earthR * Math.sin(latitude),
        z: earthR * Math.cos(latitude) * Math.sin(earthRotation),
      };
      obsP = rotateX(obsP, tilt);
      obsP = rotateX(obsP, viewRotX);
      obsP = rotateY(obsP, viewRotY);

      const obsProj = project(obsP);
      if (obsProj.z > 0) {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(obsProj.x, obsProj.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ef4444";
        ctx.font = `${Math.max(9, width * 0.012)}px sans-serif`;
        ctx.textAlign = "left";
        ctx.fillText("Observer", obsProj.x + 8, obsProj.y + 3);
      }

      // Rotation axis
      ctx.strokeStyle = "#fbbf2488";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      let axisTop = { x: 0, y: earthR * 1.5, z: 0 };
      let axisBot = { x: 0, y: -earthR * 1.5, z: 0 };
      axisTop = rotateX(axisTop, tilt);
      axisTop = rotateX(axisTop, viewRotX);
      axisTop = rotateY(axisTop, viewRotY);
      axisBot = rotateX(axisBot, tilt);
      axisBot = rotateX(axisBot, viewRotX);
      axisBot = rotateY(axisBot, viewRotY);

      const atProj = project(axisTop);
      const abProj = project(axisBot);
      ctx.beginPath();
      ctx.moveTo(atProj.x, atProj.y);
      ctx.lineTo(abProj.x, abProj.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#fbbf24";
      ctx.font = `${Math.max(9, width * 0.012)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("N", atProj.x, atProj.y - 5);
      ctx.fillText("S", abProj.x, abProj.y + 12);
    }

    // Celestial pole direction
    const poleLabelX = width - 120;
    const poleLabelY = 50;
    ctx.fillStyle = "#fbbf24";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("↑ To Polaris (NCP)", poleLabelX, poleLabelY);

    // Info panel
    const panelX = 10;
    const panelY = height - 95;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(panelX, panelY, 260, 80);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, 260, 80);

    const latDeg = (currentParams.latitude ?? 40).toFixed(1);
    const rotDeg = ((earthRotation * 180 / Math.PI) % 360).toFixed(0);
    const hourAngle = ((earthRotation / (Math.PI * 2)) * 24) % 24;

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(11, width * 0.014)}px monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`Latitude: ${latDeg}°`, panelX + 10, panelY + 20);
    ctx.fillText(`Earth rotation: ${rotDeg}°`, panelX + 10, panelY + 40);
    ctx.fillText(`Hour: ${hourAngle.toFixed(1)}h`, panelX + 10, panelY + 60);
    ctx.fillText(`Axial tilt: ${(currentParams.tilt ?? 23.5).toFixed(1)}°`, panelX + 10, panelY + 75);
  }

  function reset(): void {
    time = 0;
    currentParams = {};
    viewRotX = 0.2;
    viewRotY = 0.3;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const latitude = currentParams.latitude ?? 40;
    const tilt = currentParams.tilt ?? 23.5;
    const earthRotation = time * 0.15;
    const hourAngle = ((earthRotation / (Math.PI * 2)) * 24) % 24;

    return `Diurnal motion 3D simulation: Observer at latitude ${latitude.toFixed(1)}°, Earth axial tilt ${tilt.toFixed(1)}°, current rotation hour ${hourAngle.toFixed(1)}h. This 3D view shows how Earth's rotation causes the apparent daily motion of stars across the sky. Stars appear to circle the celestial pole (Polaris in the north). At higher latitudes, more stars are circumpolar (never set). The Earth's 23.5° axial tilt causes seasons by changing which hemisphere receives more direct sunlight.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DiurnalMotion3DFactory;
