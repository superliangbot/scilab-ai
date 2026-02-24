import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const BimetalFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("bimetal") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters (cached)
  let temperature = 20;
  let metal1Expansion = 23; // aluminum-like, top metal (×10⁻⁶/°C)
  let metal2Expansion = 11; // steel-like, bottom metal (×10⁻⁶/°C)
  let stripLength = 100; // mm

  // Molecular vibration particles
  interface MoleculeParticle {
    baseX: number;
    baseY: number;
    offsetX: number;
    offsetY: number;
    phase: number;
    layer: number; // 0 = top, 1 = bottom
  }
  let molecules: MoleculeParticle[] = [];
  const NUM_MOLECULES_PER_LAYER = 40;

  // Reference temperature for zero bending
  const T_REF = 20; // °C

  // Strip thickness (mm) for bending calculations
  const STRIP_THICKNESS = 4; // total thickness (2mm each layer)

  function initMolecules(): void {
    molecules = [];
    for (let layer = 0; layer < 2; layer++) {
      for (let i = 0; i < NUM_MOLECULES_PER_LAYER; i++) {
        molecules.push({
          baseX: Math.random(),
          baseY: Math.random(),
          offsetX: 0,
          offsetY: 0,
          phase: Math.random() * Math.PI * 2,
          layer,
        });
      }
    }
  }

  /**
   * Bending radius for a bimetal strip:
   * R = t / (6 × ΔT × (α₁ - α₂))
   * where t = total strip thickness, ΔT = temperature change, α₁ - α₂ = expansion difference
   * The strip bends toward the metal with lower expansion coefficient.
   */
  function getBendingRadius(): number {
    const deltaT = temperature - T_REF;
    const deltaAlpha = (metal1Expansion - metal2Expansion) * 1e-6; // convert from ×10⁻⁶
    if (Math.abs(deltaT) < 0.01 || Math.abs(deltaAlpha) < 1e-12) {
      return Infinity;
    }
    const t = STRIP_THICKNESS * 1e-3; // convert mm to m
    const R = t / (6 * deltaT * deltaAlpha);
    return R; // in meters
  }

  /**
   * Bending angle (arc length / radius):
   * θ = L / R
   */
  function getBendingAngle(): number {
    const R = getBendingRadius();
    if (!isFinite(R) || Math.abs(R) < 1e-10) return 0;
    const L = stripLength * 1e-3; // mm to m
    const theta = L / R;
    // Clamp to reasonable range
    return Math.max(-Math.PI * 1.5, Math.min(Math.PI * 1.5, theta));
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initMolecules();
  }

  function update(dt: number, params: Record<string, number>): void {
    temperature = params.temperature ?? 20;
    metal1Expansion = params.metal1Expansion ?? 23;
    metal2Expansion = params.metal2Expansion ?? 11;
    stripLength = params.stripLength ?? 100;

    time += dt;

    // Update molecular vibrations based on temperature
    const vibrationAmplitude = Math.min((temperature / 200) * 5, 8);
    const vibrationSpeed = 2 + (temperature / 200) * 8;

    for (const mol of molecules) {
      mol.offsetX = vibrationAmplitude * Math.sin(vibrationSpeed * time + mol.phase);
      mol.offsetY = vibrationAmplitude * Math.cos(vibrationSpeed * time + mol.phase * 1.3);
    }
  }

  function drawThermometer(x: number, y: number, h: number): void {
    const bulbRadius = 14;
    const tubeWidth = 8;
    const tubeHeight = h - bulbRadius * 2;
    const tubeX = x - tubeWidth / 2;
    const tubeY = y;

    // Outer tube glass
    ctx.fillStyle = "rgba(200, 220, 240, 0.15)";
    ctx.strokeStyle = "rgba(200, 220, 240, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(tubeX - 2, tubeY, tubeWidth + 4, tubeHeight, 4);
    ctx.fill();
    ctx.stroke();

    // Mercury bulb
    const bulbY = y + tubeHeight;
    const bulbGrad = ctx.createRadialGradient(x, bulbY, 0, x, bulbY, bulbRadius);
    bulbGrad.addColorStop(0, "#ff4444");
    bulbGrad.addColorStop(0.7, "#cc2222");
    bulbGrad.addColorStop(1, "#991111");
    ctx.beginPath();
    ctx.arc(x, bulbY, bulbRadius, 0, Math.PI * 2);
    ctx.fillStyle = bulbGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 220, 240, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Mercury level (fill from bulb up based on temperature)
    const fillFraction = Math.max(0, Math.min(1, temperature / 200));
    const mercuryHeight = fillFraction * tubeHeight;
    const mercuryY = tubeY + tubeHeight - mercuryHeight;

    const mercGrad = ctx.createLinearGradient(tubeX, mercuryY, tubeX + tubeWidth, mercuryY);
    mercGrad.addColorStop(0, "#dd3333");
    mercGrad.addColorStop(0.5, "#ff4444");
    mercGrad.addColorStop(1, "#dd3333");
    ctx.fillStyle = mercGrad;
    ctx.fillRect(tubeX + 1, mercuryY, tubeWidth - 2, mercuryHeight);

    // Temperature scale marks
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "rgba(200, 220, 240, 0.6)";
    ctx.textAlign = "left";
    for (let t = 0; t <= 200; t += 50) {
      const markY = tubeY + tubeHeight - (t / 200) * tubeHeight;
      ctx.beginPath();
      ctx.moveTo(x + tubeWidth / 2 + 3, markY);
      ctx.lineTo(x + tubeWidth / 2 + 8, markY);
      ctx.strokeStyle = "rgba(200, 220, 240, 0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillText(`${t}°`, x + tubeWidth / 2 + 10, markY + 3);
    }
  }

  function drawBimetalStrip(): void {
    const theta = getBendingAngle();
    const R = getBendingRadius();

    // Drawing parameters
    const drawLength = Math.min(width * 0.55, stripLength * 2.2);
    const stripThick = 28; // total visual thickness
    const halfThick = stripThick / 2;

    // Center position (anchor point — left end of the strip)
    const anchorX = width * 0.35;
    const anchorY = height * 0.42;

    ctx.save();
    ctx.translate(anchorX, anchorY);

    if (Math.abs(theta) < 0.005) {
      // Straight strip
      // Top metal (higher expansion)
      const topGrad = ctx.createLinearGradient(0, -halfThick, 0, 0);
      topGrad.addColorStop(0, "#d4956b"); // copper/aluminum color
      topGrad.addColorStop(0.5, "#c47d52");
      topGrad.addColorStop(1, "#b06838");
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, -halfThick, drawLength, halfThick);

      // Bottom metal (lower expansion)
      const botGrad = ctx.createLinearGradient(0, 0, 0, halfThick);
      botGrad.addColorStop(0, "#8899aa");
      botGrad.addColorStop(0.5, "#7a8b9c");
      botGrad.addColorStop(1, "#6b7c8d");
      ctx.fillStyle = botGrad;
      ctx.fillRect(0, 0, drawLength, halfThick);

      // Bond line
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(drawLength, 0);
      ctx.stroke();

      // Outer border
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, -halfThick, drawLength, stripThick);

      // Draw molecules on straight strip
      drawMoleculesStraight(drawLength, halfThick);
    } else {
      // Curved strip — draw as arc segments
      // The bending radius in pixels
      const drawR = (drawLength / Math.abs(theta));
      // Positive theta means bending downward (top metal expands more, strip curves toward bottom/steel)
      const sign = theta > 0 ? 1 : -1;

      // Center of curvature is below (or above) the strip at distance R from the bond line
      const cx = 0;
      const cy = sign * drawR;

      const numSegments = 80;
      const startAngle = -sign * Math.PI / 2;
      const endAngle = startAngle + theta;

      // Draw top metal (outer arc)
      ctx.beginPath();
      for (let i = 0; i <= numSegments; i++) {
        const t = i / numSegments;
        const angle = startAngle + t * (endAngle - startAngle);
        const outerR = drawR - sign * halfThick;
        const px = cx + outerR * Math.cos(angle);
        const py = cy + outerR * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      for (let i = numSegments; i >= 0; i--) {
        const t = i / numSegments;
        const angle = startAngle + t * (endAngle - startAngle);
        const innerR = drawR;
        const px = cx + innerR * Math.cos(angle);
        const py = cy + innerR * Math.sin(angle);
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = "#c47d52"; // copper/aluminum
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw bottom metal (inner arc)
      ctx.beginPath();
      for (let i = 0; i <= numSegments; i++) {
        const t = i / numSegments;
        const angle = startAngle + t * (endAngle - startAngle);
        const outerR = drawR;
        const px = cx + outerR * Math.cos(angle);
        const py = cy + outerR * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      for (let i = numSegments; i >= 0; i--) {
        const t = i / numSegments;
        const angle = startAngle + t * (endAngle - startAngle);
        const innerR = drawR + sign * halfThick;
        const px = cx + innerR * Math.cos(angle);
        const py = cy + innerR * Math.sin(angle);
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = "#7a8b9c"; // steel gray
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Bond line (arc at the interface)
      ctx.beginPath();
      for (let i = 0; i <= numSegments; i++) {
        const t = i / numSegments;
        const angle = startAngle + t * (endAngle - startAngle);
        const px = cx + drawR * Math.cos(angle);
        const py = cy + drawR * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw molecules on curved strip
      drawMoleculesCurved(cx, cy, drawR, halfThick, sign, startAngle, endAngle);
    }

    // Clamp indicator at anchor
    ctx.fillStyle = "#555";
    ctx.fillRect(-8, -halfThick - 6, 16, stripThick + 12);
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-8, -halfThick - 6, 16, stripThick + 12);

    ctx.restore();
  }

  function drawMoleculesStraight(drawLength: number, halfThick: number): void {
    const vibrationAmplitude = Math.min((temperature / 200) * 3, 5);
    for (const mol of molecules) {
      const x = mol.baseX * drawLength;
      const y = mol.layer === 0
        ? -halfThick + mol.baseY * halfThick
        : mol.baseY * halfThick;

      const dx = mol.offsetX * (vibrationAmplitude / 5);
      const dy = mol.offsetY * (vibrationAmplitude / 5);

      ctx.beginPath();
      ctx.arc(x + dx, y + dy, 2.5, 0, Math.PI * 2);
      const alpha = 0.3 + (temperature / 200) * 0.4;
      ctx.fillStyle = mol.layer === 0
        ? `rgba(255, 200, 150, ${alpha})`
        : `rgba(180, 200, 220, ${alpha})`;
      ctx.fill();
    }
  }

  function drawMoleculesCurved(
    cx: number, cy: number, drawR: number, halfThick: number,
    sign: number, startAngle: number, endAngle: number
  ): void {
    const vibrationAmplitude = Math.min((temperature / 200) * 3, 5);
    for (const mol of molecules) {
      const t = mol.baseX;
      const angle = startAngle + t * (endAngle - startAngle);

      let r: number;
      if (mol.layer === 0) {
        // Top metal (outer)
        r = drawR - sign * halfThick + sign * mol.baseY * halfThick;
      } else {
        // Bottom metal (inner)
        r = drawR + sign * mol.baseY * halfThick;
      }

      const dx = mol.offsetX * (vibrationAmplitude / 5);
      const dy = mol.offsetY * (vibrationAmplitude / 5);
      const px = cx + r * Math.cos(angle) + dx;
      const py = cy + r * Math.sin(angle) + dy;

      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      const alpha = 0.3 + (temperature / 200) * 0.4;
      ctx.fillStyle = mol.layer === 0
        ? `rgba(255, 200, 150, ${alpha})`
        : `rgba(180, 200, 220, ${alpha})`;
      ctx.fill();
    }
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Bimetal Strip — Thermal Expansion", width / 2, 30);

    // Draw the thermometer on the left side
    drawThermometer(width * 0.1, height * 0.12, height * 0.5);

    // Draw the bimetal strip
    drawBimetalStrip();

    // ── Legend / labels ──────────────────────────
    const legendX = width * 0.67;
    const legendY = height * 0.1;

    ctx.font = "13px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "left";

    // Top metal label
    ctx.fillStyle = "#c47d52";
    ctx.fillRect(legendX, legendY, 16, 12);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`Metal 1 (α₁ = ${metal1Expansion} ×10⁻⁶/°C)`, legendX + 22, legendY + 10);

    // Bottom metal label
    ctx.fillStyle = "#7a8b9c";
    ctx.fillRect(legendX, legendY + 24, 16, 12);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`Metal 2 (α₂ = ${metal2Expansion} ×10⁻⁶/°C)`, legendX + 22, legendY + 34);

    // ── Data panel ──────────────────────────────
    const panelY = height * 0.72;
    ctx.font = "13px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "left";
    const col1 = 30;
    const lineH = 22;

    const deltaT = temperature - T_REF;
    const R = getBendingRadius();
    const theta = getBendingAngle();
    const thetaDeg = (theta * 180) / Math.PI;

    // Temperature
    ctx.fillStyle = "#ff6b6b";
    ctx.fillText(`Temperature: ${temperature.toFixed(0)} °C   (ΔT = ${deltaT.toFixed(0)} °C from ref ${T_REF} °C)`, col1, panelY);

    // Expansion coefficients
    ctx.fillStyle = "#ffa94d";
    ctx.fillText(
      `Δα = α₁ - α₂ = ${(metal1Expansion - metal2Expansion).toFixed(1)} ×10⁻⁶/°C`,
      col1, panelY + lineH
    );

    // Strip info
    ctx.fillStyle = "#69db7c";
    ctx.fillText(`Strip length: ${stripLength} mm    Thickness: ${STRIP_THICKNESS} mm`, col1, panelY + lineH * 2);

    // Bending formula
    ctx.fillStyle = "#74c0fc";
    if (isFinite(R) && Math.abs(theta) > 0.001) {
      ctx.fillText(
        `R = t / (6·ΔT·Δα) = ${Math.abs(R * 1000).toFixed(1)} mm    Bending angle: ${Math.abs(thetaDeg).toFixed(1)}°`,
        col1, panelY + lineH * 3
      );
    } else {
      ctx.fillText(`R = ∞  (no bending — strip is straight at reference temperature)`, col1, panelY + lineH * 3);
    }

    // Formula display
    ctx.fillStyle = "#b197fc";
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.fillText(
      `Formula: R = t / (6 × ΔT × (α₁ − α₂))    θ = L / R`,
      col1, panelY + lineH * 4
    );

    // Direction note
    ctx.fillStyle = "#868e96";
    ctx.font = "11px 'Inter', system-ui, sans-serif";
    if (deltaT > 0.5) {
      ctx.fillText("Strip bends toward Metal 2 (lower expansion) when heated.", col1, panelY + lineH * 5);
    } else if (deltaT < -0.5) {
      ctx.fillText("Strip bends toward Metal 1 (higher expansion) when cooled below reference.", col1, panelY + lineH * 5);
    } else {
      ctx.fillText("At reference temperature — no bending. Change temperature to see bimetal effect.", col1, panelY + lineH * 5);
    }

    // Application note
    ctx.fillStyle = "#495057";
    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.fillText("Application: Thermostats use bimetal strips to open/close circuits at set temperatures.", col1, panelY + lineH * 6);

    // Time display at bottom-left
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    initMolecules();
  }

  function destroy(): void {
    molecules = [];
  }

  function getStateDescription(): string {
    const deltaT = temperature - T_REF;
    const R = getBendingRadius();
    const theta = getBendingAngle();
    const thetaDeg = (theta * 180) / Math.PI;
    return (
      `Bimetal Strip: T=${temperature}°C (ΔT=${deltaT}°C), ` +
      `α₁=${metal1Expansion}×10⁻⁶/°C, α₂=${metal2Expansion}×10⁻⁶/°C, ` +
      `strip length=${stripLength}mm, thickness=${STRIP_THICKNESS}mm. ` +
      `Bending radius R=${isFinite(R) ? (Math.abs(R * 1000).toFixed(1) + "mm") : "∞"}, ` +
      `bending angle=${Math.abs(thetaDeg).toFixed(1)}°. ` +
      `Formula: R = t/(6·ΔT·(α₁-α₂)). ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default BimetalFactory;
