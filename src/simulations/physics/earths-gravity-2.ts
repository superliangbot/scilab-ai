import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const EarthsGravity2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("earths-gravity-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let altitude = 0; // km above surface
  let objectMass = 10; // kg
  let showScale = 1;

  const G = 6.674e-11;
  const M_EARTH = 5.972e24;
  const R_EARTH = 6371; // km

  // Dragging state
  let dragY = 0.5; // normalized position (0=surface, 1=max altitude)

  function gravityAt(altKm: number): number {
    const r = (R_EARTH + altKm) * 1000; // meters
    return (G * M_EARTH) / (r * r);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    altitude = params.altitude ?? 0;
    objectMass = params.objectMass ?? 10;
    showScale = params.showScale ?? 1;
    time += dt;
  }

  function render(): void {
    // Background gradient: atmosphere to space
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#000011");
    bg.addColorStop(0.4, "#000033");
    bg.addColorStop(0.7, "#1a3a6a");
    bg.addColorStop(1, "#4a90c4");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Stars at top
    for (let i = 0; i < 60; i++) {
      const sx = (i * 137.5) % width;
      const sy = (i * 47.3) % (height * 0.5);
      ctx.fillStyle = `rgba(255,255,255,${0.3 + (i % 4) * 0.15})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    const earthSurfaceY = height * 0.85;
    const maxAltPixels = height * 0.7;

    // Earth surface
    const earthGrad = ctx.createLinearGradient(0, earthSurfaceY, 0, height);
    earthGrad.addColorStop(0, "#2d7d46");
    earthGrad.addColorStop(0.3, "#1e6b35");
    earthGrad.addColorStop(1, "#8B4513");
    ctx.fillStyle = earthGrad;
    ctx.fillRect(0, earthSurfaceY, width, height - earthSurfaceY);

    // Horizon line
    ctx.strokeStyle = "rgba(100,200,100,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, earthSurfaceY);
    ctx.lineTo(width, earthSurfaceY);
    ctx.stroke();

    // Atmosphere layers
    const layers = [
      { name: "Troposphere", altKm: 12, color: "rgba(100,180,255,0.1)" },
      { name: "Stratosphere", altKm: 50, color: "rgba(80,150,255,0.08)" },
      { name: "Mesosphere", altKm: 85, color: "rgba(60,100,200,0.05)" },
      { name: "Thermosphere", altKm: 500, color: "rgba(40,60,150,0.03)" },
    ];

    const maxAltKm = 40000; // max altitude slider range
    for (const layer of layers) {
      const layerY = earthSurfaceY - (layer.altKm / maxAltKm) * maxAltPixels;
      if (layerY > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.moveTo(0, layerY);
        ctx.lineTo(width * 0.6, layerY);
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "9px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${layer.name} (~${layer.altKm}km)`, 5, layerY - 3);
      }
    }

    // Object position based on altitude
    const objY = earthSurfaceY - (altitude / maxAltKm) * maxAltPixels;
    const objX = width * 0.4;

    // Current gravity
    const gAtAlt = gravityAt(altitude);
    const gSurface = gravityAt(0);
    const weight = objectMass * gAtAlt;
    const weightSurface = objectMass * gSurface;
    const gRatio = gAtAlt / gSurface;

    // Gravity vector (arrow pointing down)
    const arrowLen = 40 * gRatio + 10;
    ctx.strokeStyle = "#ff4444";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(objX, objY);
    ctx.lineTo(objX, objY + arrowLen);
    ctx.stroke();

    // Arrowhead
    ctx.fillStyle = "#ff4444";
    ctx.beginPath();
    ctx.moveTo(objX, objY + arrowLen);
    ctx.lineTo(objX - 6, objY + arrowLen - 10);
    ctx.lineTo(objX + 6, objY + arrowLen - 10);
    ctx.fill();

    // Object (box/mass)
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.roundRect(objX - 15, objY - 15, 30, 30, 4);
    ctx.fill();
    ctx.strokeStyle = "#CC9900";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#333";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${objectMass}`, objX, objY);
    ctx.fillText("kg", objX, objY + 12);
    ctx.textBaseline = "alphabetic";

    // Altitude line
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(objX - 40, objY);
    ctx.lineTo(objX - 20, objY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(objX - 30, objY);
    ctx.lineTo(objX - 30, earthSurfaceY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Altitude label
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`h = ${altitude.toFixed(0)} km`, objX - 35, (objY + earthSurfaceY) / 2);

    // Spring scale visualization
    if (showScale) {
      const scaleX = width * 0.65;
      const scaleTop = height * 0.15;
      const scaleH = height * 0.6;

      // Scale body
      ctx.fillStyle = "rgba(40,40,60,0.8)";
      ctx.beginPath();
      ctx.roundRect(scaleX - 30, scaleTop, 60, scaleH, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Scale title
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Weight Scale", scaleX, scaleTop - 8);

      // Scale markings
      const maxN = weightSurface * 1.2;
      const numMarks = 10;
      for (let i = 0; i <= numMarks; i++) {
        const markY = scaleTop + 15 + (i / numMarks) * (scaleH - 30);
        const markVal = maxN * (1 - i / numMarks);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(scaleX - 20, markY);
        ctx.lineTo(scaleX + 20, markY);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "9px system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`${markVal.toFixed(0)}N`, scaleX - 22, markY + 3);
      }

      // Weight indicator
      const weightFraction = weight / maxN;
      const indicatorY = scaleTop + 15 + (1 - weightFraction) * (scaleH - 30);
      ctx.fillStyle = "#ff4444";
      ctx.beginPath();
      ctx.moveTo(scaleX - 20, indicatorY);
      ctx.lineTo(scaleX + 20, indicatorY);
      ctx.lineTo(scaleX + 25, indicatorY + 5);
      ctx.lineTo(scaleX + 25, indicatorY - 5);
      ctx.fill();

      // Spring coils
      ctx.strokeStyle = "#888";
      ctx.lineWidth = 2;
      const springTop = scaleTop + 15;
      const springBot = indicatorY;
      const coils = 8;
      ctx.beginPath();
      for (let i = 0; i <= coils * 10; i++) {
        const t = i / (coils * 10);
        const sy = springTop + t * (springBot - springTop);
        const sx = scaleX + 12 * Math.sin(t * coils * Math.PI * 2);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 280, 130, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Gravity vs. Altitude", 16, 28);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#FFD700";
    ctx.fillText(`g = GM/(R+h)²`, 16, 48);

    ctx.fillStyle = "#ccc";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`Altitude: ${altitude.toFixed(0)} km`, 16, 68);
    ctx.fillText(`g = ${gAtAlt.toFixed(4)} m/s²  (${(gRatio * 100).toFixed(1)}% of surface)`, 16, 84);
    ctx.fillText(`Weight: ${weight.toFixed(2)} N  (surface: ${weightSurface.toFixed(2)} N)`, 16, 100);
    ctx.fillText(`Distance from center: ${(R_EARTH + altitude).toFixed(0)} km`, 16, 116);

    // Ratio info
    const distRatio = (R_EARTH + altitude) / R_EARTH;
    ctx.fillStyle = "#88bbff";
    ctx.fillText(`r/R = ${distRatio.toFixed(2)}  →  g/g₀ = 1/${(distRatio * distRatio).toFixed(2)}`, 16, 132);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const gAtAlt = gravityAt(altitude);
    const gSurface = gravityAt(0);
    const weight = objectMass * gAtAlt;
    return (
      `Earth's Gravity 2: altitude=${altitude.toFixed(0)} km, ` +
      `object mass=${objectMass} kg, ` +
      `g=${gAtAlt.toFixed(4)} m/s² (${((gAtAlt / gSurface) * 100).toFixed(1)}% of surface), ` +
      `weight=${weight.toFixed(2)} N. ` +
      `At distance r from center: g = GM/r². ` +
      `When altitude doubles R, g drops to 1/4. Shows how weight decreases with altitude.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default EarthsGravity2Factory;
