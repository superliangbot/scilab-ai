import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

/**
 * Pulse/PWM Signal Generator: Demonstrates pulse-width modulation (PWM),
 * duty cycle, frequency, and their effects on average output voltage.
 * Commonly used with microcontrollers to control LEDs, motors, etc.
 */
const MicrobitPulseFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("microbit-pulse") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let frequency = 10; // Hz
  let dutyCycle = 50; // percent
  let amplitude = 5; // V
  let showAverage = 1;

  function getPulseValue(t: number): number {
    const period = 1 / frequency;
    const phase = (t % period) / period;
    return phase < dutyCycle / 100 ? amplitude : 0;
  }

  function getAverageVoltage(): number {
    return amplitude * (dutyCycle / 100);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      frequency = Math.max(0.1, params.frequency ?? 10);
      dutyCycle = Math.max(0, Math.min(100, params.dutyCycle ?? 50));
      amplitude = Math.max(0.01, params.amplitude ?? 5);
      showAverage = params.showAverage ?? 1;
      time += dt;
    },

    render() {
      if (!ctx) return;

      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Pulse Width Modulation (PWM)", W / 2, 28);

      // Oscilloscope-style waveform display
      const scopeX = W * 0.06;
      const scopeY = 50;
      const scopeW = W * 0.88;
      const scopeH = H * 0.38;

      // Scope background
      ctx.fillStyle = "#0a1628";
      ctx.beginPath();
      ctx.roundRect(scopeX, scopeY, scopeW, scopeH, 8);
      ctx.fill();
      ctx.strokeStyle = "#1e3a5f";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Grid
      ctx.strokeStyle = "rgba(30, 58, 95, 0.5)";
      ctx.lineWidth = 0.5;
      const gridCols = 10;
      const gridRows = 5;
      for (let i = 1; i < gridCols; i++) {
        const gx = scopeX + (i / gridCols) * scopeW;
        ctx.beginPath();
        ctx.moveTo(gx, scopeY);
        ctx.lineTo(gx, scopeY + scopeH);
        ctx.stroke();
      }
      for (let i = 1; i < gridRows; i++) {
        const gy = scopeY + (i / gridRows) * scopeH;
        ctx.beginPath();
        ctx.moveTo(scopeX, gy);
        ctx.lineTo(scopeX + scopeW, gy);
        ctx.stroke();
      }

      // Y-axis labels
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "right";
      ctx.fillText(`${amplitude}V`, scopeX - 4, scopeY + 15);
      ctx.fillText("0V", scopeX - 4, scopeY + scopeH - 2);

      // Draw PWM waveform
      const period = 1 / frequency;
      const numPeriods = 4;
      const totalTime = period * numPeriods;
      const plotMargin = 10;
      const plotW = scopeW - plotMargin * 2;
      const plotH = scopeH - 30;
      const baseY = scopeY + scopeH - 15;
      const topY = scopeY + 15;

      ctx.beginPath();
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;

      let prevV = 0;
      for (let px = 0; px <= plotW; px++) {
        const t = (px / plotW) * totalTime;
        const v = getPulseValue(t);
        const x = scopeX + plotMargin + px;
        const y = baseY - (v / amplitude) * plotH;

        if (px === 0) {
          ctx.moveTo(x, y);
        } else {
          // Vertical transition for square wave
          if (v !== prevV) {
            const prevY = baseY - (prevV / amplitude) * plotH;
            ctx.lineTo(x, prevY);
            ctx.lineTo(x, y);
          }
          ctx.lineTo(x, y);
        }
        prevV = v;
      }
      ctx.stroke();

      // Highlight current position
      const currentPhase = time % totalTime;
      const curX = scopeX + plotMargin + (currentPhase / totalTime) * plotW;
      const curV = getPulseValue(time);
      const curY = baseY - (curV / amplitude) * plotH;

      ctx.beginPath();
      ctx.arc(curX, curY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#22c55e";
      ctx.fill();

      // Scanning line
      ctx.beginPath();
      ctx.moveTo(curX, scopeY);
      ctx.lineTo(curX, scopeY + scopeH);
      ctx.strokeStyle = "rgba(34, 197, 94, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Average voltage line
      if (showAverage) {
        const avgV = getAverageVoltage();
        const avgY = baseY - (avgV / amplitude) * plotH;
        ctx.beginPath();
        ctx.moveTo(scopeX + plotMargin, avgY);
        ctx.lineTo(scopeX + plotMargin + plotW, avgY);
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = "11px system-ui, sans-serif";
        ctx.fillStyle = "#ef4444";
        ctx.textAlign = "left";
        ctx.fillText(`Avg: ${avgV.toFixed(2)}V`, scopeX + plotMargin + plotW + 5, avgY + 4);
      }

      // Duty cycle visualization
      const dcY = scopeY + scopeH + 30;
      const dcW = W * 0.35;
      const dcH = 40;
      const dcX = W * 0.05;

      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Duty Cycle", dcX, dcY - 8);

      // Full bar
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.roundRect(dcX, dcY, dcW, dcH, 6);
      ctx.fill();

      // ON portion
      const onW = (dutyCycle / 100) * dcW;
      ctx.fillStyle = "#22c55e";
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.roundRect(dcX, dcY, onW, dcH, [6, 0, 0, 6]);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      if (onW > 40) ctx.fillText("ON", dcX + onW / 2, dcY + dcH / 2 + 5);
      if (dcW - onW > 40) {
        ctx.fillStyle = "#64748b";
        ctx.fillText("OFF", dcX + onW + (dcW - onW) / 2, dcY + dcH / 2 + 5);
      }

      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "left";
      ctx.fillText(`${dutyCycle}%`, dcX + dcW + 15, dcY + dcH / 2 + 6);

      // LED brightness visualization
      const ledX = W * 0.55;
      const ledY = dcY + dcH / 2;
      const ledR = 25;
      const brightness = dutyCycle / 100;

      // LED glow
      const glow = ctx.createRadialGradient(ledX, ledY, 0, ledX, ledY, ledR * 3);
      glow.addColorStop(0, `rgba(255, 200, 50, ${brightness * 0.5})`);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ledX, ledY, ledR * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ledX, ledY, ledR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 200, 50, ${brightness})`;
      ctx.fill();
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText("LED Brightness", ledX, ledY + ledR + 18);
      ctx.fillText(`${(brightness * 100).toFixed(0)}%`, ledX, ledY + ledR + 32);

      // Motor speed visualization
      const motorX = W * 0.8;
      const motorY = dcY + dcH / 2;
      const motorR = 22;
      const motorAngle = time * brightness * 20;

      ctx.beginPath();
      ctx.arc(motorX, motorY, motorR, 0, Math.PI * 2);
      ctx.fillStyle = "#334155";
      ctx.fill();
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Spinning indicator
      for (let i = 0; i < 3; i++) {
        const a = motorAngle + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.moveTo(motorX, motorY);
        ctx.lineTo(motorX + motorR * 0.8 * Math.cos(a), motorY + motorR * 0.8 * Math.sin(a));
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(motorX, motorY, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#3b82f6";
      ctx.fill();

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText("Motor Speed", motorX, motorY + motorR + 18);

      // Info panel
      const panelY = H - 65;
      ctx.font = "13px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "#22c55e";
      ctx.fillText(`Frequency: ${frequency} Hz`, 16, panelY);
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`Period: ${(1000 / frequency).toFixed(1)} ms`, 16, panelY + 18);
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`ON time: ${((dutyCycle / 100) * (1000 / frequency)).toFixed(1)} ms`, 16, panelY + 36);

      ctx.textAlign = "right";
      ctx.fillStyle = "#c084fc";
      ctx.fillText(`V_avg = V × duty = ${amplitude} × ${dutyCycle}% = ${getAverageVoltage().toFixed(2)} V`, W - 16, panelY);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`PWM is used for LED dimming, motor speed control, audio`, W - 16, panelY + 18);

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText("PWM rapidly switches between HIGH and LOW; the average voltage controls the effective output", W / 2, H - 8);
    },

    reset() {
      time = 0;
    },

    destroy() {},

    getStateDescription(): string {
      const avg = getAverageVoltage();
      return (
        `PWM Signal: frequency=${frequency}Hz, duty cycle=${dutyCycle}%, amplitude=${amplitude}V. ` +
        `Average voltage=${avg.toFixed(2)}V. Period=${(1000 / frequency).toFixed(1)}ms. ` +
        `ON time=${((dutyCycle / 100) * (1000 / frequency)).toFixed(1)}ms. ` +
        `PWM controls effective power by varying the fraction of time the signal is HIGH.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default MicrobitPulseFactory;
