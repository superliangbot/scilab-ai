import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const IncandescenceFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("incandescence") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let voltage = 12;
  let resistance = 10;
  let isOn = 1;

  let filamentTemp = 20; // °C
  const MAX_TEMP = 2800; // tungsten operating temp
  const AMBIENT = 20;

  interface Electron {
    x: number;
    y: number;
    speed: number;
    segment: number; // which wire segment
    progress: number; // 0-1 along segment
  }

  interface Photon {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    wavelength: number; // nm (determines color)
  }

  let electrons: Electron[] = [];
  let photons: Photon[] = [];

  function initElectrons() {
    electrons = [];
    for (let i = 0; i < 30; i++) {
      electrons.push({
        x: 0,
        y: 0,
        speed: 0.3 + Math.random() * 0.3,
        segment: Math.floor(Math.random() * 4),
        progress: Math.random(),
      });
    }
  }

  function tempToColor(temp: number): { r: number; g: number; b: number } {
    // Black body radiation approximation
    const t = Math.max(0, Math.min(1, (temp - 500) / (MAX_TEMP - 500)));
    if (temp < 500) return { r: 20, g: 20, b: 20 };
    if (t < 0.3) return { r: Math.round(180 * (t / 0.3)), g: 0, b: 0 }; // dark red
    if (t < 0.6) return { r: 220, g: Math.round(120 * ((t - 0.3) / 0.3)), b: 0 }; // orange
    return {
      r: 255,
      g: Math.round(180 + 75 * ((t - 0.6) / 0.4)),
      b: Math.round(150 * ((t - 0.6) / 0.4)),
    }; // yellow-white
  }

  function emitPhoton(fx: number, fy: number) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 2;

    // Wavelength based on temperature (Wien's law approximation)
    const peakWavelength = 2898000 / (filamentTemp + 273.15); // nm
    const wavelength = peakWavelength * (0.5 + Math.random());

    photons.push({
      x: fx + (Math.random() - 0.5) * 10,
      y: fy + (Math.random() - 0.5) * 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 1 + Math.random(),
      wavelength,
    });
  }

  function wavelengthToColor(wl: number): string {
    // Simplified visible spectrum
    if (wl < 380) return "rgba(100,0,200,0.6)"; // UV-ish
    if (wl < 450) return "rgba(100,0,255,0.6)"; // violet
    if (wl < 495) return "rgba(0,100,255,0.6)"; // blue
    if (wl < 570) return "rgba(0,255,100,0.6)"; // green
    if (wl < 590) return "rgba(255,255,0,0.6)"; // yellow
    if (wl < 620) return "rgba(255,150,0,0.6)"; // orange
    if (wl < 750) return "rgba(255,50,0,0.6)"; // red
    return "rgba(200,0,0,0.4)"; // infrared-ish
  }

  function drawBulb() {
    const cx = width * 0.35;
    const cy = height * 0.4;
    const bulbR = Math.min(width * 0.18, height * 0.25);

    // Glass bulb
    ctx.strokeStyle = "rgba(200,220,240,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, bulbR, 0, Math.PI * 2);
    ctx.stroke();

    // Glow based on temperature
    if (filamentTemp > 500) {
      const color = tempToColor(filamentTemp);
      const glowAlpha = Math.min(0.6, (filamentTemp - 500) / 3000);
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, bulbR * 2);
      glow.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${glowAlpha})`);
      glow.addColorStop(0.5, `rgba(${color.r},${color.g},${color.b},${glowAlpha * 0.3})`);
      glow.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, bulbR * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Filament (zigzag coil)
    const color = tempToColor(filamentTemp);
    ctx.strokeStyle = `rgb(${color.r},${color.g},${color.b})`;
    ctx.lineWidth = 3;
    if (filamentTemp > 800) {
      ctx.shadowColor = `rgb(${color.r},${color.g},${color.b})`;
      ctx.shadowBlur = 15;
    }

    const filamentW = bulbR * 0.6;
    const filamentH = bulbR * 0.4;
    const coils = 8;
    ctx.beginPath();
    for (let i = 0; i <= coils; i++) {
      const x = cx - filamentW / 2 + (i / coils) * filamentW;
      const y = cy + (i % 2 === 0 ? -filamentH / 2 : filamentH / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Lead wires
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - filamentW / 2, cy - filamentH / 2);
    ctx.lineTo(cx - filamentW / 2, cy + bulbR + 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + filamentW / 2, cy + filamentH / 2);
    ctx.lineTo(cx + filamentW / 2, cy + bulbR + 20);
    ctx.stroke();

    // Base
    ctx.fillStyle = "#666";
    ctx.beginPath();
    ctx.roundRect(cx - 20, cy + bulbR, 40, 30, [0, 0, 5, 5]);
    ctx.fill();
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = cy + bulbR + 5 + i * 7;
      ctx.beginPath();
      ctx.moveTo(cx - 20, y);
      ctx.lineTo(cx + 20, y);
      ctx.stroke();
    }

    // Emit photons from filament
    if (isOn >= 1 && filamentTemp > 800) {
      const emitRate = (filamentTemp / MAX_TEMP) * 3;
      if (Math.random() < emitRate) {
        const fx = cx - filamentW / 2 + Math.random() * filamentW;
        const fy = cy - filamentH / 2 + Math.random() * filamentH;
        emitPhoton(fx, fy);
      }
    }

    // Draw photons
    for (const p of photons) {
      const alpha = 1 - p.life / p.maxLife;
      const wlColor = wavelengthToColor(p.wavelength);
      ctx.fillStyle = wlColor.replace(/[\d.]+\)$/, `${alpha})`);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 + (1 - alpha) * 3, 0, Math.PI * 2);
      ctx.fill();

      // Wavy trail
      ctx.strokeStyle = wlColor.replace(/[\d.]+\)$/, `${alpha * 0.3})`);
      ctx.lineWidth = 1;
      ctx.beginPath();
      const trail = 15;
      for (let t = 0; t < trail; t++) {
        const tx = p.x - p.vx * t * 0.3;
        const ty = p.y - p.vy * t * 0.3 + Math.sin(t * 1.5 + time * 5) * 2;
        if (t === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.stroke();
    }

    // Draw electrons in lead wires
    if (isOn >= 1) {
      ctx.fillStyle = "#44aaff";
      for (const e of electrons) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawCircuit() {
    const cx = width * 0.35;
    const baseY = height * 0.4 + Math.min(width * 0.18, height * 0.25) + 50;

    // Simple circuit with switch
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 2;

    // Bottom wire to battery
    ctx.beginPath();
    ctx.moveTo(cx - 20, baseY);
    ctx.lineTo(cx - 60, baseY);
    ctx.lineTo(cx - 60, baseY + 40);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 20, baseY);
    ctx.lineTo(cx + 60, baseY);
    ctx.lineTo(cx + 60, baseY + 40);
    ctx.stroke();

    // Battery
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 30, baseY + 40);
    ctx.lineTo(cx + 30, baseY + 40);
    ctx.stroke();

    // Switch indicator
    ctx.fillStyle = isOn >= 1 ? "#44ff88" : "#ff4444";
    ctx.beginPath();
    ctx.arc(cx, baseY + 55, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ccc";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(isOn >= 1 ? "ON" : "OFF", cx, baseY + 70);
  }

  function drawInfoPanel() {
    const panelX = width * 0.6;
    const panelY = 70;
    const panelW = width * 0.36;
    const panelH = height - 100;

    ctx.fillStyle = "rgba(10,15,30,0.85)";
    ctx.strokeStyle = "rgba(100,150,200,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Incandescent Light Bulb", panelX + 12, panelY + 22);

    const current = isOn >= 1 ? voltage / resistance : 0;
    const power = current * current * resistance;

    ctx.fillStyle = "#aabbcc";
    ctx.font = "11px monospace";
    const info = [
      `Voltage: ${voltage.toFixed(1)} V`,
      `Resistance: ${resistance.toFixed(1)} Ω`,
      `Current: ${current.toFixed(2)} A`,
      `Power: ${power.toFixed(1)} W`,
      ``,
      `Filament temp: ${filamentTemp.toFixed(0)}°C`,
      ``,
      `Ohm's Law: V = IR`,
      `Power: P = I²R`,
      ``,
    ];

    for (let i = 0; i < info.length; i++) {
      ctx.fillText(info[i], panelX + 12, panelY + 42 + i * 18);
    }

    // Temperature bar
    const barX = panelX + 12;
    const barY = panelY + panelH - 80;
    const barW = panelW - 24;
    const barH = 12;

    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    const tempFrac = Math.min(1, filamentTemp / MAX_TEMP);
    const tempColor = tempToColor(filamentTemp);
    ctx.fillStyle = `rgb(${tempColor.r},${tempColor.g},${tempColor.b})`;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * tempFrac, barH, 4);
    ctx.fill();

    ctx.fillStyle = "#889";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("0°C", barX, barY + barH + 12);
    ctx.textAlign = "right";
    ctx.fillText(`${MAX_TEMP}°C`, barX + barW, barY + barH + 12);

    // Wien's law
    if (filamentTemp > 500) {
      const peakWL = 2898000 / (filamentTemp + 273.15);
      ctx.fillStyle = "#ffcc88";
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`Wien's law: λ_peak = ${peakWL.toFixed(0)} nm`, barX, barY + barH + 28);
    }

    // Spectrum bar
    const specY = barY + barH + 38;
    const specH = 10;
    const specGrad = ctx.createLinearGradient(barX, specY, barX + barW, specY);
    specGrad.addColorStop(0, "#4400aa");
    specGrad.addColorStop(0.15, "#0000ff");
    specGrad.addColorStop(0.3, "#00ff00");
    specGrad.addColorStop(0.5, "#ffff00");
    specGrad.addColorStop(0.7, "#ff8800");
    specGrad.addColorStop(1, "#ff0000");
    ctx.fillStyle = specGrad;
    ctx.beginPath();
    ctx.roundRect(barX, specY, barW, specH, 3);
    ctx.fill();

    ctx.fillStyle = "#778";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("380nm", barX, specY + specH + 10);
    ctx.textAlign = "right";
    ctx.fillText("750nm", barX + barW, specY + specH + 10);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initElectrons();
    },

    update(dt: number, params: Record<string, number>) {
      voltage = params.voltage ?? 12;
      resistance = params.resistance ?? 10;
      isOn = params.isOn ?? 1;

      // Temperature dynamics
      const current = isOn >= 1 ? voltage / resistance : 0;
      const power = current * current * resistance;
      const heatRate = power * 50; // scaling factor
      const coolingRate = (filamentTemp - AMBIENT) * 5;

      filamentTemp += (heatRate - coolingRate) * dt;
      filamentTemp = Math.max(AMBIENT, Math.min(MAX_TEMP, filamentTemp));

      // Update electrons
      if (isOn >= 1) {
        const bulbCx = width * 0.35;
        const bulbCy = height * 0.4;
        const bulbR = Math.min(width * 0.18, height * 0.25);

        for (const e of electrons) {
          e.progress += e.speed * dt * (current / 1.2);
          if (e.progress >= 1) {
            e.progress -= 1;
            e.segment = (e.segment + 1) % 4;
          }

          // Position based on segment
          const p = e.progress;
          switch (e.segment) {
            case 0: // left wire up
              e.x = bulbCx - bulbR * 0.3;
              e.y = bulbCy + bulbR + 20 - p * (bulbR * 0.8);
              break;
            case 1: // filament left to right
              e.x = bulbCx - bulbR * 0.3 + p * bulbR * 0.6;
              e.y = bulbCy + Math.sin(p * Math.PI * 4) * 10;
              break;
            case 2: // right wire down
              e.x = bulbCx + bulbR * 0.3;
              e.y = bulbCy + bulbR * 0.2 + p * (bulbR * 0.8);
              break;
            case 3: // bottom wire
              e.x = bulbCx + bulbR * 0.3 - p * bulbR * 0.6;
              e.y = bulbCy + bulbR + 20;
              break;
          }
        }
      }

      // Update photons
      for (let i = photons.length - 1; i >= 0; i--) {
        const p = photons[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life += dt;
        if (p.life >= p.maxLife) {
          photons.splice(i, 1);
        }
      }
      // Limit photons
      while (photons.length > 100) photons.shift();

      time += dt;
    },

    render() {
      ctx.fillStyle = "#0c1222";
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Incandescent Light Bulb", width / 2, 28);

      ctx.fillStyle = "#889";
      ctx.font = "12px monospace";
      ctx.fillText("Electrical energy → Heat → Light (incandescence)", width / 2, 48);

      drawBulb();
      drawCircuit();
      drawInfoPanel();
    },

    reset() {
      time = 0;
      filamentTemp = AMBIENT;
      photons = [];
      initElectrons();
    },

    destroy() {
      electrons = [];
      photons = [];
    },

    getStateDescription() {
      const current = isOn >= 1 ? voltage / resistance : 0;
      const power = current * current * resistance;
      return `Incandescent bulb: ${isOn >= 1 ? "ON" : "OFF"}, V=${voltage}V, R=${resistance}Ω, I=${current.toFixed(2)}A, P=${power.toFixed(1)}W. Filament temp=${filamentTemp.toFixed(0)}°C/${MAX_TEMP}°C. Current heats tungsten filament until it glows (incandescence).`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default IncandescenceFactory;
