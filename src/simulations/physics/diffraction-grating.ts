import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const DiffractionGratingFactory = (): SimulationEngine => {
  const config = getSimConfig("diffraction-grating") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;
  let currentParams: Record<string, number> = {};

  function wavelengthToColor(nm: number): string {
    let r = 0, g = 0, b = 0;
    if (nm >= 380 && nm < 440) {
      r = -(nm - 440) / (440 - 380);
      b = 1;
    } else if (nm >= 440 && nm < 490) {
      g = (nm - 440) / (490 - 440);
      b = 1;
    } else if (nm >= 490 && nm < 510) {
      g = 1;
      b = -(nm - 510) / (510 - 490);
    } else if (nm >= 510 && nm < 580) {
      r = (nm - 510) / (580 - 510);
      g = 1;
    } else if (nm >= 580 && nm < 645) {
      r = 1;
      g = -(nm - 645) / (645 - 580);
    } else if (nm >= 645 && nm <= 780) {
      r = 1;
    }
    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
  }

  function update(dt: number, params: Record<string, number>): void {
    currentParams = params;
    time += dt;
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);

    const wavelength = currentParams.wavelength ?? 550;
    const slitCount = Math.round(currentParams.slitCount ?? 5);
    const slitSpacing = currentParams.slitSpacing ?? 2;
    const showOrders = currentParams.showOrders ?? 1;

    const color = wavelengthToColor(wavelength);
    const gratingX = width * 0.3;

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Diffraction Grating", width / 2, 28);

    // Light source (left)
    const sourceX = 30;
    const sourceY = height / 2;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(sourceX, sourceY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Light Source", sourceX, sourceY + 25);
    ctx.fillText(`λ = ${wavelength} nm`, sourceX, sourceY + 40);

    // Incoming beam
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(sourceX + 15, sourceY);
    ctx.lineTo(gratingX - 5, sourceY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Wave fronts in incoming beam
    const waveSpeed = 100;
    const wavePeriod = wavelength / 50;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 15; i++) {
      const x = gratingX - 10 - ((time * waveSpeed + i * wavePeriod * 5) % (gratingX - sourceX - 30));
      if (x > sourceX + 20 && x < gratingX - 5) {
        ctx.beginPath();
        ctx.moveTo(x, sourceY - 30);
        ctx.lineTo(x, sourceY + 30);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // Grating
    ctx.fillStyle = "#475569";
    ctx.fillRect(gratingX - 4, 30, 8, height - 60);

    // Slits
    const totalGratingH = height * 0.5;
    const gratingTop = (height - totalGratingH) / 2;
    const slitH = 6;

    const slitPositions: number[] = [];
    for (let i = 0; i < slitCount; i++) {
      const y = gratingTop + (i / (slitCount - 1)) * totalGratingH;
      slitPositions.push(y);
      // Clear slit opening
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(gratingX - 4, y - slitH / 2, 8, slitH);
      // Highlight slit
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(gratingX - 2, y - slitH / 2, 4, slitH);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Grating", gratingX, gratingTop - 15);
    ctx.fillText(`${slitCount} slits`, gratingX, gratingTop - 3);

    // Screen on right
    const screenX = width - 60;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(screenX - 3, 30, 6, height - 60);

    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.fillText("Screen", screenX, 25);

    // Calculate diffraction pattern and draw beams
    // d * sin(θ) = mλ for constructive interference
    const d_um = slitSpacing; // slit spacing in μm
    const lambda_um = wavelength / 1000; // wavelength in μm

    // Draw diffraction pattern on screen
    const screenH = height - 80;
    const screenTop = 40;

    // Calculate intensity pattern
    for (let py = 0; py < screenH; py++) {
      const screenY = screenTop + py;
      const dy = screenY - height / 2;
      const sinTheta = dy / Math.sqrt(dy * dy + Math.pow(screenX - gratingX, 2));
      const theta = Math.asin(Math.min(1, Math.max(-1, sinTheta)));

      // Phase difference between adjacent slits
      const delta = (2 * Math.PI * d_um * Math.sin(theta)) / lambda_um;

      // N-slit interference pattern: I = (sin(Nδ/2) / sin(δ/2))²
      let intensity: number;
      const denom = Math.sin(delta / 2);
      if (Math.abs(denom) < 1e-10) {
        intensity = slitCount * slitCount;
      } else {
        const num = Math.sin(slitCount * delta / 2);
        intensity = (num / denom) * (num / denom);
      }

      // Normalize
      intensity = intensity / (slitCount * slitCount);
      intensity = Math.pow(intensity, 0.4); // gamma correction for visibility

      if (intensity > 0.01) {
        ctx.fillStyle = color;
        ctx.globalAlpha = intensity * 0.8;
        ctx.fillRect(screenX - 6, screenY, 12, 1);
        ctx.globalAlpha = 1;
      }
    }

    // Draw diffracted beams for each order
    if (showOrders >= 0.5) {
      const maxOrder = 3;
      for (let m = -maxOrder; m <= maxOrder; m++) {
        const sinTheta = (m * lambda_um) / d_um;
        if (Math.abs(sinTheta) > 1) continue;

        const theta = Math.asin(sinTheta);
        const beamEndY = height / 2 + (screenX - gratingX) * Math.tan(theta);

        if (beamEndY < 30 || beamEndY > height - 30) continue;

        // Draw beam from center of grating to screen
        ctx.strokeStyle = color;
        ctx.lineWidth = m === 0 ? 3 : 1.5;
        ctx.globalAlpha = m === 0 ? 0.8 : 0.4;
        ctx.beginPath();
        ctx.moveTo(gratingX + 5, height / 2);
        ctx.lineTo(screenX - 5, beamEndY);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Bright spot on screen
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(screenX, beamEndY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Order label
        ctx.fillStyle = "#e2e8f0";
        ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
        ctx.textAlign = "left";
        ctx.fillText(`m=${m}`, screenX + 10, beamEndY + 4);

        // Angle label
        if (m !== 0) {
          const angleDeg = (theta * 180 / Math.PI).toFixed(1);
          ctx.fillStyle = "#94a3b8";
          ctx.font = `${Math.max(9, width * 0.012)}px sans-serif`;
          ctx.fillText(`θ=${angleDeg}°`, screenX + 10, beamEndY + 16);
        }
      }
    }

    // Formula and info
    const panelX = 15;
    const panelY = height - 100;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(panelX, panelY, 280, 85);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, 280, 85);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(12, width * 0.016)}px monospace`;
    ctx.textAlign = "left";
    ctx.fillText("d·sin(θ) = mλ", panelX + 10, panelY + 22);
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(11, width * 0.014)}px monospace`;
    ctx.fillText(`λ = ${wavelength} nm`, panelX + 10, panelY + 44);
    ctx.fillText(`d = ${slitSpacing.toFixed(1)} μm`, panelX + 10, panelY + 62);

    const theta1 = Math.asin(Math.min(1, lambda_um / d_um)) * 180 / Math.PI;
    ctx.fillText(`θ₁ = ${theta1.toFixed(1)}°`, panelX + 10, panelY + 80);
  }

  function reset(): void {
    time = 0;
    currentParams = {};
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const wavelength = currentParams.wavelength ?? 550;
    const slitCount = Math.round(currentParams.slitCount ?? 5);
    const slitSpacing = currentParams.slitSpacing ?? 2;
    const lambda_um = wavelength / 1000;

    const theta1 = Math.asin(Math.min(1, lambda_um / slitSpacing)) * 180 / Math.PI;

    return `Diffraction grating simulation: ${slitCount} slits with spacing d=${slitSpacing}μm, illuminated by λ=${wavelength}nm light. First-order maximum at θ₁=${theta1.toFixed(1)}°. The grating equation d·sin(θ)=mλ determines where constructive interference produces bright maxima. More slits produce sharper, brighter peaks. Different wavelengths diffract at different angles, which is how spectrometers separate light into its component colors.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DiffractionGratingFactory;
