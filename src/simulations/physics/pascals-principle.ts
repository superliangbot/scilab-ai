import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PascalsPrincipleFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("pascals-principle") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let force = 50;
  let smallArea = 10;
  let largeArea = 100;
  let showPressure = 1;

  let smallPistonDisp = 0;
  let largePistonDisp = 0;
  let particles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    particles = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    force = params.force ?? 50;
    smallArea = params.smallArea ?? 10;
    largeArea = params.largeArea ?? 100;
    showPressure = params.showPressure ?? 1;
    time += dt;

    const maxD = 60;
    const targetSmall = Math.min(maxD, (force / 200) * maxD);
    const targetLarge = targetSmall * (smallArea / largeArea);
    smallPistonDisp += (targetSmall - smallPistonDisp) * Math.min(1, dt * 4);
    largePistonDisp += (targetLarge - largePistonDisp) * Math.min(1, dt * 4);

    // Pressure particles
    if (showPressure >= 0.5 && Math.random() < dt * 12) {
      const pressure = force / smallArea;
      particles.push({
        x: width * 0.35 + Math.random() * width * 0.3,
        y: height * 0.6 + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.3) * 60 * (pressure / 5),
        vy: (Math.random() - 0.5) * 40,
        life: 1.0,
      });
    }
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.2; }
    particles = particles.filter((p) => p.life > 0);
  }

  function render(): void {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0a1628");
    bg.addColorStop(1, "#0d1f3c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    drawHydraulicSystem();
    if (showPressure >= 0.5) drawPressureVis();
    drawForceVectors();
    drawInfoPanel();
    drawTitle();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 10, height - 10);
  }

  function drawHydraulicSystem(): void {
    const baseY = height * 0.5;
    const tubeBot = height * 0.72;
    const sCylX = width * 0.2;
    const sCylW = 30 + smallArea * 1.5;
    const sCylTop = baseY - 80;
    const lCylX = width * 0.65;
    const lCylW = 30 + largeArea * 0.5;
    const lCylTop = baseY - 80;

    // Connecting tube
    ctx.fillStyle = "rgba(40,100,180,0.4)";
    ctx.fillRect(sCylX, tubeBot - 30, lCylX + lCylW - sCylX, 30);
    ctx.strokeStyle = "rgba(100,160,220,0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(sCylX, tubeBot - 30, lCylX + lCylW - sCylX, 30);

    // Fluid columns
    const sFluidTop = sCylTop + 20 + smallPistonDisp;
    const lFluidTop = lCylTop + 20 - largePistonDisp;
    drawFluid(sCylX, sFluidTop, sCylW, tubeBot - sFluidTop);
    drawFluid(lCylX, lFluidTop, lCylW, tubeBot - lFluidTop);

    // Cylinder walls
    ctx.strokeStyle = "rgba(180,200,230,0.7)";
    ctx.lineWidth = 3;
    for (const [cx, cw] of [[sCylX, sCylW], [lCylX, lCylW]]) {
      ctx.beginPath();
      ctx.moveTo(cx, sCylTop);
      ctx.lineTo(cx, tubeBot);
      ctx.moveTo(cx + cw, sCylTop);
      ctx.lineTo(cx + cw, tubeBot);
      ctx.stroke();
    }

    // Pistons
    const sPistonY = sFluidTop - 8;
    const lPistonY = lFluidTop - 8;
    drawPiston(sCylX, sPistonY, sCylW, "#6688aa");
    drawPiston(lCylX, lPistonY, lCylW, "#7799bb");

    // Piston rods
    ctx.fillStyle = "rgba(160,180,200,0.8)";
    ctx.fillRect(sCylX + sCylW / 2 - 4, sPistonY - 50, 8, 50);
    ctx.fillRect(lCylX + lCylW / 2 - 4, lPistonY - 50, 8, 50);

    // Area labels
    ctx.fillStyle = "rgba(200,220,255,0.9)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`A\u2081 = ${smallArea} cm\u00B2`, sCylX + sCylW / 2, tubeBot + 20);
    ctx.fillText(`A\u2082 = ${largeArea} cm\u00B2`, lCylX + lCylW / 2, tubeBot + 20);

    // Displacement labels
    ctx.fillStyle = "rgba(180,255,180,0.8)";
    ctx.font = "10px monospace";
    ctx.fillText(`d\u2081=${smallPistonDisp.toFixed(1)}`, sCylX + sCylW / 2, sPistonY - 55);
    ctx.fillText(`d\u2082=${largePistonDisp.toFixed(1)}`, lCylX + lCylW / 2, lPistonY - 55);

    // Load block on large piston
    const loadW = lCylW * 0.6;
    ctx.fillStyle = "rgba(200,80,80,0.7)";
    ctx.fillRect(lCylX + lCylW / 2 - loadW / 2, lPistonY - 70, loadW, 30);
    ctx.strokeStyle = "rgba(255,120,120,0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(lCylX + lCylW / 2 - loadW / 2, lPistonY - 70, loadW, 30);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("LOAD", lCylX + lCylW / 2, lPistonY - 51);
  }

  function drawFluid(x: number, top: number, w: number, h: number): void {
    if (h <= 0) return;
    const fg = ctx.createLinearGradient(x, top, x + w, top + h);
    fg.addColorStop(0, "rgba(30,120,220,0.7)");
    fg.addColorStop(0.5, "rgba(40,140,240,0.8)");
    fg.addColorStop(1, "rgba(20,90,180,0.7)");
    ctx.fillStyle = fg;
    ctx.fillRect(x, top, w, h);

    ctx.strokeStyle = "rgba(100,200,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 2, top);
    for (let px = x + 2; px < x + w - 2; px += 3) {
      ctx.lineTo(px, top + Math.sin((px - x) * 0.1 + time * 3) * 1.5);
    }
    ctx.stroke();
  }

  function drawPiston(x: number, y: number, w: number, color: string): void {
    const pg = ctx.createLinearGradient(x, y, x, y + 16);
    pg.addColorStop(0, color);
    pg.addColorStop(0.5, "#aabbcc");
    pg.addColorStop(1, color);
    ctx.fillStyle = pg;
    ctx.fillRect(x + 2, y, w - 4, 16);
    ctx.strokeStyle = "rgba(200,220,240,0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y, w - 4, 16);
  }

  function drawPressureVis(): void {
    // Particles
    for (const p of particles) {
      ctx.fillStyle = `rgba(80,180,255,${p.life * 0.6})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Pressure arrows at key points
    const pressure = force / smallArea;
    const pts = [
      { x: width * 0.28, y: height * 0.6 },
      { x: width * 0.42, y: height * 0.61 },
      { x: width * 0.55, y: height * 0.605 },
      { x: width * 0.72, y: height * 0.6 },
    ];
    for (const pt of pts) {
      const len = Math.min(20, pressure * 2);
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        ctx.strokeStyle = "rgba(255,180,50,0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x + dx * len, pt.y + dy * len);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,180,50,0.5)";
        ctx.beginPath();
        ctx.arc(pt.x + dx * len, pt.y + dy * len, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255,200,80,0.7)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${pressure.toFixed(1)}`, pt.x, pt.y - len - 6);
    }
  }

  function drawForceVectors(): void {
    const pressure = force / smallArea;
    const outputForce = pressure * largeArea;
    const sCylX = width * 0.2;
    const sCylW = 30 + smallArea * 1.5;
    const lCylX = width * 0.65;
    const lCylW = 30 + largeArea * 0.5;
    const ay = height * 0.28;

    // Input force (downward)
    const f1Len = Math.min(80, force * 0.5);
    const f1X = sCylX + sCylW / 2;
    drawArrow(f1X, ay - f1Len, f1X, ay, "rgba(50,220,100,0.9)", 3);
    ctx.fillStyle = "rgba(50,220,100,0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`F\u2081 = ${force} N`, f1X, ay - f1Len - 10);

    // Output force (upward)
    const f2Len = Math.min(80, outputForce * 0.05);
    const f2X = lCylX + lCylW / 2;
    drawArrow(f2X, ay, f2X, ay - f2Len, "rgba(255,100,80,0.9)", 3);
    ctx.fillStyle = "rgba(255,100,80,0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText(`F\u2082 = ${outputForce.toFixed(1)} N`, f2X, ay - f2Len - 10);
  }

  function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string, lw: number): void {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const nx = dx / len, ny = dy / len;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 10 * nx + 4 * ny, y2 - 10 * ny - 4 * nx);
    ctx.lineTo(x2 - 10 * nx - 4 * ny, y2 - 10 * ny + 4 * nx);
    ctx.closePath();
    ctx.fill();
  }

  function drawInfoPanel(): void {
    const pw = 280, ph = 95, px = 10, py = height - ph - 30;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(50,150,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const pressure = force / smallArea;
    const outputForce = pressure * largeArea;
    const mechAdv = largeArea / smallArea;

    ctx.fillStyle = "rgba(80,180,255,0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Pascal's Principle", px + 10, py + 16);

    ctx.font = "11px 'SF Mono','Fira Code',monospace";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    let y = py + 32;
    ctx.fillText(`Pressure: F\u2081/A\u2081 = ${pressure.toFixed(2)} N/cm\u00B2`, px + 10, y);
    ctx.fillText(`Input: ${force} N  |  Output: ${outputForce.toFixed(1)} N`, px + 10, y + 15);
    ctx.fillText(`Mech. Advantage: A\u2082/A\u2081 = ${mechAdv.toFixed(1)}\u00D7`, px + 10, y + 30);
    ctx.fillText(`d\u2081=${smallPistonDisp.toFixed(1)}  d\u2082=${largePistonDisp.toFixed(1)}  (A\u2081d\u2081=A\u2082d\u2082)`, px + 10, y + 45);
  }

  function drawTitle(): void {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pascal's Principle \u2014 Hydraulic Press", width / 2, 24);
    ctx.fillStyle = "rgba(100,200,255,0.65)";
    ctx.font = "italic 12px system-ui, sans-serif";
    ctx.fillText("F\u2081/A\u2081 = F\u2082/A\u2082 \u2014 Pressure transmits equally in all directions", width / 2, 42);
  }

  function reset(): void { time = 0; smallPistonDisp = 0; largePistonDisp = 0; particles = []; }
  function destroy(): void { particles = []; }

  function getStateDescription(): string {
    const pressure = force / smallArea;
    const outputForce = pressure * largeArea;
    const mechAdv = largeArea / smallArea;
    return (
      `Pascal's Principle (hydraulic press). Input: ${force} N on ${smallArea} cm\u00B2. ` +
      `Pressure: ${pressure.toFixed(2)} N/cm\u00B2. Output: ${outputForce.toFixed(1)} N on ${largeArea} cm\u00B2. ` +
      `Mechanical advantage: ${mechAdv.toFixed(1)}\u00D7. d\u2081=${smallPistonDisp.toFixed(1)}, d\u2082=${largePistonDisp.toFixed(1)}. ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PascalsPrincipleFactory;
