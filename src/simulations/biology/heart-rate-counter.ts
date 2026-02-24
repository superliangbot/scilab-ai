import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const HeartRateCounterFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("heart-rate-counter") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let bpm = 72;
  let amplitude = 1.0;
  let noiseLevel = 0.1;

  // Simulated PPG waveform data
  const waveformData: number[] = [];
  const MAX_SAMPLES = 300;
  let beatPhase = 0;
  let detectedBPM = 0;
  let lastPeakTime = 0;
  const peakTimes: number[] = [];
  let heartScale = 1;
  let heartGrowing = false;

  function generatePPGSample(t: number): number {
    const period = 60 / bpm;
    const phase = (t % period) / period;

    // Realistic PPG waveform shape
    let signal = 0;

    // Systolic peak (main upstroke)
    if (phase < 0.15) {
      signal = Math.sin((phase / 0.15) * Math.PI) * amplitude;
    }
    // Dicrotic notch and secondary wave
    else if (phase < 0.25) {
      signal = Math.sin(((phase - 0.15) / 0.1) * Math.PI) * amplitude * 0.3;
    }
    // Diastolic decay
    else if (phase < 0.6) {
      const decay = 1 - (phase - 0.25) / 0.35;
      signal = decay * amplitude * 0.15;
    }
    // Baseline
    else {
      signal = 0;
    }

    // Add noise
    signal += (Math.random() - 0.5) * noiseLevel * amplitude * 0.3;

    return signal;
  }

  function detectPeaks() {
    if (waveformData.length < 10) return;

    const last = waveformData.length - 1;
    // Simple peak detection
    if (last >= 2 &&
      waveformData[last - 1] > waveformData[last - 2] &&
      waveformData[last - 1] > waveformData[last] &&
      waveformData[last - 1] > amplitude * 0.5) {
      const peakTime = time;
      if (peakTime - lastPeakTime > 0.3) { // min 0.3s between peaks
        peakTimes.push(peakTime);
        lastPeakTime = peakTime;
        heartGrowing = true;

        // Keep only recent peaks
        while (peakTimes.length > 10) peakTimes.shift();

        // Calculate BPM from peak intervals
        if (peakTimes.length >= 3) {
          let totalInterval = 0;
          for (let i = 1; i < peakTimes.length; i++) {
            totalInterval += peakTimes[i] - peakTimes[i - 1];
          }
          const avgInterval = totalInterval / (peakTimes.length - 1);
          detectedBPM = Math.round(60 / avgInterval);
        }
      }
    }
  }

  function drawHeart(cx: number, cy: number, size: number) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(size / 30, size / 30);

    ctx.fillStyle = "#ff3355";
    ctx.shadowColor = "#ff3355";
    ctx.shadowBlur = 15 * heartScale;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.bezierCurveTo(-15, -25, -30, -5, 0, 20);
    ctx.moveTo(0, -5);
    ctx.bezierCurveTo(15, -25, 30, -5, 0, 20);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawWaveform() {
    const waveX = 30;
    const waveY = height * 0.4;
    const waveW = width - 60;
    const waveH = height * 0.3;

    // Background
    ctx.fillStyle = "rgba(15,20,35,0.8)";
    ctx.strokeStyle = "rgba(100,150,200,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(waveX - 10, waveY - waveH / 2 - 10, waveW + 20, waveH + 20, 8);
    ctx.fill();
    ctx.stroke();

    // Grid lines
    ctx.strokeStyle = "rgba(50,70,90,0.4)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = waveY - waveH / 2 + (i / 4) * waveH;
      ctx.beginPath();
      ctx.moveTo(waveX, y);
      ctx.lineTo(waveX + waveW, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 10; i++) {
      const x = waveX + (i / 10) * waveW;
      ctx.beginPath();
      ctx.moveTo(x, waveY - waveH / 2);
      ctx.lineTo(x, waveY + waveH / 2);
      ctx.stroke();
    }

    // Waveform
    if (waveformData.length > 1) {
      ctx.strokeStyle = "#ff4466";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#ff4466";
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for (let i = 0; i < waveformData.length; i++) {
        const x = waveX + (i / MAX_SAMPLES) * waveW;
        const y = waveY - waveformData[i] * (waveH * 0.4);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Label
    ctx.fillStyle = "#667";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("PPG Waveform (Photoplethysmography)", waveX, waveY - waveH / 2 - 15);
  }

  function drawECGStyle() {
    const eY = height * 0.78;
    const eW = width - 60;
    const eH = height * 0.12;
    const eX = 30;

    ctx.fillStyle = "rgba(15,25,15,0.8)";
    ctx.strokeStyle = "rgba(50,150,50,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(eX - 10, eY - eH / 2 - 10, eW + 20, eH + 20, 8);
    ctx.fill();
    ctx.stroke();

    // ECG-style display
    const period = 60 / bpm;
    ctx.strokeStyle = "#22ff66";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#22ff66";
    ctx.shadowBlur = 3;
    ctx.beginPath();
    for (let i = 0; i < eW; i++) {
      const t = (i / eW) * 4 * period + time;
      const phase = (t % period) / period;
      let y = 0;

      // P wave
      if (phase > 0.0 && phase < 0.08) {
        y = Math.sin(((phase - 0.0) / 0.08) * Math.PI) * 0.15;
      }
      // QRS complex
      else if (phase > 0.12 && phase < 0.14) {
        y = -0.2;
      } else if (phase > 0.14 && phase < 0.18) {
        y = Math.sin(((phase - 0.14) / 0.04) * Math.PI) * 1.0;
      } else if (phase > 0.18 && phase < 0.20) {
        y = -0.15;
      }
      // T wave
      else if (phase > 0.25 && phase < 0.38) {
        y = Math.sin(((phase - 0.25) / 0.13) * Math.PI) * 0.3;
      }

      const px = eX + i;
      const py = eY - y * (eH * 0.45);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#446";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("ECG Representation", eX, eY - eH / 2 - 15);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      waveformData.length = 0;
      peakTimes.length = 0;
    },

    update(dt: number, params: Record<string, number>) {
      bpm = params.bpm ?? 72;
      amplitude = params.amplitude ?? 1.0;
      noiseLevel = params.noiseLevel ?? 0.1;

      time += dt;

      // Generate waveform samples
      const sample = generatePPGSample(time);
      waveformData.push(sample);
      if (waveformData.length > MAX_SAMPLES) {
        waveformData.shift();
      }

      detectPeaks();

      // Heart animation
      if (heartGrowing) {
        heartScale += dt * 8;
        if (heartScale >= 1.3) {
          heartGrowing = false;
        }
      } else {
        heartScale = Math.max(1, heartScale - dt * 4);
      }
    },

    render() {
      ctx.fillStyle = "#0c1222";
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Heart Rate Monitor", width / 2, 28);

      // Heart and BPM display
      const heartCx = width / 2;
      const heartCy = height * 0.17;
      drawHeart(heartCx - 60, heartCy, 25 * heartScale);

      // BPM display
      ctx.fillStyle = "#ff3355";
      ctx.font = "bold 48px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${detectedBPM || "--"}`, heartCx + 20, heartCy + 12);

      ctx.fillStyle = "#aa6677";
      ctx.font = "14px sans-serif";
      ctx.fillText("BPM", heartCx + 20, heartCy + 30);

      // Reference info
      ctx.fillStyle = "#667788";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`Set: ${bpm} BPM  |  Detected: ${detectedBPM || "--"} BPM`, width / 2, heartCy + 52);

      // Draw waveform
      drawWaveform();

      // Draw ECG
      drawECGStyle();

      // Reference ranges
      ctx.fillStyle = "#556";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Normal ranges: Adults 60-100 BPM | Children 80-120 BPM | Athletes 40-60 BPM", width / 2, height - 12);
    },

    reset() {
      time = 0;
      waveformData.length = 0;
      peakTimes.length = 0;
      detectedBPM = 0;
      heartScale = 1;
    },

    destroy() {
      waveformData.length = 0;
      peakTimes.length = 0;
    },

    getStateDescription() {
      return `Heart rate monitor showing simulated PPG waveform at ${bpm} BPM. Detected rate: ${detectedBPM || "calculating"} BPM. Amplitude=${amplitude.toFixed(2)}. PPG uses light absorption changes from blood volume pulses to detect heartbeats.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default HeartRateCounterFactory;
