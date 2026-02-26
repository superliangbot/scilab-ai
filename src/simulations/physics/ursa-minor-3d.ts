import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Star3D {
  name: string;
  ra: number; // right ascension (degrees)
  dec: number; // declination (degrees)
  dist: number; // distance in light-years
  magnitude: number;
  x: number;
  y: number;
  z: number;
}

const UrsaMinor3DFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("ursa-minor-3d") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let rotationSpeed = 0.3;
  let viewAngle = 0;
  let elevation = 0.2;
  let zoom = 1;

  // Ursa Minor stars (approximate data)
  const starData: { name: string; ra: number; dec: number; dist: number; mag: number }[] = [
    { name: "Polaris (α)", ra: 37.95, dec: 89.26, dist: 431, mag: 1.98 },
    { name: "Kochab (β)", ra: 222.68, dec: 74.16, dist: 131, mag: 2.08 },
    { name: "Pherkad (γ)", ra: 230.18, dec: 71.83, dist: 487, mag: 3.00 },
    { name: "Yildun (δ)", ra: 263.05, dec: 86.59, dist: 183, mag: 4.36 },
    { name: "Urodelus (ε)", ra: 248.03, dec: 82.04, dist: 347, mag: 4.23 },
    { name: "Alifa (ζ)", ra: 246.55, dec: 77.79, dist: 380, mag: 4.32 },
    { name: "Anwar (η)", ra: 245.07, dec: 75.76, dist: 97, mag: 4.95 },
  ];

  // Constellation lines (indices)
  const lines: [number, number][] = [
    [0, 3], [3, 4], [4, 5], [5, 6], [6, 1], [1, 2],
  ];

  let stars: Star3D[] = [];

  function initStars(): void {
    const scale = 0.5;
    stars = starData.map((s) => {
      const raRad = (s.ra * Math.PI) / 180;
      const decRad = (s.dec * Math.PI) / 180;
      const d = s.dist * scale;
      return {
        name: s.name,
        ra: s.ra,
        dec: s.dec,
        dist: s.dist,
        magnitude: s.mag,
        x: d * Math.cos(decRad) * Math.cos(raRad),
        y: d * Math.cos(decRad) * Math.sin(raRad),
        z: d * Math.sin(decRad),
      };
    });
  }

  function project(x: number, y: number, z: number): { sx: number; sy: number; depth: number } {
    // Rotate around vertical axis
    const cosA = Math.cos(viewAngle);
    const sinA = Math.sin(viewAngle);
    const rx = x * cosA - y * sinA;
    const ry = x * sinA + y * cosA;
    const rz = z;

    // Elevation rotation
    const cosE = Math.cos(elevation);
    const sinE = Math.sin(elevation);
    const fy = ry * cosE - rz * sinE;
    const fz = ry * sinE + rz * cosE;

    const fov = 600 * zoom;
    const depth = fy + 400;
    const scale = depth > 10 ? fov / depth : fov / 10;

    return {
      sx: width / 2 + rx * scale,
      sy: height / 2 - fz * scale,
      depth,
    };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    viewAngle = 0;
    initStars();
  }

  function update(dt: number, params: Record<string, number>): void {
    rotationSpeed = params.rotationSpeed ?? 0.3;
    elevation = params.elevation ?? 0.2;
    zoom = params.zoom ?? 1;

    viewAngle += rotationSpeed * dt;
    time += dt;
  }

  function render(): void {
    // Background - deep space
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);

    // Background stars
    const seed = 42;
    let rng = seed;
    function pseudoRandom(): number {
      rng = (rng * 16807 + 0) % 2147483647;
      return rng / 2147483647;
    }
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    for (let i = 0; i < 150; i++) {
      const sx = pseudoRandom() * width;
      const sy = pseudoRandom() * height;
      const sr = pseudoRandom() * 1.2;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Project and sort stars by depth
    const projected = stars.map((s, i) => {
      const p = project(s.x, s.y, s.z);
      return { ...p, index: i, star: s };
    });
    projected.sort((a, b) => a.depth - b.depth);

    // Draw constellation lines
    for (const [i, j] of lines) {
      const p1 = project(stars[i].x, stars[i].y, stars[i].z);
      const p2 = project(stars[j].x, stars[j].y, stars[j].z);
      ctx.beginPath();
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.strokeStyle = "rgba(100,150,255,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Draw stars
    for (const ps of projected) {
      const s = ps.star;
      const size = Math.max(2, (6 - s.magnitude) * 1.5 * zoom);

      // Glow
      const glow = ctx.createRadialGradient(ps.sx, ps.sy, 0, ps.sx, ps.sy, size * 4);
      glow.addColorStop(0, "rgba(200,220,255,0.3)");
      glow.addColorStop(1, "rgba(200,220,255,0)");
      ctx.beginPath();
      ctx.arc(ps.sx, ps.sy, size * 4, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Star body
      ctx.beginPath();
      ctx.arc(ps.sx, ps.sy, size, 0, Math.PI * 2);
      const starColor = s.name.includes("Polaris") ? "#ffffaa" : "#ddeeff";
      ctx.fillStyle = starColor;
      ctx.fill();

      // Label
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(s.name, ps.sx + size + 4, ps.sy + 3);

      // Distance label
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "8px system-ui, sans-serif";
      ctx.fillText(`${s.dist} ly`, ps.sx + size + 4, ps.sy + 14);
    }

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Ursa Minor (Little Dipper) — 3D View", width / 2, 25);

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(10, height - 75, 280, 65, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Stars appear connected from Earth, but are at", 20, height - 56);
    ctx.fillText("vastly different distances (97 – 487 light-years).", 20, height - 42);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`Rotation: ${((viewAngle * 180 / Math.PI) % 360).toFixed(0)}°`, 20, height - 22);
    ctx.fillText("Polaris (North Star) is at the tip of the handle.", 120, height - 22);
  }

  function reset(): void {
    time = 0;
    viewAngle = 0;
  }

  function destroy(): void {
    stars = [];
  }

  function getStateDescription(): string {
    return (
      `Ursa Minor 3D: 7 stars of the Little Dipper constellation shown in 3D. ` +
      `Rotation angle: ${((viewAngle * 180 / Math.PI) % 360).toFixed(0)}°, ` +
      `elevation: ${(elevation * 180 / Math.PI).toFixed(0)}°, zoom: ${zoom}×. ` +
      `Polaris (431 ly) is the most distant; Anwar (η, 97 ly) is closest.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default UrsaMinor3DFactory;
