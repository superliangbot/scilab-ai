import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface FloatingObject {
  x: number;
  y: number;
  vy: number;
  targetY: number;
  density: number;
  size: number;
  color: string;
  glowColor: string;
  label: string;
}

const BuoyancyFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("buoyancy") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let density1 = 800;
  let density2 = 1200;
  let fluidDensity = 1000;
  let objectSize = 1;

  // Objects
  let obj1: FloatingObject;
  let obj2: FloatingObject;

  // Water surface and container geometry
  const CONTAINER_MARGIN_X = 0.1; // fraction of width
  const WATER_SURFACE_Y_FRAC = 0.35; // fraction of height
  const CONTAINER_BOTTOM_FRAC = 0.88;

  // Wave animation
  let wavePhase = 0;

  // Gravity
  const g = 9.81;

  // Object base side length in pixels
  const BASE_OBJECT_SIZE = 50;

  function getWaterSurfaceY(): number {
    return height * WATER_SURFACE_Y_FRAC;
  }

  function getContainerBottom(): number {
    return height * CONTAINER_BOTTOM_FRAC;
  }

  function getContainerLeft(): number {
    return width * CONTAINER_MARGIN_X;
  }

  function getContainerRight(): number {
    return width * (1 - CONTAINER_MARGIN_X);
  }

  function computeEquilibriumY(obj: FloatingObject): number {
    const waterY = getWaterSurfaceY();
    const containerBottom = getContainerBottom();
    const objSideLen = BASE_OBJECT_SIZE * objectSize;

    if (obj.density <= fluidDensity) {
      // Object floats: fraction submerged = rho_obj / rho_fluid
      const fractionSubmerged = obj.density / fluidDensity;
      // Top of object is at waterY - (1 - fractionSubmerged) * objSideLen
      // Center of object is at waterY - (1 - fractionSubmerged) * objSideLen + objSideLen/2
      // Actually: the center y when floating:
      // submerged depth = fractionSubmerged * objSideLen
      // water surface cuts through the object, top of submerged part is at waterY
      // bottom of object = waterY + submergedDepth => but we want center
      // center = waterY + submergedDepth - objSideLen/2 = waterY + (fractionSubmerged - 0.5)*objSideLen
      const centerY = waterY + (fractionSubmerged - 0.5) * objSideLen;
      return centerY;
    } else {
      // Object sinks to bottom
      return containerBottom - objSideLen / 2;
    }
  }

  function createObjects(): void {
    const containerLeft = getContainerLeft();
    const containerRight = getContainerRight();
    const containerWidth = containerRight - containerLeft;

    obj1 = {
      x: containerLeft + containerWidth * 0.3,
      y: getWaterSurfaceY() - BASE_OBJECT_SIZE * objectSize, // start above water
      vy: 0,
      targetY: 0,
      density: density1,
      size: BASE_OBJECT_SIZE * objectSize,
      color: "#3b82f6",
      glowColor: "rgba(59, 130, 246, 0.3)",
      label: "Object 1",
    };

    obj2 = {
      x: containerLeft + containerWidth * 0.7,
      y: getWaterSurfaceY() - BASE_OBJECT_SIZE * objectSize,
      vy: 0,
      targetY: 0,
      density: density2,
      size: BASE_OBJECT_SIZE * objectSize,
      color: "#ef4444",
      glowColor: "rgba(239, 68, 68, 0.3)",
      label: "Object 2",
    };

    obj1.targetY = computeEquilibriumY(obj1);
    obj2.targetY = computeEquilibriumY(obj2);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    wavePhase = 0;
    createObjects();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newD1 = params.density1 ?? 800;
    const newD2 = params.density2 ?? 1200;
    const newFluid = params.fluidDensity ?? 1000;
    const newSize = params.objectSize ?? 1;

    density1 = newD1;
    density2 = newD2;
    fluidDensity = newFluid;
    objectSize = newSize;

    obj1.density = density1;
    obj2.density = density2;
    obj1.size = BASE_OBJECT_SIZE * objectSize;
    obj2.size = BASE_OBJECT_SIZE * objectSize;

    obj1.targetY = computeEquilibriumY(obj1);
    obj2.targetY = computeEquilibriumY(obj2);

    // Reposition X based on container width
    const containerLeft = getContainerLeft();
    const containerRight = getContainerRight();
    const containerWidth = containerRight - containerLeft;
    obj1.x = containerLeft + containerWidth * 0.3;
    obj2.x = containerLeft + containerWidth * 0.7;

    // Spring-damper physics toward equilibrium
    const springK = 8;
    const damping = 4;

    for (const obj of [obj1, obj2]) {
      const displacement = obj.y - obj.targetY;
      const springForce = -springK * displacement;
      const dampForce = -damping * obj.vy;
      const accel = springForce + dampForce;
      obj.vy += accel * dt;
      obj.y += obj.vy * dt;

      // Clamp to container
      const halfSize = obj.size / 2;
      const waterY = getWaterSurfaceY();
      const containerBottom = getContainerBottom();
      if (obj.y + halfSize > containerBottom) {
        obj.y = containerBottom - halfSize;
        obj.vy = -obj.vy * 0.3;
      }
      if (obj.y - halfSize < waterY - obj.size * 1.5) {
        obj.y = waterY - obj.size * 1.5 + halfSize;
        obj.vy = 0;
      }
    }

    wavePhase += dt * 1.5;
    time += dt;
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(0.3, "#0d1025");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawContainer(): void {
    const left = getContainerLeft();
    const right = getContainerRight();
    const waterY = getWaterSurfaceY();
    const bottom = getContainerBottom();

    // Container walls (glass look)
    ctx.save();
    ctx.strokeStyle = "rgba(150, 200, 255, 0.4)";
    ctx.lineWidth = 3;

    // Left wall
    ctx.beginPath();
    ctx.moveTo(left, waterY - 60);
    ctx.lineTo(left, bottom + 5);
    ctx.stroke();

    // Right wall
    ctx.beginPath();
    ctx.moveTo(right, waterY - 60);
    ctx.lineTo(right, bottom + 5);
    ctx.stroke();

    // Bottom
    ctx.beginPath();
    ctx.moveTo(left, bottom + 5);
    ctx.lineTo(right, bottom + 5);
    ctx.stroke();

    // Glass reflection on walls
    ctx.strokeStyle = "rgba(200, 230, 255, 0.1)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(left + 4, waterY - 50);
    ctx.lineTo(left + 4, bottom);
    ctx.stroke();

    ctx.restore();
  }

  function drawWater(): void {
    const left = getContainerLeft();
    const right = getContainerRight();
    const waterY = getWaterSurfaceY();
    const bottom = getContainerBottom();

    // Water body
    const waterGrad = ctx.createLinearGradient(0, waterY, 0, bottom);
    waterGrad.addColorStop(0, "rgba(20, 100, 200, 0.5)");
    waterGrad.addColorStop(0.5, "rgba(15, 70, 160, 0.6)");
    waterGrad.addColorStop(1, "rgba(10, 40, 100, 0.7)");

    ctx.save();
    ctx.beginPath();
    // Wavy surface
    ctx.moveTo(left, waterY);
    for (let x = left; x <= right; x += 2) {
      const wave = Math.sin((x * 0.02) + wavePhase) * 3 + Math.sin((x * 0.035) + wavePhase * 1.3) * 2;
      ctx.lineTo(x, waterY + wave);
    }
    ctx.lineTo(right, bottom + 5);
    ctx.lineTo(left, bottom + 5);
    ctx.closePath();
    ctx.fillStyle = waterGrad;
    ctx.fill();

    // Surface highlight
    ctx.beginPath();
    for (let x = left; x <= right; x += 2) {
      const wave = Math.sin((x * 0.02) + wavePhase) * 3 + Math.sin((x * 0.035) + wavePhase * 1.3) * 2;
      if (x === left) ctx.moveTo(x, waterY + wave);
      else ctx.lineTo(x, waterY + wave);
    }
    ctx.strokeStyle = "rgba(100, 200, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Caustic light patterns
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 12; i++) {
      const cx = left + (Math.sin(i * 1.7 + wavePhase * 0.8) * 0.5 + 0.5) * (right - left);
      const cy = waterY + 40 + (Math.cos(i * 2.3 + wavePhase * 0.5) * 0.5 + 0.5) * (bottom - waterY - 60);
      const r = 20 + Math.sin(i + wavePhase) * 10;
      const caustic = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      caustic.addColorStop(0, "rgba(100, 200, 255, 1)");
      caustic.addColorStop(1, "rgba(100, 200, 255, 0)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = caustic;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function drawObject(obj: FloatingObject): void {
    const halfSize = obj.size / 2;
    const x = obj.x - halfSize;
    const y = obj.y - halfSize;
    const waterY = getWaterSurfaceY();

    // Parse color for manipulation
    const r = parseInt(obj.color.slice(1, 3), 16);
    const g = parseInt(obj.color.slice(3, 5), 16);
    const b = parseInt(obj.color.slice(5, 7), 16);

    // Object glow
    const glow = ctx.createRadialGradient(obj.x, obj.y, halfSize * 0.5, obj.x, obj.y, halfSize * 2.5);
    glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.2)`);
    glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, halfSize * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Object body with gradient
    const bodyGrad = ctx.createLinearGradient(x, y, x + obj.size, y + obj.size);
    bodyGrad.addColorStop(0, `rgba(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)}, 0.9)`);
    bodyGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.9)`);
    bodyGrad.addColorStop(1, `rgba(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)}, 0.9)`);

    ctx.beginPath();
    ctx.roundRect(x, y, obj.size, obj.size, 6);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, 0.3)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Water line effect on submerged portion
    if (obj.y + halfSize > waterY) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, waterY, obj.size, obj.y + halfSize - waterY);
      ctx.clip();
      ctx.fillStyle = `rgba(20, 80, 180, 0.25)`;
      ctx.fillRect(x, waterY, obj.size, obj.y + halfSize - waterY);
      ctx.restore();
    }

    // Density label on object
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = `bold ${Math.max(10, obj.size * 0.22)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`${obj.density}`, obj.x, obj.y - 2);
    ctx.font = `${Math.max(8, obj.size * 0.16)}px system-ui, sans-serif`;
    ctx.fillText("kg/m\u00B3", obj.x, obj.y + obj.size * 0.2);

    // Label above
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(obj.label, obj.x, y - 8);
  }

  function drawForceArrows(obj: FloatingObject): void {
    const halfSize = obj.size / 2;
    const waterY = getWaterSurfaceY();

    // Compute forces (using normalized units for display)
    // Volume of object (assume cube with side length proportional to objectSize)
    const volume = 1; // normalized
    const weight = obj.density * volume * g;

    // Submerged volume fraction
    let submergedFraction = 0;
    if (obj.y + halfSize > waterY) {
      submergedFraction = Math.min(1, (obj.y + halfSize - waterY) / obj.size);
    }
    if (obj.density >= fluidDensity) {
      submergedFraction = Math.min(1, submergedFraction);
    }

    const buoyancyForce = fluidDensity * volume * submergedFraction * g;

    // Scale forces for display
    const maxForce = Math.max(weight, buoyancyForce, 1);
    const arrowScale = (height * 0.12) / maxForce;

    // Weight arrow (red, pointing down)
    const weightLen = weight * arrowScale;
    drawArrow(obj.x - halfSize * 0.5, obj.y, obj.x - halfSize * 0.5, obj.y + weightLen,
      "rgba(255, 80, 80, 0.85)", "W", weightLen);

    // Buoyancy arrow (green, pointing up)
    if (submergedFraction > 0) {
      const buoyLen = buoyancyForce * arrowScale;
      drawArrow(obj.x + halfSize * 0.5, obj.y, obj.x + halfSize * 0.5, obj.y - buoyLen,
        "rgba(80, 255, 120, 0.85)", "F_b", buoyLen);
    }

    // Net force indicator
    const netForce = buoyancyForce - weight;
    const netLen = Math.abs(netForce) * arrowScale;
    if (netLen > 2) {
      const netDir = netForce > 0 ? -1 : 1;
      const netColor = netForce > 0 ? "rgba(100, 200, 255, 0.7)" : "rgba(255, 150, 100, 0.7)";
      drawArrow(obj.x, obj.y, obj.x, obj.y + netDir * netLen, netColor, "Net", netLen);
    }
  }

  function drawArrow(
    x1: number, y1: number, x2: number, y2: number,
    color: string, label: string, _len: number
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 3) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(dy, dx);
    const headLen = 10;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
    ctx.stroke();

    // Label
    ctx.fillStyle = color;
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    const labelX = (x1 + x2) / 2 + (dy > 0 ? -15 : 15);
    const labelY = (y1 + y2) / 2;
    ctx.fillText(label, labelX, labelY);

    ctx.restore();
  }

  function drawFluidLabel(): void {
    const waterY = getWaterSurfaceY();
    const left = getContainerLeft();

    ctx.save();
    ctx.fillStyle = "rgba(100, 200, 255, 0.7)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Fluid: ${fluidDensity} kg/m\u00B3`, left + 10, waterY + 25);
    ctx.restore();
  }

  function drawInfoPanel(): void {
    ctx.save();
    const panelW = 260;
    const panelH = 120;
    const panelX = 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Buoyancy (Archimedes' Principle)", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Time: ${time.toFixed(1)}s`, panelX + 10, panelY + 38);
    ctx.fillText(`F_buoyancy = \u03C1_fluid \u00D7 V_sub \u00D7 g`, panelX + 10, panelY + 56);

    // Object 1 status
    const status1 = density1 < fluidDensity ? "Floats" : density1 === fluidDensity ? "Neutral" : "Sinks";
    const frac1 = density1 <= fluidDensity ? `(${((density1 / fluidDensity) * 100).toFixed(0)}% submerged)` : "";
    ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
    ctx.fillText(`Obj 1: ${density1} kg/m\u00B3 \u2192 ${status1} ${frac1}`, panelX + 10, panelY + 76);

    // Object 2 status
    const status2 = density2 < fluidDensity ? "Floats" : density2 === fluidDensity ? "Neutral" : "Sinks";
    const frac2 = density2 <= fluidDensity ? `(${((density2 / fluidDensity) * 100).toFixed(0)}% submerged)` : "";
    ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
    ctx.fillText(`Obj 2: ${density2} kg/m\u00B3 \u2192 ${status2} ${frac2}`, panelX + 10, panelY + 94);

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText(`\u03C1_obj < \u03C1_fluid \u2192 floats | \u03C1_obj > \u03C1_fluid \u2192 sinks`, panelX + 10, panelY + 112);

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawWater();
    drawContainer();
    drawObject(obj1);
    drawObject(obj2);
    drawForceArrows(obj1);
    drawForceArrows(obj2);
    drawFluidLabel();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    wavePhase = 0;
    createObjects();
  }

  function destroy(): void {
    // No persistent resources
  }

  function getStateDescription(): string {
    const status1 = density1 < fluidDensity ? "floating" : density1 === fluidDensity ? "neutrally buoyant" : "sinking";
    const status2 = density2 < fluidDensity ? "floating" : density2 === fluidDensity ? "neutrally buoyant" : "sinking";
    const frac1 = density1 <= fluidDensity ? (density1 / fluidDensity * 100).toFixed(0) : "100";
    const frac2 = density2 <= fluidDensity ? (density2 / fluidDensity * 100).toFixed(0) : "100";
    return (
      `Buoyancy Simulation: Fluid density=${fluidDensity} kg/m\u00B3. ` +
      `Object 1: density=${density1} kg/m\u00B3, ${status1}, ${frac1}% submerged. ` +
      `Object 2: density=${density2} kg/m\u00B3, ${status2}, ${frac2}% submerged. ` +
      `Archimedes' principle: F_b = \u03C1_fluid * V_sub * g. ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    createObjects();
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

export default BuoyancyFactory;
