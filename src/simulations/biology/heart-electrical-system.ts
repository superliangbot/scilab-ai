import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const HeartElectricalSystemFactory: SimulationFactory = () => {
  const config = getSimConfig("heart-electrical-system")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let heartRate = 72;        // beats per minute
  let conductionDelay = 1.0; // AV node delay factor
  let amplitude = 1.0;       // ECG amplitude
  let showConduction = 1;    // show electrical conduction system

  // Heart anatomy points (relative coordinates)
  const heartCenterX = 0.25;
  const heartCenterY = 0.45;
  
  const anatomyPoints = {
    // Sinoatrial node (pacemaker)
    saNode: { x: heartCenterX + 0.08, y: heartCenterY - 0.12 },
    // Atrioventricular node
    avNode: { x: heartCenterX - 0.02, y: heartCenterY - 0.05 },
    // Bundle of His
    bundleOfHis: { x: heartCenterX - 0.02, y: heartCenterY - 0.02 },
    // Left and right bundle branches
    leftBundle: { x: heartCenterX - 0.08, y: heartCenterY + 0.05 },
    rightBundle: { x: heartCenterX + 0.04, y: heartCenterY + 0.05 },
    // Purkinje fibers endpoints
    leftPurkinje: [
      { x: heartCenterX - 0.12, y: heartCenterY + 0.08 },
      { x: heartCenterX - 0.10, y: heartCenterY + 0.12 },
      { x: heartCenterX - 0.06, y: heartCenterY + 0.10 }
    ],
    rightPurkinje: [
      { x: heartCenterX + 0.08, y: heartCenterY + 0.08 },
      { x: heartCenterX + 0.10, y: heartCenterY + 0.12 },
      { x: heartCenterX + 0.06, y: heartCenterY + 0.10 }
    ]
  };

  // Electrical activity state
  let currentBeat = 0;
  let beatPhase = 0; // 0 to 1 through cardiac cycle
  
  let electricalWaves: Array<{
    x: number;
    y: number;
    radius: number;
    intensity: number;
    phase: string; // 'p', 'qrs', 't'
  }> = [];

  // ECG waveform data
  let ecgHistory: Array<{ time: number; voltage: number }> = [];
  let currentECGVoltage = 0;

  // Heart chambers animation
  let atrialContraction = 0;
  let ventricularContraction = 0;

  function calculateBeatTiming(): { period: number; rr_interval: number } {
    const period = 60 / heartRate; // seconds per beat
    const rr_interval = period * 1000; // milliseconds
    return { period, rr_interval };
  }

  function updateElectricalActivity(dt: number) {
    const timing = calculateBeatTiming();
    
    // Update beat phase (0 to 1 over one cardiac cycle)
    beatPhase = (beatPhase + dt / timing.period) % 1;
    
    // Clear old waves
    electricalWaves = [];
    
    // Generate electrical waves based on cardiac cycle phase
    if (beatPhase < 0.15) {
      // P wave - atrial depolarization
      const intensity = Math.sin(beatPhase * Math.PI / 0.15) * 0.8;
      electricalWaves.push({
        x: anatomyPoints.saNode.x * W,
        y: anatomyPoints.saNode.y * H,
        radius: beatPhase * 60,
        intensity,
        phase: 'p'
      });
      
      atrialContraction = intensity;
      currentECGVoltage = intensity * 0.3 * amplitude; // P wave amplitude
      
    } else if (beatPhase >= 0.15 && beatPhase < 0.2) {
      // PR interval - conduction delay at AV node
      atrialContraction = Math.max(0, atrialContraction - dt * 5);
      currentECGVoltage = 0;
      
    } else if (beatPhase >= 0.2 && beatPhase < 0.35) {
      // QRS complex - ventricular depolarization
      const qrsPhase = (beatPhase - 0.2) / 0.15;
      
      // Delay factor for AV node
      const delayedPhase = Math.max(0, qrsPhase - (1 - conductionDelay) * 0.5);
      
      if (delayedPhase > 0) {
        const intensity = Math.sin(delayedPhase * Math.PI) * 1.5;
        
        // AV node activation
        electricalWaves.push({
          x: anatomyPoints.avNode.x * W,
          y: anatomyPoints.avNode.y * H,
          radius: delayedPhase * 20,
          intensity: intensity * 0.8,
          phase: 'qrs'
        });
        
        // Bundle of His
        if (delayedPhase > 0.3) {
          electricalWaves.push({
            x: anatomyPoints.bundleOfHis.x * W,
            y: anatomyPoints.bundleOfHis.y * H,
            radius: (delayedPhase - 0.3) * 40,
            intensity: intensity,
            phase: 'qrs'
          });
        }
        
        // Bundle branches
        if (delayedPhase > 0.5) {
          electricalWaves.push({
            x: anatomyPoints.leftBundle.x * W,
            y: anatomyPoints.leftBundle.y * H,
            radius: (delayedPhase - 0.5) * 35,
            intensity: intensity,
            phase: 'qrs'
          });
          
          electricalWaves.push({
            x: anatomyPoints.rightBundle.x * W,
            y: anatomyPoints.rightBundle.y * H,
            radius: (delayedPhase - 0.5) * 35,
            intensity: intensity,
            phase: 'qrs'
          });
        }
        
        // Purkinje fibers
        if (delayedPhase > 0.7) {
          [...anatomyPoints.leftPurkinje, ...anatomyPoints.rightPurkinje].forEach(point => {
            electricalWaves.push({
              x: point.x * W,
              y: point.y * H,
              radius: (delayedPhase - 0.7) * 25,
              intensity: intensity * 0.9,
              phase: 'qrs'
            });
          });
        }
        
        ventricularContraction = intensity;
        
        // QRS waveform shape
        let qrsVoltage = 0;
        if (delayedPhase < 0.3) {
          qrsVoltage = -0.2 * amplitude; // Q wave
        } else if (delayedPhase < 0.7) {
          qrsVoltage = 1.0 * amplitude; // R wave
        } else {
          qrsVoltage = -0.3 * amplitude; // S wave
        }
        
        currentECGVoltage = qrsVoltage;
      }
      
    } else if (beatPhase >= 0.35 && beatPhase < 0.6) {
      // ST segment
      ventricularContraction = Math.max(0.5, ventricularContraction - dt * 2);
      currentECGVoltage = 0;
      
    } else if (beatPhase >= 0.6 && beatPhase < 0.8) {
      // T wave - ventricular repolarization  
      const tPhase = (beatPhase - 0.6) / 0.2;
      const intensity = Math.sin(tPhase * Math.PI) * 0.6;
      
      electricalWaves.push({
        x: anatomyPoints.leftBundle.x * W,
        y: anatomyPoints.leftBundle.y * H,
        radius: tPhase * 50,
        intensity,
        phase: 't'
      });
      
      electricalWaves.push({
        x: anatomyPoints.rightBundle.x * W,
        y: anatomyPoints.rightBundle.y * H,
        radius: tPhase * 50,
        intensity,
        phase: 't'
      });
      
      ventricularContraction = Math.max(0, ventricularContraction - dt * 3);
      currentECGVoltage = intensity * 0.4 * amplitude; // T wave amplitude
      
    } else {
      // Diastole - resting phase
      ventricularContraction = Math.max(0, ventricularContraction - dt * 4);
      atrialContraction = Math.max(0, atrialContraction - dt * 4);
      currentECGVoltage = 0;
    }

    // Record ECG history
    if (ecgHistory.length === 0 || time - ecgHistory[ecgHistory.length - 1].time > 0.01) {
      ecgHistory.push({
        time: time,
        voltage: currentECGVoltage
      });
      
      // Keep recent history (about 6 seconds)
      if (ecgHistory.length > 600) {
        ecgHistory.shift();
      }
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
      beatPhase = 0;
      ecgHistory = [];
      electricalWaves = [];
    },

    update(dt: number, params: Record<string, number>) {
      heartRate = params.heartRate ?? heartRate;
      conductionDelay = params.conductionDelay ?? conductionDelay;
      amplitude = params.amplitude ?? amplitude;
      showConduction = Math.round(params.showConduction ?? showConduction);

      time += dt;
      updateElectricalActivity(dt);
    },

    render() {
      // Background
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, "#0f172a");
      gradient.addColorStop(1, "#1e293b");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Heart Electrical System & ECG", W / 2, 25);

      // Draw heart outline
      const hx = heartCenterX * W;
      const hy = heartCenterY * H;
      const heartSize = 120;

      // Heart chambers with contraction animation
      ctx.save();
      ctx.translate(hx, hy);

      // Left ventricle
      const lvScale = 1 - ventricularContraction * 0.15;
      ctx.scale(lvScale, lvScale);
      ctx.fillStyle = `rgba(220, 38, 38, ${0.3 + ventricularContraction * 0.4})`;
      ctx.beginPath();
      ctx.arc(-30, 20, 35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(hx, hy);

      // Right ventricle
      const rvScale = 1 - ventricularContraction * 0.12;
      ctx.scale(rvScale, rvScale);
      ctx.fillStyle = `rgba(220, 38, 38, ${0.2 + ventricularContraction * 0.3})`;
      ctx.beginPath();
      ctx.arc(25, 25, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(hx, hy);

      // Left atrium
      const laScale = 1 - atrialContraction * 0.1;
      ctx.scale(laScale, laScale);
      ctx.fillStyle = `rgba(59, 130, 246, ${0.3 + atrialContraction * 0.4})`;
      ctx.beginPath();
      ctx.arc(-25, -30, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(hx, hy);

      // Right atrium
      const raScale = 1 - atrialContraction * 0.08;
      ctx.scale(raScale, raScale);
      ctx.fillStyle = `rgba(59, 130, 246, ${0.2 + atrialContraction * 0.3})`;
      ctx.beginPath();
      ctx.arc(20, -35, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Draw conduction system
      if (showConduction) {
        // SA Node
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(anatomyPoints.saNode.x * W, anatomyPoints.saNode.y * H, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.font = "10px Arial";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "center";
        ctx.fillText("SA", anatomyPoints.saNode.x * W, anatomyPoints.saNode.y * H - 12);

        // AV Node
        ctx.fillStyle = "#f97316";
        ctx.beginPath();
        ctx.arc(anatomyPoints.avNode.x * W, anatomyPoints.avNode.y * H, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = "#f97316";
        ctx.fillText("AV", anatomyPoints.avNode.x * W, anatomyPoints.avNode.y * H - 10);

        // Bundle of His
        ctx.strokeStyle = "#84cc16";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(anatomyPoints.avNode.x * W, anatomyPoints.avNode.y * H);
        ctx.lineTo(anatomyPoints.bundleOfHis.x * W, anatomyPoints.bundleOfHis.y * H);
        ctx.stroke();

        // Bundle branches
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2;
        
        // Left bundle branch
        ctx.beginPath();
        ctx.moveTo(anatomyPoints.bundleOfHis.x * W, anatomyPoints.bundleOfHis.y * H);
        ctx.lineTo(anatomyPoints.leftBundle.x * W, anatomyPoints.leftBundle.y * H);
        ctx.stroke();
        
        // Right bundle branch
        ctx.beginPath();
        ctx.moveTo(anatomyPoints.bundleOfHis.x * W, anatomyPoints.bundleOfHis.y * H);
        ctx.lineTo(anatomyPoints.rightBundle.x * W, anatomyPoints.rightBundle.y * H);
        ctx.stroke();

        // Purkinje fibers
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 1;
        
        anatomyPoints.leftPurkinje.forEach(point => {
          ctx.beginPath();
          ctx.moveTo(anatomyPoints.leftBundle.x * W, anatomyPoints.leftBundle.y * H);
          ctx.lineTo(point.x * W, point.y * H);
          ctx.stroke();
        });
        
        anatomyPoints.rightPurkinje.forEach(point => {
          ctx.beginPath();
          ctx.moveTo(anatomyPoints.rightBundle.x * W, anatomyPoints.rightBundle.y * H);
          ctx.lineTo(point.x * W, point.y * H);
          ctx.stroke();
        });
      }

      // Draw electrical waves
      for (const wave of electricalWaves) {
        let color: string;
        switch (wave.phase) {
          case 'p':
            color = `rgba(251, 191, 36, ${wave.intensity})`;
            break;
          case 'qrs':
            color = `rgba(239, 68, 68, ${wave.intensity})`;
            break;
          case 't':
            color = `rgba(16, 185, 129, ${wave.intensity})`;
            break;
          default:
            color = `rgba(255, 255, 255, ${wave.intensity})`;
        }

        // Wave as expanding circle
        const gradient = ctx.createRadialGradient(wave.x, wave.y, 0, wave.x, wave.y, wave.radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color.replace(/[\d.]+\)/, '0)'));
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // ECG trace
      const ecgX = W * 0.5;
      const ecgY = H * 0.65;
      const ecgW = W * 0.45;
      const ecgH = 140;

      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(ecgX, ecgY, ecgW, ecgH);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.strokeRect(ecgX, ecgY, ecgW, ecgH);

      // ECG grid
      ctx.strokeStyle = "#374151";
      ctx.lineWidth = 0.5;
      
      // Horizontal lines
      for (let i = 0; i <= 10; i++) {
        const y = ecgY + (i / 10) * ecgH;
        ctx.beginPath();
        ctx.moveTo(ecgX, y);
        ctx.lineTo(ecgX + ecgW, y);
        ctx.stroke();
      }
      
      // Vertical lines
      for (let i = 0; i <= 20; i++) {
        const x = ecgX + (i / 20) * ecgW;
        ctx.beginPath();
        ctx.moveTo(x, ecgY);
        ctx.lineTo(x, ecgY + ecgH);
        ctx.stroke();
      }

      ctx.font = "12px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("ECG Trace (Lead II)", ecgX + ecgW / 2, ecgY - 8);

      // Plot ECG waveform
      if (ecgHistory.length > 1) {
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < ecgHistory.length; i++) {
          const point = ecgHistory[i];
          const x = ecgX + (i / (ecgHistory.length - 1)) * ecgW;
          const y = ecgY + ecgH / 2 - (point.voltage / (2 * amplitude)) * ecgH * 0.4;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Current voltage indicator
      ctx.fillStyle = "#fbbf24";
      ctx.font = "14px Arial";
      ctx.textAlign = "left";
      ctx.fillText(`${currentECGVoltage.toFixed(2)} mV`, ecgX + 10, ecgY + ecgH + 20);

      // Heart rate monitor
      const timing = calculateBeatTiming();
      const instantaneousHR = Math.round(60000 / timing.rr_interval);
      
      ctx.font = "bold 16px Arial";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "right";
      ctx.fillText(`${instantaneousHR} BPM`, ecgX + ecgW - 10, ecgY + ecgH + 20);

      // Parameters panel
      const paramX = 20;
      const paramY = H * 0.65;
      const paramW = 200;
      const paramH = 140;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(paramX, paramY, paramW, paramH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(paramX, paramY, paramW, paramH);

      let infoY = paramY + 20;
      ctx.font = "bold 12px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Cardiac Parameters", paramX + 10, infoY);
      infoY += 20;

      ctx.font = "11px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Heart Rate: ${heartRate} BPM`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`RR Interval: ${timing.rr_interval.toFixed(0)} ms`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`AV Delay: ${conductionDelay.toFixed(1)}x`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`ECG Amplitude: ${amplitude.toFixed(1)}`, paramX + 10, infoY);
      infoY += 20;

      // Current phase indicator
      let phaseText = "";
      if (beatPhase < 0.15) phaseText = "P wave (Atrial depol.)";
      else if (beatPhase < 0.2) phaseText = "PR interval";
      else if (beatPhase < 0.35) phaseText = "QRS (Ventricular depol.)";
      else if (beatPhase < 0.6) phaseText = "ST segment";
      else if (beatPhase < 0.8) phaseText = "T wave (Ventricular repol.)";
      else phaseText = "Diastole";
      
      ctx.fillStyle = "#10b981";
      ctx.fillText("Phase:", paramX + 10, infoY);
      infoY += 12;
      ctx.fillStyle = "#fbbf24";
      ctx.font = "10px Arial";
      ctx.fillText(phaseText, paramX + 10, infoY);

      // Wave legend
      const waveY = 60;
      const waveItems = [
        { color: "#fbbf24", label: "P wave (Atrial)" },
        { color: "#ef4444", label: "QRS (Ventricular)" },
        { color: "#10b981", label: "T wave (Repolarization)" }
      ];

      ctx.font = "10px Arial";
      waveItems.forEach((item, i) => {
        const x = W * 0.5 + (i % 2) * 140;
        const y = waveY + Math.floor(i / 2) * 15;
        
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = "#e2e8f0";
        ctx.textAlign = "left";
        ctx.fillText(item.label, x + 8, y + 3);
      });

      // Cycle indicator
      ctx.font = "12px Arial";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "left";
      ctx.fillText(`Cycle: ${(beatPhase * 100).toFixed(0)}%`, 10, H - 10);
    },

    reset() {
      time = 0;
      beatPhase = 0;
      ecgHistory = [];
      electricalWaves = [];
      currentBeat = 0;
    },

    destroy() {
      ecgHistory = [];
      electricalWaves = [];
    },

    getStateDescription(): string {
      const timing = calculateBeatTiming();
      let currentPhase = "";
      
      if (beatPhase < 0.15) currentPhase = "P wave - atrial depolarization";
      else if (beatPhase < 0.2) currentPhase = "PR interval - AV conduction delay";
      else if (beatPhase < 0.35) currentPhase = "QRS complex - ventricular depolarization";
      else if (beatPhase < 0.6) currentPhase = "ST segment - ventricular plateau";
      else if (beatPhase < 0.8) currentPhase = "T wave - ventricular repolarization";
      else currentPhase = "diastole - cardiac rest phase";

      return (
        `Heart Electrical System showing cardiac conduction and ECG generation. ` +
        `Heart rate: ${heartRate} BPM, RR interval: ${timing.rr_interval.toFixed(0)}ms. ` +
        `Current phase: ${currentPhase} (${(beatPhase * 100).toFixed(0)}% through cycle). ` +
        `ECG voltage: ${currentECGVoltage.toFixed(2)}mV, AV conduction delay: ${conductionDelay.toFixed(1)}x. ` +
        `Electrical impulses originate from SA node, pass through AV node, Bundle of His, ` +
        `bundle branches, and Purkinje fibers to coordinate heart contraction.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    }
  };

  return engine;
};

export default HeartElectricalSystemFactory;