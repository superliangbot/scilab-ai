import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Ion { x: number; y: number; vx: number; vy: number; deposited: boolean }
interface Electron { t: number; speed: number }

const ElectricPlatingFactory = (): SimulationEngine => {
  const config = getSimConfig("electric-plating") as SimulationConfig;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D;
  let width = 0, height = 0, time = 0;
  let currentParams: Record<string, number> = {};
  let ions: Ion[] = [], electrons: Electron[] = [];
  let cathodeThick = 0, anodeThick = 0;
  const maxCathode = 20, maxAnode = 30;

  const bk = () => ({ x: width * 0.15, y: height * 0.28, w: width * 0.7, h: height * 0.48 });
  const anR = () => {
    const b = bk(), aw = Math.max(4, 18 - anodeThick * 0.4);
    return { x: b.x + b.w * 0.18 - aw / 2, y: b.y + 20, w: aw, h: b.h - 40 };
  };
  const caR = () => { const b = bk(); return { x: b.x + b.w * 0.82 - 10, y: b.y + 30, w: 20, h: b.h - 60 }; };

  function createIons(): void {
    ions = [];
    const b = bk();
    for (let i = 0; i < 28; i++) {
      ions.push({
        x: b.x + b.w * 0.28 + Math.random() * b.w * 0.44,
        y: b.y + 25 + Math.random() * (b.h - 50),
        vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 15, deposited: false,
      });
    }
  }

  function createElectrons(): void {
    electrons = [];
    for (let i = 0; i < 10; i++) electrons.push({ t: Math.random(), speed: 0.08 + Math.random() * 0.04 });
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c; ctx = canvas.getContext("2d")!;
    width = canvas.width; height = canvas.height;
    cathodeThick = 0; anodeThick = 0;
    createIons(); createElectrons();
  }

  function update(dt: number, params: Record<string, number>): void {
    currentParams = params;
    const V = params.voltage ?? 6, I = params.current ?? 2;
    const spd = params.platingTime ?? 1, conc = params.electrolyteConcentration ?? 1;
    const b = bk(), aR = anR(), cR = caR();
    const drift = V * I * 0.6 * spd;

    for (const ion of ions) {
      if (ion.deposited) continue;
      ion.vx += (Math.random() - 0.5) * 60 * conc * dt;
      ion.vy += (Math.random() - 0.5) * 40 * dt;
      ion.vx += drift * dt;
      const sp = Math.hypot(ion.vx, ion.vy), mx = 40 + V * 5;
      if (sp > mx) { ion.vx = (ion.vx / sp) * mx; ion.vy = (ion.vy / sp) * mx; }
      ion.x += ion.vx * dt; ion.y += ion.vy * dt;
      const left = aR.x + aR.w + 8, right = cR.x - cathodeThick - 4;
      if (ion.x < left) { ion.x = left; ion.vx = Math.abs(ion.vx) * 0.6; }
      if (ion.x > right) ion.deposited = true;
      if (ion.y < b.y + 15) { ion.y = b.y + 15; ion.vy = Math.abs(ion.vy); }
      if (ion.y > b.y + b.h - 15) { ion.y = b.y + b.h - 15; ion.vy = -Math.abs(ion.vy); }
    }

    // Respawn deposited ions at anode (continuous dissolution)
    for (const ion of ions) {
      if (!ion.deposited) continue;
      ion.deposited = false;
      ion.x = aR.x + aR.w + 10 + Math.random() * 20;
      ion.y = aR.y + 10 + Math.random() * (aR.h - 20);
      ion.vx = 15 + Math.random() * 15; ion.vy = (Math.random() - 0.5) * 20;
    }

    const eSpd = V * I * 0.01 * spd;
    for (const e of electrons) { e.t = (e.t + e.speed * eSpd * dt) % 1; }

    const grow = V * I * 0.0003 * spd * conc;
    cathodeThick = Math.min(maxCathode, cathodeThick + grow * dt);
    anodeThick = Math.min(maxAnode, anodeThick + grow * dt * 0.8);
    time += dt;
  }

  function wirePoint(t: number): { x: number; y: number } {
    const b = bk(), aR = anR(), cR = caR();
    const wTop = b.y - 40, bx = width * 0.5;
    const cx = cR.x + cR.w / 2, ax = aR.x + aR.w / 2;
    const segs = [
      [cx, b.y - 2, cx, wTop], [cx, wTop, bx + 25, wTop],
      [bx - 25, wTop, ax, wTop], [ax, wTop, ax, b.y - 2],
    ];
    const lens = segs.map(([x0, y0, x1, y1]) => Math.hypot(x1 - x0, y1 - y0));
    const total = lens.reduce((a, b) => a + b, 0);
    let d = t * total;
    for (let i = 0; i < segs.length; i++) {
      if (d <= lens[i]) {
        const f = lens[i] > 0 ? d / lens[i] : 0;
        return { x: segs[i][0] + (segs[i][2] - segs[i][0]) * f, y: segs[i][1] + (segs[i][3] - segs[i][1]) * f };
      }
      d -= lens[i];
    }
    return { x: segs[3][2], y: segs[3][3] };
  }

  function render(): void {
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, width, height);
    const V = currentParams.voltage ?? 6, conc = currentParams.electrolyteConcentration ?? 1;
    const b = bk(), aR = anR(), cR = caR();
    const fs = (r: number) => `${Math.max(r, width * (r / 700))}px sans-serif`;

    // Title
    ctx.fillStyle = "#e6edf3"; ctx.font = `bold ${fs(15)}`; ctx.textAlign = "center";
    ctx.fillText("Electroplating (Electric Plating)", width / 2, 22);

    // Wires
    const wTop = b.y - 40, bx = width * 0.5;
    const cx = cR.x + cR.w / 2, ax = aR.x + aR.w / 2;
    ctx.strokeStyle = "#8b949e"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx, b.y - 2); ctx.lineTo(cx, wTop); ctx.lineTo(bx + 28, wTop); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax, b.y - 2); ctx.lineTo(ax, wTop); ctx.lineTo(bx - 28, wTop); ctx.stroke();

    // Battery symbol
    ctx.strokeStyle = "#e6edf3"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(bx + 25, wTop - 14); ctx.lineTo(bx + 25, wTop + 14); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx - 25, wTop - 8); ctx.lineTo(bx - 25, wTop + 8); ctx.stroke();
    ctx.font = `bold ${fs(13)}`; ctx.textAlign = "center";
    ctx.fillStyle = "#f85149"; ctx.fillText("+", bx + 25, wTop - 19);
    ctx.fillStyle = "#58a6ff"; ctx.fillText("\u2212", bx - 25, wTop - 13);
    ctx.fillStyle = "#8b949e"; ctx.font = fs(11);
    ctx.fillText(`${V.toFixed(1)}V DC`, bx, wTop + 28);

    // Electrons on wire
    for (const e of electrons) {
      const pt = wirePoint(e.t);
      ctx.fillStyle = "#58a6ff"; ctx.beginPath(); ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c9d1d9"; ctx.font = "bold 7px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("e\u207B", pt.x, pt.y);
    }
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#58a6ff"; ctx.font = fs(10); ctx.textAlign = "center";
    ctx.fillText("e\u207B flow \u2192", bx, wTop - 35);

    // Beaker with electrolyte
    const alpha = 0.12 + conc * 0.08;
    ctx.fillStyle = `rgba(56,139,253,${alpha})`; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = "#6e7681"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(b.x, b.y - 5); ctx.lineTo(b.x, b.y + b.h);
    ctx.lineTo(b.x + b.w, b.y + b.h); ctx.lineTo(b.x + b.w, b.y - 5); ctx.stroke();
    ctx.fillStyle = "rgba(56,139,253,0.7)"; ctx.font = fs(10); ctx.textAlign = "center";
    ctx.fillText("CuSO\u2084 solution", b.x + b.w / 2, b.y + b.h - 8);

    // Anode (copper plate, dissolving)
    const ag = ctx.createLinearGradient(aR.x, aR.y, aR.x + aR.w, aR.y);
    ag.addColorStop(0, "#d97706"); ag.addColorStop(0.5, "#f59e0b"); ag.addColorStop(1, "#b45309");
    ctx.fillStyle = ag; ctx.fillRect(aR.x, aR.y, aR.w, aR.h);
    ctx.strokeStyle = "#92400e"; ctx.lineWidth = 1; ctx.strokeRect(aR.x, aR.y, aR.w, aR.h);
    ctx.fillStyle = "#fbbf24"; ctx.font = `bold ${fs(12)}`; ctx.textAlign = "center";
    ctx.fillText("Anode (+)", aR.x + aR.w / 2, aR.y - 8);

    // Cathode (object being plated)
    ctx.fillStyle = "#30363d"; ctx.fillRect(cR.x, cR.y, cR.w, cR.h);
    ctx.strokeStyle = "#484f58"; ctx.lineWidth = 1; ctx.strokeRect(cR.x, cR.y, cR.w, cR.h);
    if (cathodeThick > 0.5) {
      const cg = ctx.createLinearGradient(cR.x - cathodeThick, cR.y, cR.x, cR.y);
      cg.addColorStop(0, "#f59e0b"); cg.addColorStop(0.4, "#d97706"); cg.addColorStop(1, "#b45309");
      ctx.fillStyle = cg; ctx.fillRect(cR.x - cathodeThick, cR.y + 2, cathodeThick, cR.h - 4);
    }
    ctx.fillStyle = "#58a6ff"; ctx.font = `bold ${fs(12)}`; ctx.textAlign = "center";
    ctx.fillText("Cathode (\u2212)", cR.x + cR.w / 2, cR.y - 8);

    // Ions in solution
    for (const ion of ions) {
      if (ion.deposited) continue;
      const glow = ctx.createRadialGradient(ion.x, ion.y, 0, ion.x, ion.y, 6);
      glow.addColorStop(0, "rgba(251,191,36,0.9)");
      glow.addColorStop(0.6, "rgba(217,119,6,0.6)");
      glow.addColorStop(1, "rgba(217,119,6,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(ion.x, ion.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.arc(ion.x, ion.y, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "bold 6px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("Cu\u00B2\u207A", ion.x, ion.y - 9);
    }
    ctx.textBaseline = "alphabetic";

    // Ion legend
    ctx.fillStyle = "#fbbf24"; ctx.font = fs(11); ctx.textAlign = "left";
    ctx.fillText("\u25CF Cu\u00B2\u207A ions", b.x + 5, b.y + 18);

    // Ion migration arrow
    const arY = b.y + b.h / 2, arS = aR.x + aR.w + 25, arE = cR.x - cathodeThick - 10;
    ctx.strokeStyle = "rgba(251,191,36,0.5)"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(arS, arY); ctx.lineTo(arE, arY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "rgba(251,191,36,0.6)";
    ctx.beginPath(); ctx.moveTo(arE, arY); ctx.lineTo(arE - 8, arY - 5); ctx.lineTo(arE - 8, arY + 5); ctx.closePath(); ctx.fill();
    ctx.font = fs(9); ctx.textAlign = "center";
    ctx.fillText("Cu\u00B2\u207A migration", (arS + arE) / 2, arY - 10);

    // Chemical equations
    const eqY = b.y + b.h + 22;
    ctx.fillStyle = "#e6edf3"; ctx.font = `bold ${fs(11)}`; ctx.textAlign = "center";
    ctx.fillText("Chemical Reactions:", width / 2, eqY);
    ctx.font = fs(11);
    ctx.fillStyle = "#fbbf24"; ctx.fillText("Anode: Cu \u2192 Cu\u00B2\u207A + 2e\u207B", width * 0.3, eqY + 20);
    ctx.fillStyle = "#58a6ff"; ctx.fillText("Cathode: Cu\u00B2\u207A + 2e\u207B \u2192 Cu", width * 0.7, eqY + 20);

    // Info panel
    const pY = eqY + 38, pW = Math.min(width - 20, 400), pX = (width - pW) / 2;
    ctx.fillStyle = "#161b22"; ctx.fillRect(pX, pY, pW, 50);
    ctx.strokeStyle = "#30363d"; ctx.lineWidth = 1; ctx.strokeRect(pX, pY, pW, 50);
    ctx.fillStyle = "#8b949e"; ctx.font = fs(10); ctx.textAlign = "left";
    const coat = (cathodeThick / maxCathode * 100).toFixed(1);
    const diss = (anodeThick / maxAnode * 100).toFixed(1);
    ctx.fillText(`Voltage: ${V.toFixed(1)} V`, pX + 10, pY + 16);
    ctx.fillText(`Current: ${(currentParams.current ?? 2).toFixed(1)} A`, pX + 10, pY + 32);
    ctx.fillText(`Coating: ${coat}%`, pX + pW / 2, pY + 16);
    ctx.fillText(`Conc: ${conc.toFixed(2)} M`, pX + pW / 2, pY + 32);
    ctx.fillText(`Anode dissolved: ${diss}%`, pX + 10, pY + 47);
  }

  function reset(): void {
    time = 0; cathodeThick = 0; anodeThick = 0; currentParams = {};
    createIons(); createElectrons();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const V = currentParams.voltage ?? 6, I = currentParams.current ?? 2;
    const conc = currentParams.electrolyteConcentration ?? 1;
    const coat = (cathodeThick / maxCathode * 100).toFixed(1);
    const diss = (anodeThick / maxAnode * 100).toFixed(1);
    return `Electroplating simulation at ${V.toFixed(1)} V and ${I.toFixed(1)} A. ` +
      `Electrolyte: CuSO\u2084 at ${conc.toFixed(2)} M. ` +
      `Anode oxidation: Cu \u2192 Cu\u00B2\u207A + 2e\u207B (${diss}% dissolved). ` +
      `Cu\u00B2\u207A ions migrate to cathode, reduced: Cu\u00B2\u207A + 2e\u207B \u2192 Cu (${coat}% coated). ` +
      `Electrons flow externally from cathode to anode. Higher voltage/current increases plating rate; ` +
      `higher concentration provides more ions for deposition.`;
  }

  function resize(w: number, h: number): void {
    width = w; height = h; createIons(); createElectrons();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ElectricPlatingFactory;
