import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const MagnetizationFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("magnetization") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let extField = 0;       // external H field (-10 to 10)
  let temperature = 300;  // Kelvin
  let materialType = 0;   // 0 = soft ferromagnet, 1 = hard ferromagnet
  let domainCount = 12;   // grid side (total = domainCount^2)

  // Domain grid: each domain has an angle (radians)
  let domains: number[] = [];
  let domainTargets: number[] = [];
  let gridSize = 12;

  // Hysteresis tracking
  let magnetization = 0;
  const MAX_BH_POINTS = 400;
  let bhCurve: { h: number; m: number }[] = [];

  // Previous field for tracking direction
  let prevField = 0;
  let peakReached = false;

  function initDomains(): void {
    gridSize = domainCount;
    const n = gridSize * gridSize;
    domains = [];
    domainTargets = [];
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      domains.push(angle);
      domainTargets.push(angle);
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
    bhCurve = [];
    prevField = 0;
    peakReached = false;
    initDomains();
  }

  function update(dt: number, params: Record<string, number>): void {
    extField = params.extField ?? 0;
    temperature = params.temperature ?? 300;
    materialType = params.materialType ?? 0;
    const newDomainCount = Math.round(params.domainCount ?? 12);

    if (newDomainCount !== gridSize) {
      domainCount = newDomainCount;
      initDomains();
    }

    const dtClamped = Math.min(dt, 0.05);
    time += dtClamped;

    const n = gridSize * gridSize;

    // Coercivity: how hard it is for domains to realign (higher for hard magnets)
    const coercivity = materialType > 0.5 ? 0.7 : 0.15;

    // Thermal noise strength (higher temperature = more randomness)
    const thermalNoise = (temperature / 300) * 0.25;

    // Target angle for alignment with external field (0 = right = positive H direction)
    const fieldAngle = extField >= 0 ? 0 : Math.PI;
    const fieldMag = Math.abs(extField);

    // For each domain, compute target and nudge toward it
    for (let i = 0; i < n; i++) {
      // Alignment tendency: stronger field overcomes coercivity
      const alignStrength = Math.max(0, fieldMag - coercivity * 3) * 0.3;

      if (alignStrength > 0.01) {
        // Gradually target the field direction
        domainTargets[i] = fieldAngle;
      } else if (fieldMag < 0.1 && materialType < 0.5) {
        // Soft magnet: some relaxation back toward random when field removed
        // But remnance keeps some alignment
      }

      // Interpolate domain angle toward target
      let target = domainTargets[i];
      let current = domains[i];

      // Normalize angles
      let diff = target - current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      // Rate depends on field strength and material
      const rate = alignStrength * (materialType > 0.5 ? 1.5 : 4) * dtClamped;
      domains[i] += diff * rate;

      // Thermal noise
      if (thermalNoise > 0.01) {
        domains[i] += (Math.random() - 0.5) * thermalNoise * dtClamped * 10;
      }

      // Normalize
      domains[i] = domains[i] % (Math.PI * 2);
      if (domains[i] < 0) domains[i] += Math.PI * 2;
    }

    // Compute net magnetization (average of cos(angle) — projection onto field axis)
    let sumCos = 0;
    for (let i = 0; i < n; i++) {
      sumCos += Math.cos(domains[i]);
    }
    magnetization = sumCos / n; // ranges from -1 to 1

    // Track B-H curve
    bhCurve.push({ h: extField, m: magnetization });
    if (bhCurve.length > MAX_BH_POINTS) bhCurve.shift();

    prevField = extField;
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#080c18");
    grad.addColorStop(1, "#0e1424");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawTitle(): void {
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(15, W * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Magnetization of Ferromagnetic Material", W / 2, 28);

    ctx.font = `${Math.max(11, W * 0.014)}px system-ui, sans-serif`;
    ctx.fillStyle = "#64748b";
    const matLabel = materialType > 0.5 ? "Hard Ferromagnet" : "Soft Ferromagnet";
    ctx.fillText(`Magnetic domains aligning with external field  |  ${matLabel}`, W / 2, 48);
  }

  function drawDomainGrid(): void {
    const n = gridSize;
    const gridW = Math.min(W * 0.45, H * 0.65);
    const gridH = gridW;
    const gx = W * 0.05;
    const gy = (H - gridH) / 2 + 10;
    const cellW = gridW / n;
    const cellH = gridH / n;

    // Grid background
    ctx.fillStyle = "rgba(20, 30, 50, 0.6)";
    ctx.beginPath();
    ctx.roundRect(gx - 4, gy - 4, gridW + 8, gridH + 8, 6);
    ctx.fill();
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.strokeRect(gx - 4, gy - 4, gridW + 8, gridH + 8);

    // Label
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(10, W * 0.013)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Magnetic Domains", gx + gridW / 2, gy - 12);

    // Draw each domain as an arrow
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const idx = row * n + col;
        const angle = domains[idx];

        const cx = gx + col * cellW + cellW / 2;
        const cy = gy + row * cellH + cellH / 2;
        const arrowLen = Math.min(cellW, cellH) * 0.38;

        // Color based on alignment with positive x-axis (external field direction)
        const alignment = Math.cos(angle);
        // Blue = aligned right, red = aligned left, gray = perpendicular
        const r = alignment < 0 ? Math.round(180 + Math.abs(alignment) * 75) : 60;
        const g = 70 + Math.round((1 - Math.abs(alignment)) * 60);
        const b = alignment > 0 ? Math.round(180 + alignment * 75) : 60;
        const alpha = 0.85;

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.lineWidth = Math.max(1.5, cellW * 0.08);

        // Arrow shaft
        const dx = Math.cos(angle) * arrowLen;
        const dy = Math.sin(angle) * arrowLen;

        ctx.beginPath();
        ctx.moveTo(cx - dx * 0.6, cy - dy * 0.6);
        ctx.lineTo(cx + dx * 0.6, cy + dy * 0.6);
        ctx.stroke();

        // Arrowhead
        const tipX = cx + dx * 0.6;
        const tipY = cy + dy * 0.6;
        const headSize = Math.max(3, cellW * 0.15);
        const perpX = -Math.sin(angle) * headSize * 0.5;
        const perpY = Math.cos(angle) * headSize * 0.5;
        const backX = -Math.cos(angle) * headSize;
        const backY = -Math.sin(angle) * headSize;

        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX + backX + perpX, tipY + backY + perpY);
        ctx.lineTo(tipX + backX - perpX, tipY + backY - perpY);
        ctx.closePath();
        ctx.fill();
      }
    }

    // External field arrow below the grid
    if (Math.abs(extField) > 0.1) {
      const arrowCx = gx + gridW / 2;
      const arrowY = gy + gridH + 25;
      const arrowLen = Math.min(80, Math.abs(extField) * 10);
      const dir = extField > 0 ? 1 : -1;

      ctx.strokeStyle = "rgba(34, 197, 94, 0.7)";
      ctx.fillStyle = "rgba(34, 197, 94, 0.7)";
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(arrowCx - dir * arrowLen, arrowY);
      ctx.lineTo(arrowCx + dir * arrowLen, arrowY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(arrowCx + dir * arrowLen, arrowY);
      ctx.lineTo(arrowCx + dir * (arrowLen - 8), arrowY - 5);
      ctx.lineTo(arrowCx + dir * (arrowLen - 8), arrowY + 5);
      ctx.closePath();
      ctx.fill();

      ctx.font = `bold ${Math.max(11, W * 0.014)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`H_ext = ${extField.toFixed(1)}`, arrowCx, arrowY + 20);
    }
  }

  function drawBHCurve(): void {
    // B-H hysteresis loop plot
    const plotW = Math.min(W * 0.38, 300);
    const plotH = Math.min(H * 0.55, 300);
    const px = W - plotW - 20;
    const py = (H - plotH) / 2 + 10;

    // Background
    ctx.fillStyle = "rgba(10, 15, 30, 0.88)";
    ctx.beginPath();
    ctx.roundRect(px, py, plotW, plotH, 8);
    ctx.fill();
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, plotW, plotH);

    // Title
    ctx.fillStyle = "#cbd5e1";
    ctx.font = `bold ${Math.max(11, W * 0.015)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("B-H Hysteresis Curve", px + plotW / 2, py + 18);

    const originX = px + plotW / 2;
    const originY = py + plotH / 2 + 5;
    const scaleX = (plotW - 40) / 20; // H range -10 to 10
    const scaleY = (plotH - 60) / 2;  // M range -1 to 1

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 15, originY);
    ctx.lineTo(px + plotW - 15, originY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(originX, py + 28);
    ctx.lineTo(originX, py + plotH - 10);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "#64748b";
    ctx.font = `${Math.max(10, W * 0.013)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("H (field)", px + plotW - 20, originY + 16);
    ctx.textAlign = "left";
    ctx.fillText("M", originX + 6, py + 36);

    // Scale ticks
    ctx.fillStyle = "#475569";
    ctx.font = `${Math.max(8, W * 0.01)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText("-10", originX - 10 * scaleX, originY + 14);
    ctx.fillText("+10", originX + 10 * scaleX, originY + 14);
    ctx.textAlign = "right";
    ctx.fillText("+1", originX - 5, originY - scaleY + 4);
    ctx.fillText("-1", originX - 5, originY + scaleY + 4);

    // Plot the B-H curve
    if (bhCurve.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;

      for (let i = 0; i < bhCurve.length; i++) {
        const x = originX + bhCurve[i].h * scaleX;
        const y = originY - bhCurve[i].m * scaleY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Current point
      const lastPt = bhCurve[bhCurve.length - 1];
      const dotX = originX + lastPt.h * scaleX;
      const dotY = originY - lastPt.m * scaleY;

      ctx.beginPath();
      ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawInfoPanel(): void {
    const pw = Math.min(260, W * 0.32);
    const ph = 100;
    const px = W - pw - 20;
    const py = H - ph - 15;

    ctx.fillStyle = "rgba(10, 15, 30, 0.85)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(12, W * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Magnetization State", px + 12, py + 22);

    ctx.font = `${Math.max(11, W * 0.014)}px monospace`;
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`H_ext = ${extField.toFixed(1)}`, px + 12, py + 44);
    ctx.fillText(`M = ${magnetization.toFixed(3)}`, px + 12, py + 62);
    ctx.fillText(`T = ${temperature.toFixed(0)} K`, px + 12, py + 80);

    const matLabel = materialType > 0.5 ? "Hard ferro" : "Soft ferro";
    ctx.fillStyle = "#64748b";
    ctx.font = `${Math.max(10, W * 0.013)}px system-ui, sans-serif`;
    ctx.fillText(matLabel, px + 12, py + 94);
  }

  function drawMagnetizationBar(): void {
    // A horizontal bar showing net magnetization
    const bw = Math.min(W * 0.45, 300);
    const bh = 16;
    const bx = W * 0.05;
    const by = H - 40;

    ctx.fillStyle = "rgba(20, 30, 50, 0.5)";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 4);
    ctx.fill();

    // Fill based on magnetization
    const fillW = Math.abs(magnetization) * (bw / 2);
    const fillX = magnetization >= 0 ? bw / 2 : bw / 2 - fillW;

    const col = magnetization >= 0 ? "rgba(56, 189, 248, 0.6)" : "rgba(248, 113, 113, 0.6)";
    ctx.fillStyle = col;
    ctx.fillRect(bx + fillX, by, fillW, bh);

    // Center mark
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + bw / 2, by - 2);
    ctx.lineTo(bx + bw / 2, by + bh + 2);
    ctx.stroke();

    // Label
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(10, W * 0.013)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`Net Magnetization: ${magnetization.toFixed(3)}`, bx + bw / 2, by - 6);
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawTitle();
    drawDomainGrid();
    drawBHCurve();
    drawInfoPanel();
    drawMagnetizationBar();
  }

  function reset(): void {
    time = 0;
    bhCurve = [];
    prevField = 0;
    peakReached = false;
    initDomains();
  }

  function destroy(): void {
    domains = [];
    domainTargets = [];
    bhCurve = [];
  }

  function getStateDescription(): string {
    const matLabel = materialType > 0.5 ? "hard" : "soft";
    return (
      `Magnetization simulation: A ${gridSize}x${gridSize} grid of magnetic domains in a ${matLabel} ferromagnet. ` +
      `External field H = ${extField.toFixed(1)}, temperature = ${temperature.toFixed(0)} K. ` +
      `Net magnetization M = ${magnetization.toFixed(3)} (range -1 to 1). ` +
      `Domains align with external field; stronger fields overcome coercivity. ` +
      `The B-H curve shows hysteresis: magnetization lags behind field changes. ` +
      `Hard ferromagnets retain more magnetization (remnance) when field is removed.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default MagnetizationFactory;
