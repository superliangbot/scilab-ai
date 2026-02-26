import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const NeutralizationReactionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("neutralization-reaction") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let acidConcentration = 0.5; // mol/L
  let baseVolume = 0; // mL added (0-100)
  let acidType = 1; // 1 = HCl, 2 = H2SO4
  let showIndicator = 1;

  // Chemistry state
  let pH = 1;
  let temperature = 25;
  let hPlusConc = 0;
  let ohMinusConc = 0;
  let waterProduced = 0;
  let saltProduced = 0;

  // Particles
  interface Ion {
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: "H+" | "OH-" | "Na+" | "Cl-" | "H2O" | "salt";
    alpha: number;
    size: number;
  }
  let ions: Ion[] = [];

  // Beaker geometry
  const BEAKER_LEFT = 0.2;
  const BEAKER_RIGHT = 0.6;
  const BEAKER_TOP = 0.25;
  const BEAKER_BOTTOM = 0.75;

  function computeChemistry(): void {
    const acidMoles = acidConcentration * 0.1; // 100mL beaker
    const baseMoles = (acidConcentration * baseVolume) / 100;

    if (baseMoles < acidMoles) {
      // Acid excess
      const excessH = acidMoles - baseMoles;
      hPlusConc = excessH / 0.1;
      ohMinusConc = 1e-14 / Math.max(hPlusConc, 1e-14);
      pH = -Math.log10(Math.max(hPlusConc, 1e-14));
    } else if (baseMoles > acidMoles) {
      // Base excess
      const excessOH = baseMoles - acidMoles;
      ohMinusConc = excessOH / 0.1;
      hPlusConc = 1e-14 / Math.max(ohMinusConc, 1e-14);
      pH = 14 + Math.log10(Math.max(ohMinusConc, 1e-14));
    } else {
      // Neutral
      pH = 7;
      hPlusConc = 1e-7;
      ohMinusConc = 1e-7;
    }

    pH = Math.max(0, Math.min(14, pH));
    waterProduced = Math.min(acidMoles, baseMoles) * 1000;
    saltProduced = waterProduced;

    // Temperature rise from exothermic neutralization
    const heatReleased = Math.min(acidMoles, baseMoles) * 57.1; // kJ/mol
    temperature = 25 + heatReleased * 5;
  }

  function pHToColor(ph: number): string {
    if (ph < 3) return `rgb(255, ${Math.round(40 + ph * 20)}, 40)`;
    if (ph < 5) return `rgb(255, ${Math.round(100 + (ph - 3) * 60)}, 40)`;
    if (ph < 6) return `rgb(255, ${Math.round(220 + (ph - 5) * 35)}, ${Math.round(40 + (ph - 5) * 60)})`;
    if (ph < 7) return `rgb(${Math.round(255 - (ph - 6) * 100)}, 255, ${Math.round(100 + (ph - 6) * 50)})`;
    if (ph < 8) return `rgb(${Math.round(155 - (ph - 7) * 100)}, ${Math.round(255 - (ph - 7) * 30)}, ${Math.round(150 + (ph - 7) * 50)})`;
    if (ph < 10) return `rgb(${Math.round(55 - (ph - 8) * 20)}, ${Math.round(225 - (ph - 8) * 60)}, ${Math.round(200 + (ph - 8) * 25)})`;
    if (ph < 12) return `rgb(${Math.round(15 + (ph - 10) * 30)}, ${Math.round(105 - (ph - 10) * 30)}, ${Math.round(250 - (ph - 10) * 20)})`;
    return `rgb(${Math.round(75 + (ph - 12) * 40)}, ${Math.round(45 + (ph - 12) * 10)}, ${Math.round(210 + (ph - 12) * 20)})`;
  }

  function indicatorColor(ph: number): string {
    // Phenolphthalein: colorless in acid, pink in base
    if (showIndicator < 1) return "transparent";
    if (ph < 8.2) return "rgba(255, 255, 255, 0.05)";
    const intensity = Math.min(1, (ph - 8.2) / 2);
    return `rgba(219, 39, 119, ${intensity * 0.6})`;
  }

  function spawnIons(): void {
    if (ions.length > 150) return;

    const bLeft = width * BEAKER_LEFT + 15;
    const bRight = width * BEAKER_RIGHT - 15;
    const bTop = height * BEAKER_TOP + 30;
    const bBottom = height * BEAKER_BOTTOM - 10;

    // H+ ions based on acid concentration
    const targetH = Math.round(hPlusConc * 30);
    const currentH = ions.filter(i => i.type === "H+").length;
    if (currentH < targetH && currentH < 40) {
      ions.push({
        x: bLeft + Math.random() * (bRight - bLeft),
        y: bTop + Math.random() * (bBottom - bTop),
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        type: "H+",
        alpha: 1,
        size: 4,
      });
    }

    // OH- ions based on base volume
    const targetOH = Math.round(ohMinusConc * 30);
    const currentOH = ions.filter(i => i.type === "OH-").length;
    if (currentOH < targetOH && currentOH < 40) {
      ions.push({
        x: bLeft + Math.random() * (bRight - bLeft),
        y: bTop + Math.random() * (bBottom - bTop),
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        type: "OH-",
        alpha: 1,
        size: 5,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    ions = [];
    computeChemistry();
  }

  function update(dt: number, params: Record<string, number>): void {
    acidConcentration = params.acidConcentration ?? 0.5;
    baseVolume = params.baseVolume ?? 0;
    acidType = params.acidType ?? 1;
    showIndicator = params.showIndicator ?? 1;

    time += dt;
    computeChemistry();
    spawnIons();

    const bLeft = width * BEAKER_LEFT + 15;
    const bRight = width * BEAKER_RIGHT - 15;
    const bTop = height * BEAKER_TOP + 30;
    const bBottom = height * BEAKER_BOTTOM - 10;

    // Update ions
    for (let i = ions.length - 1; i >= 0; i--) {
      const ion = ions[i];
      ion.x += ion.vx * dt;
      ion.y += ion.vy * dt;

      // Bounce off beaker walls
      if (ion.x < bLeft) { ion.x = bLeft; ion.vx = Math.abs(ion.vx); }
      if (ion.x > bRight) { ion.x = bRight; ion.vx = -Math.abs(ion.vx); }
      if (ion.y < bTop) { ion.y = bTop; ion.vy = Math.abs(ion.vy); }
      if (ion.y > bBottom) { ion.y = bBottom; ion.vy = -Math.abs(ion.vy); }

      // H+ and OH- can react to form water
      if (ion.type === "H+") {
        for (let j = ions.length - 1; j >= 0; j--) {
          if (j === i) continue;
          const other = ions[j];
          if (other.type === "OH-") {
            const dx = ion.x - other.x;
            const dy = ion.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 12) {
              // Reaction: H+ + OH- -> H2O
              ions[i].type = "H2O";
              ions[i].size = 3;
              ions[i].alpha = 0.5;
              ions.splice(j, 1);
              if (j < i) i--;
              break;
            }
          }
        }
      }

      // Water molecules fade out
      if (ion.type === "H2O") {
        ion.alpha -= dt * 0.3;
        if (ion.alpha <= 0) {
          ions.splice(i, 1);
        }
      }
    }

    // Keep ion count manageable
    const excessH = ions.filter(i => i.type === "H+").length - Math.round(hPlusConc * 30);
    if (excessH > 5) {
      for (let i = ions.length - 1; i >= 0 && excessH > 0; i--) {
        if (ions[i].type === "H+") { ions.splice(i, 1); break; }
      }
    }
  }

  function drawBeaker(): void {
    const bLeft = width * BEAKER_LEFT;
    const bRight = width * BEAKER_RIGHT;
    const bTop = height * BEAKER_TOP;
    const bBottom = height * BEAKER_BOTTOM;
    const bw = bRight - bLeft;
    const bh = bBottom - bTop;

    // Solution
    const liquidLevel = bTop + bh * 0.08;
    const solutionColor = pHToColor(pH);
    const solGrad = ctx.createLinearGradient(0, liquidLevel, 0, bBottom);
    solGrad.addColorStop(0, solutionColor + "90");
    solGrad.addColorStop(1, solutionColor + "c0");
    ctx.fillStyle = solGrad;
    ctx.fillRect(bLeft + 3, liquidLevel, bw - 6, bBottom - liquidLevel);

    // Indicator overlay
    if (showIndicator >= 1) {
      ctx.fillStyle = indicatorColor(pH);
      ctx.fillRect(bLeft + 3, liquidLevel, bw - 6, bBottom - liquidLevel);
    }

    // Beaker outline (glass)
    ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bLeft, bTop);
    ctx.lineTo(bLeft, bBottom);
    ctx.lineTo(bRight, bBottom);
    ctx.lineTo(bRight, bTop);
    ctx.stroke();

    // Beaker lip
    ctx.beginPath();
    ctx.moveTo(bLeft - 5, bTop);
    ctx.lineTo(bLeft + 8, bTop);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bRight - 8, bTop);
    ctx.lineTo(bRight + 5, bTop);
    ctx.stroke();

    // Graduation marks
    ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
    ctx.lineWidth = 1;
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "left";
    for (let i = 1; i <= 4; i++) {
      const y = bBottom - (i / 5) * bh;
      ctx.beginPath();
      ctx.moveTo(bLeft + 3, y);
      ctx.lineTo(bLeft + 15, y);
      ctx.stroke();
      ctx.fillText(`${i * 20}mL`, bLeft + 18, y + 3);
    }

    // Label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(acidType === 1 ? "HCl (aq)" : "H₂SO₄ (aq)", (bLeft + bRight) / 2, bBottom + 18);
  }

  function drawBurette(): void {
    const bx = width * 0.42;
    const by = height * 0.03;
    const bw = 18;
    const bh = height * 0.2;

    // Burette body
    ctx.fillStyle = "rgba(148, 163, 184, 0.15)";
    ctx.fillRect(bx - bw / 2, by, bw, bh);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx - bw / 2, by, bw, bh);

    // NaOH solution level
    const level = (1 - baseVolume / 100) * bh;
    ctx.fillStyle = "rgba(59, 130, 246, 0.4)";
    ctx.fillRect(bx - bw / 2 + 1, by + level, bw - 2, bh - level);

    // Drip
    const beakerTop = height * BEAKER_TOP;
    ctx.strokeStyle = "rgba(59, 130, 246, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, by + bh);
    ctx.lineTo(bx, beakerTop + 5);
    ctx.stroke();

    // Drops animation
    if (baseVolume > 0) {
      const dropY = (by + bh) + (time * 100 % (beakerTop - by - bh));
      if (dropY < beakerTop) {
        ctx.beginPath();
        ctx.ellipse(bx, dropY, 3, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#3b82f6";
        ctx.fill();
      }
    }

    // Label
    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NaOH", bx, by - 5);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillText(`${baseVolume.toFixed(0)} mL added`, bx, by + bh + 15);
  }

  function drawIons(): void {
    for (const ion of ions) {
      ctx.globalAlpha = ion.alpha;
      ctx.beginPath();
      ctx.arc(ion.x, ion.y, ion.size, 0, Math.PI * 2);

      switch (ion.type) {
        case "H+":
          ctx.fillStyle = "#ef4444";
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 7px system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("H⁺", ion.x, ion.y);
          break;
        case "OH-":
          ctx.fillStyle = "#3b82f6";
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 6px system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("OH⁻", ion.x, ion.y);
          break;
        case "H2O":
          ctx.fillStyle = "rgba(147, 197, 253, 0.5)";
          ctx.fill();
          break;
        default:
          ctx.fillStyle = "#94a3b8";
          ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawPHScale(): void {
    const scaleX = width * 0.68;
    const scaleY = height * 0.25;
    const scaleW = width * 0.25;
    const scaleH = 20;

    // pH gradient bar
    for (let i = 0; i <= 14; i++) {
      const x = scaleX + (i / 14) * scaleW;
      const w = scaleW / 14;
      ctx.fillStyle = pHToColor(i);
      ctx.fillRect(x, scaleY, w, scaleH);
    }

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(scaleX, scaleY, scaleW, scaleH);

    // Scale numbers
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#94a3b8";
    for (let i = 0; i <= 14; i += 2) {
      const x = scaleX + (i / 14) * scaleW;
      ctx.fillText(i.toString(), x, scaleY + scaleH + 12);
    }

    // Current pH pointer
    const ptrX = scaleX + (pH / 14) * scaleW;
    ctx.beginPath();
    ctx.moveTo(ptrX, scaleY - 2);
    ctx.lineTo(ptrX - 5, scaleY - 10);
    ctx.lineTo(ptrX + 5, scaleY - 10);
    ctx.closePath();
    ctx.fillStyle = "#fbbf24";
    ctx.fill();

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText(`pH = ${pH.toFixed(2)}`, ptrX, scaleY - 15);

    // Labels
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#ef4444";
    ctx.textAlign = "left";
    ctx.fillText("Acidic", scaleX, scaleY + scaleH + 28);
    ctx.fillStyle = "#22c55e";
    ctx.textAlign = "center";
    ctx.fillText("Neutral", scaleX + scaleW / 2, scaleY + scaleH + 28);
    ctx.fillStyle = "#3b82f6";
    ctx.textAlign = "right";
    ctx.fillText("Basic", scaleX + scaleW, scaleY + scaleH + 28);
  }

  function drawTitrationCurve(): void {
    const gx = width * 0.65;
    const gy = height * 0.48;
    const gw = width * 0.3;
    const gh = height * 0.35;

    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 6);
    ctx.fill();

    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Titration Curve", gx + gw / 2, gy + 16);

    const plotLeft = gx + 35;
    const plotRight = gx + gw - 10;
    const plotTop = gy + 25;
    const plotBottom = gy + gh - 20;
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - plotTop;

    // Axes
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotTop);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Base Volume (mL)", gx + gw / 2, plotBottom + 15);
    ctx.save();
    ctx.translate(gx + 12, gy + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("pH", 0, 0);
    ctx.restore();

    // Draw titration curve
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let first = true;
    for (let v = 0; v <= 100; v++) {
      const mAcid = acidConcentration * 0.1;
      const mBase = (acidConcentration * v) / 100;
      let phVal: number;
      if (mBase < mAcid) {
        const excess = mAcid - mBase;
        phVal = -Math.log10(Math.max(excess / 0.1, 1e-14));
      } else if (mBase > mAcid) {
        const excess = mBase - mAcid;
        phVal = 14 + Math.log10(Math.max(excess / 0.1, 1e-14));
      } else {
        phVal = 7;
      }
      phVal = Math.max(0, Math.min(14, phVal));

      const px = plotLeft + (v / 100) * plotW;
      const py = plotBottom - (phVal / 14) * plotH;
      if (first) { ctx.moveTo(px, py); first = false; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Current point
    const cpx = plotLeft + (baseVolume / 100) * plotW;
    const cpy = plotBottom - (pH / 14) * plotH;
    ctx.beginPath();
    ctx.arc(cpx, cpy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Equivalence point line
    const eqVol = 50; // at half of max
    const eqX = plotLeft + (eqVol / 100) * plotW;
    ctx.strokeStyle = "rgba(251, 191, 36, 0.3)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(eqX, plotTop);
    ctx.lineTo(eqX, plotBottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#fbbf24";
    ctx.font = "8px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Equivalence", eqX, plotTop - 3);
  }

  function render(): void {
    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Neutralization Reaction — Acid-Base Titration", width / 2, 28);

    drawBeaker();
    drawBurette();
    drawIons();
    drawPHScale();
    drawTitrationCurve();

    // Equation
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("HCl + NaOH → NaCl + H₂O", width * 0.4, height * 0.82);
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("(strong acid + strong base → salt + water)", width * 0.4, height * 0.86);

    // Temperature
    ctx.fillStyle = temperature > 30 ? "#ef4444" : "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`T = ${temperature.toFixed(1)}°C (ΔH = −57.1 kJ/mol)`, width * 0.4, height * 0.9);
  }

  function reset(): void {
    time = 0;
    ions = [];
    computeChemistry();
  }

  function destroy(): void {
    ions = [];
  }

  function getStateDescription(): string {
    return (
      `Neutralization Reaction: ${acidConcentration} M HCl with NaOH. ` +
      `Base added: ${baseVolume.toFixed(0)} mL. pH = ${pH.toFixed(2)}. ` +
      `Temperature: ${temperature.toFixed(1)}°C. ` +
      `[H⁺] = ${hPlusConc.toExponential(2)} M, [OH⁻] = ${ohMinusConc.toExponential(2)} M. ` +
      `Water produced: ${waterProduced.toFixed(2)} mmol. ` +
      `Reaction: HCl + NaOH → NaCl + H₂O (exothermic, ΔH = -57.1 kJ/mol).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default NeutralizationReactionFactory;
