import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface ChargeParticle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  side: number; // 0 = left plate (+), 1 = right plate (-)
  alpha: number;
}

interface WireCharge {
  t: number;
  speed: number;
}

const Capacitor2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("capacitor-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let plateArea = 5;
  let gapDistance = 5;
  let voltage = 12;
  let mode = 0; // 0 = charge, 1 = discharge

  // Physics state
  let chargeLevel = 0; // 0 to 1 normalized charge
  let currentFlow = 0; // normalized 0 to 1

  // RC-like time constant for animation (not real units, just for smooth animation)
  const TAU_BASE = 1.5; // seconds for animation feel

  // Animated charges on plates
  let plateCharges: ChargeParticle[] = [];
  let wireCharges: WireCharge[] = [];

  // Layout cache
  let prevMode = -1;

  function initWireCharges(): void {
    wireCharges = [];
    for (let i = 0; i < 24; i++) {
      wireCharges.push({ t: i / 24, speed: 0 });
    }
  }

  function getPlateLayout(): {
    leftX: number;
    rightX: number;
    topY: number;
    plateH: number;
    plateW: number;
  } {
    const centerX = width * 0.5;
    const gap = 30 + gapDistance * 8;
    const halfGap = gap / 2;
    const plateH = 60 + plateArea * 18;
    const plateW = 8;
    const topY = height * 0.25;
    return {
      leftX: centerX - halfGap,
      rightX: centerX + halfGap,
      topY,
      plateH,
      plateW,
    };
  }

  function updateCharges(dt: number): void {
    const layout = getPlateLayout();
    const targetCount = Math.floor(chargeLevel * 30);

    // Add/remove plate charges
    while (plateCharges.length < targetCount * 2) {
      const side = plateCharges.length % 2;
      const baseX = side === 0
        ? layout.leftX + layout.plateW * 0.5
        : layout.rightX - layout.plateW * 0.5;

      const yPos = layout.topY + Math.random() * layout.plateH;
      const xOffset = (Math.random() - 0.5) * layout.plateW * 1.5;

      plateCharges.push({
        x: baseX + xOffset,
        y: yPos,
        targetX: baseX + xOffset,
        targetY: yPos,
        side,
        alpha: 0,
      });
    }
    while (plateCharges.length > targetCount * 2 && plateCharges.length > 0) {
      plateCharges.pop();
    }

    // Animate alpha and jitter
    for (const ch of plateCharges) {
      ch.alpha = Math.min(1, ch.alpha + dt * 3);
      ch.x += (Math.random() - 0.5) * 0.4;
      ch.y += (Math.random() - 0.5) * 0.4;
    }

    // Move wire charges
    for (const wc of wireCharges) {
      wc.speed = currentFlow;
      const direction = mode === 0 ? 1 : -1;
      wc.t += direction * currentFlow * dt * 0.35;
      if (wc.t > 1) wc.t -= 1;
      if (wc.t < 0) wc.t += 1;
    }
  }

  function getWirePoint(t: number): { x: number; y: number } {
    const layout = getPlateLayout();
    const battX = width * 0.12;
    const battY = height * 0.5;
    const topY = height * 0.18;
    const bottomY = height * 0.82;
    const bulbX = width * 0.88;

    // Circuit path segments
    if (t < 0.1) {
      const f = t / 0.1;
      return { x: battX, y: battY - 30 - f * (battY - 30 - topY) };
    }
    if (t < 0.25) {
      const f = (t - 0.1) / 0.15;
      return { x: battX + f * (layout.leftX - battX), y: topY };
    }
    if (t < 0.35) {
      const f = (t - 0.25) / 0.1;
      return { x: layout.leftX, y: topY + f * (layout.topY - topY) };
    }
    // Gap skip
    if (t < 0.45) {
      const f = (t - 0.35) / 0.1;
      return { x: layout.rightX, y: layout.topY + layout.plateH - f * (layout.topY + layout.plateH - topY) };
    }
    if (t < 0.6) {
      const f = (t - 0.45) / 0.15;
      return { x: layout.rightX + f * (bulbX - layout.rightX), y: topY };
    }
    if (t < 0.75) {
      const f = (t - 0.6) / 0.15;
      return { x: bulbX, y: topY + f * (bottomY - topY) };
    }
    if (t < 0.9) {
      const f = (t - 0.75) / 0.15;
      return { x: bulbX - f * (bulbX - battX), y: bottomY };
    }
    const f = (t - 0.9) / 0.1;
    return { x: battX, y: bottomY - f * (bottomY - battY - 30) };
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawBattery(): void {
    const x = width * 0.12;
    const y = height * 0.5;
    const bw = 34;
    const bh = 56;

    // Battery body
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Positive terminal
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(x - 14, y - bh / 2 - 6, 28, 6);
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("+", x, y - bh / 2 - 8);

    // Negative terminal
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(x - 10, y + bh / 2, 20, 6);
    ctx.textBaseline = "top";
    ctx.fillText("-", x, y + bh / 2 + 6);

    // Voltage label
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(`${voltage}V`, x, y);

    // Connection status
    if (mode === 0) {
      ctx.fillStyle = "rgba(52, 211, 153, 0.8)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText("CONNECTED", x, y + bh / 2 + 24);
    } else {
      ctx.fillStyle = "rgba(156, 163, 175, 0.5)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText("DISCONNECTED", x, y + bh / 2 + 24);
    }
  }

  function drawCapacitorPlates(): void {
    const layout = getPlateLayout();
    const fieldStrength = chargeLevel;

    // Electric field lines between plates
    if (fieldStrength > 0.05) {
      const numFieldLines = Math.floor(6 + plateArea * 0.8);
      for (let i = 0; i < numFieldLines; i++) {
        const fy = layout.topY + (i + 0.5) * layout.plateH / numFieldLines;
        ctx.strokeStyle = `rgba(100, 200, 255, ${fieldStrength * 0.18})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(layout.leftX + layout.plateW + 4, fy);
        ctx.lineTo(layout.rightX - layout.plateW - 4, fy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrow in center
        const arrowX = (layout.leftX + layout.rightX) / 2;
        ctx.fillStyle = `rgba(100, 200, 255, ${fieldStrength * 0.35})`;
        ctx.beginPath();
        ctx.moveTo(arrowX + 5, fy);
        ctx.lineTo(arrowX - 3, fy - 3);
        ctx.lineTo(arrowX - 3, fy + 3);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Left plate (positive)
    const leftAlpha = 0.4 + fieldStrength * 0.6;
    ctx.fillStyle = `rgba(239, 68, 68, ${leftAlpha})`;
    ctx.fillRect(layout.leftX - layout.plateW / 2, layout.topY, layout.plateW, layout.plateH);

    // Left plate glow
    const leftGlow = ctx.createRadialGradient(
      layout.leftX, layout.topY + layout.plateH / 2, 0,
      layout.leftX, layout.topY + layout.plateH / 2, layout.plateH * 0.35
    );
    leftGlow.addColorStop(0, `rgba(239, 68, 68, ${fieldStrength * 0.15})`);
    leftGlow.addColorStop(1, "rgba(239, 68, 68, 0)");
    ctx.fillStyle = leftGlow;
    ctx.fillRect(
      layout.leftX - layout.plateH * 0.35, layout.topY - 10,
      layout.plateH * 0.7, layout.plateH + 20
    );

    // Right plate (negative)
    const rightAlpha = 0.4 + fieldStrength * 0.6;
    ctx.fillStyle = `rgba(59, 130, 246, ${rightAlpha})`;
    ctx.fillRect(layout.rightX - layout.plateW / 2, layout.topY, layout.plateW, layout.plateH);

    // Right plate glow
    const rightGlow = ctx.createRadialGradient(
      layout.rightX, layout.topY + layout.plateH / 2, 0,
      layout.rightX, layout.topY + layout.plateH / 2, layout.plateH * 0.35
    );
    rightGlow.addColorStop(0, `rgba(59, 130, 246, ${fieldStrength * 0.15})`);
    rightGlow.addColorStop(1, "rgba(59, 130, 246, 0)");
    ctx.fillStyle = rightGlow;
    ctx.fillRect(
      layout.rightX - layout.plateH * 0.35, layout.topY - 10,
      layout.plateH * 0.7, layout.plateH + 20
    );

    // Plate charge symbols (+ and -)
    for (const ch of plateCharges) {
      const symbol = ch.side === 0 ? "+" : "\u2212";
      const color = ch.side === 0
        ? `rgba(255, 120, 120, ${ch.alpha})`
        : `rgba(120, 160, 255, ${ch.alpha})`;
      ctx.fillStyle = color;
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(symbol, ch.x, ch.y);
    }

    // Labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("+ Plate", layout.leftX, layout.topY + layout.plateH + 8);
    ctx.fillText("\u2212 Plate", layout.rightX, layout.topY + layout.plateH + 8);

    // Gap label
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "10px system-ui, sans-serif";
    const gapCenter = (layout.leftX + layout.rightX) / 2;
    ctx.fillText(`d = ${gapDistance}`, gapCenter, layout.topY - 14);

    // Area label
    ctx.fillText(`A = ${plateArea}`, gapCenter, layout.topY + layout.plateH + 24);
  }

  function drawLightBulb(): void {
    const x = width * 0.88;
    const y = height * 0.5;
    const r = 20;

    // Brightness proportional to current (mainly visible during discharge)
    const brightness = mode === 1 ? Math.pow(currentFlow, 1.5) : currentFlow * 0.3;

    // Glow effect
    if (brightness > 0.01) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      glow.addColorStop(0, `rgba(255, 240, 150, ${brightness * 0.5})`);
      glow.addColorStop(0.5, `rgba(255, 200, 50, ${brightness * 0.2})`);
      glow.addColorStop(1, "rgba(255, 200, 50, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bulb glass
    const bulbGrad = ctx.createRadialGradient(x, y - r * 0.2, 0, x, y, r);
    bulbGrad.addColorStop(0, `rgba(255, 255, ${Math.floor(200 + brightness * 55)}, ${0.3 + brightness * 0.7})`);
    bulbGrad.addColorStop(0.7, `rgba(200, 180, 100, ${0.2 + brightness * 0.3})`);
    bulbGrad.addColorStop(1, "rgba(100, 100, 80, 0.2)");
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = bulbGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Filament
    ctx.strokeStyle = `rgba(255, 200, 100, ${0.3 + brightness * 0.7})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 7, y + 5);
    ctx.lineTo(x - 3, y - 6);
    ctx.lineTo(x + 3, y + 5);
    ctx.lineTo(x + 7, y - 6);
    ctx.stroke();

    // Base
    ctx.fillStyle = "rgba(180, 180, 180, 0.4)";
    ctx.fillRect(x - 9, y + r, 18, 10);

    // Label
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Light Bulb", x, y + r + 16);
    if (mode === 1 && brightness > 0.1) {
      ctx.fillStyle = `rgba(255, 220, 100, ${brightness})`;
      ctx.fillText("ON", x, y + r + 30);
    }
  }

  function drawWires(): void {
    const layout = getPlateLayout();
    const battX = width * 0.12;
    const topY = height * 0.18;
    const bottomY = height * 0.82;
    const bulbX = width * 0.88;
    const battTopY = height * 0.5 - 28;
    const battBotY = height * 0.5 + 28;

    ctx.strokeStyle = "rgba(100, 116, 139, 0.6)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    // Top: battery -> left plate
    ctx.beginPath();
    ctx.moveTo(battX, battTopY);
    ctx.lineTo(battX, topY);
    ctx.lineTo(layout.leftX, topY);
    ctx.lineTo(layout.leftX, layout.topY);
    ctx.stroke();

    // Right plate -> bulb
    ctx.beginPath();
    ctx.moveTo(layout.rightX, layout.topY);
    ctx.lineTo(layout.rightX, topY);
    ctx.lineTo(bulbX, topY);
    ctx.lineTo(bulbX, height * 0.5 - 20);
    ctx.stroke();

    // Bulb -> bottom wire -> battery
    ctx.beginPath();
    ctx.moveTo(bulbX, height * 0.5 + 30);
    ctx.lineTo(bulbX, bottomY);
    ctx.lineTo(battX, bottomY);
    ctx.lineTo(battX, battBotY);
    ctx.stroke();

    // Switch indicator (on top wire near battery)
    const switchX = (battX + layout.leftX) / 2;
    if (mode === 0) {
      // Connected to battery (charging)
      ctx.fillStyle = "rgba(52, 211, 153, 0.8)";
      ctx.beginPath();
      ctx.arc(switchX, topY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("CHARGE", switchX, topY + 11);
    } else {
      // Disconnected from battery (discharging through bulb)
      ctx.fillStyle = "rgba(251, 146, 60, 0.8)";
      ctx.beginPath();
      ctx.arc(switchX, topY, 7, 0, Math.PI * 2);
      ctx.fill();

      // Draw break in wire
      ctx.strokeStyle = "#0a0a1a";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(switchX - 12, topY);
      ctx.lineTo(switchX + 12, topY);
      ctx.stroke();

      // Open switch arm
      ctx.strokeStyle = "rgba(251, 146, 60, 0.6)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(switchX - 10, topY);
      ctx.lineTo(switchX + 6, topY - 14);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("DISCHARGE", switchX, topY + 11);
    }

    // Animated wire charges
    for (const wc of wireCharges) {
      if (wc.speed < 0.01) continue;
      const pt = getWirePoint(wc.t);

      // In discharge mode, skip charges in the battery section
      if (mode === 1 && wc.t < 0.1) continue;
      if (mode === 1 && wc.t > 0.9) continue;

      ctx.fillStyle = `rgba(34, 211, 238, ${wc.speed * 0.7})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Glow
      ctx.fillStyle = `rgba(34, 211, 238, ${wc.speed * 0.2})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Current direction arrow
    if (currentFlow > 0.02) {
      ctx.fillStyle = `rgba(52, 211, 153, ${currentFlow * 0.8})`;
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const dir = mode === 0 ? "\u2192" : "\u2190";
      const arrowX = mode === 0 ? (battX + layout.leftX) / 2 : (layout.rightX + bulbX) / 2;
      ctx.fillText("I " + dir, arrowX, topY - 16);
    }
  }

  function drawInfoPanel(): void {
    const panelH = 56;
    const panelY = height - panelH - 8;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(8, panelY, width - 16, panelH, 6);
    ctx.fill();

    const fontSize = Math.max(10, Math.min(12, width / 55));
    ctx.font = `${fontSize}px 'SF Mono', 'Fira Code', monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const y1 = panelY + 16;
    const y2 = panelY + 38;

    const capVoltage = chargeLevel * voltage;
    // C = epsilon_0 * A / d (relative units)
    const capacitanceRel = plateArea / gapDistance;

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Plate Area: ${plateArea}`, 16, y1);
    ctx.fillText(`Gap: ${gapDistance}`, 16 + width * 0.2, y1);
    ctx.fillText(`V_cap = ${capVoltage.toFixed(1)}V`, 16 + width * 0.4, y1);

    ctx.fillText(`C \u221D A/d = ${capacitanceRel.toFixed(2)}`, 16, y2);
    ctx.fillText(`Charge: ${(chargeLevel * 100).toFixed(0)}%`, 16 + width * 0.25, y2);
    ctx.fillText(`E = \u00BDCV\u00B2`, 16 + width * 0.5, y2);

    // Mode label
    ctx.fillStyle = mode === 0 ? "rgba(52, 211, 153, 0.8)" : "rgba(251, 146, 60, 0.8)";
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(mode === 0 ? "CHARGING" : "DISCHARGING", width - 16, y1);

    // Formula
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = `${fontSize - 1}px system-ui, sans-serif`;
    if (mode === 0) {
      ctx.fillText("Q(t) = CV\u2080(1 - e^(-t/RC))", width - 16, y2);
    } else {
      ctx.fillText("Q(t) = CV\u2080 \u00B7 e^(-t/RC)", width - 16, y2);
    }
  }

  function drawTitle(): void {
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Capacitor Charging & Discharging", 12, 8);
  }

  function drawFieldAnnotation(): void {
    if (chargeLevel < 0.1) return;

    const layout = getPlateLayout();
    const cx = (layout.leftX + layout.rightX) / 2;
    const cy = layout.topY - 30;

    ctx.fillStyle = `rgba(100, 200, 255, ${chargeLevel * 0.6})`;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("E \u2192", cx, cy);
    ctx.fillStyle = `rgba(100, 200, 255, ${chargeLevel * 0.4})`;
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Electric Field", cx, cy - 14);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    prevMode = -1;
    chargeLevel = 0;
    currentFlow = 0;
    plateCharges = [];
    initWireCharges();
  }

  function update(dt: number, params: Record<string, number>): void {
    plateArea = params.plateArea ?? 5;
    gapDistance = params.gapDistance ?? 5;
    voltage = params.voltage ?? 12;
    const newMode = Math.round(params.mode ?? 0);

    // Reset time when mode changes
    if (newMode !== prevMode) {
      time = 0;
      if (newMode === 1) {
        // Start discharge from current charge level (or full)
        chargeLevel = Math.max(chargeLevel, 0.95);
      } else {
        chargeLevel = 0;
      }
      prevMode = newMode;
    }
    mode = newMode;

    time += dt;

    // Compute charge level with exponential curves
    const tau = TAU_BASE * (gapDistance / 5); // gap affects time constant
    if (mode === 0) {
      // Charging: Q = Q_max (1 - e^(-t/tau))
      chargeLevel = 1 - Math.exp(-time / tau);
      currentFlow = Math.exp(-time / tau);
    } else {
      // Discharging: Q = Q_max * e^(-t/tau)
      chargeLevel = Math.exp(-time / tau);
      currentFlow = Math.exp(-time / tau);
    }

    updateCharges(dt);
  }

  function render(): void {
    if (!ctx || width === 0 || height === 0) return;

    drawBackground();
    drawWires();
    drawBattery();
    drawCapacitorPlates();
    drawLightBulb();
    drawFieldAnnotation();
    drawInfoPanel();
    drawTitle();
  }

  function reset(): void {
    time = 0;
    chargeLevel = mode === 1 ? 1 : 0;
    currentFlow = mode === 1 ? 1 : 0;
    plateCharges = [];
    initWireCharges();
  }

  function destroy(): void {
    plateCharges = [];
    wireCharges = [];
  }

  function getStateDescription(): string {
    const modeStr = mode === 0 ? "charging" : "discharging";
    const capV = (chargeLevel * voltage).toFixed(1);
    const capRel = (plateArea / gapDistance).toFixed(2);
    return (
      `Capacitor (${modeStr}): Plate area = ${plateArea} (relative), Gap = ${gapDistance} (relative), ` +
      `Battery = ${voltage}V. Capacitance \u221D A/d = ${capRel}. ` +
      `Charge level: ${(chargeLevel * 100).toFixed(0)}%. ` +
      `Capacitor voltage: ${capV}V. ` +
      `${mode === 0 ? "Charging: charges accumulate on plates, connected to battery." : "Discharging: charges flow through light bulb, battery disconnected."}` +
      ` Electric field lines between plates are proportional to stored charge.`
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

export default Capacitor2Factory;
