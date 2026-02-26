import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PolygonalWheelFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("polygonal-wheel") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let numSides = 4;
  let speed = 1;
  let showAxleLine = 1;

  // Wheel state
  let wheelX = 0; // horizontal position along the road
  let wheelAngle = 0; // rotation angle
  let wheelR = 0; // circumradius

  // Layout
  let roadY = 0;

  function layout() {
    roadY = height * 0.65;
    wheelR = Math.min(width, height) * 0.1;
  }

  // Catenary function: y = a * cosh(x/a)
  // For an n-sided polygon with circumradius R, the catenary parameter a = R * cos(PI/n)
  function getCatenaryParam(): number {
    return wheelR * Math.cos(Math.PI / numSides);
  }

  // Get road surface Y at a given x position
  // The road is made of inverted catenaries, one per polygon side
  function getRoadY(x: number): number {
    const a = getCatenaryParam();
    const sideLen = 2 * wheelR * Math.sin(Math.PI / numSides);

    // Period of one catenary bump
    const period = sideLen;

    // Offset within the current period
    let localX = x % period;
    if (localX < 0) localX += period;
    localX -= period / 2;

    // Inverted catenary: road goes DOWN in the middle
    const catenarY = a * Math.cosh(localX / a) - a;

    return roadY + catenarY;
  }

  // Get the axle (center) height — should be constant for smooth rolling
  function getAxleY(): number {
    return roadY - wheelR * Math.cos(Math.PI / numSides);
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    wheelX = width * 0.2;
    wheelAngle = 0;
    layout();
  }

  function update(dt: number, params: Record<string, number>) {
    numSides = Math.round(params.numSides ?? 4);
    if (numSides < 3) numSides = 3;
    speed = params.speed ?? 1;
    showAxleLine = params.showAxleLine ?? 1;

    // Roll the wheel
    const sideLen = 2 * wheelR * Math.sin(Math.PI / numSides);
    const perimeter = numSides * sideLen;
    const rollSpeed = 60 * speed;

    wheelX += rollSpeed * dt;
    // Angular change: one full revolution per perimeter traveled
    wheelAngle += (rollSpeed * dt / perimeter) * Math.PI * 2;

    // Wrap around
    if (wheelX > width + wheelR * 2) {
      wheelX = -wheelR * 2;
    }

    time += dt;
  }

  function drawRoad() {
    const a = getCatenaryParam();
    const sideLen = 2 * wheelR * Math.sin(Math.PI / numSides);

    // Draw catenary road surface
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 2) {
      const ry = getRoadY(x);
      if (x === 0) ctx.moveTo(x, ry);
      else ctx.lineTo(x, ry);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();

    const roadGrad = ctx.createLinearGradient(0, roadY - 20, 0, height);
    roadGrad.addColorStop(0, "#4a8040");
    roadGrad.addColorStop(0.3, "#3a6830");
    roadGrad.addColorStop(1, "#2a4820");
    ctx.fillStyle = roadGrad;
    ctx.fill();

    // Road surface line
    ctx.beginPath();
    for (let x = 0; x <= width; x += 2) {
      const ry = getRoadY(x);
      if (x === 0) ctx.moveTo(x, ry);
      else ctx.lineTo(x, ry);
    }
    ctx.strokeStyle = "rgba(100,180,80,0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawWheel() {
    const axleY = getAxleY();

    ctx.save();
    ctx.translate(wheelX, axleY);
    ctx.rotate(-wheelAngle);

    // Polygon
    ctx.beginPath();
    for (let i = 0; i <= numSides; i++) {
      const angle = (i / numSides) * Math.PI * 2;
      const px = wheelR * Math.cos(angle);
      const py = wheelR * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    const wheelGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, wheelR);
    wheelGrad.addColorStop(0, "#c89050");
    wheelGrad.addColorStop(0.7, "#a07040");
    wheelGrad.addColorStop(1, "#805830");
    ctx.fillStyle = wheelGrad;
    ctx.fill();
    ctx.strokeStyle = "#604020";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Spoke lines from center to each vertex
    ctx.strokeStyle = "rgba(80,50,20,0.5)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < numSides; i++) {
      const angle = (i / numSides) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(wheelR * 0.9 * Math.cos(angle), wheelR * 0.9 * Math.sin(angle));
      ctx.stroke();
    }

    // Center axle
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#333";
    ctx.fill();

    ctx.restore();
  }

  function render() {
    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, "#88bbee");
    skyGrad.addColorStop(0.6, "#bbddff");
    skyGrad.addColorStop(1, "#ddeeff");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Clouds
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 3; i++) {
      const cx = ((time * 8 + i * width * 0.35) % (width + 100)) - 50;
      const cy = height * 0.1 + i * 25;
      for (let j = 0; j < 4; j++) {
        ctx.beginPath();
        ctx.arc(cx + j * 18 - 25, cy, 15 + j * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawRoad();
    drawWheel();

    // Axle height line
    if (showAxleLine >= 0.5) {
      const axleY = getAxleY();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "rgba(255,50,50,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, axleY);
      ctx.lineTo(width, axleY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(255,50,50,0.7)";
      ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText("Constant axle height", 10, axleY - 8);
    }

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(width * 0.05, height * 0.02, width * 0.4, height * 0.18, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `bold ${Math.max(12, height * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(`${numSides}-sided polygon`, width * 0.08, height * 0.06);

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.fillText(`Road: inverted catenary`, width * 0.08, height * 0.09);
    ctx.fillText(`y = a·cosh(x/a)`, width * 0.08, height * 0.12);
    ctx.fillText(`a = R·cos(π/${numSides}) = ${getCatenaryParam().toFixed(1)}`, width * 0.08, height * 0.15);

    // Title
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.font = `bold ${Math.max(13, height * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Polygonal Wheel on Catenary Road", width / 2, height - 15);
  }

  function reset() {
    time = 0;
    wheelX = width * 0.2;
    wheelAngle = 0;
  }

  function destroy() {}

  function getStateDescription(): string {
    return `Polygonal Wheel | Sides: ${numSides} | Catenary param: ${getCatenaryParam().toFixed(2)} | Speed: ${speed}x | Axle height is constant: the inverted catenary road compensates for the polygon shape`;
  }

  function resize(w: number, h: number) {
    width = w; height = h;
    layout();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PolygonalWheelFactory;
