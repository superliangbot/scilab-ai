import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

interface CurrentDot {
  t: number;
}

const ACGenerator: SimulationFactory = () => {
  const config = getSimConfig("ac-generator")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let rpm = 60;
  let turns = 10;
  let fieldStrength = 1;
  let coilArea = 0.05;
  let omega = 0;
  let emf = 0;
  let peakEmf = 0;
  let angle = 0;

  // Animation
  let time = 0;
  const waveformHistory: number[] = [];
  const WAVEFORM_MAX_POINTS = 300;
  let waveformTimer = 0;
  const WAVEFORM_SAMPLE_INTERVAL = 0.016; // ~60fps sampling

  // Current dots for animated wire flow
  const currentDots: CurrentDot[] = [];
  const NUM_DOTS = 16;

  // Colors
  const BG_COLOR = "#0a0e1a";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#64748b";
  const N_POLE_COLOR = "#ef4444";
  const S_POLE_COLOR = "#3b82f6";
  const COIL_COLOR = "#f59e0b";
  const WIRE_COLOR = "#475569";
  const FIELD_LINE_COLOR = "rgba(100, 200, 255, 0.25)";
  const GLOW_CYAN = "#22d3ee";
  const GLOW_YELLOW = "#fbbf24";
  const WAVE_COLOR = "#34d399";
  const AXIS_COLOR = "#334155";
  const GRID_COLOR = "rgba(51, 65, 85, 0.3)";
  const BRUSH_COLOR = "#a78bfa";
  const SLIP_RING_COLOR = "#78716c";

  function initDots() {
    currentDots.length = 0;
    for (let i = 0; i < NUM_DOTS; i++) {
      currentDots.push({ t: i / NUM_DOTS });
    }
  }

  function computePhysics(params: Record<string, number>) {
    rpm = params.rpm ?? rpm;
    turns = Math.round(params.turns ?? turns);
    fieldStrength = params.fieldStrength ?? fieldStrength;
    coilArea = params.coilArea ?? coilArea;

    omega = (2 * Math.PI * rpm) / 60;
    peakEmf = turns * fieldStrength * coilArea * omega;
    emf = peakEmf * Math.sin(omega * time);
  }

  // ---- Left side: Generator visualization ----

  function drawMagnet(x: number, y: number, w: number, h: number, pole: "N" | "S") {
    const color = pole === "N" ? N_POLE_COLOR : S_POLE_COLOR;
    const gradient = ctx.createLinearGradient(x, y, x + w, y);

    if (pole === "N") {
      gradient.addColorStop(0, "#dc2626");
      gradient.addColorStop(1, "#991b1b");
    } else {
      gradient.addColorStop(0, "#1e40af");
      gradient.addColorStop(1, "#2563eb");
    }

    // Magnet body
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();

    // Border glow
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pole, x + w / 2, y + h / 2);
  }

  function drawFieldLines(leftMagRight: number, rightMagLeft: number, cy: number, magnetH: number) {
    const numLines = 7;
    const gapX = rightMagLeft - leftMagRight;

    ctx.strokeStyle = FIELD_LINE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);

    for (let i = 0; i < numLines; i++) {
      const frac = (i + 0.5) / numLines;
      const yOff = (frac - 0.5) * magnetH * 0.85;
      const lineY = cy + yOff;

      ctx.beginPath();
      ctx.moveTo(leftMagRight + 4, lineY);
      ctx.lineTo(rightMagLeft - 4, lineY);
      ctx.stroke();

      // Arrow in the middle pointing from N to S
      const midX = leftMagRight + gapX / 2;
      const arrowSize = 5;
      ctx.fillStyle = FIELD_LINE_COLOR;
      ctx.beginPath();
      ctx.moveTo(midX + arrowSize, lineY);
      ctx.lineTo(midX - arrowSize, lineY - arrowSize * 0.6);
      ctx.lineTo(midX - arrowSize, lineY + arrowSize * 0.6);
      ctx.closePath();
      ctx.fill();
    }

    ctx.setLineDash([]);
  }

  function drawCoil(cx: number, cy: number, coilW: number, coilH: number) {
    // The coil rotates around a vertical axis
    // When angle = 0 or PI, coil is face-on (maximum flux)
    // When angle = PI/2 or 3PI/2, coil is edge-on (zero flux, maximum EMF rate of change)

    const cosA = Math.cos(angle);
    // projected width gives the 3D perspective effect
    const projectedW = coilW * Math.abs(cosA);
    const minWidth = 3; // minimum visible width when edge-on

    const effectiveW = Math.max(projectedW, minWidth);

    // Coil outline with glow
    const intensity = Math.abs(Math.sin(angle));
    const glowAlpha = 0.2 + intensity * 0.5;

    ctx.strokeStyle = COIL_COLOR;
    ctx.lineWidth = 3;
    ctx.shadowColor = GLOW_YELLOW;
    ctx.shadowBlur = 6 + intensity * 10;

    ctx.beginPath();
    ctx.rect(cx - effectiveW / 2, cy - coilH / 2, effectiveW, coilH);
    ctx.stroke();

    // Draw multiple turn lines inside the coil to show windings
    const visibleTurns = Math.min(turns, 8);
    if (effectiveW > 8) {
      ctx.strokeStyle = `rgba(245, 158, 11, ${0.3 + intensity * 0.3})`;
      ctx.lineWidth = 1;
      for (let i = 1; i <= visibleTurns; i++) {
        const inset = (i / (visibleTurns + 1)) * Math.min(effectiveW / 2 - 2, coilH / 4);
        ctx.beginPath();
        ctx.rect(
          cx - effectiveW / 2 + inset,
          cy - coilH / 2 + inset,
          effectiveW - inset * 2,
          coilH - inset * 2
        );
        ctx.stroke();
      }
    }

    ctx.shadowBlur = 0;

    // Rotation axis (vertical dashed line)
    ctx.strokeStyle = TEXT_DIM;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, cy - coilH / 2 - 20);
    ctx.lineTo(cx, cy + coilH / 2 + 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Show angle indicator at top
    const indicatorRadius = 14;
    const indicatorY = cy - coilH / 2 - 30;
    ctx.strokeStyle = TEXT_DIM;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, indicatorY, indicatorRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Angle line
    ctx.strokeStyle = COIL_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, indicatorY);
    ctx.lineTo(
      cx + indicatorRadius * Math.cos(-angle + Math.PI / 2),
      indicatorY - indicatorRadius * Math.sin(-angle + Math.PI / 2)
    );
    ctx.stroke();
  }

  function drawSlipRingsAndBrushes(cx: number, coilBottomY: number, genLeft: number, genRight: number) {
    const ringY = coilBottomY + 30;
    const ringRadius = 10;
    const ringGap = 24;

    // Slip rings (two concentric rings on the shaft)
    for (let i = -1; i <= 1; i += 2) {
      const rx = cx + i * ringGap / 2;
      ctx.strokeStyle = SLIP_RING_COLOR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(rx, ringY, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Brush pressing against ring
      const brushW = 8;
      const brushH = 16;
      const brushX = rx - brushW / 2;
      const brushY = ringY + ringRadius + 2;

      ctx.fillStyle = BRUSH_COLOR;
      ctx.shadowColor = BRUSH_COLOR;
      ctx.shadowBlur = 4;
      ctx.fillRect(brushX, brushY, brushW, brushH);
      ctx.shadowBlur = 0;

      // Wire from brush going down then out
      ctx.strokeStyle = WIRE_COLOR;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(rx, brushY + brushH);
      ctx.lineTo(rx, brushY + brushH + 15);
      if (i === -1) {
        ctx.lineTo(genLeft + 10, brushY + brushH + 15);
      } else {
        ctx.lineTo(genRight - 10, brushY + brushH + 15);
      }
      ctx.stroke();
    }

    // Connecting wires from shaft to coil
    ctx.strokeStyle = COIL_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - ringGap / 2, ringY - ringRadius);
    ctx.lineTo(cx - ringGap / 2, coilBottomY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + ringGap / 2, ringY - ringRadius);
    ctx.lineTo(cx + ringGap / 2, coilBottomY);
    ctx.stroke();

    // Labels
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("slip rings", cx, ringY + ringRadius + 35);
  }

  function drawCurrentDots(genLeft: number, genRight: number, genBottom: number) {
    const currentMagnitude = Math.abs(emf);
    const currentDirection = emf >= 0 ? 1 : -1;

    if (currentMagnitude < 0.01) return;

    const alpha = Math.min(currentMagnitude / peakEmf, 1) * 0.8 + 0.2;
    const wireY = genBottom + 45 + 15; // matches brush wire y

    // Path: left terminal -> bottom left -> bottom right -> right terminal (or reverse)
    // Simple path along the output wires
    for (const dot of currentDots) {
      const t = dot.t;
      let dx: number, dy: number;

      // Path segments: left terminal (0) -> across bottom (0.5) -> right terminal (1)
      if (t < 0.5) {
        const frac = t / 0.5;
        dx = genLeft + 10 + frac * (genRight - 10 - genLeft - 10);
        dy = wireY;
      } else {
        const frac = (t - 0.5) / 0.5;
        dx = genRight - 10 - frac * (genRight - 10 - genLeft - 10);
        dy = wireY;
      }

      // Glow
      ctx.fillStyle = `rgba(34, 211, 238, ${alpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(dx, dy, 6, 0, Math.PI * 2);
      ctx.fill();

      // Dot
      ctx.fillStyle = `rgba(34, 211, 238, ${alpha})`;
      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Direction arrows on the wire
    const arrowX = (genLeft + genRight) / 2;
    ctx.fillStyle = `rgba(34, 211, 238, ${alpha})`;
    const arrowDir = currentDirection;
    const arrowSize = 7;
    ctx.beginPath();
    ctx.moveTo(arrowX + arrowDir * arrowSize, wireY);
    ctx.lineTo(arrowX - arrowDir * arrowSize * 0.5, wireY - arrowSize * 0.5);
    ctx.lineTo(arrowX - arrowDir * arrowSize * 0.5, wireY + arrowSize * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  function drawLightBulb(cx: number, cy: number, brightness: number) {
    const bulbRadius = 18;

    // Brightness ranges 0..1
    const b = Math.max(0, Math.min(1, brightness));

    // Glow effect
    if (b > 0.05) {
      const glowRadius = bulbRadius + 10 + b * 25;
      const grd = ctx.createRadialGradient(cx, cy, bulbRadius * 0.3, cx, cy, glowRadius);
      grd.addColorStop(0, `rgba(255, 250, 200, ${b * 0.6})`);
      grd.addColorStop(0.5, `rgba(255, 220, 100, ${b * 0.3})`);
      grd.addColorStop(1, "rgba(255, 200, 50, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bulb glass
    ctx.strokeStyle = `rgba(255, 250, 200, ${0.3 + b * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, bulbRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Filament fill
    const fillColor = `rgba(255, 240, 150, ${b * 0.4})`;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.arc(cx, cy, bulbRadius, 0, Math.PI * 2);
    ctx.fill();

    // Filament inside
    ctx.strokeStyle = `rgba(255, 200, 50, ${0.4 + b * 0.6})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Simple zigzag filament
    const fLeft = cx - 8;
    const fRight = cx + 8;
    const fTop = cy - 6;
    const fBottom = cy + 6;
    ctx.moveTo(cx - 4, fBottom);
    ctx.lineTo(fLeft, fTop);
    ctx.lineTo(cx - 2, fBottom - 2);
    ctx.lineTo(cx, fTop);
    ctx.lineTo(cx + 2, fBottom - 2);
    ctx.lineTo(fRight, fTop);
    ctx.lineTo(cx + 4, fBottom);
    ctx.stroke();

    // Base of bulb
    ctx.strokeStyle = SLIP_RING_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + bulbRadius);
    ctx.lineTo(cx - 8, cy + bulbRadius + 10);
    ctx.lineTo(cx + 8, cy + bulbRadius + 10);
    ctx.lineTo(cx + 8, cy + bulbRadius);
    ctx.stroke();

    // Label
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("load", cx, cy + bulbRadius + 24);
  }

  // ---- Right side: Waveform ----

  function drawWaveform(ox: number, oy: number, w: number, h: number) {
    // Background panel
    ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
    ctx.beginPath();
    ctx.roundRect(ox, oy, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(ox, oy, w, h, 8);
    ctx.stroke();

    const padding = 30;
    const plotLeft = ox + padding + 10;
    const plotRight = ox + w - padding;
    const plotTop = oy + padding;
    const plotBottom = oy + h - padding;
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - plotTop;
    const plotCY = plotTop + plotH / 2;

    // Grid lines
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const gy = plotTop + (i / 4) * plotH;
      ctx.beginPath();
      ctx.moveTo(plotLeft, gy);
      ctx.lineTo(plotRight, gy);
      ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const gx = plotLeft + (i / 6) * plotW;
      ctx.beginPath();
      ctx.moveTo(gx, plotTop);
      ctx.lineTo(gx, plotBottom);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1.5;
    // Y axis
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotTop);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.stroke();
    // X axis (center)
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotCY);
    ctx.lineTo(plotRight, plotCY);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("time", plotLeft + plotW / 2, plotBottom + 6);

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("EMF (V)", plotLeft - 4, plotTop + 8);

    // Peak voltage labels
    const peakDisplay = peakEmf > 0.1 ? peakEmf.toFixed(1) : peakEmf.toFixed(3);
    ctx.fillStyle = WAVE_COLOR;
    ctx.font = "9px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`+${peakDisplay}`, plotLeft - 4, plotTop + 4);
    ctx.fillText(`-${peakDisplay}`, plotLeft - 4, plotBottom - 4);
    ctx.fillText("0", plotLeft - 4, plotCY);

    // Draw waveform
    if (waveformHistory.length > 1) {
      ctx.strokeStyle = WAVE_COLOR;
      ctx.lineWidth = 2;
      ctx.shadowColor = WAVE_COLOR;
      ctx.shadowBlur = 6;
      ctx.beginPath();

      const maxVal = Math.max(peakEmf, 0.001);
      const numPoints = waveformHistory.length;

      for (let i = 0; i < numPoints; i++) {
        const x = plotRight - ((numPoints - 1 - i) / WAVEFORM_MAX_POINTS) * plotW;
        const normalized = waveformHistory[i] / maxVal;
        const y = plotCY - normalized * (plotH / 2) * 0.9;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Bright dot at the current value (rightmost point)
      if (numPoints > 0) {
        const lastVal = waveformHistory[numPoints - 1];
        const dotY = plotCY - (lastVal / maxVal) * (plotH / 2) * 0.9;
        ctx.fillStyle = WAVE_COLOR;
        ctx.shadowColor = WAVE_COLOR;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(plotRight, dotY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("OUTPUT WAVEFORM", ox + 12, oy + 8);
  }

  // ---- Info panel ----

  function drawInfoPanel() {
    const panelH = 44;
    const panelY = height - panelH - 8;
    const panelX = 8;
    const panelW = width - 16;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.stroke();

    ctx.font = "12px monospace";
    ctx.textBaseline = "middle";
    const cy = panelY + panelH / 2;
    const spacing = panelW / 6;

    ctx.textAlign = "center";

    // Angular velocity
    ctx.fillStyle = GLOW_CYAN;
    ctx.fillText(`\u03C9 = ${omega.toFixed(2)} rad/s`, panelX + spacing * 0.5, cy);

    // Peak EMF
    ctx.fillStyle = WAVE_COLOR;
    ctx.fillText(`\u03B5\u2080 = ${peakEmf.toFixed(2)} V`, panelX + spacing * 1.5, cy);

    // Current EMF
    ctx.fillStyle = GLOW_YELLOW;
    ctx.fillText(`\u03B5 = ${emf.toFixed(2)} V`, panelX + spacing * 2.5, cy);

    // Frequency
    const freq = rpm / 60;
    ctx.fillStyle = BRUSH_COLOR;
    ctx.fillText(`f = ${freq.toFixed(2)} Hz`, panelX + spacing * 3.5, cy);

    // Angle
    const angleDeg = ((angle % (2 * Math.PI)) / (2 * Math.PI)) * 360;
    ctx.fillStyle = COIL_COLOR;
    ctx.fillText(`\u03B8 = ${angleDeg.toFixed(0)}\u00B0`, panelX + spacing * 4.5, cy);

    // Formula
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "10px monospace";
    ctx.fillText("\u03B5 = NBAω sin(ωt)", panelX + spacing * 5.5, cy);
  }

  function drawTitle() {
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("AC GENERATOR - Electromagnetic Induction", 12, 10);

    ctx.fillStyle = TEXT_DIM;
    ctx.font = "10px monospace";
    ctx.fillText(`N=${turns}  B=${fieldStrength}T  A=${coilArea}m\u00B2  RPM=${rpm}`, 12, 26);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      angle = 0;
      waveformHistory.length = 0;
      initDots();
    },

    update(dt: number, params: Record<string, number>) {
      time += dt;
      computePhysics(params);
      angle = omega * time;

      // Sample waveform
      waveformTimer += dt;
      if (waveformTimer >= WAVEFORM_SAMPLE_INTERVAL) {
        waveformTimer -= WAVEFORM_SAMPLE_INTERVAL;
        waveformHistory.push(emf);
        if (waveformHistory.length > WAVEFORM_MAX_POINTS) {
          waveformHistory.shift();
        }
      }

      // Move current dots
      const currentMag = Math.abs(emf);
      const direction = emf >= 0 ? 1 : -1;
      const speed = peakEmf > 0.001 ? (currentMag / Math.max(peakEmf, 0.001)) * 0.6 : 0;

      for (const dot of currentDots) {
        dot.t += speed * direction * dt;
        // Wrap
        while (dot.t > 1) dot.t -= 1;
        while (dot.t < 0) dot.t += 1;
      }
    },

    render() {
      // Clear with dark background
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);

      // Layout: left half = generator, right half = waveform
      const divider = width * 0.5;
      const genCX = divider * 0.5;
      const genCY = height * 0.42;

      // --- Left side: Generator ---

      // Magnets
      const magnetW = 40;
      const magnetH = 140;
      const magnetGap = 160;
      const leftMagX = genCX - magnetGap / 2 - magnetW;
      const rightMagX = genCX + magnetGap / 2;
      const magnetY = genCY - magnetH / 2;

      drawMagnet(leftMagX, magnetY, magnetW, magnetH, "N");
      drawMagnet(rightMagX, magnetY, magnetW, magnetH, "S");

      // Field lines between magnets
      drawFieldLines(
        leftMagX + magnetW,
        rightMagX,
        genCY,
        magnetH
      );

      // Rotating coil
      const coilW = magnetGap * 0.7;
      const coilH = magnetH * 0.75;
      drawCoil(genCX, genCY, coilW, coilH);

      // Slip rings and brushes
      const coilBottomY = genCY + coilH / 2;
      const genLeft = leftMagX;
      const genRight = rightMagX + magnetW;
      drawSlipRingsAndBrushes(genCX, coilBottomY, genLeft, genRight);

      // Animated current dots on output wires
      drawCurrentDots(genLeft, genRight, coilBottomY);

      // Light bulb between the output wires
      const bulbCX = genCX;
      const bulbCY = coilBottomY + 30 + 15 + 30; // below the wire
      const brightness = peakEmf > 0.001 ? Math.abs(emf) / peakEmf : 0;
      drawLightBulb(bulbCX, bulbCY, brightness);

      // Connect wires to bulb
      const wireY = coilBottomY + 30 + 15;
      ctx.strokeStyle = WIRE_COLOR;
      ctx.lineWidth = 2;
      // Left wire down to bulb
      ctx.beginPath();
      ctx.moveTo(bulbCX - 8, wireY);
      ctx.lineTo(bulbCX - 8, bulbCY - 18);
      ctx.stroke();
      // Right wire down to bulb
      ctx.beginPath();
      ctx.moveTo(bulbCX + 8, wireY);
      ctx.lineTo(bulbCX + 8, bulbCY - 18);
      ctx.stroke();

      // --- Right side: Waveform ---
      const waveX = divider + 10;
      const waveY = 40;
      const waveW = width - divider - 20;
      const waveH = height * 0.6;
      drawWaveform(waveX, waveY, waveW, waveH);

      // Current EMF readout on the right side
      const readoutY = waveY + waveH + 20;
      ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
      ctx.beginPath();
      ctx.roundRect(waveX, readoutY, waveW, 60, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(waveX, readoutY, waveW, 60, 8);
      ctx.stroke();

      // Instantaneous EMF display
      ctx.fillStyle = GLOW_YELLOW;
      ctx.font = "bold 22px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = GLOW_YELLOW;
      ctx.shadowBlur = 8;
      ctx.fillText(`\u03B5 = ${emf.toFixed(2)} V`, waveX + waveW / 2, readoutY + 20);
      ctx.shadowBlur = 0;

      // Peak EMF
      ctx.fillStyle = TEXT_DIM;
      ctx.font = "11px monospace";
      ctx.fillText(`Peak: \u00B1${peakEmf.toFixed(2)} V`, waveX + waveW / 2, readoutY + 46);

      // --- Overlays ---
      drawInfoPanel();
      drawTitle();

      // Divider line
      ctx.strokeStyle = "rgba(100, 116, 139, 0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(divider, 0);
      ctx.lineTo(divider, height);
      ctx.stroke();
      ctx.setLineDash([]);
    },

    reset() {
      time = 0;
      angle = 0;
      emf = 0;
      waveformHistory.length = 0;
      waveformTimer = 0;
      initDots();
    },

    destroy() {
      // No external resources to clean up
    },

    getStateDescription(): string {
      const freq = rpm / 60;
      const angleDeg = ((angle % (2 * Math.PI)) / (2 * Math.PI)) * 360;
      return (
        `AC Generator: ${turns} turns, B=${fieldStrength}T, A=${coilArea}m\u00B2, ` +
        `RPM=${rpm} (\u03C9=${omega.toFixed(2)} rad/s, f=${freq.toFixed(2)} Hz). ` +
        `Peak EMF=${peakEmf.toFixed(2)}V, Current EMF=${emf.toFixed(2)}V, ` +
        `Coil angle=${angleDeg.toFixed(0)}\u00B0. ` +
        `Formula: \u03B5 = NBA\u03C9 sin(\u03C9t).`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default ACGenerator;
