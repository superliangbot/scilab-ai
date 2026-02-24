import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Molecule types ─────────────────────────────────────────────────
interface Molecule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "paraffin" | "O2" | "CO2" | "H2O";
  alpha: number;
  life: number; // 0..1 for products fading in
}

// ─── Factory ────────────────────────────────────────────────────────
const ChemicalChangeOfCandleFactory: SimulationFactory = () => {
  const config = getSimConfig("chemical-change-of-candle") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let heatIntensity = 5;
  let showMolecules = 1;
  let speed = 1;
  let showEquation = 1;

  // Molecules
  let molecules: Molecule[] = [];

  // Flame flicker state
  let flickerPhase = 0;

  // Spawn timers
  let reactantTimer = 0;
  let productTimer = 0;

  const MAX_MOLECULES = 120;

  // ── Candle geometry helpers ──────────────────────────────────────
  function candleX(): number {
    return W / 2;
  }
  function candleTop(): number {
    return H * 0.52;
  }
  function candleBottom(): number {
    return H * 0.85;
  }
  function candleWidth(): number {
    return Math.min(60, W * 0.08);
  }

  // ── Molecule colors ────────────────────────────────────────────
  function moleculeColor(type: Molecule["type"]): string {
    switch (type) {
      case "paraffin":
        return "#7c8bb8"; // gray-blue
      case "O2":
        return "#ef4444"; // red
      case "CO2":
        return "#a0a0a0"; // gray
      case "H2O":
        return "#3b82f6"; // blue
    }
  }

  // ── Molecule rendering ─────────────────────────────────────────
  function drawMolecule(m: Molecule): void {
    const a = m.alpha;
    if (a <= 0) return;

    ctx.globalAlpha = a;

    switch (m.type) {
      case "paraffin": {
        // Draw as a small chain of gray/blue circles (simplified C25H52)
        const segLen = 4;
        const numSegs = 5;
        ctx.strokeStyle = "#5a6a90";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < numSegs; i++) {
          const sx = m.x - (numSegs * segLen) / 2 + i * segLen;
          const sy = m.y + (i % 2 === 0 ? -2 : 2);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        for (let i = 0; i < numSegs; i++) {
          const sx = m.x - (numSegs * segLen) / 2 + i * segLen;
          const sy = m.y + (i % 2 === 0 ? -2 : 2);
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fillStyle = i % 3 === 0 ? "#94a3b8" : "#7c8bb8";
          ctx.fill();
        }
        break;
      }
      case "O2": {
        // Two red circles bonded
        ctx.beginPath();
        ctx.arc(m.x - 5, m.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
        ctx.strokeStyle = "#b91c1c";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(m.x + 5, m.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
        ctx.strokeStyle = "#b91c1c";
        ctx.lineWidth = 1;
        ctx.stroke();
        // Bond line
        ctx.beginPath();
        ctx.moveTo(m.x - 2, m.y - 1);
        ctx.lineTo(m.x + 2, m.y - 1);
        ctx.moveTo(m.x - 2, m.y + 1);
        ctx.lineTo(m.x + 2, m.y + 1);
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      }
      case "CO2": {
        // Gray center (C) + two red (O) on sides
        ctx.beginPath();
        ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#9ca3af";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(m.x - 9, m.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(m.x + 9, m.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
        // Bonds
        ctx.beginPath();
        ctx.moveTo(m.x - 4, m.y);
        ctx.lineTo(m.x - 5, m.y);
        ctx.moveTo(m.x + 4, m.y);
        ctx.lineTo(m.x + 5, m.y);
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;
      }
      case "H2O": {
        // Bent molecule: red O center, two small blue H
        const angle = Math.PI * 0.29; // ~104.5 degrees total
        ctx.beginPath();
        ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
        const hx1 = m.x + Math.cos(-angle) * 9;
        const hy1 = m.y + Math.sin(-angle) * 9;
        const hx2 = m.x + Math.cos(angle) * 9;
        const hy2 = m.y + Math.sin(angle) * 9;
        ctx.beginPath();
        ctx.arc(hx1, hy1, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#60a5fa";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(hx2, hy2, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#60a5fa";
        ctx.fill();
        // Bonds
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(hx1, hy1);
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(hx2, hy2);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      }
    }

    ctx.globalAlpha = 1;
  }

  // ── Init molecules ─────────────────────────────────────────────
  function initMolecules(): void {
    molecules = [];
    // Seed some initial O2 molecules around the candle
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 100 + Math.random() * 120;
      molecules.push({
        x: candleX() + Math.cos(angle) * dist,
        y: candleTop() - 30 + Math.sin(angle) * dist * 0.6,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        type: "O2",
        alpha: 0.85,
        life: 1,
      });
    }
    // Seed a few paraffin molecules near the wick
    for (let i = 0; i < 4; i++) {
      molecules.push({
        x: candleX() + (Math.random() - 0.5) * 30,
        y: candleTop() + 5 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 10,
        type: "paraffin",
        alpha: 0.8,
        life: 1,
      });
    }
  }

  // ── Engine ────────────────────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
      flickerPhase = 0;
      reactantTimer = 0;
      productTimer = 0;
      initMolecules();
    },

    update(dt: number, params: Record<string, number>) {
      heatIntensity = params.heatIntensity ?? 5;
      showMolecules = Math.round(params.showMolecules ?? 1);
      speed = params.speed ?? 1;
      showEquation = Math.round(params.showEquation ?? 1);

      const dtClamped = Math.min(dt, 0.05) * speed;
      time += dtClamped;
      flickerPhase += dtClamped * 12;

      const intensityFactor = heatIntensity / 5; // normalized around 1
      const thermalSpeed = 30 * intensityFactor;

      // Spawn O2 molecules approaching the flame
      reactantTimer += dtClamped;
      const spawnInterval = 0.4 / intensityFactor;
      if (reactantTimer > spawnInterval && molecules.length < MAX_MOLECULES) {
        reactantTimer = 0;

        // O2 from random side
        const side = Math.random() < 0.5 ? -1 : 1;
        const spawnX = candleX() + side * (120 + Math.random() * 80);
        const spawnY = candleTop() - 60 + Math.random() * 80;
        molecules.push({
          x: spawnX,
          y: spawnY,
          vx: -side * (15 + Math.random() * 15) * intensityFactor,
          vy: (Math.random() - 0.5) * 10,
          type: "O2",
          alpha: 0.85,
          life: 1,
        });

        // Paraffin from the wick area
        if (Math.random() < 0.5) {
          molecules.push({
            x: candleX() + (Math.random() - 0.5) * 20,
            y: candleTop() + Math.random() * 10,
            vx: (Math.random() - 0.5) * 10,
            vy: -(5 + Math.random() * 10) * intensityFactor,
            type: "paraffin",
            alpha: 0.8,
            life: 1,
          });
        }
      }

      // Spawn products from the flame tip
      productTimer += dtClamped;
      const productInterval = 0.25 / intensityFactor;
      if (productTimer > productInterval && molecules.length < MAX_MOLECULES) {
        productTimer = 0;

        const flameTopY = candleTop() - 30 - heatIntensity * 5;

        // CO2 rising
        molecules.push({
          x: candleX() + (Math.random() - 0.5) * 20,
          y: flameTopY + Math.random() * 15,
          vx: (Math.random() - 0.5) * 15,
          vy: -(20 + Math.random() * 25) * intensityFactor,
          type: "CO2",
          alpha: 0,
          life: 0,
        });

        // H2O rising
        molecules.push({
          x: candleX() + (Math.random() - 0.5) * 25,
          y: flameTopY + Math.random() * 15,
          vx: (Math.random() - 0.5) * 15,
          vy: -(18 + Math.random() * 22) * intensityFactor,
          type: "H2O",
          alpha: 0,
          life: 0,
        });
      }

      // Update all molecules
      const flameZoneX = candleX();
      const flameZoneY = candleTop() - 20;
      const flameRadius = 25 + heatIntensity * 3;

      for (let i = molecules.length - 1; i >= 0; i--) {
        const m = molecules[i];

        // Products fade in
        if (m.type === "CO2" || m.type === "H2O") {
          m.life = Math.min(1, m.life + dtClamped * 3);
          m.alpha = Math.min(0.85, m.life);
          // Products rise and eventually fade out at top
          m.vy -= dtClamped * 5 * intensityFactor; // buoyancy
          if (m.y < 20) {
            m.alpha -= dtClamped * 2;
          }
        }

        // Reactants: O2 molecules drift toward flame
        if (m.type === "O2") {
          const dx = flameZoneX - m.x;
          const dy = flameZoneY - m.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 10) {
            m.vx += (dx / dist) * dtClamped * 15 * intensityFactor;
            m.vy += (dy / dist) * dtClamped * 15 * intensityFactor;
          }
          // Consume O2 near flame
          if (dist < flameRadius) {
            m.alpha -= dtClamped * 4;
          }
        }

        // Paraffin: drawn upward toward flame
        if (m.type === "paraffin") {
          m.vy -= dtClamped * 20 * intensityFactor;
          const dx = flameZoneX - m.x;
          const dy = flameZoneY - m.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < flameRadius) {
            m.alpha -= dtClamped * 5;
          }
        }

        // Thermal jitter
        m.vx += (Math.random() - 0.5) * thermalSpeed * dtClamped;
        m.vy += (Math.random() - 0.5) * thermalSpeed * dtClamped;

        // Damping
        m.vx *= 0.995;
        m.vy *= 0.995;

        // Position update
        m.x += m.vx * dtClamped;
        m.y += m.vy * dtClamped;

        // Boundary wrapping
        if (m.x < -30) m.x = W + 20;
        if (m.x > W + 30) m.x = -20;
        if (m.y > H + 20) m.y = H + 20;

        // Remove dead molecules
        if (m.alpha <= 0 || m.y < -40) {
          molecules.splice(i, 1);
        }
      }
    },

    render() {
      if (!ctx) return;

      // ── Background ──────────────────────────────────
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0a0a1a");
      bgGrad.addColorStop(1, "#10102a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // ── Title ───────────────────────────────────────
      ctx.font = "bold 17px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Chemical Change of a Candle", W / 2, 28);

      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        "Paraffin wax combustion: hydrocarbon + oxygen \u2192 carbon dioxide + water",
        W / 2,
        46
      );

      const cx = candleX();
      const ct = candleTop();
      const cb = candleBottom();
      const cw = candleWidth();
      const intensityFactor = heatIntensity / 5;

      // ── Candle body ─────────────────────────────────
      // Wax body gradient
      const waxGrad = ctx.createLinearGradient(cx - cw, ct, cx + cw, ct);
      waxGrad.addColorStop(0, "#d4c5a0");
      waxGrad.addColorStop(0.3, "#f5e6c8");
      waxGrad.addColorStop(0.7, "#f5e6c8");
      waxGrad.addColorStop(1, "#c4b590");
      ctx.fillStyle = waxGrad;

      // Rounded rectangle for candle body
      ctx.beginPath();
      ctx.moveTo(cx - cw, ct + 5);
      ctx.quadraticCurveTo(cx - cw, ct, cx - cw + 5, ct);
      ctx.lineTo(cx + cw - 5, ct);
      ctx.quadraticCurveTo(cx + cw, ct, cx + cw, ct + 5);
      ctx.lineTo(cx + cw, cb);
      ctx.lineTo(cx - cw, cb);
      ctx.closePath();
      ctx.fill();

      // Candle top ellipse (melted wax pool)
      ctx.beginPath();
      ctx.ellipse(cx, ct, cw, 8, 0, 0, Math.PI * 2);
      const poolGrad = ctx.createRadialGradient(cx, ct, 0, cx, ct, cw);
      poolGrad.addColorStop(0, "#e8d5a8");
      poolGrad.addColorStop(0.6, "#dcc898");
      poolGrad.addColorStop(1, "#c4b590");
      ctx.fillStyle = poolGrad;
      ctx.fill();

      // Melted pool near wick
      ctx.beginPath();
      ctx.ellipse(cx, ct, cw * 0.35, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(210, 180, 120, 0.7)";
      ctx.fill();

      // ── Wick ────────────────────────────────────────
      const wickTop = ct - 15;
      ctx.beginPath();
      ctx.moveTo(cx - 1, ct - 2);
      ctx.lineTo(cx, wickTop);
      ctx.lineTo(cx + 1, ct - 2);
      ctx.strokeStyle = "#3a3a3a";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Wick glow (ember at tip)
      ctx.beginPath();
      ctx.arc(cx, wickTop, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ff6b2b";
      ctx.fill();

      // ── Flame ───────────────────────────────────────
      const flameHeight = 30 + heatIntensity * 6;
      const flameWidth = 8 + heatIntensity * 1.5;
      const flameBaseY = wickTop;
      const flameTipY = flameBaseY - flameHeight;

      // Outer flame (orange/yellow)
      const flicker1 = Math.sin(flickerPhase) * 2;
      const flicker2 = Math.sin(flickerPhase * 1.3 + 1) * 1.5;

      // Outer glow
      const outerGlow = ctx.createRadialGradient(
        cx, flameBaseY - flameHeight * 0.4, 0,
        cx, flameBaseY - flameHeight * 0.3, flameHeight * 0.9
      );
      outerGlow.addColorStop(0, `rgba(255, 200, 50, ${0.15 * intensityFactor})`);
      outerGlow.addColorStop(1, "rgba(255, 100, 0, 0)");
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(cx, flameBaseY - flameHeight * 0.4, flameHeight * 0.9, 0, Math.PI * 2);
      ctx.fill();

      // Outer flame shape
      ctx.beginPath();
      ctx.moveTo(cx, flameTipY + flicker1);
      ctx.bezierCurveTo(
        cx - flameWidth * 0.6, flameTipY + flameHeight * 0.3 + flicker2,
        cx - flameWidth * 1.2, flameBaseY - 5,
        cx, flameBaseY
      );
      ctx.bezierCurveTo(
        cx + flameWidth * 1.2, flameBaseY - 5,
        cx + flameWidth * 0.6, flameTipY + flameHeight * 0.3 - flicker2,
        cx, flameTipY + flicker1
      );
      const outerFlameGrad = ctx.createLinearGradient(0, flameTipY, 0, flameBaseY);
      outerFlameGrad.addColorStop(0, `rgba(255, 180, 30, ${0.8 * intensityFactor})`);
      outerFlameGrad.addColorStop(0.4, `rgba(255, 130, 20, ${0.85 * intensityFactor})`);
      outerFlameGrad.addColorStop(0.8, `rgba(255, 80, 10, ${0.6 * intensityFactor})`);
      outerFlameGrad.addColorStop(1, "rgba(255, 50, 0, 0.1)");
      ctx.fillStyle = outerFlameGrad;
      ctx.fill();

      // Inner flame (blue-white core)
      const innerH = flameHeight * 0.45;
      const innerW = flameWidth * 0.5;
      const innerFlicker = Math.sin(flickerPhase * 1.7) * 1;
      ctx.beginPath();
      ctx.moveTo(cx, flameBaseY - innerH + innerFlicker);
      ctx.bezierCurveTo(
        cx - innerW * 0.5, flameBaseY - innerH * 0.5,
        cx - innerW, flameBaseY - 3,
        cx, flameBaseY
      );
      ctx.bezierCurveTo(
        cx + innerW, flameBaseY - 3,
        cx + innerW * 0.5, flameBaseY - innerH * 0.5,
        cx, flameBaseY - innerH + innerFlicker
      );
      const innerFlameGrad = ctx.createLinearGradient(0, flameBaseY - innerH, 0, flameBaseY);
      innerFlameGrad.addColorStop(0, `rgba(100, 150, 255, ${0.7 * intensityFactor})`);
      innerFlameGrad.addColorStop(0.5, `rgba(200, 220, 255, ${0.8 * intensityFactor})`);
      innerFlameGrad.addColorStop(1, "rgba(255, 255, 200, 0.3)");
      ctx.fillStyle = innerFlameGrad;
      ctx.fill();

      // ── Molecules ───────────────────────────────────
      if (showMolecules) {
        for (const m of molecules) {
          drawMolecule(m);
        }

        // Legend
        const legendX = 20;
        const legendY = H * 0.12;
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.beginPath();
        ctx.roundRect(legendX - 5, legendY - 15, 155, 95, 6);
        ctx.fill();
        ctx.strokeStyle = "rgba(100, 150, 200, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#e2e8f0";
        ctx.textAlign = "left";
        ctx.fillText("Molecules", legendX + 3, legendY);

        const legendItems: Array<{ color: string; label: string }> = [
          { color: "#7c8bb8", label: "Paraffin (C\u2082\u2085H\u2085\u2082)" },
          { color: "#ef4444", label: "O\u2082 (Oxygen)" },
          { color: "#9ca3af", label: "CO\u2082 (Carbon dioxide)" },
          { color: "#3b82f6", label: "H\u2082O (Water vapor)" },
        ];

        ctx.font = "10px 'Inter', system-ui, sans-serif";
        for (let i = 0; i < legendItems.length; i++) {
          const item = legendItems[i];
          const ly = legendY + 15 + i * 17;
          ctx.beginPath();
          ctx.arc(legendX + 8, ly - 3, 5, 0, Math.PI * 2);
          ctx.fillStyle = item.color;
          ctx.fill();
          ctx.fillStyle = "#cbd5e1";
          ctx.fillText(item.label, legendX + 18, ly);
        }
      }

      // ── Balanced equation ───────────────────────────
      if (showEquation) {
        const eqY = H - 55;
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.beginPath();
        ctx.roundRect(W * 0.05, eqY - 18, W * 0.9, 50, 8);
        ctx.fill();
        ctx.strokeStyle = "rgba(100, 150, 200, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "center";
        ctx.fillText("Balanced Equation:", W / 2, eqY);

        ctx.font = "bold 15px 'SF Mono', 'Fira Code', monospace";
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText(
          "C\u2082\u2085H\u2085\u2082 + 38O\u2082 \u2192 25CO\u2082 + 26H\u2082O",
          W / 2,
          eqY + 22
        );
      }

      // ── Info panel ──────────────────────────────────
      const infoX = W - 175;
      const infoY = H * 0.12;
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.beginPath();
      ctx.roundRect(infoX - 5, infoY - 15, 165, 85, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(100, 150, 200, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Combustion Info", infoX + 3, infoY);

      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Flame intensity: ${heatIntensity}/10`, infoX + 3, infoY + 16);
      ctx.fillText(`Fuel: Paraffin wax (C\u2082\u2085H\u2085\u2082)`, infoX + 3, infoY + 32);
      ctx.fillText(`Reaction: Exothermic`, infoX + 3, infoY + 48);
      ctx.fillText(`\u0394H \u2248 \u221215,000 kJ/mol`, infoX + 3, infoY + 64);

      // ── Reactant/product arrows ─────────────────────
      // O2 arrows pointing toward flame
      ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      for (const side of [-1, 1]) {
        const ax = cx + side * (cw + 60);
        const ay = ct - 30;
        ctx.beginPath();
        ctx.moveTo(ax + side * 30, ay);
        ctx.lineTo(ax, ay);
        ctx.stroke();
        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + side * 6, ay - 4);
        ctx.lineTo(ax + side * 6, ay + 4);
        ctx.closePath();
        ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
        ctx.fill();
      }
      ctx.setLineDash([]);

      // Product arrow rising
      ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      const arrowX = cx;
      const arrowBottomY = ct - flameHeight - 15;
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowBottomY);
      ctx.lineTo(arrowX, arrowBottomY - 30);
      ctx.stroke();
      ctx.setLineDash([]);
      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowBottomY - 34);
      ctx.lineTo(arrowX - 4, arrowBottomY - 26);
      ctx.lineTo(arrowX + 4, arrowBottomY - 26);
      ctx.closePath();
      ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
      ctx.fill();

      // Labels near arrows
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(239, 68, 68, 0.7)";
      ctx.fillText("O\u2082", cx - cw - 70, ct - 40);
      ctx.fillText("O\u2082", cx + cw + 70, ct - 40);
      ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
      ctx.fillText("CO\u2082 + H\u2082O", arrowX, arrowBottomY - 40);

      // Time
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`t = ${time.toFixed(1)}s`, 12, H - 8);
    },

    reset() {
      time = 0;
      flickerPhase = 0;
      reactantTimer = 0;
      productTimer = 0;
      initMolecules();
    },

    destroy() {
      molecules = [];
    },

    getStateDescription(): string {
      const numO2 = molecules.filter((m) => m.type === "O2").length;
      const numParaffin = molecules.filter((m) => m.type === "paraffin").length;
      const numCO2 = molecules.filter((m) => m.type === "CO2").length;
      const numH2O = molecules.filter((m) => m.type === "H2O").length;
      return (
        `Chemical Change of Candle simulation. ` +
        `Paraffin wax (C\u2082\u2085H\u2085\u2082) combustion with O\u2082. ` +
        `Flame intensity: ${heatIntensity}/10, speed: ${speed}x. ` +
        `Active molecules: ${numParaffin} paraffin, ${numO2} O\u2082 (reactants), ` +
        `${numCO2} CO\u2082, ${numH2O} H\u2082O (products). ` +
        `Balanced equation: C\u2082\u2085H\u2085\u2082 + 38O\u2082 \u2192 25CO\u2082 + 26H\u2082O. ` +
        `The reaction is highly exothermic (\u0394H \u2248 \u221215,000 kJ/mol). ` +
        `Time: ${time.toFixed(1)}s.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default ChemicalChangeOfCandleFactory;
