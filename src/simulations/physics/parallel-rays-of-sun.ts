import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ParallelRaysOfSunFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("parallel-rays-of-sun") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let zoom = 1;
  let showShadow = 1;
  let objectHeight = 50;
  let sunDistance = 300;

  const SUN_RADIUS_KM = 696000;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    zoom = params.zoom ?? 1;
    showShadow = params.showShadow ?? 1;
    objectHeight = params.objectHeight ?? 50;
    sunDistance = params.sunDistance ?? 300;
    time += dt;
  }

  function render(): void {
    const bg = ctx.createLinearGradient(0, 0, width, 0);
    bg.addColorStop(0, "#1a0a00");
    bg.addColorStop(0.3, "#0a0a1e");
    bg.addColorStop(1, "#050520");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Stars
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i < 60; i++) {
      const sx = ((42 * (i + 1) * 7919) % 10000) / 10000 * width;
      const sy = ((42 * (i + 1) * 104729) % 10000) / 10000 * height;
      ctx.beginPath();
      ctx.arc(sx, sy, ((42 * (i + 1) * 31) % 10) / 10 + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    drawSunAndRays();
    if (showShadow >= 0.5) drawShadowComparison();
    drawInfoPanel();
    drawTitle();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 10, height - 10);
  }

  function drawSunAndRays(): void {
    const cy = height * 0.35;
    const sunX = width * 0.08 + 40;
    const sunR = 30 + zoom * 8;
    const earthX = width * 0.92 - 30;
    const earthR = 12;
    const distKm = sunDistance * 1e6;
    const angDeg = 2 * Math.atan(SUN_RADIUS_KM / distKm) * (180 / Math.PI);

    // Sun glow + body
    const glow = ctx.createRadialGradient(sunX, cy, 0, sunX, cy, sunR * 3);
    glow.addColorStop(0, "rgba(255,200,50,0.6)");
    glow.addColorStop(0.3, "rgba(255,150,20,0.2)");
    glow.addColorStop(1, "rgba(255,100,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, cy, sunR * 3, 0, Math.PI * 2);
    ctx.fill();

    const sg = ctx.createRadialGradient(sunX - 5, cy - 5, 0, sunX, cy, sunR);
    sg.addColorStop(0, "#fffbe0");
    sg.addColorStop(0.4, "#ffd700");
    sg.addColorStop(0.8, "#ff8c00");
    sg.addColorStop(1, "#cc4400");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sunX, cy, sunR, 0, Math.PI * 2);
    ctx.fill();

    // Corona flicker
    ctx.strokeStyle = "rgba(255,200,50,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sunX, cy, sunR + 5 + 3 * Math.sin(time * 4), 0, Math.PI * 2);
    ctx.stroke();

    // Rays from Sun to Earth
    const numRays = 9;
    const divergeScale = Math.min(1, angDeg / 0.53);
    for (let i = 0; i < numRays; i++) {
      const f = (i / (numRays - 1)) - 0.5;
      const originY = cy + f * sunR * 1.6;
      const destY = cy + f * 40 * divergeScale * zoom;
      const hue = 40 + f * 10;
      const alpha = 0.5 + 0.2 * Math.sin(time * 2 + i);

      ctx.strokeStyle = `hsla(${hue},100%,65%,${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sunX + sunR, originY);
      ctx.lineTo(earthX - earthR - 5, destY);
      ctx.stroke();

      // Arrowhead
      ctx.fillStyle = `hsla(${hue},100%,65%,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(earthX - earthR - 5, destY);
      ctx.lineTo(earthX - earthR - 13, destY - 3);
      ctx.lineTo(earthX - earthR - 13, destY + 3);
      ctx.closePath();
      ctx.fill();
    }

    // Earth
    const eg = ctx.createRadialGradient(earthX - 3, cy - 3, 0, earthX, cy, earthR);
    eg.addColorStop(0, "#4488ff");
    eg.addColorStop(0.5, "#2255cc");
    eg.addColorStop(1, "#113388");
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(earthX, cy, earthR, 0, Math.PI * 2);
    ctx.fill();

    // Labels
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(100,180,255,0.9)";
    ctx.fillText("Earth", earthX, cy + earthR + 15);
    ctx.fillStyle = "rgba(255,200,50,0.9)";
    ctx.fillText("Sun", sunX, cy + sunR + 18);

    // Angle indicator near Earth
    const halfAng = Math.min((angDeg / 2) * (Math.PI / 180) * zoom * 80, Math.PI / 4);
    ctx.strokeStyle = "rgba(255,100,100,0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(earthX - 60, cy, 25, -halfAng, halfAng);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,150,150,0.9)";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${angDeg.toFixed(4)}\u00B0`, earthX - 30, cy + 4);

    // Distance span
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Distance: ${sunDistance} \u00D7 10\u2076 km`, (sunX + earthX) / 2, cy - 50);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sunX + sunR + 10, cy - 40);
    ctx.lineTo(earthX - earthR - 10, cy - 40);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawShadowComparison(): void {
    const baseY = height * 0.72;
    const ph = height * 0.2;
    const hw = width / 2;

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hw, baseY - 10);
    ctx.lineTo(hw, baseY + ph + 5);
    ctx.stroke();

    drawShadowScene(width * 0.12, baseY, hw - width * 0.14, ph, true);
    drawShadowScene(hw + width * 0.02, baseY, hw - width * 0.14, ph, false);

    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,200,50,0.9)";
    ctx.fillText("Parallel Rays (Sun)", hw * 0.5, baseY - 5);
    ctx.fillStyle = "rgba(150,200,255,0.9)";
    ctx.fillText("Point Source (Lamp)", hw * 1.5, baseY - 5);
  }

  function drawShadowScene(sx: number, sy: number, sw: number, sh: number, parallel: boolean): void {
    const groundY = sy + sh - 10;
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, groundY);
    ctx.lineTo(sx + sw, groundY);
    ctx.stroke();

    const objX = sx + sw * 0.45;
    const objH = objectHeight * 0.6;
    const objTop = groundY - objH;

    ctx.fillStyle = "rgba(80,160,230,0.9)";
    ctx.fillRect(objX, objTop, 8, objH);
    ctx.strokeStyle = "rgba(120,200,255,0.8)";
    ctx.strokeRect(objX, objTop, 8, objH);

    let shadowLen: number;
    if (parallel) {
      const rayAngle = Math.PI / 6;
      shadowLen = objH * Math.tan(rayAngle);
      for (let i = 0; i < 5; i++) {
        const rx = sx + 10 + i * (sw / 5);
        ctx.strokeStyle = "rgba(255,200,50,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rx, sy + 5);
        ctx.lineTo(rx + Math.sin(rayAngle) * sh, sy + 5 + Math.cos(rayAngle) * sh);
        ctx.stroke();
      }
    } else {
      const lx = sx + sw * 0.15;
      const ly = sy + 15;
      ctx.fillStyle = "rgba(150,200,255,0.9)";
      ctx.beginPath();
      ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 7; i++) {
        ctx.strokeStyle = "rgba(150,200,255,0.25)";
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(sx + sw * 0.2 + i * (sw * 0.6 / 6), groundY);
        ctx.stroke();
      }
      const shadowEnd = lx + ((objX + 8 - lx) / (objTop - ly)) * (groundY - ly);
      shadowLen = Math.max(0, shadowEnd - (objX + 8));
    }

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(objX + 8, groundY - 3, shadowLen, 3);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${shadowLen.toFixed(0)}px`, objX + 8 + shadowLen / 2, groundY + 12);
  }

  function drawInfoPanel(): void {
    const pw = 260, ph = 80, px = width - pw - 12, py = 40;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,200,50,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const distKm = sunDistance * 1e6;
    const angDiv = 2 * Math.atan(SUN_RADIUS_KM / distKm) * (180 / Math.PI);
    const shadowLen = objectHeight * 0.6 * Math.tan(Math.PI / 6);

    ctx.fillStyle = "rgba(255,200,50,0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Measurements", px + 10, py + 16);

    ctx.font = "11px 'SF Mono','Fira Code',monospace";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(`Divergence: ${angDiv.toFixed(4)}\u00B0`, px + 10, py + 34);
    ctx.fillText(`Shadow (parallel): ${shadowLen.toFixed(1)} px`, px + 10, py + 50);
    ctx.fillText(`D/h ratio: ${(distKm / objectHeight).toExponential(2)}`, px + 10, py + 66);
  }

  function drawTitle(): void {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Parallel Rays of the Sun", width / 2, 24);
    ctx.fillStyle = "rgba(255,200,100,0.65)";
    ctx.font = "italic 12px system-ui, sans-serif";
    ctx.fillText("At 150M km, the Sun\u2019s rays arrive nearly parallel (\u03B8 \u2248 0.53\u00B0)", width / 2, 40);
  }

  function reset(): void { time = 0; }
  function destroy(): void {}

  function getStateDescription(): string {
    const distKm = sunDistance * 1e6;
    const angDiv = 2 * Math.atan(SUN_RADIUS_KM / distKm) * (180 / Math.PI);
    return (
      `Parallel Rays of the Sun simulation. Sun distance: ${sunDistance} \u00D7 10\u2076 km. ` +
      `Angular divergence: ${angDiv.toFixed(4)}\u00B0. At 1 AU the Sun subtends ~0.53\u00B0. ` +
      `Object height: ${objectHeight}px. Zoom: ${zoom}\u00D7. Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ParallelRaysOfSunFactory;
