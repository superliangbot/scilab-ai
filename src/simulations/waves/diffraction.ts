import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const Diffraction: SimulationFactory = () => {
  const config = getSimConfig("diffraction")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let wavelength = 30;
  let amplitude = 1;
  let frequency = 2;
  let slitWidth = 40;
  let time = 0;

  // Geometry
  const WALL_X = width * 0.4;
  const SLIT_Y = height * 0.5;
  const SCREEN_X = width * 0.85;

  // Rendering buffers
  const SCALE = 3; // compute every 3rd pixel for performance
  let gridW = 0;
  let gridH = 0;
  let waveField: Float32Array = new Float32Array(0);
  let imageData: ImageData | null = null;

  // Colors
  const BG_COLOR = "#0a0a0f";
  const WALL_COLOR = "#374151";
  const SCREEN_COLOR = "#1f2937";
  const WAVE_COLOR = "#60a5fa";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#9ca3af";

  function allocateBuffers() {
    gridW = Math.ceil(width / SCALE);
    gridH = Math.ceil(height / SCALE);
    waveField = new Float32Array(gridW * gridH);
    imageData = ctx.createImageData(gridW, gridH);
  }

  /** Map wave displacement to color */
  function displacementToColor(val: number): [number, number, number] {
    const clamped = Math.max(-2, Math.min(2, val));
    const norm = clamped / 2; // [-1, 1]

    let r: number, g: number, b: number;

    if (norm < 0) {
      // Negative: black -> blue -> cyan
      const t = -norm;
      if (t < 0.5) {
        const u = t * 2;
        r = 0;
        g = 0;
        b = Math.round(u * 180);
      } else {
        const u = (t - 0.5) * 2;
        r = 0;
        g = Math.round(u * 120);
        b = Math.round(180 + u * 75);
      }
    } else if (norm > 0) {
      // Positive: black -> red -> yellow
      const t = norm;
      if (t < 0.5) {
        const u = t * 2;
        r = Math.round(u * 200);
        g = 0;
        b = 0;
      } else {
        const u = (t - 0.5) * 2;
        r = Math.round(200 + u * 55);
        g = Math.round(u * 200);
        b = 0;
      }
    } else {
      r = 0;
      g = 0;
      b = 0;
    }

    return [r, g, b];
  }

  function isInSlit(y: number): boolean {
    const slitTop = SLIT_Y - slitWidth / 2;
    const slitBottom = SLIT_Y + slitWidth / 2;
    return y >= slitTop && y <= slitBottom;
  }

  function isBlocked(x: number, y: number): boolean {
    // Wall blocks everything except the slit
    if (Math.abs(x - WALL_X) < 5) {
      return !isInSlit(y);
    }
    return false;
  }

  function computeWaveField() {
    const k = (2 * Math.PI) / wavelength;
    const omega = 2 * Math.PI * frequency;
    
    // Source position (left side)
    const sourceX = 50;
    const sourceY = height / 2;

    for (let gy = 0; gy < gridH; gy++) {
      const py = gy * SCALE + SCALE / 2;
      
      for (let gx = 0; gx < gridW; gx++) {
        const px = gx * SCALE + SCALE / 2;
        
        let totalWave = 0;
        
        if (isBlocked(px, py)) {
          // Inside wall/obstacle
          totalWave = 0;
        } else if (px < WALL_X) {
          // Left side of wall - incident wave
          const dx = px - sourceX;
          const dy = py - sourceY;
          const r = Math.sqrt(dx * dx + dy * dy);
          
          if (r > 1) {
            const attenuation = 1 / Math.sqrt(r);
            totalWave = amplitude * attenuation * Math.sin(k * r - omega * time);
          }
        } else {
          // Right side of wall - diffracted wave
          // Use Huygens principle: every point in the slit acts as a source
          const slitTop = SLIT_Y - slitWidth / 2;
          const slitBottom = SLIT_Y + slitWidth / 2;
          const numSlitSources = 20;
          
          for (let i = 0; i < numSlitSources; i++) {
            const slitY = slitTop + (i / (numSlitSources - 1)) * slitWidth;
            
            // Distance from source to slit point
            const dx1 = WALL_X - sourceX;
            const dy1 = slitY - sourceY;
            const r1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
            
            // Distance from slit point to observation point
            const dx2 = px - WALL_X;
            const dy2 = py - slitY;
            const r2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            
            const totalDistance = r1 + r2;
            
            if (totalDistance > 1) {
              // Amplitude decreases with distance and number of slit sources
              const attenuation = amplitude / (numSlitSources * Math.sqrt(totalDistance));
              totalWave += attenuation * Math.sin(k * totalDistance - omega * time);
            }
          }
        }
        
        waveField[gy * gridW + gx] = totalWave;
      }
    }
  }

  function renderWaveField() {
    if (!imageData) return;

    const data = imageData.data;

    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const val = waveField[gy * gridW + gx];
        const [r, g, b] = displacementToColor(val);
        const idx = (gy * gridW + gx) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    // Draw the scaled-up wave field
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = gridW;
    tmpCanvas.height = gridH;
    const tmpCtx = tmpCanvas.getContext("2d")!;
    tmpCtx.putImageData(imageData, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "low";
    ctx.drawImage(tmpCanvas, 0, 0, gridW, gridH, 0, 0, width, height);
  }

  function drawWallAndSlit() {
    // Wall
    ctx.fillStyle = WALL_COLOR;
    ctx.fillRect(WALL_X - 10, 0, 20, SLIT_Y - slitWidth / 2);
    ctx.fillRect(WALL_X - 10, SLIT_Y + slitWidth / 2, 20, height - (SLIT_Y + slitWidth / 2));
    
    // Slit opening (outlined)
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 2;
    ctx.strokeRect(WALL_X - 10, SLIT_Y - slitWidth / 2, 20, slitWidth);
    
    // Slit dimension indicator
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    
    const indicatorX = WALL_X + 25;
    ctx.beginPath();
    ctx.moveTo(indicatorX, SLIT_Y - slitWidth / 2);
    ctx.lineTo(indicatorX, SLIT_Y + slitWidth / 2);
    ctx.stroke();
    
    // Dimension labels
    ctx.fillStyle = "#fbbf24";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.save();
    ctx.translate(indicatorX + 15, SLIT_Y);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${slitWidth.toFixed(0)}px`, 0, 0);
    ctx.restore();
    
    ctx.setLineDash([]);
  }

  function drawScreen() {
    // Detection screen
    ctx.fillStyle = SCREEN_COLOR;
    ctx.fillRect(SCREEN_X - 2, 0, 4, height);
    
    // Intensity pattern on screen
    const intensityProfile: number[] = [];
    const numSamples = 100;
    
    for (let i = 0; i < numSamples; i++) {
      const y = (i / (numSamples - 1)) * height;
      const gy = Math.floor(y / SCALE);
      const gx = Math.floor(SCREEN_X / SCALE);
      
      if (gy >= 0 && gy < gridH && gx >= 0 && gx < gridW) {
        const intensity = Math.abs(waveField[gy * gridW + gx]);
        intensityProfile.push(intensity);
      } else {
        intensityProfile.push(0);
      }
    }
    
    // Draw intensity profile
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const maxIntensity = Math.max(...intensityProfile) || 1;
    
    for (let i = 0; i < intensityProfile.length; i++) {
      const y = (i / (intensityProfile.length - 1)) * height;
      const normalizedIntensity = intensityProfile[i] / maxIntensity;
      const x = SCREEN_X + 5 + normalizedIntensity * 50;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
    
    // Screen label
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Screen", SCREEN_X, height - 20);
    ctx.fillText("Intensity", SCREEN_X + 30, height - 20);
  }

  function drawSource() {
    const sourceX = 50;
    const sourceY = height / 2;
    
    // Animated source
    const pulseFactor = 0.5 + 0.5 * Math.sin(2 * Math.PI * frequency * time);
    
    const gradient = ctx.createRadialGradient(sourceX, sourceY, 0, sourceX, sourceY, 15);
    gradient.addColorStop(0, `rgba(96, 165, 250, ${pulseFactor})`);
    gradient.addColorStop(1, "rgba(96, 165, 250, 0.1)");
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sourceX, sourceY, 10 + 3 * pulseFactor, 0, Math.PI * 2);
    ctx.fill();
    
    // Source label
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("Source", sourceX, sourceY - 15);
  }

  function drawInfoPanel() {
    const panelX = 15;
    const panelY = 15;
    const lineH = 18;
    
    ctx.fillStyle = "rgba(10, 10, 15, 0.9)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 280, lineH * 8 + 16, 8);
    ctx.fill();
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 280, lineH * 8 + 16, 8);
    ctx.stroke();
    
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = panelX + 12;
    let y = panelY + 10;
    
    ctx.fillStyle = "#60a5fa";
    ctx.fillText("Single-Slit Diffraction", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(`Wavelength: λ = ${wavelength.toFixed(0)}px`, x, y);
    y += lineH;
    
    ctx.fillText(`Slit width: a = ${slitWidth.toFixed(0)}px`, x, y);
    y += lineH;
    
    ctx.fillText(`Frequency: f = ${frequency.toFixed(1)}Hz`, x, y);
    y += lineH;
    
    const ratio = slitWidth / wavelength;
    ctx.fillText(`a/λ ratio: ${ratio.toFixed(2)}`, x, y);
    y += lineH;
    
    if (ratio < 1) {
      ctx.fillStyle = "#fbbf24";
      ctx.fillText("⚠ Strong diffraction (a < λ)", x, y);
    } else if (ratio < 5) {
      ctx.fillStyle = "#10b981";
      ctx.fillText("✓ Moderate diffraction", x, y);
    } else {
      ctx.fillStyle = "#6b7280";
      ctx.fillText("→ Weak diffraction (a >> λ)", x, y);
    }
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText("Minima at: sin θ = nλ/a", x, y);
    y += lineH;
    
    ctx.fillText("Huygens principle simulation", x, y);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      allocateBuffers();
    },

    update(dt: number, params: Record<string, number>) {
      wavelength = params.wavelength ?? wavelength;
      amplitude = params.amplitude ?? amplitude;
      frequency = params.frequency ?? frequency;
      slitWidth = params.slitWidth ?? slitWidth;
      
      time += dt;
      
      // Recompute wave field
      computeWaveField();
    },

    render() {
      // Clear background
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);
      
      // Render wave field
      renderWaveField();
      
      // Draw physical elements
      drawWallAndSlit();
      drawScreen();
      drawSource();
      
      // Info panel
      drawInfoPanel();
    },

    reset() {
      time = 0;
      waveField.fill(0);
    },

    destroy() {
      waveField = new Float32Array(0);
      imageData = null;
    },

    getStateDescription(): string {
      const ratio = slitWidth / wavelength;
      return (
        `Single-Slit Diffraction: Wave bending when passing through an opening. ` +
        `Slit width=${slitWidth}px, wavelength=${wavelength}px (ratio ${ratio.toFixed(2)}). ` +
        `${ratio < 1 ? 'Strong diffraction - slit smaller than wavelength' : 
          ratio < 5 ? 'Moderate diffraction - comparable sizes' : 
          'Weak diffraction - slit much larger than wavelength'}. ` +
        `Minima occur at angles where sin θ = nλ/a. Intensity pattern shows on screen.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
      allocateBuffers();
    },
  };

  return engine;
};

export default Diffraction;