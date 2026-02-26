import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PrincipleOfLeastTimeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("principle-of-least-time") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let mediumSpeed = 50; // percentage (0-100) of speed in medium 2 relative to medium 1
  let showAnimation = 1;
  let showAllPaths = 1;

  // Points
  let startX = 0, startY = 0;
  let endX = 0, endY = 0;
  let boundaryY = 0;

  const NUM_PATHS = 9;

  function layout() {
    startX = width * 0.15;
    startY = height * 0.2;
    endX = width * 0.55;
    endY = height * 0.8;
    boundaryY = height * 0.5;
  }

  function getPathTime(crossX: number): { time: number; d1: number; d2: number } {
    // Distance in medium 1 (faster)
    const dx1 = crossX - startX;
    const dy1 = boundaryY - startY;
    const d1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

    // Distance in medium 2 (slower)
    const dx2 = endX - crossX;
    const dy2 = endY - boundaryY;
    const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    const v1 = 1; // speed in medium 1
    const v2 = mediumSpeed / 100; // speed in medium 2

    const t = d1 / v1 + d2 / v2;
    return { time: t, d1, d2 };
  }

  function getOptimalCrossX(): number {
    // Find minimum time crossing point by scanning
    let bestX = startX;
    let bestTime = Infinity;
    for (let x = startX; x <= endX; x += 1) {
      const { time: t } = getPathTime(x);
      if (t < bestTime) {
        bestTime = t;
        bestX = x;
      }
    }
    return bestX;
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    layout();
  }

  function update(dt: number, params: Record<string, number>) {
    mediumSpeed = params.mediumSpeed ?? 50;
    showAnimation = params.showAnimation ?? 1;
    showAllPaths = params.showAllPaths ?? 1;
    time += dt;
  }

  function render() {
    // Medium 1 (top - fast)
    ctx.fillStyle = "#d4c4a0";
    ctx.fillRect(0, 0, width * 0.7, boundaryY);

    // Medium 2 (bottom - slow)
    ctx.fillStyle = "#5090c0";
    ctx.fillRect(0, boundaryY, width * 0.7, height - boundaryY);

    // Boundary line
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, boundaryY);
    ctx.lineTo(width * 0.7, boundaryY);
    ctx.stroke();

    // Medium labels
    ctx.fillStyle = "rgba(80,60,30,0.7)";
    ctx.font = `bold ${Math.max(12, height * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Medium 1 (fast)", 10, boundaryY - 15);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`Medium 2 (${mediumSpeed}% speed)`, 10, boundaryY + 22);

    // Calculate all paths
    const pathRange = endX - startX;
    const paths: Array<{ crossX: number; time: number }> = [];
    for (let i = 0; i < NUM_PATHS; i++) {
      const crossX = startX + (i / (NUM_PATHS - 1)) * pathRange;
      const { time: t } = getPathTime(crossX);
      paths.push({ crossX, time: t });
    }

    // Find minimum
    let minTime = Infinity;
    let minIdx = 0;
    for (let i = 0; i < paths.length; i++) {
      if (paths[i].time < minTime) {
        minTime = paths[i].time;
        minIdx = i;
      }
    }

    const optimalX = getOptimalCrossX();
    const optimalTime = getPathTime(optimalX).time;

    // Draw paths
    if (showAllPaths >= 0.5) {
      for (let i = 0; i < paths.length; i++) {
        const p = paths[i];
        const isMin = i === minIdx;
        ctx.setLineDash(isMin ? [] : [5, 5]);
        ctx.strokeStyle = isMin ? "rgba(255,80,80,0.9)" : "rgba(255,255,255,0.25)";
        ctx.lineWidth = isMin ? 3 : 1.5;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(p.crossX, boundaryY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Crossing point dot
        ctx.beginPath();
        ctx.arc(p.crossX, boundaryY, isMin ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isMin ? "#ff4444" : "rgba(255,255,255,0.4)";
        ctx.fill();

        // Path number
        ctx.fillStyle = isMin ? "#ff6644" : "rgba(255,255,255,0.3)";
        ctx.font = `${Math.max(9, height * 0.014)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(`${i + 1}`, p.crossX, boundaryY - 8);
      }
      ctx.setLineDash([]);
    } else {
      // Show only optimal
      ctx.strokeStyle = "rgba(255,80,80,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(optimalX, boundaryY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    // Animated traveler
    if (showAnimation >= 0.5) {
      const cycle = (time * 0.4) % 1;
      const path = getPathTime(optimalX);
      const totalDist = path.d1 + path.d2;
      const distTraveled = cycle * totalDist;

      let travX: number, travY: number;
      if (distTraveled < path.d1) {
        const frac = distTraveled / path.d1;
        travX = startX + frac * (optimalX - startX);
        travY = startY + frac * (boundaryY - startY);
      } else {
        const frac = (distTraveled - path.d1) / path.d2;
        travX = optimalX + frac * (endX - optimalX);
        travY = boundaryY + frac * (endY - boundaryY);
      }

      ctx.beginPath();
      ctx.arc(travX, travY, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#ffcc00";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,200,0,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Start and end points
    ctx.beginPath();
    ctx.arc(startX, startY, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#44cc44";
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `bold ${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("A", startX, startY - 15);

    ctx.beginPath();
    ctx.arc(endX, endY, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#cc4444";
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText("B", endX, endY + 22);

    // Normal line at crossing point
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(optimalX, boundaryY - 40);
    ctx.lineTo(optimalX, boundaryY + 40);
    ctx.stroke();
    ctx.setLineDash([]);

    // Angles
    const angle1 = Math.atan2(optimalX - startX, boundaryY - startY);
    const angle2 = Math.atan2(endX - optimalX, endY - boundaryY);
    const angleDeg1 = (angle1 * 180 / Math.PI).toFixed(1);
    const angleDeg2 = (angle2 * 180 / Math.PI).toFixed(1);

    // Info panel (right side)
    const panelX = width * 0.72;
    const panelY = height * 0.05;
    const panelW = width * 0.26;
    const panelH = height * 0.9;

    ctx.fillStyle = "rgba(15,15,30,0.9)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `bold ${Math.max(11, height * 0.02)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Fermat's Principle", panelX + panelW / 2, panelY + 25);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    const tx = panelX + 12;
    let ty = panelY + 50;

    ctx.fillText(`v₁ = 1.00 (fast)`, tx, ty); ty += 20;
    ctx.fillText(`v₂ = ${(mediumSpeed / 100).toFixed(2)} (slow)`, tx, ty); ty += 25;
    ctx.fillText(`θ₁ = ${angleDeg1}°`, tx, ty); ty += 20;
    ctx.fillText(`θ₂ = ${angleDeg2}°`, tx, ty); ty += 25;

    // Snell's law check
    const snell1 = Math.sin(angle1);
    const snell2 = Math.sin(angle2) / (mediumSpeed / 100);
    ctx.fillStyle = "rgba(255,200,100,0.7)";
    ctx.fillText("Snell's Law:", tx, ty); ty += 18;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`sin(θ₁)/v₁ = ${snell1.toFixed(3)}`, tx, ty); ty += 18;
    ctx.fillText(`sin(θ₂)/v₂ = ${snell2.toFixed(3)}`, tx, ty); ty += 28;

    ctx.fillStyle = "rgba(255,255,200,0.6)";
    ctx.fillText("Optimal time:", tx, ty); ty += 18;
    ctx.fillStyle = "rgba(255,80,80,0.8)";
    ctx.fillText(`${optimalTime.toFixed(2)} units`, tx, ty); ty += 25;

    // Path times table
    if (showAllPaths >= 0.5) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `${Math.max(9, height * 0.013)}px system-ui, sans-serif`;
      ctx.fillText("Path times:", tx, ty); ty += 16;
      for (let i = 0; i < paths.length; i++) {
        const isMin = i === minIdx;
        ctx.fillStyle = isMin ? "rgba(255,100,100,0.8)" : "rgba(255,255,255,0.35)";
        ctx.fillText(`#${i + 1}: ${paths[i].time.toFixed(2)}${isMin ? " ← min" : ""}`, tx, ty);
        ty += 14;
      }
    }

    // Explanation at bottom
    ty = panelY + panelH - 50;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `${Math.max(9, height * 0.013)}px system-ui, sans-serif`;
    const lines = ["Light takes the path of", "least time, not shortest", "distance — this explains", "refraction (Snell's Law)."];
    for (const line of lines) {
      ctx.fillText(line, tx, ty);
      ty += 14;
    }

    // Title
    ctx.fillStyle = "rgba(50,50,70,0.7)";
    ctx.font = `bold ${Math.max(13, height * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Principle of Least Time (Fermat)", width * 0.35, height - 10);
  }

  function reset() { time = 0; }
  function destroy() {}

  function getStateDescription(): string {
    const optX = getOptimalCrossX();
    const optT = getPathTime(optX).time;
    const angle1 = Math.atan2(optX - startX, boundaryY - startY) * 180 / Math.PI;
    const angle2 = Math.atan2(endX - optX, endY - boundaryY) * 180 / Math.PI;
    return `Least Time | v₂/v₁=${(mediumSpeed / 100).toFixed(2)} | θ₁=${angle1.toFixed(1)}° θ₂=${angle2.toFixed(1)}° | Optimal time: ${optT.toFixed(2)} | Demonstrates Snell's law via Fermat's principle`;
  }

  function resize(w: number, h: number) {
    width = w; height = h;
    layout();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PrincipleOfLeastTimeFactory;
