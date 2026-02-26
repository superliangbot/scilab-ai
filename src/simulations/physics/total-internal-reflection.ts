import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TotalInternalReflectionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("total-internal-reflection") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let incidenceAngle = 30;
  let n1 = 1.5;
  let n2 = 1.0;
  let showFiber = 0;

  const rayParticles: Array<{ x: number; y: number; vx: number; vy: number; age: number }> = [];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    rayParticles.length = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    incidenceAngle = params.incidenceAngle ?? 30;
    n1 = params.n1 ?? 1.5;
    n2 = params.n2 ?? 1.0;
    showFiber = params.showFiber ?? 0;
    time += dt;
    for (let i = rayParticles.length - 1; i >= 0; i--) {
      const p = rayParticles[i];
      p.x += p.vx * dt * 120;
      p.y += p.vy * dt * 120;
      p.age += dt;
      if (p.age > 2 || p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
        rayParticles.splice(i, 1);
      }
    }
    if (Math.random() < 0.3) {
      const angRad = (incidenceAngle * Math.PI) / 180;
      const hitX = width * 0.4;
      const ifY = height * 0.5;
      rayParticles.push({
        x: hitX - 180 * Math.sin(angRad) + (Math.random() - 0.5) * 4,
        y: ifY - 180 * Math.cos(angRad) + (Math.random() - 0.5) * 4,
        vx: 1.2 * Math.sin(angRad), vy: 1.2 * Math.cos(angRad), age: 0,
      });
    }
  }

  function getCriticalAngle(): number {
    if (n2 >= n1) return 90;
    return (Math.asin(n2 / n1) * 180) / Math.PI;
  }

  function getRefractedAngle(): number | null {
    const sinR = (n1 * Math.sin((incidenceAngle * Math.PI) / 180)) / n2;
    if (Math.abs(sinR) > 1) return null;
    return (Math.asin(sinR) * 180) / Math.PI;
  }

  function renderSnellDemo(): void {
    const ifY = height * 0.5;
    const hitX = width * 0.4;
    const angRad = (incidenceAngle * Math.PI) / 180;
    // Medium 1 (top - denser)
    ctx.fillStyle = "rgba(60, 100, 200, 0.15)";
    ctx.fillRect(0, 0, width * 0.75, ifY);
    // Medium 2 (bottom)
    ctx.fillStyle = "rgba(200, 220, 255, 0.08)";
    ctx.fillRect(0, ifY, width * 0.75, height - ifY);
    // Interface line
    ctx.beginPath();
    ctx.moveTo(0, ifY);
    ctx.lineTo(width * 0.75, ifY);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Normal line
    ctx.beginPath();
    ctx.moveTo(hitX, ifY - 200);
    ctx.lineTo(hitX, ifY + 200);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.textAlign = "center";
    ctx.fillText("Normal", hitX, ifY - 205);
    // Medium labels
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "rgba(100, 160, 255, 0.8)";
    ctx.textAlign = "left";
    ctx.fillText(`Medium 1 (n\u2081 = ${n1.toFixed(2)})`, 12, ifY - 30);
    ctx.fillStyle = "rgba(180, 220, 255, 0.7)";
    ctx.fillText(`Medium 2 (n\u2082 = ${n2.toFixed(2)})`, 12, ifY + 45);
    // Incident ray
    const rayLen = 200;
    const incSX = hitX - rayLen * Math.sin(angRad);
    const incSY = ifY - rayLen * Math.cos(angRad);
    ctx.beginPath();
    ctx.moveTo(incSX, incSY);
    ctx.lineTo(hitX, ifY);
    ctx.strokeStyle = "#ffcc00";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Arrowhead
    const aa = Math.atan2(ifY - incSY, hitX - incSX);
    ctx.beginPath();
    ctx.moveTo(hitX, ifY);
    ctx.lineTo(hitX - 10 * Math.cos(aa - 0.3), ifY - 10 * Math.sin(aa - 0.3));
    ctx.moveTo(hitX, ifY);
    ctx.lineTo(hitX - 10 * Math.cos(aa + 0.3), ifY - 10 * Math.sin(aa + 0.3));
    ctx.strokeStyle = "#ffcc00";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Reflected ray
    const critAngle = getCriticalAngle();
    const isTIR = incidenceAngle >= critAngle;
    const rAlpha = isTIR ? 1.0 : 0.4 + 0.6 * (incidenceAngle / critAngle);
    ctx.beginPath();
    ctx.moveTo(hitX, ifY);
    ctx.lineTo(hitX + rayLen * Math.sin(angRad), ifY - rayLen * Math.cos(angRad));
    ctx.strokeStyle = `rgba(255, 100, 100, ${rAlpha})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Refracted ray
    const refAngle = getRefractedAngle();
    if (refAngle !== null && !isTIR) {
      const rr = (refAngle * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(hitX, ifY);
      ctx.lineTo(hitX + rayLen * Math.sin(rr), ifY + rayLen * Math.cos(rr));
      ctx.strokeStyle = "rgba(100, 255, 150, 0.8)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    // Angle arc for incidence
    ctx.beginPath();
    ctx.arc(hitX, ifY, 35, -Math.PI / 2, -Math.PI / 2 + angRad);
    ctx.strokeStyle = "#ffcc00";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#ffcc00";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${incidenceAngle}\u00B0`, hitX - 45, ifY - 25);
    // Critical angle indicator
    if (n2 < n1) {
      const cRad = (critAngle * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(hitX, ifY);
      ctx.lineTo(hitX + 100 * Math.sin(cRad), ifY - 100 * Math.cos(cRad));
      ctx.strokeStyle = "rgba(255, 100, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Animated particles
    for (const p of rayParticles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 220, 50, ${Math.max(0, 1 - p.age)})`;
      ctx.fill();
    }
    // TIR flash
    if (isTIR) {
      const glow = ctx.createRadialGradient(hitX, ifY, 0, hitX, ifY, 15);
      glow.addColorStop(0, `rgba(255, 100, 100, ${0.3 + 0.15 * Math.sin(time * 4)})`);
      glow.addColorStop(1, "rgba(255, 100, 100, 0)");
      ctx.beginPath();
      ctx.arc(hitX, ifY, 15, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }
  }

  function renderFiberOptic(): void {
    const fSX = width * 0.1, fEX = width * 0.7, fY = height * 0.65;
    const fH = 40, segs = 60, amp = 50;
    ctx.beginPath();
    ctx.moveTo(fSX, fY - fH / 2);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      ctx.lineTo(fSX + t * (fEX - fSX), fY + amp * Math.sin(t * Math.PI * 2) - fH / 2);
    }
    for (let i = segs; i >= 0; i--) {
      const t = i / segs;
      ctx.lineTo(fSX + t * (fEX - fSX), fY + amp * Math.sin(t * Math.PI * 2) + fH / 2);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(60, 120, 220, 0.2)";
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 160, 255, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Light bouncing inside fiber
    const bc = 8, lp = time * 1.5;
    ctx.beginPath();
    ctx.strokeStyle = "#ffcc00";
    ctx.lineWidth = 2;
    for (let i = 0; i <= bc * 2; i++) {
      const t = i / (bc * 2);
      const x = fSX + t * (fEX - fSX);
      const yOff = amp * Math.sin(t * Math.PI * 2);
      const bounce = (fH / 2 - 3) * Math.sin(i * Math.PI + lp);
      if (i === 0) ctx.moveTo(x, fY + yOff + bounce);
      else ctx.lineTo(x, fY + yOff + bounce);
    }
    ctx.stroke();
    // Light dot
    const dp = ((time * 0.3) % 1);
    const dx = fSX + dp * (fEX - fSX);
    const dyOff = amp * Math.sin(dp * Math.PI * 2);
    const dBounce = (fH / 2 - 3) * Math.sin(dp * bc * 2 * Math.PI + lp);
    const dy = fY + dyOff + dBounce;
    ctx.beginPath();
    ctx.arc(dx, dy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffee55";
    ctx.fill();
    const dotGlow = ctx.createRadialGradient(dx, dy, 0, dx, dy, 12);
    dotGlow.addColorStop(0, "rgba(255, 238, 85, 0.5)");
    dotGlow.addColorStop(1, "rgba(255, 238, 85, 0)");
    ctx.beginPath();
    ctx.arc(dx, dy, 12, 0, Math.PI * 2);
    ctx.fillStyle = dotGlow;
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Fiber Optic Cable - Light trapped by TIR", (fSX + fEX) / 2, fY + amp + fH + 20);
  }

  function renderInfoPanel(): void {
    const px = width * 0.76, py = 20, pw = width * 0.23, ph = 280;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.strokeStyle = "rgba(100, 150, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#88bbff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Snell's Law", px + 12, py + 24);
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "12px system-ui, sans-serif";
    let y = py + 48;
    const lh = 20;
    ctx.fillText(`n\u2081 sin\u03B8\u2081 = n\u2082 sin\u03B8\u2082`, px + 12, y); y += lh;
    ctx.fillText(`n\u2081 = ${n1.toFixed(2)}`, px + 12, y); y += lh;
    ctx.fillText(`n\u2082 = ${n2.toFixed(2)}`, px + 12, y); y += lh;
    ctx.fillText(`\u03B8i = ${incidenceAngle}\u00B0`, px + 12, y); y += lh + 6;
    const critAngle = getCriticalAngle();
    const refAngle = getRefractedAngle();
    const isTIR = incidenceAngle >= critAngle;
    ctx.fillStyle = "#ff88ff";
    ctx.fillText(`\u03B8c = ${critAngle.toFixed(1)}\u00B0`, px + 12, y); y += lh;
    ctx.fillStyle = isTIR ? "#ff6666" : "#66ff99";
    if (refAngle !== null && !isTIR) {
      ctx.fillText(`\u03B8r = ${refAngle.toFixed(1)}\u00B0`, px + 12, y); y += lh;
    } else {
      ctx.fillText("Total Internal Reflection!", px + 12, y); y += lh;
    }
    y += 10;
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("\u03B8c = arcsin(n\u2082/n\u2081)", px + 12, y); y += lh;
    ctx.fillText(`   = arcsin(${(n2 / n1).toFixed(3)})`, px + 12, y); y += lh;
    ctx.fillText(`   = ${critAngle.toFixed(1)}\u00B0`, px + 12, y); y += lh + 6;
    // Legend
    const items = [
      { color: "#ffcc00", label: "Incident ray" },
      { color: "#ff6666", label: "Reflected ray" },
      { color: "#66ff99", label: "Refracted ray" },
    ];
    for (const item of items) {
      ctx.fillStyle = item.color;
      ctx.fillRect(px + 12, y, 12, 3);
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fillText(item.label, px + 30, y + 4);
      y += 16;
    }
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1e");
    bgGrad.addColorStop(1, "#0e1428");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
    renderSnellDemo();
    if (showFiber >= 1) renderFiberOptic();
    renderInfoPanel();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void { time = 0; rayParticles.length = 0; }
  function destroy(): void { rayParticles.length = 0; }

  function getStateDescription(): string {
    const critAngle = getCriticalAngle();
    const refAngle = getRefractedAngle();
    const isTIR = incidenceAngle >= critAngle;
    return (
      `Total Internal Reflection: n1=${n1.toFixed(2)}, n2=${n2.toFixed(2)}, ` +
      `incidence=${incidenceAngle}\u00B0, critical angle=${critAngle.toFixed(1)}\u00B0. ` +
      (isTIR ? "TIR occurring." : `Refracted angle=${refAngle?.toFixed(1)}\u00B0.`) +
      (showFiber ? " Fiber optic demo active." : "")
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default TotalInternalReflectionFactory;
