import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const DipoleAntennaFactory = (): SimulationEngine => {
  const config = getSimConfig("dipole-antenna") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;
  let currentParams: Record<string, number> = {};

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
  }

  function update(dt: number, params: Record<string, number>): void {
    currentParams = params;
    time += dt;
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    const frequency = currentParams.frequency ?? 1;
    const antennaLen = currentParams.antennaLength ?? 50;
    const showEField = currentParams.showEField ?? 1;
    const showRadiation = currentParams.showRadiation ?? 1;

    const cx = width * 0.35;
    const cy = height * 0.5;
    const antH = antennaLen * 2;

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Dipole Antenna", width / 2, 28);

    // Antenna structure
    const antTop = cy - antH;
    const antBot = cy + antH;

    // Feed line
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 5);
    ctx.lineTo(cx, cy + 40);
    ctx.stroke();

    // Gap at feed point
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Upper element
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5);
    ctx.lineTo(cx, antTop);
    ctx.stroke();

    // Lower element
    ctx.beginPath();
    ctx.moveTo(cx, cy + 5);
    ctx.lineTo(cx, antBot);
    ctx.stroke();

    // Charge distribution (oscillating)
    const phase = time * frequency * Math.PI * 2;
    const chargeMag = Math.sin(phase);

    // Draw charge accumulation
    const numCharges = 12;
    for (let i = 0; i < numCharges; i++) {
      const frac = (i + 0.5) / numCharges;
      const topY = cy - 5 - frac * (antH - 5);
      const botY = cy + 5 + frac * (antH - 5);

      // Charge density follows sinusoidal distribution
      const chargeAt = chargeMag * Math.cos(frac * Math.PI / 2);
      const alpha = Math.abs(chargeAt) * 0.8;

      if (chargeAt > 0.05) {
        // Positive charges on top, negative on bottom
        ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.beginPath();
        ctx.arc(cx, topY, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(59, 130, 246, ${alpha})`;
        ctx.beginPath();
        ctx.arc(cx, botY, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (chargeAt < -0.05) {
        ctx.fillStyle = `rgba(59, 130, 246, ${alpha})`;
        ctx.beginPath();
        ctx.arc(cx, topY, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.beginPath();
        ctx.arc(cx, botY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Current arrows along antenna
    const currentMag = Math.cos(phase); // current leads voltage by 90°
    if (Math.abs(currentMag) > 0.1) {
      ctx.strokeStyle = `rgba(251, 191, 36, ${Math.abs(currentMag)})`;
      ctx.lineWidth = 2;
      const dir = currentMag > 0 ? -1 : 1;

      // Upper element current arrows
      for (let y = cy - 10; y > antTop + 10; y -= 25) {
        ctx.beginPath();
        ctx.moveTo(cx - 8, y);
        ctx.lineTo(cx - 8, y + dir * 12);
        ctx.stroke();
        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(cx - 8, y + dir * 12);
        ctx.lineTo(cx - 11, y + dir * 8);
        ctx.lineTo(cx - 5, y + dir * 8);
        ctx.closePath();
        ctx.fillStyle = `rgba(251, 191, 36, ${Math.abs(currentMag)})`;
        ctx.fill();
      }
    }

    // Electric field lines (near field)
    if (showEField >= 0.5) {
      const fieldPhase = phase;
      ctx.strokeStyle = "rgba(239, 68, 68, 0.3)";
      ctx.lineWidth = 1;

      for (let ring = 1; ring <= 4; ring++) {
        const r = ring * 30;
        const fieldStrength = Math.sin(fieldPhase) / ring;

        if (Math.abs(fieldStrength) > 0.05) {
          ctx.globalAlpha = Math.abs(fieldStrength) * 0.5;
          ctx.beginPath();
          // Electric field curves from + to - charges
          const bulge = fieldStrength * r * 0.8;
          ctx.moveTo(cx, antTop + 10);
          ctx.bezierCurveTo(cx + r + bulge, cy - antH * 0.3, cx + r + bulge, cy + antH * 0.3, cx, antBot - 10);
          ctx.stroke();

          // Mirror on left side
          ctx.beginPath();
          ctx.moveTo(cx, antTop + 10);
          ctx.bezierCurveTo(cx - r - bulge, cy - antH * 0.3, cx - r - bulge, cy + antH * 0.3, cx, antBot - 10);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // Radiation pattern (far field) - propagating EM waves
    if (showRadiation >= 0.5) {
      const numWaves = 8;
      const waveSpacing = 50 / frequency;
      const maxR = Math.max(width, height) * 0.6;

      for (let i = 0; i < numWaves; i++) {
        const r = ((time * frequency * 80 + i * waveSpacing) % maxR);
        if (r < 30) continue;

        const alpha = Math.max(0, 1 - r / maxR) * 0.5;

        // Radiation pattern is toroidal (figure-8 in cross section)
        // Maximum perpendicular to antenna, zero along axis
        ctx.strokeStyle = `rgba(168, 85, 247, ${alpha})`;
        ctx.lineWidth = 1.5;

        // Right side radiation
        ctx.beginPath();
        for (let a = -Math.PI / 2 + 0.1; a <= Math.PI / 2 - 0.1; a += 0.05) {
          // Intensity ∝ sin²(θ) where θ is angle from antenna axis
          const intensity = Math.pow(Math.cos(a), 2);
          const x = cx + r * intensity * Math.cos(a);
          const y = cy + r * Math.sin(a);
          if (a === -Math.PI / 2 + 0.1) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Left side radiation
        ctx.beginPath();
        for (let a = Math.PI / 2 + 0.1; a <= 3 * Math.PI / 2 - 0.1; a += 0.05) {
          const intensity = Math.pow(Math.cos(a), 2);
          const x = cx + r * intensity * Math.cos(a);
          const y = cy + r * Math.sin(a);
          if (a === Math.PI / 2 + 0.1) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // Radiation pattern diagram (small, in corner)
    const diagX = width - 100;
    const diagY = height - 100;
    const diagR = 40;

    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(diagX, diagY, diagR + 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(diagX, diagY, diagR + 5, 0, Math.PI * 2);
    ctx.stroke();

    // Figure-8 pattern
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.05) {
      const r = diagR * Math.abs(Math.cos(a));
      const x = diagX + r * Math.cos(a);
      const y = diagY + r * Math.sin(a);
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Antenna line in diagram
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(diagX, diagY - diagR - 2);
    ctx.lineTo(diagX, diagY + diagR + 2);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(9, width * 0.012)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Radiation Pattern", diagX, diagY - diagR - 10);

    // Info panel
    const panelX = 15;
    const panelY = height - 110;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(panelX, panelY, 260, 95);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, 260, 95);

    const wavelength = 300 / frequency; // c = 300,000 km/s, f in MHz -> λ in m
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(11, width * 0.014)}px monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`Frequency: ${frequency.toFixed(1)} MHz`, panelX + 10, panelY + 20);
    ctx.fillText(`λ = c/f = ${wavelength.toFixed(0)} m`, panelX + 10, panelY + 40);
    ctx.fillText(`Antenna: ${(antennaLen * 2).toFixed(0)}% of λ/2`, panelX + 10, panelY + 60);
    ctx.fillText(`Phase: ${((phase * 180 / Math.PI) % 360).toFixed(0)}°`, panelX + 10, panelY + 80);

    // Legend
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "left";
    const legX = panelX + 10;
    const legY = panelY - 60;
    ctx.fillStyle = "#ef4444";
    ctx.fillText("● + charge", legX, legY);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("● − charge", legX, legY + 16);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("→ Current", legX, legY + 32);
    ctx.fillStyle = "#a855f7";
    ctx.fillText("~ EM radiation", legX, legY + 48);
  }

  function reset(): void {
    time = 0;
    currentParams = {};
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const frequency = currentParams.frequency ?? 1;
    const antennaLen = currentParams.antennaLength ?? 50;
    const wavelength = 300 / frequency;

    return `Dipole antenna simulation: Frequency=${frequency.toFixed(1)} MHz, wavelength=${wavelength.toFixed(0)}m, antenna length=${(antennaLen * 2).toFixed(0)}% of half-wavelength. A dipole antenna works by oscillating charges back and forth along its length. The alternating current creates changing electric and magnetic fields that propagate outward as electromagnetic radiation. Maximum radiation is perpendicular to the antenna (toroidal pattern), with nulls along the antenna axis. Optimal efficiency when antenna length ≈ λ/2.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DipoleAntennaFactory;
