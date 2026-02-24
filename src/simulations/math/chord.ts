import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Music theory constants ─────────────────────────────────────────
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Equal temperament: each semitone is 2^(1/12) apart
// A4 = 440 Hz, C4 = 261.63 Hz
const C4_FREQ = 261.63;

function equalTemperamentFreq(semitones: number): number {
  return C4_FREQ * Math.pow(2, semitones / 12);
}

// Just intonation ratios from C (relative to root)
const JUST_RATIOS: Record<number, number> = {
  0: 1,       // Unison
  1: 16 / 15, // Minor second
  2: 9 / 8,   // Major second
  3: 6 / 5,   // Minor third
  4: 5 / 4,   // Major third
  5: 4 / 3,   // Perfect fourth
  6: 45 / 32, // Tritone
  7: 3 / 2,   // Perfect fifth
  8: 8 / 5,   // Minor sixth
  9: 5 / 3,   // Major sixth
  10: 9 / 5,  // Minor seventh
  11: 15 / 8, // Major seventh
};

function justIntonationFreq(rootSemitone: number, intervalSemitones: number): number {
  const rootFreq = equalTemperamentFreq(rootSemitone);
  const interval = ((intervalSemitones % 12) + 12) % 12;
  const ratio = JUST_RATIOS[interval] ?? Math.pow(2, interval / 12);
  const octaveShift = Math.floor(intervalSemitones / 12);
  return rootFreq * ratio * Math.pow(2, octaveShift);
}

// Chord intervals (semitones from root)
const CHORD_INTERVALS: number[][] = [
  [0, 4, 7],       // Major triad (4:5:6)
  [0, 3, 7],       // Minor triad (10:12:15)
  [0, 4, 7, 10],   // Dominant seventh
  [0, 5, 7],       // Custom (sus4) - a placeholder
];

const CHORD_NAMES = ["Major", "Minor", "Dominant 7th", "Sus4"];

// Wave colors for each note in chord
const WAVE_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
];

// Piano key data
interface PianoKey {
  note: number; // 0-11
  isBlack: boolean;
  x: number;
  width: number;
}

