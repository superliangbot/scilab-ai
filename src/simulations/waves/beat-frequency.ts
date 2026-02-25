import { SimulationEngine } from '../types';

interface BeatFrequencyState {
  time: number;
  freq1: number;
  freq2: number;
  amplitude1: number;
  amplitude2: number;
  wave1Data: number[];
  wave2Data: number[];
  beatData: number[];
  phase1: number;
  phase2: number;
}

export default class BeatFrequencySimulation implements SimulationEngine<BeatFrequencyState> {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animationFrameId?: number;
  private state!: BeatFrequencyState;

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.reset();
  }

  reset(): void {
    this.state = {
      time: 0,
      freq1: 440,
      freq2: 442,
      amplitude1: 1.0,
      amplitude2: 1.0,
      wave1Data: [],
      wave2Data: [],
      beatData: [],
      phase1: 0,
      phase2: 0,
    };
    this.generateWaveData();
  }

  private generateWaveData(): void {
    const samples = 200;
    const duration = 4; // 4 periods for visualization
    
    this.state.wave1Data = [];
    this.state.wave2Data = [];
    this.state.beatData = [];

    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * duration;
      const wave1 = this.state.amplitude1 * Math.sin(2 * Math.PI * this.state.freq1 * t / 100 + this.state.phase1);
      const wave2 = this.state.amplitude2 * Math.sin(2 * Math.PI * this.state.freq2 * t / 100 + this.state.phase2);
      const beat = wave1 + wave2;

      this.state.wave1Data.push(wave1);
      this.state.wave2Data.push(wave2);
      this.state.beatData.push(beat);
    }
  }

  update(deltaTime: number, parameters: Record<string, number>): void {
    this.state.freq1 = parameters.freq1 || 440;
    this.state.freq2 = parameters.freq2 || 442;
    this.state.amplitude1 = parameters.amplitude1 || 1.0;
    this.state.amplitude2 = parameters.amplitude2 || 1.0;

    this.state.time += deltaTime / 1000;
    this.state.phase1 = this.state.time * 2 * Math.PI * this.state.freq1 / 100;
    this.state.phase2 = this.state.time * 2 * Math.PI * this.state.freq2 / 100;

    this.generateWaveData();
  }

  render(): void {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    // Draw background
    this.ctx.fillStyle = '#0a0f1a';
    this.ctx.fillRect(0, 0, width, height);

    // Draw grid
    this.drawGrid();

    // Draw waves
    this.drawWaves();

    // Draw equations and info
    this.drawEquations();

    // Draw beat frequency calculation
    this.drawBeatInfo();
  }

  private drawGrid(): void {
    const { width, height } = this.canvas;
    this.ctx.strokeStyle = '#1a1a2e';
    this.ctx.lineWidth = 1;

    // Horizontal lines
    for (let y = 0; y <= height; y += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }

    // Vertical lines
    for (let x = 0; x <= width; x += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }
  }

  private drawWaves(): void {
    const { width, height } = this.canvas;
    const centerY1 = height * 0.2;
    const centerY2 = height * 0.4;
    const centerY3 = height * 0.7;
    const scale = 60;

    // Draw wave 1 (frequency 1)
    this.ctx.strokeStyle = '#00ff88';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    for (let i = 0; i < this.state.wave1Data.length; i++) {
      const x = (i / this.state.wave1Data.length) * width;
      const y = centerY1 + this.state.wave1Data[i] * scale;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();

    // Draw wave 2 (frequency 2)
    this.ctx.strokeStyle = '#ff6b6b';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    for (let i = 0; i < this.state.wave2Data.length; i++) {
      const x = (i / this.state.wave2Data.length) * width;
      const y = centerY2 + this.state.wave2Data[i] * scale;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();

    // Draw beat wave (superposition)
    this.ctx.strokeStyle = '#ffeb3b';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    for (let i = 0; i < this.state.beatData.length; i++) {
      const x = (i / this.state.beatData.length) * width;
      const y = centerY3 + this.state.beatData[i] * scale / 2;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();

    // Draw beat envelope
    this.ctx.strokeStyle = '#ff9800';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    
    // Upper envelope
    this.ctx.beginPath();
    for (let i = 0; i < this.state.beatData.length; i++) {
      const x = (i / this.state.beatData.length) * width;
      const beatFreq = Math.abs(this.state.freq1 - this.state.freq2);
      const envelope = Math.abs(this.state.amplitude1 + this.state.amplitude2) * 
                     Math.abs(Math.cos(2 * Math.PI * beatFreq * i / this.state.beatData.length));
      const y = centerY3 - envelope * scale / 2;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();

    // Lower envelope
    this.ctx.beginPath();
    for (let i = 0; i < this.state.beatData.length; i++) {
      const x = (i / this.state.beatData.length) * width;
      const beatFreq = Math.abs(this.state.freq1 - this.state.freq2);
      const envelope = Math.abs(this.state.amplitude1 + this.state.amplitude2) * 
                     Math.abs(Math.cos(2 * Math.PI * beatFreq * i / this.state.beatData.length));
      const y = centerY3 + envelope * scale / 2;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();

    this.ctx.setLineDash([]);

    // Labels
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '14px Arial';
    this.ctx.fillText(`Wave 1: ${this.state.freq1.toFixed(1)} Hz`, 10, centerY1 - 30);
    this.ctx.fillText(`Wave 2: ${this.state.freq2.toFixed(1)} Hz`, 10, centerY2 - 30);
    this.ctx.fillText('Beat Pattern (Superposition)', 10, centerY3 - 30);
  }

  private drawEquations(): void {
    const { width } = this.canvas;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '16px Arial';
    
    const equations = [
      'y₁ = A₁ sin(2πf₁t)',
      'y₂ = A₂ sin(2πf₂t)',
      'y = y₁ + y₂ = A₁ sin(2πf₁t) + A₂ sin(2πf₂t)',
      `Beat frequency: fb = |f₁ - f₂| = ${Math.abs(this.state.freq1 - this.state.freq2).toFixed(1)} Hz`
    ];

    equations.forEach((eq, i) => {
      this.ctx.fillText(eq, width - 400, 30 + i * 25);
    });
  }

  private drawBeatInfo(): void {
    const { height } = this.canvas;
    const beatFreq = Math.abs(this.state.freq1 - this.state.freq2);
    const beatPeriod = beatFreq > 0 ? 1 / beatFreq : 0;

    this.ctx.fillStyle = '#ffeb3b';
    this.ctx.font = '14px Arial';
    this.ctx.fillText(`Beat Frequency: ${beatFreq.toFixed(2)} Hz`, 10, height - 60);
    this.ctx.fillText(`Beat Period: ${beatPeriod.toFixed(2)} s`, 10, height - 40);
    
    // Show phase difference
    const phaseDiff = Math.abs(this.state.phase1 - this.state.phase2) % (2 * Math.PI);
    this.ctx.fillText(`Phase Difference: ${(phaseDiff * 180 / Math.PI).toFixed(1)}°`, 10, height - 20);
  }

  getStateDescription(): string {
    const beatFreq = Math.abs(this.state.freq1 - this.state.freq2);
    return `Two sine waves with frequencies ${this.state.freq1.toFixed(1)} Hz and ${this.state.freq2.toFixed(1)} Hz creating beats at ${beatFreq.toFixed(1)} Hz. The beat pattern shows amplitude modulation due to wave interference.`;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}