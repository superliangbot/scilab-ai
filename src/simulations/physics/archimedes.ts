import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ArchimedesFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("archimedes") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Physical constants
  const GOLD_DENSITY = 19300; // kg/m^3
  const SILVER_DENSITY = 10490; // kg/m^3
  const G = 9.81; // m/s^2

  // Reference gold nugget: fixed volume and mass
  const GOLD_MASS = 1.0; // kg
  const GOLD_VOLUME = GOLD_MASS / GOLD_DENSITY; // m^3

  // Cached parameters
  let silverRatio = 0;
  let waterLevel = 50;
  let fluidDensity = 1000;

  // Animation state for balance beam angle (smoothed)
  let beamAngle = 0;
  let targetBeamAngle = 0;

  // Computed values for display
  let crownDensity = GOLD_DENSITY;
  let crownVolume = GOLD_VOLUME;
  let crownMass = GOLD_MASS;
  let buoyantForceCrown = 0;
  let buoyantForceGold = 0;
  let apparentWeightCrown = 0;
  let apparentWeightGold = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    beamAngle = 0;
    targetBeamAngle = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    silverRatio = params.silverRatio ?? 0;
    waterLevel = params.waterLevel ?? 50;
    fluidDensity = params.fluidDensity ?? 1000;

    time += dt;

    // Crown is same mass as gold nugget (1 kg) but made of gold-silver alloy
    // The silver fraction changes the density, hence the volume
    const silverFraction = silverRatio / 100;
    const goldFraction = 1 - silverFraction;

    // Density of alloy: harmonic mean weighted by mass fraction
    // 1/rho_alloy = (f_gold/rho_gold) + (f_silver/rho_silver)
    crownDensity = 1 / (goldFraction / GOLD_DENSITY + silverFraction / SILVER_DENSITY);
    crownMass = GOLD_MASS; // same mass as reference
    crownVolume = crownMass / crownDensity;

    // Submersion fraction based on waterLevel parameter (0-100%)
    const submersionFraction = waterLevel / 100;

    // Buoyant force: F_b = rho_fluid * V_submerged * g
    const crownSubmergedVolume = crownVolume * submersionFraction;
    const goldSubmergedVolume = GOLD_VOLUME * submersionFraction;

    buoyantForceCrown = fluidDensity * crownSubmergedVolume * G;
    buoyantForceGold = fluidDensity * goldSubmergedVolume * G;

    // Apparent weight = true weight - buoyant force
    apparentWeightCrown = crownMass * G - buoyantForceCrown;
    apparentWeightGold = GOLD_MASS * G - buoyantForceGold;

    // Balance beam tilts based on difference in apparent weights
    // Positive angle = crown side is lighter (goes up)
    const weightDiff = apparentWeightGold - apparentWeightCrown;
    const maxAngle = Math.PI / 12; // 15 degrees max tilt
    const maxDiff = 3; // N for full tilt
    targetBeamAngle = Math.max(-maxAngle, Math.min(maxAngle, (weightDiff / maxDiff) * maxAngle));

    // Smooth animation of beam angle
    beamAngle += (targetBeamAngle - beamAngle) * Math.min(1, dt * 5);
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const tankLeft = width * 0.1;
    const tankRight = width * 0.9;
    const tankTop = height * 0.35;
    const tankBottom = height * 0.82;
    const tankWidth = tankRight - tankLeft;
    const tankHeight = tankBottom - tankTop;

    // Water surface position based on water level
    const waterSurfaceY = tankBottom - (waterLevel / 100) * tankHeight;

    // Draw tank (glass walls)
    drawTank(tankLeft, tankTop, tankRight, tankBottom);

    // Draw water
    drawWater(tankLeft, waterSurfaceY, tankRight, tankBottom);

    // Draw balance beam and fulcrum
    const beamCenterX = width / 2;
    const beamCenterY = height * 0.15;
    const beamHalfWidth = width * 0.3;
    drawBalanceBeam(beamCenterX, beamCenterY, beamHalfWidth);

    // Draw strings and objects
    const leftObjX = beamCenterX - beamHalfWidth * 0.7;
    const rightObjX = beamCenterX + beamHalfWidth * 0.7;

    // Object vertical positions along strings - they hang into the tank
    const stringTop = beamCenterY;
    const objCenterY = (tankTop + tankBottom) / 2;

    // Adjust object Y based on beam tilt
    const leftAnchorY = stringTop + Math.sin(-beamAngle) * beamHalfWidth * 0.7;
    const rightAnchorY = stringTop + Math.sin(beamAngle) * beamHalfWidth * 0.7;

    // Draw strings
    ctx.strokeStyle = "rgba(200, 200, 220, 0.6)";
    ctx.lineWidth = 1.5;

    // Left string (crown)
    ctx.beginPath();
    ctx.moveTo(leftObjX + Math.cos(beamAngle - Math.PI / 2) * 0, leftAnchorY);
    ctx.lineTo(leftObjX, objCenterY);
    ctx.stroke();

    // Right string (gold)
    ctx.beginPath();
    ctx.moveTo(rightObjX + Math.cos(beamAngle + Math.PI / 2) * 0, rightAnchorY);
    ctx.lineTo(rightObjX, objCenterY);
    ctx.stroke();

    // Draw crown (left object) - ornate shape
    const crownSize = 20 + (crownVolume / GOLD_VOLUME - 1) * 60; // bigger if more silver
    const crownDisplaySize = Math.max(18, Math.min(40, crownSize));
    drawCrown(leftObjX, objCenterY, crownDisplaySize);

    // Draw gold nugget (right object) - simple block
    drawGoldNugget(rightObjX, objCenterY, 20);

    // Draw submerge indicator lines
    if (waterLevel > 0) {
      const submersionFraction = waterLevel / 100;
      // Show displacement arrows
      drawDisplacementArrows(leftObjX, objCenterY, crownDisplaySize, waterSurfaceY, submersionFraction);
      drawDisplacementArrows(rightObjX, objCenterY, 20, waterSurfaceY, submersionFraction);
    }

    // Draw info panel
    drawInfoPanel();

    // Draw title and formula
    drawTitle();

    // Time display
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function drawTank(left: number, top: number, right: number, bottom: number): void {
    // Glass tank walls
    ctx.strokeStyle = "rgba(140, 180, 220, 0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.lineTo(right, bottom);
    ctx.lineTo(right, top);
    ctx.stroke();

    // Glass reflection highlights
    ctx.strokeStyle = "rgba(200, 230, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left + 4, top + 10);
    ctx.lineTo(left + 4, bottom - 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(right - 4, top + 10);
    ctx.lineTo(right - 4, bottom - 10);
    ctx.stroke();
  }

  function drawWater(left: number, surfaceY: number, right: number, bottom: number): void {
    if (surfaceY >= bottom) return;

    // Water body gradient
    const waterGrad = ctx.createLinearGradient(0, surfaceY, 0, bottom);

    // Color based on fluid density - heavier fluids are darker
    const densityNorm = (fluidDensity - 500) / (13600 - 500);
    const r = Math.round(20 + densityNorm * 60);
    const g = Math.round(100 + (1 - densityNorm) * 100);
    const b = Math.round(180 + (1 - densityNorm) * 75);

    waterGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.5)`);
    waterGrad.addColorStop(0.5, `rgba(${r - 10}, ${g - 20}, ${b}, 0.6)`);
    waterGrad.addColorStop(1, `rgba(${r - 20}, ${g - 40}, ${b - 20}, 0.7)`);
    ctx.fillStyle = waterGrad;
    ctx.fillRect(left, surfaceY, right - left, bottom - surfaceY);

    // Water surface ripple
    ctx.strokeStyle = `rgba(${r + 40}, ${g + 60}, ${b + 30}, 0.8)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, surfaceY);
    for (let x = left; x <= right; x += 3) {
      const wave = Math.sin((x - left) * 0.05 + time * 2) * 2;
      ctx.lineTo(x, surfaceY + wave);
    }
    ctx.stroke();

    // Surface highlight
    ctx.strokeStyle = `rgba(255, 255, 255, 0.15)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left + 5, surfaceY + 1);
    ctx.lineTo(right - 5, surfaceY + 1);
    ctx.stroke();
  }

  function drawBalanceBeam(cx: number, cy: number, halfWidth: number): void {
    // Fulcrum triangle
    const fulcrumSize = 15;
    ctx.fillStyle = "#888";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - fulcrumSize, cy - fulcrumSize * 1.5);
    ctx.lineTo(cx + fulcrumSize, cy - fulcrumSize * 1.5);
    ctx.closePath();

    const fulcrumGrad = ctx.createLinearGradient(cx - fulcrumSize, cy - fulcrumSize * 1.5, cx + fulcrumSize, cy - fulcrumSize * 1.5);
    fulcrumGrad.addColorStop(0, "#666");
    fulcrumGrad.addColorStop(0.5, "#aaa");
    fulcrumGrad.addColorStop(1, "#666");
    ctx.fillStyle = fulcrumGrad;
    ctx.fill();
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Beam - rotated around center point
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(beamAngle);

    const beamGrad = ctx.createLinearGradient(-halfWidth, -5, -halfWidth, 5);
    beamGrad.addColorStop(0, "#999");
    beamGrad.addColorStop(0.5, "#ccc");
    beamGrad.addColorStop(1, "#999");
    ctx.fillStyle = beamGrad;

    ctx.beginPath();
    ctx.roundRect(-halfWidth, -4, halfWidth * 2, 8, 3);
    ctx.fill();
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Hanging hooks
    for (const side of [-1, 1]) {
      const hookX = side * halfWidth * 0.7;
      ctx.beginPath();
      ctx.arc(hookX, 6, 4, 0, Math.PI);
      ctx.strokeStyle = "#aaa";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();

    // Labels on beam
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Crown", cx - halfWidth * 0.7, cy - 15);
    ctx.fillText("Gold Ref.", cx + halfWidth * 0.7, cy - 15);
  }

  function drawCrown(cx: number, cy: number, size: number): void {
    // Crown shape - ornate with points
    const s = size;
    const silverFraction = silverRatio / 100;

    // Crown color: gold to silver based on ratio
    const r = Math.round(255 - silverFraction * 60);
    const g = Math.round(215 - silverFraction * 30);
    const b = Math.round(0 + silverFraction * 180);
    const crownColor = `rgb(${r}, ${g}, ${b})`;
    const crownHighlight = `rgb(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 20)})`;
    const crownShadow = `rgb(${Math.max(0, r - 60)}, ${Math.max(0, g - 60)}, ${Math.max(0, b - 30)})`;

    // Crown body
    ctx.beginPath();
    ctx.moveTo(cx - s, cy + s * 0.4);
    ctx.lineTo(cx - s, cy - s * 0.2);
    ctx.lineTo(cx - s * 0.6, cy - s * 0.6);
    ctx.lineTo(cx - s * 0.3, cy - s * 0.2);
    ctx.lineTo(cx, cy - s * 0.8);
    ctx.lineTo(cx + s * 0.3, cy - s * 0.2);
    ctx.lineTo(cx + s * 0.6, cy - s * 0.6);
    ctx.lineTo(cx + s, cy - s * 0.2);
    ctx.lineTo(cx + s, cy + s * 0.4);
    ctx.closePath();

    const crownGrad = ctx.createLinearGradient(cx - s, cy - s, cx + s, cy + s);
    crownGrad.addColorStop(0, crownHighlight);
    crownGrad.addColorStop(0.5, crownColor);
    crownGrad.addColorStop(1, crownShadow);
    ctx.fillStyle = crownGrad;
    ctx.fill();
    ctx.strokeStyle = crownShadow;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Jewel dots on crown points
    const jewels = [
      { x: cx - s * 0.6, y: cy - s * 0.55 },
      { x: cx, y: cy - s * 0.75 },
      { x: cx + s * 0.6, y: cy - s * 0.55 },
    ];
    for (const j of jewels) {
      ctx.beginPath();
      ctx.arc(j.x, j.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = silverFraction > 0.5 ? "#88aaff" : "#ff4444";
      ctx.fill();
    }

    // Band at bottom
    ctx.fillStyle = crownShadow;
    ctx.fillRect(cx - s, cy + s * 0.2, s * 2, s * 0.2);
  }

  function drawGoldNugget(cx: number, cy: number, size: number): void {
    // Gold nugget - irregular rounded rectangle
    const s = size;

    const goldGrad = ctx.createRadialGradient(cx - s * 0.3, cy - s * 0.3, 0, cx, cy, s * 1.2);
    goldGrad.addColorStop(0, "#fff8c0");
    goldGrad.addColorStop(0.3, "#ffd700");
    goldGrad.addColorStop(0.7, "#daa520");
    goldGrad.addColorStop(1, "#b8860b");
    ctx.fillStyle = goldGrad;

    ctx.beginPath();
    ctx.moveTo(cx - s * 0.8, cy - s * 0.4);
    ctx.quadraticCurveTo(cx - s * 0.9, cy - s * 0.7, cx - s * 0.3, cy - s * 0.7);
    ctx.quadraticCurveTo(cx + s * 0.2, cy - s * 0.9, cx + s * 0.7, cy - s * 0.5);
    ctx.quadraticCurveTo(cx + s * 1.0, cy - s * 0.1, cx + s * 0.8, cy + s * 0.4);
    ctx.quadraticCurveTo(cx + s * 0.5, cy + s * 0.8, cx - s * 0.2, cy + s * 0.6);
    ctx.quadraticCurveTo(cx - s * 0.9, cy + s * 0.5, cx - s * 0.8, cy - s * 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#8b6914";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Au", cx, cy + s + 14);
  }

  function drawDisplacementArrows(cx: number, cy: number, size: number, waterY: number, submersion: number): void {
    if (submersion <= 0) return;

    // Upward buoyancy arrow
    const arrowLength = submersion * 30;
    ctx.strokeStyle = "rgba(100, 200, 255, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + size + 5);
    ctx.lineTo(cx, cy + size + 5 - arrowLength);
    ctx.stroke();

    // Arrowhead
    ctx.fillStyle = "rgba(100, 200, 255, 0.7)";
    ctx.beginPath();
    ctx.moveTo(cx, cy + size + 5 - arrowLength - 5);
    ctx.lineTo(cx - 4, cy + size + 5 - arrowLength + 2);
    ctx.lineTo(cx + 4, cy + size + 5 - arrowLength + 2);
    ctx.closePath();
    ctx.fill();

    // Label
    ctx.fillStyle = "rgba(100, 200, 255, 0.8)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("F_b", cx + 15, cy + size + 5 - arrowLength / 2);
  }

  function drawInfoPanel(): void {
    const panelX = width * 0.05;
    const panelY = height * 0.84;
    const panelW = width * 0.9;
    const panelH = height * 0.14;

    // Semi-transparent panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 150, 200, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "11px 'SF Mono', 'Fira Code', monospace";
    ctx.textAlign = "left";

    const lineHeight = 15;
    let y = panelY + 16;

    const silverFraction = silverRatio / 100;

    // Left column
    ctx.fillStyle = "rgba(255, 215, 100, 0.9)";
    ctx.fillText(`Crown (${(silverFraction * 100).toFixed(0)}% Ag):`, panelX + 10, y);
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillText(
      `\u03C1=${crownDensity.toFixed(0)} kg/m\u00B3  V=${(crownVolume * 1e6).toFixed(2)} cm\u00B3  F_b=${buoyantForceCrown.toFixed(3)} N  W'=${apparentWeightCrown.toFixed(3)} N`,
      panelX + 10,
      y + lineHeight
    );

    // Right column offset
    const col2X = panelX + panelW * 0.55;
    y = panelY + 16;

    ctx.fillStyle = "rgba(255, 215, 0, 0.9)";
    ctx.fillText("Gold Reference:", col2X, y);
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillText(
      `\u03C1=${GOLD_DENSITY} kg/m\u00B3  V=${(GOLD_VOLUME * 1e6).toFixed(2)} cm\u00B3  F_b=${buoyantForceGold.toFixed(3)} N  W'=${apparentWeightGold.toFixed(3)} N`,
      col2X,
      y + lineHeight
    );

    // Bottom line: verdict
    y = panelY + 16 + lineHeight * 2 + 4;
    const diff = Math.abs(apparentWeightCrown - apparentWeightGold);
    if (silverRatio < 0.5) {
      ctx.fillStyle = "rgba(100, 255, 100, 0.9)";
      ctx.fillText(`Balance: Equal  --  Crown is pure gold!`, panelX + 10, y);
    } else {
      ctx.fillStyle = "rgba(255, 100, 100, 0.9)";
      const lighter = apparentWeightCrown < apparentWeightGold ? "Crown" : "Gold";
      ctx.fillText(
        `Balance: ${lighter} side rises (\u0394W = ${diff.toFixed(3)} N)  --  Crown contains silver!`,
        panelX + 10,
        y
      );
    }

    // Fluid label
    ctx.fillStyle = "rgba(100, 200, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`Fluid: \u03C1=${fluidDensity} kg/m\u00B3`, panelX + panelW - 10, y);
  }

  function drawTitle(): void {
    // Title and formula at top
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Archimedes' Principle", width / 2, height * 0.05);

    ctx.fillStyle = "rgba(180, 220, 255, 0.7)";
    ctx.font = "italic 13px system-ui, sans-serif";
    ctx.fillText("F_b = \u03C1_fluid \u00D7 V_displaced \u00D7 g", width / 2, height * 0.05 + 20);
  }

  function reset(): void {
    time = 0;
    beamAngle = 0;
    targetBeamAngle = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const silverFraction = silverRatio / 100;
    return (
      `Archimedes Buoyancy Simulation: Crown is ${(silverFraction * 100).toFixed(0)}% silver, ${((1 - silverFraction) * 100).toFixed(0)}% gold. ` +
      `Crown density: ${crownDensity.toFixed(0)} kg/m^3, volume: ${(crownVolume * 1e6).toFixed(2)} cm^3. ` +
      `Gold reference density: ${GOLD_DENSITY} kg/m^3, volume: ${(GOLD_VOLUME * 1e6).toFixed(2)} cm^3. ` +
      `Water level: ${waterLevel}%, fluid density: ${fluidDensity} kg/m^3. ` +
      `Buoyant force on crown: ${buoyantForceCrown.toFixed(3)} N, on gold: ${buoyantForceGold.toFixed(3)} N. ` +
      `Apparent weight crown: ${apparentWeightCrown.toFixed(3)} N, gold: ${apparentWeightGold.toFixed(3)} N. ` +
      `Balance tilts ${apparentWeightCrown < apparentWeightGold ? "crown up (lighter)" : apparentWeightCrown > apparentWeightGold ? "gold up (lighter)" : "level"}. ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default ArchimedesFactory;