// ─── Factory ────────────────────────────────────────────────────────
const ChordFactory: SimulationFactory = () => {
  const config = getSimConfig("chord") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let chordType = 0;
  let rootNote = 0;
  let tuning = 0; // 0=ET, 1=JI
  let showIndividual = 1;

  // Computed frequencies
  let activeFreqs: number[] = [];
  let activeNotes: number[] = []; // semitone indices from C4
  let chordName = "";

  function computeChord(): void {
    const intervals = CHORD_INTERVALS[chordType] ?? CHORD_INTERVALS[0];
    activeNotes = intervals.map((i) => rootNote + i);
    chordName = `${NOTE_NAMES[rootNote % 12]} ${CHORD_NAMES[chordType] ?? "Major"}`;

    if (tuning === 0) {
      // Equal temperament
      activeFreqs = activeNotes.map((n) => equalTemperamentFreq(n));
    } else {
      // Just intonation
      activeFreqs = intervals.map((interval) => justIntonationFreq(rootNote, interval));
    }
  }

  // Build piano key layout
  function buildPianoKeys(startX: number, totalWidth: number): PianoKey[] {
    const keys: PianoKey[] = [];
    const whiteNotes = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
    const blackNotes = [1, 3, 6, 8, 10]; // C# D# F# G# A#

    // Two octaves of white keys
    const numWhiteKeys = 15; // C4 to C6 (almost 2 octaves + 1)
    const whiteKeyWidth = totalWidth / numWhiteKeys;
    const whiteKeyHeight = 70;

    // White keys
    let whiteIdx = 0;
    for (let octOffset = 0; octOffset < 2; octOffset++) {
      for (let i = 0; i < whiteNotes.length; i++) {
        if (whiteIdx >= numWhiteKeys) break;
        keys.push({
          note: whiteNotes[i] + octOffset * 12,
          isBlack: false,
          x: startX + whiteIdx * whiteKeyWidth,
          width: whiteKeyWidth,
        });
        whiteIdx++;
      }
    }
    // Extra C at end
    if (whiteIdx < numWhiteKeys) {
      keys.push({
        note: 24,
        isBlack: false,
        x: startX + whiteIdx * whiteKeyWidth,
        width: whiteKeyWidth,
      });
    }

    // Black keys
    whiteIdx = 0;
    for (let octOffset = 0; octOffset < 2; octOffset++) {
      for (let i = 0; i < whiteNotes.length; i++) {
        if (whiteIdx >= numWhiteKeys) break;
        const note = whiteNotes[i] + octOffset * 12;
        // Check if next semitone is black
        const nextSemi = (note + 1) % 12;
        if (blackNotes.includes(nextSemi)) {
          keys.push({
            note: note + 1 + octOffset * (i >= whiteNotes.length - 1 ? 12 : 0),
            isBlack: true,
            x: startX + whiteIdx * whiteKeyWidth + whiteKeyWidth * 0.65,
            width: whiteKeyWidth * 0.7,
          });
        }
        whiteIdx++;
      }
    }

    return keys;
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
      computeChord();
    },

    update(dt: number, params: Record<string, number>) {
      const newChordType = Math.round(params.chordType ?? 0);
      const newRootNote = Math.round(params.rootNote ?? 0);
      const newTuning = Math.round(params.tuning ?? 0);
      showIndividual = Math.round(params.showIndividual ?? 1);

      if (newChordType !== chordType || newRootNote !== rootNote || newTuning !== tuning) {
        chordType = newChordType;
        rootNote = newRootNote;
        tuning = newTuning;
        computeChord();
      }

      time += Math.min(dt, 0.05);
    },

    render() {
      if (!ctx) return;

      // ── Background ──────────────────────────────────
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0a0a1a");
      bgGrad.addColorStop(1, "#10102a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // ── Title ───────────────────────────────────────
      ctx.font = "bold 17px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Musical Chord Waveforms", W / 2, 28);

      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        "Superposition of sine waves \u2014 consonance arises from simple frequency ratios",
        W / 2,
        46
      );

      // Layout regions
      const waveAreaTop = 60;
      const waveAreaBottom = H - 130;
      const waveAreaH = waveAreaBottom - waveAreaTop;
      const pianoTop = H - 115;
      const pianoHeight = 70;

      // ── Individual waveforms ────────────────────────
      if (showIndividual && activeFreqs.length > 0) {
        const numWaves = activeFreqs.length;
        const individualH = waveAreaH * 0.5;
        const waveH = individualH / numWaves;
        const waveMargin = 20;
        const waveLeft = waveMargin;
        const waveRight = W - waveMargin;
        const waveW = waveRight - waveLeft;

        ctx.font = "10px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "left";

        for (let wi = 0; wi < numWaves; wi++) {
          const freq = activeFreqs[wi];
          const noteIdx = activeNotes[wi] % 12;
          const centerY = waveAreaTop + 15 + wi * waveH + waveH / 2;
          const amp = waveH * 0.35;
          const color = WAVE_COLORS[wi % WAVE_COLORS.length];

          // Centerline
          ctx.strokeStyle = "rgba(100, 120, 150, 0.2)";
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(waveLeft, centerY);
          ctx.lineTo(waveRight, centerY);
          ctx.stroke();

          // Draw wave
          // Normalize freq display: show ~3-5 cycles in view
          const displayFreq = freq / 80; // scale to visible cycles
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.8;

          for (let px = 0; px <= waveW; px++) {
            const t = (px / waveW) * Math.PI * 2 * 5; // 5 base cycles
            const y = centerY - amp * Math.sin(displayFreq * t + time * freq * 0.02);
            if (px === 0) ctx.moveTo(waveLeft + px, y);
            else ctx.lineTo(waveLeft + px, y);
          }
          ctx.stroke();

          // Label
          ctx.fillStyle = color;
          ctx.fillText(
            `${NOTE_NAMES[noteIdx]}: ${freq.toFixed(1)} Hz`,
            waveLeft + 5,
            centerY - amp - 5
          );
        }
      }

      // ── Combined waveform ───────────────────────────
      const combinedTop = showIndividual
        ? waveAreaTop + waveAreaH * 0.55
        : waveAreaTop + 10;
      const combinedBottom = waveAreaBottom - 5;
      const combinedH = combinedBottom - combinedTop;
      const combinedCenterY = combinedTop + combinedH / 2;
      const combinedAmp = combinedH * 0.38;
      const waveLeft = 20;
      const waveRight = W - 20;
      const waveW = waveRight - waveLeft;

      // Section label
      ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Combined Waveform (Superposition)", waveLeft + 5, combinedTop - 5);

      // Background for combined wave
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.beginPath();
      ctx.roundRect(waveLeft - 5, combinedTop - 2, waveW + 10, combinedH + 4, 6);
      ctx.fill();

      // Centerline
      ctx.strokeStyle = "rgba(100, 120, 150, 0.3)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(waveLeft, combinedCenterY);
      ctx.lineTo(waveRight, combinedCenterY);
      ctx.stroke();

      // Draw combined wave
      ctx.beginPath();
      const combinedGrad = ctx.createLinearGradient(waveLeft, 0, waveRight, 0);
      combinedGrad.addColorStop(0, "#a78bfa");
      combinedGrad.addColorStop(0.5, "#e879f9");
      combinedGrad.addColorStop(1, "#a78bfa");
      ctx.strokeStyle = combinedGrad;
      ctx.lineWidth = 2;

      const numFreqs = activeFreqs.length;
      for (let px = 0; px <= waveW; px++) {
        const tBase = (px / waveW) * Math.PI * 2 * 5;
        let sum = 0;
        for (let fi = 0; fi < numFreqs; fi++) {
          const freq = activeFreqs[fi];
          const displayFreq = freq / 80;
          sum += Math.sin(displayFreq * tBase + time * freq * 0.02);
        }
        sum /= Math.max(numFreqs, 1); // normalize
        const y = combinedCenterY - combinedAmp * sum;
        if (px === 0) ctx.moveTo(waveLeft + px, y);
        else ctx.lineTo(waveLeft + px, y);
      }
      ctx.stroke();

      // ── Piano keyboard ──────────────────────────────
      const pianoLeft = W * 0.08;
      const pianoWidth = W * 0.84;
      const keys = buildPianoKeys(pianoLeft, pianoWidth);

      // Draw white keys first
      const whiteKeys = keys.filter((k) => !k.isBlack);
      const blackKeys = keys.filter((k) => k.isBlack);

      for (const key of whiteKeys) {
        const isActive = activeNotes.some((n) => ((n % 12) + 12) % 12 === key.note % 12);
        ctx.fillStyle = isActive ? "#4338ca" : "#e2e8f0";
        ctx.fillRect(key.x, pianoTop, key.width - 1, pianoHeight);
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1;
        ctx.strokeRect(key.x, pianoTop, key.width - 1, pianoHeight);

        // Note label on white keys
        if (key.note < 12) {
          ctx.font = "9px 'Inter', system-ui, sans-serif";
          ctx.fillStyle = isActive ? "#e2e8f0" : "#475569";
          ctx.textAlign = "center";
          ctx.fillText(NOTE_NAMES[key.note % 12], key.x + key.width / 2 - 0.5, pianoTop + pianoHeight - 6);
        }
      }

      for (const key of blackKeys) {
        const isActive = activeNotes.some((n) => ((n % 12) + 12) % 12 === key.note % 12);
        const bkH = pianoHeight * 0.6;
        ctx.fillStyle = isActive ? "#6366f1" : "#1e1b4b";
        ctx.fillRect(key.x, pianoTop, key.width, bkH);
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.strokeRect(key.x, pianoTop, key.width, bkH);
      }

      // ── Info panel ──────────────────────────────────
      const infoY = pianoTop + pianoHeight + 6;
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.roundRect(pianoLeft - 5, infoY, pianoWidth + 10, 30, 6);
      ctx.fill();

      ctx.font = "bold 12px 'SF Mono', 'Fira Code', monospace";
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "left";
      ctx.fillText(`Chord: ${chordName}`, pianoLeft + 8, infoY + 14);

      // Frequency ratios
      if (activeFreqs.length > 0) {
        const baseFreq = activeFreqs[0];
        const ratios = activeFreqs.map((f) => f / baseFreq);
        const ratioStr = ratios.map((r) => r.toFixed(3)).join(" : ");
        ctx.font = "11px 'SF Mono', 'Fira Code', monospace";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "center";
        ctx.fillText(
          `Ratios: ${ratioStr}  |  ${tuning === 0 ? "Equal Temperament" : "Just Intonation"}`,
          W / 2,
          infoY + 14
        );
      }

      // Hz values
      ctx.font = "11px 'SF Mono', 'Fira Code', monospace";
      ctx.fillStyle = "#a78bfa";
      ctx.textAlign = "right";
      const hzStr = activeFreqs.map((f) => `${f.toFixed(1)}`).join(", ");
      ctx.fillText(`Hz: ${hzStr}`, pianoLeft + pianoWidth - 5, infoY + 14);

      // Integer ratio approximation for major/minor triads
      const intervals = CHORD_INTERVALS[chordType] ?? CHORD_INTERVALS[0];
      let intRatioLabel = "";
      if (chordType === 0) intRatioLabel = "Integer ratio: 4:5:6";
      else if (chordType === 1) intRatioLabel = "Integer ratio: 10:12:15";
      else if (chordType === 2) intRatioLabel = "Integer ratio: 4:5:6:7 (approx)";

      if (intRatioLabel) {
        ctx.font = "10px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#10b981";
        ctx.textAlign = "center";
        ctx.fillText(intRatioLabel, W / 2, infoY + 26);
      }

      // Time
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`t = ${time.toFixed(1)}s`, 12, H - 4);
    },

    reset() {
      time = 0;
      computeChord();
    },

    destroy() {
      activeFreqs = [];
      activeNotes = [];
    },

    getStateDescription(): string {
      const tuningName = tuning === 0 ? "Equal Temperament" : "Just Intonation";
      const notesList = activeNotes.map((n) => NOTE_NAMES[n % 12]).join(", ");
      const freqsList = activeFreqs.map((f) => `${f.toFixed(1)} Hz`).join(", ");
      const baseFreq = activeFreqs[0] ?? 0;
      const ratios = activeFreqs.map((f) => (f / baseFreq).toFixed(3)).join(":");
      return (
        `Musical Chord simulation: ${chordName}. ` +
        `Notes: ${notesList}. Frequencies: ${freqsList}. ` +
        `Frequency ratios: ${ratios}. Tuning: ${tuningName}. ` +
        `Consonant chords have simple integer frequency ratios (e.g. major triad 4:5:6). ` +
        `The combined waveform shows superposition of the individual sine waves. ` +
        `Time: ${time.toFixed(1)}s.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default ChordFactory;
