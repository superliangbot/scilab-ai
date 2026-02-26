import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LedFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("led") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let bandGap = 2.0; // eV
  let biasMode = 1; // 0=reverse, 1=forward, 2=unbiased
  let voltage = 3; // applied voltage

  // Particles for electron/hole animation
  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: "electron" | "hole";
    active: boolean;
  }

  interface Photon {
    x: number;
    y: number;
    vx: number;
    vy: number;
    alpha: number;
    color: string;
  }

  let particles: Particle[] = [];
  let photons: Photon[] = [];

  function wavelengthFromBandGap(eV: number): number {
    // E = hc/lambda => lambda = hc/E
    // hc = 1240 eV·nm
    return 1240 / Math.max(eV, 0.01);
  }

  function wavelengthToColor(nm: number): string {
    // Approximate visible spectrum colors
    if (nm < 380) return "#7c3aed"; // UV -> purple
    if (nm < 440) return "#6366f1"; // violet
    if (nm < 490) return "#3b82f6"; // blue
    if (nm < 510) return "#06b6d4"; // cyan
    if (nm < 540) return "#10b981"; // green
    if (nm < 580) return "#eab308"; // yellow
    if (nm < 620) return "#f97316"; // orange
    if (nm < 700) return "#ef4444"; // red
    return "#991b1b"; // deep red / IR
  }

  function initParticles() {
    particles = [];
    const junctionX = W / 2;
    const bandY = 200;

    // Electrons in n-type (right side)
    for (let i = 0; i < 15; i++) {
      particles.push({
        x: junctionX + 30 + Math.random() * 200,
        y: bandY + 20 + Math.random() * 60,
        vx: -(0.5 + Math.random()),
        vy: (Math.random() - 0.5) * 0.5,
        type: "electron",
        active: true,
      });
    }

    // Holes in p-type (left side)
    for (let i = 0; i < 15; i++) {
      particles.push({
        x: junctionX - 30 - Math.random() * 200,
        y: bandY + 100 + Math.random() * 60,
        vx: 0.5 + Math.random(),
        vy: (Math.random() - 0.5) * 0.5,
        type: "hole",
        active: true,
      });
    }

    photons = [];
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    initParticles();
  }

  function update(dt: number, params: Record<string, number>) {
    bandGap = params.bandGap ?? 2.0;
    biasMode = Math.round(params.biasMode ?? 1);
    voltage = params.voltage ?? 3;

    const dtClamped = Math.min(dt, 0.05);
    time += dtClamped;

    const junctionX = W / 2;
    const bandY = 200;
    const isForward = biasMode === 1;

    // Move particles
    for (const p of particles) {
      if (!p.active) continue;

      if (isForward) {
        // Forward bias: electrons move left, holes move right toward junction
        if (p.type === "electron") {
          p.vx = -(0.5 + Math.random() * 0.5) * voltage * 0.3;
        } else {
          p.vx = (0.5 + Math.random() * 0.5) * voltage * 0.3;
        }
      } else if (biasMode === 0) {
        // Reverse bias: move away from junction
        if (p.type === "electron") {
          p.vx = (0.3 + Math.random() * 0.3);
        } else {
          p.vx = -(0.3 + Math.random() * 0.3);
        }
      } else {
        // Unbiased: random drift
        p.vx += (Math.random() - 0.5) * 0.2;
      }

      p.vy += (Math.random() - 0.5) * 0.2;
      p.x += p.vx * dtClamped * 60;
      p.y += p.vy * dtClamped * 60;

      // Recombination at junction (forward bias only)
      if (isForward && Math.abs(p.x - junctionX) < 20) {
        if (Math.random() < 0.03 * voltage) {
          // Emit photon
          const wl = wavelengthFromBandGap(bandGap);
          const color = wavelengthToColor(wl);
          photons.push({
            x: p.x,
            y: p.y,
            vx: (Math.random() - 0.5) * 3,
            vy: -(1 + Math.random() * 2),
            alpha: 1,
            color,
          });

          // Reset particle to starting side
          if (p.type === "electron") {
            p.x = junctionX + 100 + Math.random() * 150;
            p.y = bandY + 20 + Math.random() * 60;
          } else {
            p.x = junctionX - 100 - Math.random() * 150;
            p.y = bandY + 100 + Math.random() * 60;
          }
        }
      }

      // Boundary constraints
      if (p.type === "electron") {
        if (p.x < junctionX - 50 && !isForward) p.x = junctionX + 200;
        if (p.x > junctionX + 280) p.x = junctionX + 280;
        if (p.x < junctionX - 280) p.x = junctionX + 200;
      } else {
        if (p.x > junctionX + 50 && !isForward) p.x = junctionX - 200;
        if (p.x < junctionX - 280) p.x = junctionX - 280;
        if (p.x > junctionX + 280) p.x = junctionX - 200;
      }

      p.y = Math.max(bandY, Math.min(bandY + 200, p.y));
    }

    // Update photons
    for (let i = photons.length - 1; i >= 0; i--) {
      const ph = photons[i];
      ph.x += ph.vx * dtClamped * 60;
      ph.y += ph.vy * dtClamped * 60;
      ph.alpha -= dtClamped * 0.8;
      if (ph.alpha <= 0 || ph.y < 50) {
        photons.splice(i, 1);
      }
    }
  }

  function render() {
    if (!ctx) return;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0c1222");
    bg.addColorStop(1, "#1a1030");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const junctionX = W / 2;
    const bandY = 200;

    // Title
    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Light-Emitting Diode (LED)", W / 2, 28);

    const wl = wavelengthFromBandGap(bandGap);
    const ledColor = wavelengthToColor(wl);
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(
      `Band gap: ${bandGap.toFixed(2)} eV → λ = ${wl.toFixed(0)} nm | ` +
      `Bias: ${biasMode === 1 ? "Forward" : biasMode === 0 ? "Reverse" : "Unbiased"}`,
      W / 2, 48
    );

    // P-N junction diagram
    // P-type region (left)
    ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
    ctx.fillRect(junctionX - 250, bandY - 20, 250, 240);
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillStyle = "#ef4444";
    ctx.textAlign = "center";
    ctx.fillText("P-type", junctionX - 125, bandY - 5);

    // N-type region (right)
    ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
    ctx.fillRect(junctionX, bandY - 20, 250, 240);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("N-type", junctionX + 125, bandY - 5);

    // Depletion zone
    ctx.fillStyle = "rgba(148, 163, 184, 0.1)";
    ctx.fillRect(junctionX - 20, bandY - 20, 40, 240);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(junctionX, bandY - 20);
    ctx.lineTo(junctionX, bandY + 220);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Junction", junctionX, bandY + 232);

    // Energy band diagram
    const ebY = bandY + 260;
    const ebH = 100;
    const ebW = 400;
    const ebL = junctionX - ebW / 2;

    ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
    ctx.fillRect(ebL, ebY, ebW, ebH);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(ebL, ebY, ebW, ebH);

    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Energy Band Diagram", ebL + ebW / 2, ebY + 14);

    // Conduction band (top line)
    const cbY = ebY + 25;
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ebL + 10, cbY);
    ctx.lineTo(ebL + ebW / 2 - 5, cbY);
    const bandOffset = biasMode === 1 ? 15 : biasMode === 0 ? -15 : 0;
    ctx.lineTo(ebL + ebW / 2 + 5, cbY + bandOffset);
    ctx.lineTo(ebL + ebW - 10, cbY + bandOffset);
    ctx.stroke();

    // Valence band (bottom line)
    const vbGap = bandGap * 15; // scale for visual
    const vbY = cbY + vbGap;
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ebL + 10, vbY);
    ctx.lineTo(ebL + ebW / 2 - 5, vbY);
    ctx.lineTo(ebL + ebW / 2 + 5, vbY + bandOffset);
    ctx.lineTo(ebL + ebW - 10, vbY + bandOffset);
    ctx.stroke();

    // Band labels
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "#3b82f6";
    ctx.textAlign = "left";
    ctx.fillText("Conduction Band", ebL + 12, cbY - 5);
    ctx.fillStyle = "#ef4444";
    ctx.fillText("Valence Band", ebL + 12, vbY + 14);

    // Band gap arrow
    const gapX = ebL + ebW - 40;
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gapX, cbY + bandOffset);
    ctx.lineTo(gapX, vbY + bandOffset);
    ctx.stroke();
    ctx.fillStyle = "#fbbf24";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Eg=${bandGap}eV`, gapX + 5, (cbY + vbY) / 2 + bandOffset / 2 + 3);

    // Draw particles
    for (const p of particles) {
      if (p.type === "electron") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#60a5fa";
        ctx.fill();
        ctx.strokeStyle = "#93c5fd";
        ctx.lineWidth = 0.5;
        ctx.stroke();
        // Minus sign
        ctx.font = "bold 6px system-ui, sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText("−", p.x, p.y + 2);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.strokeStyle = "#f87171";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Plus sign
        ctx.font = "bold 6px system-ui, sans-serif";
        ctx.fillStyle = "#f87171";
        ctx.textAlign = "center";
        ctx.fillText("+", p.x, p.y + 2);
      }
    }

    // Draw photons
    for (const ph of photons) {
      ctx.beginPath();
      ctx.arc(ph.x, ph.y, 3, 0, Math.PI * 2);
      const glow = ctx.createRadialGradient(ph.x, ph.y, 0, ph.x, ph.y, 8);
      glow.addColorStop(0, ph.color + Math.round(ph.alpha * 255).toString(16).padStart(2, "0"));
      glow.addColorStop(1, ph.color + "00");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ph.x, ph.y, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ph.x, ph.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = ph.color;
      ctx.globalAlpha = ph.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Wavy tail
      ctx.beginPath();
      ctx.strokeStyle = ph.color;
      ctx.globalAlpha = ph.alpha * 0.5;
      ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        const tx = ph.x - ph.vx * i * 0.5;
        const ty = ph.y - ph.vy * i * 0.5 + Math.sin(i * 1.5 + time * 10) * 2;
        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // LED glow at top (only forward bias)
    if (biasMode === 1) {
      const glowIntensity = Math.min(voltage / 5, 1);
      const ledGlow = ctx.createRadialGradient(junctionX, 80, 0, junctionX, 80, 60 * glowIntensity);
      ledGlow.addColorStop(0, ledColor + Math.round(glowIntensity * 200).toString(16).padStart(2, "0"));
      ledGlow.addColorStop(1, ledColor + "00");
      ctx.fillStyle = ledGlow;
      ctx.beginPath();
      ctx.arc(junctionX, 80, 60 * glowIntensity, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.fillStyle = ledColor;
      ctx.textAlign = "center";
      ctx.fillText(`LED ON (${wl.toFixed(0)} nm)`, junctionX, 80);
    }

    // Battery
    const batX = 30;
    const batY = H - 60;
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(batX, batY);
    ctx.lineTo(batX + 30, batY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(batX + 35, batY - 10);
    ctx.lineTo(batX + 35, batY + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(batX + 42, batY - 5);
    ctx.lineTo(batX + 42, batY + 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(batX + 42, batY);
    ctx.lineTo(batX + 70, batY);
    ctx.stroke();

    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText(`${voltage.toFixed(1)}V`, batX + 35, batY + 25);
    ctx.fillText(biasMode === 1 ? "Forward" : biasMode === 0 ? "Reverse" : "Off", batX + 35, batY + 38);
  }

  function reset() {
    time = 0;
    initParticles();
  }

  function destroy() {
    particles = [];
    photons = [];
  }

  function getStateDescription(): string {
    const wl = wavelengthFromBandGap(bandGap);
    return (
      `LED simulation: Band gap = ${bandGap.toFixed(2)} eV, emitted wavelength = ${wl.toFixed(0)} nm. ` +
      `Bias: ${biasMode === 1 ? "Forward" : biasMode === 0 ? "Reverse" : "Unbiased"}, ` +
      `Voltage: ${voltage.toFixed(1)}V. ` +
      `${biasMode === 1 ? "Electrons and holes recombine at the p-n junction, releasing photons. " : ""}` +
      `${biasMode === 0 ? "Reverse bias widens the depletion zone; no light emitted. " : ""}` +
      `The photon energy equals the band gap energy: E = hf = hc/λ.`
    );
  }

  function resize(w: number, h: number) { W = w; H = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LedFactory;
