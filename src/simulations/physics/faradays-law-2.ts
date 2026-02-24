import type { SimulationConfig, SimulationEngine, SimulationFactory } from "../types";

const config: SimulationConfig = {
  slug: "faradays-law-2",
  title: "Faraday's Law 2",
  category: "physics",
  description:
    "Move a magnet through a coil to induce electric current — electromagnetic induction in action.",
  longDescription:
    "Faraday's law states that a changing magnetic flux through a coil induces an electromotive force (EMF). The induced EMF is proportional to the rate of change of magnetic flux: ε = -dΦ/dt. In this simulation, drag a bar magnet toward and away from a coil to see the induced current on an ammeter. Faster movement produces stronger currents, and the direction reverses when the magnet changes direction.",
  parameters: [
    { key: "coilTurns", label: "Coil Turns", min: 5, max: 50, step: 5, defaultValue: 20 },
    { key: "magnetStrength", label: "Magnet Strength", min: 1, max: 10, step: 1, defaultValue: 5, unit: "T" },
    { key: "resistance", label: "Coil Resistance", min: 1, max: 20, step: 1, defaultValue: 5, unit: "Ω" },
  ],
  thumbnailColor: "#6366f1",
};

const FaradaysLaw2Factory: SimulationFactory = (): SimulationEngine => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0;
  let H = 0;
  let time = 0;

  let coilTurns = 20;
  let magnetStrength = 5;
  let resistance = 5;

  let magnetX = 0;
  let magnetY = 0;
  let prevMagnetX = 0;
  let magnetVx = 0;
  let isDragging = false;
  let inducedCurrent = 0;
  let currentHistory: number[] = [];
  let posHistory: number[] = [];
  const maxHistory = 200;

  const coilX = () => W * 0.55;
  const coilY = () => H * 0.4;
  const coilWidth = 60;
  const coilHeight = 120;

  function onMouseDown(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const magW = 120, magH = 40;
    if (mx > magnetX - magW / 2 && mx < magnetX + magW / 2 && my > magnetY - magH / 2 && my < magnetY + magH / 2) {
      isDragging = true;
    }
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    magnetX = e.clientX - rect.left;
    magnetY = e.clientY - rect.top;
  }

  function onMouseUp() {
    isDragging = false;
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = c.getContext("2d")!;
    W = c.width;
    H = c.height;
    magnetX = W * 0.2;
    magnetY = H * 0.4;
    prevMagnetX = magnetX;
    currentHistory = [];
    posHistory = [];
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
  }

  function update(dt: number, params: Record<string, number>) {
    coilTurns = params.coilTurns ?? 20;
    magnetStrength = params.magnetStrength ?? 5;
    resistance = params.resistance ?? 5;
    time += dt;

    magnetVx = (magnetX - prevMagnetX) / Math.max(dt, 0.001);
    prevMagnetX = magnetX;

    const dist = magnetX - coilX();
    const fluxGradient = -magnetStrength * coilTurns / (1 + (dist / 80) * (dist / 80));
    const emf = fluxGradient * magnetVx * 0.0005;
    inducedCurrent = emf / resistance;
    inducedCurrent = Math.max(-5, Math.min(5, inducedCurrent));

    currentHistory.push(inducedCurrent);
    posHistory.push(magnetX / W);
    if (currentHistory.length > maxHistory) {
      currentHistory.shift();
      posHistory.shift();
    }
  }

  function drawMagnet() {
    const magW = 120, magH = 40;
    const x = magnetX - magW / 2;
    const y = magnetY - magH / 2;

    // North pole (red)
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(x, y, magW / 2, magH);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", x + magW / 4, y + magH / 2);

    // South pole (blue)
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(x + magW / 2, y, magW / 2, magH);
    ctx.fillStyle = "#fff";
    ctx.fillText("S", x + 3 * magW / 4, y + magH / 2);

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, magW, magH);

    // Magnetic field lines
    ctx.strokeStyle = "rgba(100,100,255,0.3)";
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      const ly = magnetY + i * 12;
      ctx.moveTo(x - 30, ly);
      ctx.quadraticCurveTo(x - 10, ly + i * 8, x, ly);
      ctx.moveTo(x + magW, ly);
      ctx.quadraticCurveTo(x + magW + 10, ly + i * 8, x + magW + 30, ly);
      ctx.stroke();
    }
  }

  function drawCoil() {
    const cx = coilX();
    const cy = coilY();
    const cw = coilWidth;
    const ch = coilHeight;

    // Coil body
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 3;
    const turns = Math.min(coilTurns, 30);
    const spacing = ch / (turns + 1);
    for (let i = 1; i <= turns; i++) {
      const ty = cy - ch / 2 + i * spacing;
      ctx.beginPath();
      ctx.ellipse(cx, ty, cw / 2, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Core outline
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - cw / 2 - 5, cy - ch / 2 - 5, cw + 10, ch + 10);

    // Wire connections going down to ammeter
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - cw / 2, cy + ch / 2 + 5);
    ctx.lineTo(cx - cw / 2, cy + ch / 2 + 60);
    ctx.lineTo(cx + cw / 2, cy + ch / 2 + 60);
    ctx.lineTo(cx + cw / 2, cy + ch / 2 + 5);
    ctx.stroke();

    // Ammeter
    const aX = cx;
    const aY = cy + ch / 2 + 60;
    const aR = 25;
    ctx.beginPath();
    ctx.arc(aX, aY, aR, 0, Math.PI * 2);
    ctx.fillStyle = "#fefce8";
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#333";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("A", aX, aY - 10);

    // Needle
    const needleAngle = -Math.PI / 2 + (inducedCurrent / 5) * (Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(aX, aY);
    ctx.lineTo(aX + Math.cos(needleAngle) * (aR - 5), aY + Math.sin(needleAngle) * (aR - 5));
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = "#333";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`I = ${inducedCurrent.toFixed(2)} A`, aX, aY + aR + 15);
  }

  function drawGraph() {
    const gx = 30;
    const gy = H * 0.72;
    const gw = W - 60;
    const gh = H * 0.24;

    // Background
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gy, gw, gh);

    // Axis
    ctx.strokeStyle = "#999";
    ctx.beginPath();
    ctx.moveTo(gx, gy + gh / 2);
    ctx.lineTo(gx + gw, gy + gh / 2);
    ctx.stroke();

    ctx.fillStyle = "#666";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Induced Current (A)", gx + 5, gy + 14);

    // Current trace
    if (currentHistory.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      for (let i = 0; i < currentHistory.length; i++) {
        const px = gx + (i / maxHistory) * gw;
        const py = gy + gh / 2 - (currentHistory[i] / 5) * (gh / 2);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Position trace
    if (posHistory.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(59,130,246,0.5)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < posHistory.length; i++) {
        const px = gx + (i / maxHistory) * gw;
        const py = gy + gh - posHistory[i] * gh;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Legend
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(gx + gw - 160, gy + 6, 12, 3);
    ctx.fillStyle = "#666";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Current", gx + gw - 144, gy + 12);

    ctx.fillStyle = "rgba(59,130,246,0.5)";
    ctx.fillRect(gx + gw - 80, gy + 6, 12, 3);
    ctx.fillStyle = "#666";
    ctx.fillText("Position", gx + gw - 64, gy + 12);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#f0f4ff");
    bg.addColorStop(1, "#e0e8f5");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Faraday's Law — Electromagnetic Induction", W / 2, 28);

    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Drag the magnet toward / away from the coil", W / 2, 48);

    drawMagnet();
    drawCoil();
    drawGraph();

    // Info panel
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(10, 60, 180, 90);
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(10, 60, 180, 90);
    ctx.fillStyle = "#334155";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Coil turns: ${coilTurns}`, 20, 80);
    ctx.fillText(`B = ${magnetStrength} T`, 20, 96);
    ctx.fillText(`R = ${resistance} Ω`, 20, 112);
    ctx.fillText(`EMF = ${(inducedCurrent * resistance).toFixed(3)} V`, 20, 128);
    ctx.fillText(`I = ${inducedCurrent.toFixed(3)} A`, 20, 144);
  }

  function reset() {
    time = 0;
    magnetX = W * 0.2;
    magnetY = H * 0.4;
    prevMagnetX = magnetX;
    inducedCurrent = 0;
    currentHistory = [];
    posHistory = [];
  }

  function destroy() {
    canvas.removeEventListener("mousedown", onMouseDown);
    canvas.removeEventListener("mousemove", onMouseMove);
    canvas.removeEventListener("mouseup", onMouseUp);
    canvas.removeEventListener("mouseleave", onMouseUp);
  }

  function getStateDescription(): string {
    const emf = inducedCurrent * resistance;
    return `Faraday's Law simulation: A bar magnet (strength ${magnetStrength} T) is positioned near a coil with ${coilTurns} turns and ${resistance} Ω resistance. The induced EMF is ${emf.toFixed(3)} V producing a current of ${inducedCurrent.toFixed(3)} A. ${Math.abs(inducedCurrent) > 0.1 ? "Current is flowing — the magnet is moving relative to the coil." : "No significant current — the magnet is stationary."}`;
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default FaradaysLaw2Factory;
