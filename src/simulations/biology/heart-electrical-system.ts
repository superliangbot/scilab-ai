import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const heartElectricalSystemFactory: SimulationFactory = () => {
  const config = getSimConfig("heart-electrical-system")!;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W = 800, H = 600, time = 0;

  let heartRate = 72;
  let conductionDelay = 1;
  let amplitude = 1;
  let showConduction = 1;

  // ECG waveform history
  const ecgHistory: number[] = [];
  const maxEcgPoints = 500;

  // Cardiac cycle phase: 0-1
  function cyclePhase(): number {
    const period = 60 / heartRate;
    return (time % period) / period;
  }

  // Conduction system activation times (as fraction of cycle)
  const conductionNodes = [
    { name: "SA Node", x: 0.52, y: 0.18, activateAt: 0.0 },
    { name: "Atrial Muscle", x: 0.5, y: 0.28, activateAt: 0.05 },
    { name: "AV Node", x: 0.5, y: 0.38, activateAt: 0.12 },
    { name: "Bundle of His", x: 0.5, y: 0.48, activateAt: 0.22 },
    { name: "Left Bundle", x: 0.42, y: 0.55, activateAt: 0.28 },
    { name: "Right Bundle", x: 0.58, y: 0.55, activateAt: 0.28 },
    { name: "Purkinje Fibers", x: 0.5, y: 0.65, activateAt: 0.33 },
  ];

  // Generate ECG voltage at given phase
  function ecgVoltage(phase: number): number {
    // Simplified ECG: P wave, QRS complex, T wave
    const a = amplitude;
    let v = 0;

    // P wave (atrial depolarization) — phase 0.05–0.12
    const pCenter = 0.08;
    const pWidth = 0.04;
    v += a * 0.2 * Math.exp(-((phase - pCenter) ** 2) / (2 * pWidth ** 2));

    // PR segment delay (adjusted by conduction delay)
    const prDelay = 0.04 * conductionDelay;

    // Q wave — small negative deflection
    const qCenter = 0.15 + prDelay;
    v -= a * 0.1 * Math.exp(-((phase - qCenter) ** 2) / (2 * 0.008 ** 2));

    // R wave — large positive spike
    const rCenter = 0.18 + prDelay;
    v += a * 1.0 * Math.exp(-((phase - rCenter) ** 2) / (2 * 0.01 ** 2));

    // S wave — negative after R
    const sCenter = 0.21 + prDelay;
    v -= a * 0.25 * Math.exp(-((phase - sCenter) ** 2) / (2 * 0.01 ** 2));

    // T wave (ventricular repolarization)
    const tCenter = 0.35 + prDelay;
    const tWidth = 0.05;
    v += a * 0.3 * Math.exp(-((phase - tCenter) ** 2) / (2 * tWidth ** 2));

    return v;
  }

  function drawHeart(cx: number, cy: number, scale: number) {
    const phase = cyclePhase();

    // Heart outline (simplified shape)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Atria (top)
    const atrialPump = phase < 0.12 ? Math.sin(phase / 0.12 * Math.PI) * 0.08 : 0;
    // Ventricles (bottom)
    const ventPump = (phase > 0.15 && phase < 0.4) ? Math.sin((phase - 0.15) / 0.25 * Math.PI) * 0.1 : 0;

    // Right atrium
    ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
    ctx.beginPath();
    ctx.ellipse(30, -30, 35 + atrialPump * 100, 30 + atrialPump * 100, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Left atrium
    ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
    ctx.beginPath();
    ctx.ellipse(-30, -30, 35 + atrialPump * 100, 30 + atrialPump * 100, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Right ventricle
    ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
    ctx.beginPath();
    ctx.ellipse(25, 30, 30 + ventPump * 100, 45 + ventPump * 100, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Left ventricle
    ctx.fillStyle = "rgba(59, 130, 246, 0.4)";
    ctx.beginPath();
    ctx.ellipse(-25, 30, 35 + ventPump * 100, 50 + ventPump * 100, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Septum
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -50);
    ctx.lineTo(0, 70);
    ctx.stroke();

    ctx.restore();

    // Chamber labels
    ctx.font = "10px Arial";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("RA", cx + 30 * scale, cy - 30 * scale);
    ctx.fillText("LA", cx - 30 * scale, cy - 30 * scale);
    ctx.fillText("RV", cx + 25 * scale, cy + 30 * scale);
    ctx.fillText("LV", cx - 25 * scale, cy + 30 * scale);
  }

  function drawConductionSystem(cx: number, cy: number, scale: number) {
    if (!showConduction) return;
    const phase = cyclePhase();

    for (let i = 0; i < conductionNodes.length; i++) {
      const node = conductionNodes[i];
      const nx = cx + (node.x - 0.5) * 200 * scale;
      const ny = cy + (node.y - 0.4) * 200 * scale;

      // Activation state
      const activated = phase >= node.activateAt && phase < node.activateAt + 0.08;
      const past = phase >= node.activateAt + 0.08;

      // Connection lines
      if (i > 0 && i !== 5) {
        const prev = conductionNodes[Math.max(0, i === 5 ? 3 : i - 1)];
        const px = cx + (prev.x - 0.5) * 200 * scale;
        const py = cy + (prev.y - 0.4) * 200 * scale;
        ctx.strokeStyle = activated ? "#facc15" : past ? "rgba(250, 204, 21, 0.3)" : "rgba(148, 163, 184, 0.2)";
        ctx.lineWidth = activated ? 3 : 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }

      // Node dot
      const r = activated ? 8 : 5;
      const color = activated ? "#facc15" : past ? "#f59e0b" : "#475569";
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (activated) {
        // Pulse ring
        const pulseR = r + (phase - node.activateAt) * 200;
        ctx.strokeStyle = `rgba(250, 204, 21, ${Math.max(0, 0.5 - (phase - node.activateAt) * 5)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(nx, ny, pulseR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Label
      ctx.font = "9px Arial";
      ctx.fillStyle = activated ? "#facc15" : "#64748b";
      ctx.textAlign = "left";
      ctx.fillText(node.name, nx + 12, ny + 3);
    }
  }

  function drawECG() {
    const gx = W * 0.03, gy = H * 0.62, gw = W * 0.94, gh = H * 0.34;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeRect(gx, gy, gw, gh);

    // ECG grid (light pink like real ECG paper)
    ctx.strokeStyle = "rgba(239, 68, 68, 0.08)";
    ctx.lineWidth = 0.5;
    const gridSize = 12;
    for (let x = gx; x < gx + gw; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy + gh); ctx.stroke();
    }
    for (let y = gy; y < gy + gh; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y); ctx.stroke();
    }
    // Major grid
    ctx.strokeStyle = "rgba(239, 68, 68, 0.15)";
    ctx.lineWidth = 1;
    for (let x = gx; x < gx + gw; x += gridSize * 5) {
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy + gh); ctx.stroke();
    }
    for (let y = gy; y < gy + gh; y += gridSize * 5) {
      ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y); ctx.stroke();
    }

    // Title
    ctx.font = "bold 13px Arial";
    ctx.fillStyle = "#22c55e";
    ctx.textAlign = "left";
    ctx.fillText("ECG Lead II", gx + 10, gy + 16);

    ctx.font = "11px Arial";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "right";
    ctx.fillText(`${heartRate} BPM`, gx + gw - 10, gy + 16);

    // ECG trace
    if (ecgHistory.length > 1) {
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const midY = gy + gh * 0.5;
      const yScale = gh * 0.35;
      for (let i = 0; i < ecgHistory.length; i++) {
        const px = gx + 5 + (i / maxEcgPoints) * (gw - 10);
        const py = midY - ecgHistory[i] * yScale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Wave labels
    ctx.font = "10px Arial";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    const labelY = gy + gh - 8;
    ctx.fillText("P: atrial depol.", gx + gw * 0.15, labelY);
    ctx.fillText("QRS: ventricular depol.", gx + gw * 0.45, labelY);
    ctx.fillText("T: ventricular repol.", gx + gw * 0.75, labelY);
  }

  const engine: SimulationEngine = {
    config,
    init(c) {
      canvas = c; ctx = c.getContext("2d")!; W = c.width; H = c.height;
      time = 0; ecgHistory.length = 0;
    },
    update(dt, params) {
      heartRate = params.heartRate ?? heartRate;
      conductionDelay = params.conductionDelay ?? conductionDelay;
      amplitude = params.amplitude ?? amplitude;
      showConduction = Math.round(params.showConduction ?? showConduction);
      time += dt;

      const phase = cyclePhase();
      ecgHistory.push(ecgVoltage(phase));
      if (ecgHistory.length > maxEcgPoints) ecgHistory.shift();
    },
    render() {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Heart Electrical System & ECG", W / 2, 28);

      const heartCx = W * 0.35, heartCy = H * 0.33;
      const heartScale = Math.min(W, H) * 0.0022;

      drawHeart(heartCx, heartCy, heartScale);
      drawConductionSystem(heartCx, heartCy, heartScale);

      // Info panel
      const ix = W * 0.65, iy = H * 0.08;
      ctx.font = "13px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText(`Heart Rate: ${heartRate} BPM`, ix, iy);
      ctx.fillText(`Period: ${(60 / heartRate).toFixed(2)} s`, ix, iy + 20);
      ctx.fillText(`AV Delay: ${(0.12 * conductionDelay * 60 / heartRate * 1000).toFixed(0)} ms`, ix, iy + 40);

      const phase = cyclePhase();
      const stateLabel = phase < 0.12 ? "Atrial Systole" : phase < 0.4 ? "Ventricular Systole" : "Diastole";
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = phase < 0.12 ? "#ef4444" : phase < 0.4 ? "#3b82f6" : "#22c55e";
      ctx.fillText(stateLabel, ix, iy + 68);

      // Conduction sequence
      ctx.font = "11px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("Conduction: SA → Atria → AV → His → Branches → Purkinje", ix, iy + 90);

      drawECG();
    },
    reset() {
      time = 0;
      ecgHistory.length = 0;
    },
    destroy() {},
    getStateDescription() {
      const phase = cyclePhase();
      const state = phase < 0.12 ? "atrial systole (P wave)" : phase < 0.4 ? "ventricular systole (QRS)" : "diastole (T wave/resting)";
      return `Heart electrical system: ${heartRate} BPM, currently in ${state}. AV conduction delay: ${conductionDelay}×. The ECG shows P wave (atrial depolarization), QRS complex (ventricular depolarization), and T wave (ventricular repolarization).`;
    },
    resize(w, h) { W = w; H = h; },
  };
  return engine;
};

export default heartElectricalSystemFactory;
