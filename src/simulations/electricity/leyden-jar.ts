import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LeydenJarFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("leyden-jar") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let chargeRate = 1;
  let capacitance = 5; // nF
  let maxVoltage = 30; // kV

  // State
  let charge = 0; // 0 to 1 (normalized)
  let isCharging = true;
  let isDischarging = false;
  let dischargeTimer = 0;

  // Charge particles
  interface ChargeParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    alpha: number;
  }

  let chargeParticles: ChargeParticle[] = [];
  let sparks: { x: number; y: number; dx: number; dy: number; life: number }[] = [];

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    charge = 0;
    isCharging = true;
    isDischarging = false;
    chargeParticles = [];
    sparks = [];
  }

  function update(dt: number, params: Record<string, number>) {
    chargeRate = params.chargeRate ?? 1;
    capacitance = params.capacitance ?? 5;
    maxVoltage = params.maxVoltage ?? 30;

    const dtClamped = Math.min(dt, 0.05);
    time += dtClamped;

    if (isCharging && !isDischarging) {
      charge = Math.min(charge + chargeRate * 0.05 * dtClamped, 1);

      // Add charge flow particles
      if (Math.random() < chargeRate * dtClamped * 5) {
        // Particle flowing down the rod to inner foil
        chargeParticles.push({
          x: W / 2,
          y: 100,
          vx: (Math.random() - 0.5) * 0.5,
          vy: 2 + Math.random() * 2,
          alpha: 1,
        });
      }

      // Auto-discharge when fully charged
      if (charge >= 1) {
        isDischarging = true;
        dischargeTimer = 1.5;
        // Create spark
        for (let i = 0; i < 20; i++) {
          sparks.push({
            x: W / 2,
            y: 130,
            dx: (Math.random() - 0.5) * 8,
            dy: (Math.random() - 0.5) * 8,
            life: 0.5 + Math.random() * 0.5,
          });
        }
      }
    }

    if (isDischarging) {
      charge = Math.max(charge - 2 * dtClamped, 0);
      dischargeTimer -= dtClamped;
      if (dischargeTimer <= 0 || charge <= 0) {
        isDischarging = false;
        charge = 0;
      }
    }

    // Update charge particles
    for (let i = chargeParticles.length - 1; i >= 0; i--) {
      const p = chargeParticles[i];
      p.x += p.vx * dtClamped * 60;
      p.y += p.vy * dtClamped * 60;
      p.alpha -= dtClamped * 0.5;
      if (p.alpha <= 0 || p.y > 400) {
        chargeParticles.splice(i, 1);
      }
    }

    // Update sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.dx * dtClamped * 60;
      s.y += s.dy * dtClamped * 60;
      s.life -= dtClamped;
      if (s.life <= 0) sparks.splice(i, 1);
    }
  }

  function render() {
    if (!ctx) return;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(1, "#1e1b30");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Leyden Jar — Early Capacitor", W / 2, 28);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("A glass jar that stores static electricity between inner and outer conductive foils", W / 2, 46);

    // Jar dimensions
    const jarCx = W / 2;
    const jarTop = 160;
    const jarBottom = 430;
    const jarW = 140;
    const jarH = jarBottom - jarTop;

    // Glass jar body
    ctx.strokeStyle = "#64b5f6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(jarCx - jarW / 2, jarTop + 20);
    ctx.lineTo(jarCx - jarW / 2, jarBottom);
    ctx.arc(jarCx, jarBottom, jarW / 2, Math.PI, 0, true);
    ctx.lineTo(jarCx + jarW / 2, jarTop + 20);
    ctx.stroke();

    // Glass fill
    ctx.fillStyle = "rgba(100, 181, 246, 0.08)";
    ctx.beginPath();
    ctx.moveTo(jarCx - jarW / 2, jarTop + 20);
    ctx.lineTo(jarCx - jarW / 2, jarBottom);
    ctx.arc(jarCx, jarBottom, jarW / 2, Math.PI, 0, true);
    ctx.lineTo(jarCx + jarW / 2, jarTop + 20);
    ctx.closePath();
    ctx.fill();

    // Inner foil (metal coating inside)
    const foilInset = 8;
    const innerColor = charge > 0
      ? `rgba(239, 68, 68, ${0.3 + charge * 0.5})`
      : "rgba(148, 163, 184, 0.3)";
    ctx.fillStyle = innerColor;
    ctx.fillRect(
      jarCx - jarW / 2 + foilInset,
      jarTop + 40,
      jarW - 2 * foilInset,
      jarH * 0.6
    );
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      jarCx - jarW / 2 + foilInset,
      jarTop + 40,
      jarW - 2 * foilInset,
      jarH * 0.6
    );

    // Outer foil
    const outerColor = charge > 0
      ? `rgba(59, 130, 246, ${0.3 + charge * 0.5})`
      : "rgba(148, 163, 184, 0.3)";
    ctx.fillStyle = outerColor;
    ctx.fillRect(
      jarCx - jarW / 2 - 6,
      jarTop + 60,
      6,
      jarH * 0.5
    );
    ctx.fillRect(
      jarCx + jarW / 2,
      jarTop + 60,
      6,
      jarH * 0.5
    );

    // Labels
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#ef4444";
    ctx.textAlign = "right";
    ctx.fillText("Inner foil (+)", jarCx - jarW / 2 - 15, jarTop + 80);
    ctx.fillStyle = "#3b82f6";
    ctx.textAlign = "left";
    ctx.fillText("Outer foil (−)", jarCx + jarW / 2 + 15, jarTop + 80);
    ctx.fillStyle = "#64b5f6";
    ctx.textAlign = "center";
    ctx.fillText("Glass (insulator)", jarCx, jarBottom + 20);

    // Metal rod (electrode going into jar)
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(jarCx - 3, 80, 6, jarTop + 50 - 80);

    // Metal ball on top
    ctx.beginPath();
    ctx.arc(jarCx, 80, 12, 0, Math.PI * 2);
    const ballGrad = ctx.createRadialGradient(jarCx - 3, 77, 0, jarCx, 80, 12);
    ballGrad.addColorStop(0, "#e2e8f0");
    ballGrad.addColorStop(1, "#64748b");
    ctx.fillStyle = ballGrad;
    ctx.fill();

    // Lid
    ctx.fillStyle = "#475569";
    ctx.fillRect(jarCx - jarW / 2 - 5, jarTop + 15, jarW + 10, 10);

    // Charge indicators on inner foil
    if (charge > 0.1) {
      const numCharges = Math.floor(charge * 10);
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      for (let i = 0; i < numCharges; i++) {
        const cy = jarTop + 50 + i * 20;
        if (cy < jarTop + 40 + jarH * 0.6) {
          ctx.fillStyle = "#ef4444";
          ctx.fillText("+", jarCx - 15, cy);
          ctx.fillStyle = "#3b82f6";
          ctx.fillText("−", jarCx + 15, cy);
        }
      }
    }

    // Draw charge particles
    for (const p of chargeParticles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(239, 68, 68, ${p.alpha})`;
      ctx.fill();
    }

    // Draw sparks
    for (const s of sparks) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 100, ${s.life})`;
      ctx.fill();
      // Glow
      const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 8);
      glow.addColorStop(0, `rgba(255, 255, 200, ${s.life * 0.5})`);
      glow.addColorStop(1, "rgba(255, 255, 200, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Discharge spark arc
    if (isDischarging && charge > 0.1) {
      ctx.strokeStyle = `rgba(255, 255, 100, ${charge})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(jarCx, 68);
      for (let i = 0; i < 8; i++) {
        const sx = jarCx + (Math.random() - 0.5) * 30;
        const sy = 68 - (i + 1) * 5;
        ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Voltage meter
    const voltage = charge * maxVoltage;
    const meterX = 50;
    const meterY = 180;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(meterX, meterY, 120, 140, 8);
    ctx.fill();

    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Charge State", meterX + 60, meterY + 18);

    // Charge bar
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(meterX + 15, meterY + 30, 90, 15);
    const barColor = charge > 0.8 ? "#ef4444" : charge > 0.4 ? "#fbbf24" : "#10b981";
    ctx.fillStyle = barColor;
    ctx.fillRect(meterX + 15, meterY + 30, 90 * charge, 15);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(meterX + 15, meterY + 30, 90, 15);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "left";
    ctx.fillText(`Voltage: ${voltage.toFixed(1)} kV`, meterX + 10, meterY + 65);
    ctx.fillText(`Charge: ${(charge * 100).toFixed(0)}%`, meterX + 10, meterY + 82);
    ctx.fillText(`C: ${capacitance} nF`, meterX + 10, meterY + 99);

    const energy = 0.5 * capacitance * 1e-9 * (voltage * 1000) * (voltage * 1000);
    ctx.fillText(`E: ${(energy * 1000).toFixed(2)} mJ`, meterX + 10, meterY + 116);

    // Status
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = isDischarging ? "#ef4444" : "#10b981";
    ctx.textAlign = "center";
    ctx.fillText(
      isDischarging ? "DISCHARGING!" : (charge >= 1 ? "FULLY CHARGED" : "Charging..."),
      meterX + 60, meterY + 135
    );

    // Capacitor equation
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("Q = CV  |  E = ½CV²", W / 2, H - 50);
    ctx.fillText(
      "The glass jar insulates between inner and outer conductors, storing charge like a capacitor.",
      W / 2, H - 30
    );

    // History note
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#475569";
    ctx.fillText("Invented ~1745 in Leiden, Netherlands — one of the first electrical storage devices", W / 2, H - 12);
  }

  function reset() {
    time = 0;
    charge = 0;
    isCharging = true;
    isDischarging = false;
    chargeParticles = [];
    sparks = [];
  }

  function destroy() {
    chargeParticles = [];
    sparks = [];
  }

  function getStateDescription(): string {
    const voltage2 = charge * maxVoltage;
    const energy = 0.5 * capacitance * 1e-9 * (voltage2 * 1000) * (voltage2 * 1000);
    return (
      `Leyden Jar: Capacitance=${capacitance}nF, Max voltage=${maxVoltage}kV. ` +
      `Charge: ${(charge * 100).toFixed(0)}%, Voltage: ${voltage2.toFixed(1)}kV, ` +
      `Energy: ${(energy * 1000).toFixed(2)}mJ. ` +
      `${isDischarging ? "Discharging!" : charge >= 1 ? "Fully charged." : "Charging."} ` +
      `The Leyden jar stores static charge between inner and outer conductive foils separated by glass.`
    );
  }

  function resize(w: number, h: number) { W = w; H = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LeydenJarFactory;
