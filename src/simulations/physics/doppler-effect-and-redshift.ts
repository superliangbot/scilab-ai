import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const DopplerEffectAndRedshiftFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("doppler-effect-and-redshift") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let sourceVelocity = 0.2; // fraction of c
  let restWavelength = 550; // nm (green light)
  let showSpectrum = 1;

  interface LightWave {
    x: number;
    emitTime: number;
    radius: number;
  }
  let waves: LightWave[] = [];
  let galaxyX = 0.5;
  let lastEmit = 0;

  function wavelengthToColor(nm: number): string {
    let r = 0, g = 0, b = 0;
    if (nm >= 380 && nm < 440) {
      r = -(nm - 440) / 60; b = 1;
    } else if (nm >= 440 && nm < 490) {
      g = (nm - 440) / 50; b = 1;
    } else if (nm >= 490 && nm < 510) {
      g = 1; b = -(nm - 510) / 20;
    } else if (nm >= 510 && nm < 580) {
      r = (nm - 510) / 70; g = 1;
    } else if (nm >= 580 && nm < 645) {
      r = 1; g = -(nm - 645) / 65;
    } else if (nm >= 645 && nm <= 780) {
      r = 1;
    }
    // Dim outside visible range
    if (nm < 380) { r = 0.4; g = 0; b = 0.8; } // UV indicator
    if (nm > 780) { r = 0.5; g = 0; b = 0; } // IR indicator
    return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    galaxyX = 0.3;
    waves = [];
    lastEmit = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    sourceVelocity = params.sourceVelocity ?? 0.2;
    restWavelength = params.restWavelength ?? 550;
    showSpectrum = params.showSpectrum ?? 1;
    time += dt;

    // Galaxy moves away from Earth (rightward = receding)
    galaxyX += sourceVelocity * 0.02 * dt;
    if (galaxyX > 0.85) galaxyX = 0.15;

    // Emit light waves
    if (time - lastEmit > 0.12) {
      waves.push({
        x: galaxyX * width,
        emitTime: time,
        radius: 0,
      });
      lastEmit = time;
    }

    // Expand waves at speed of light (scaled)
    const lightSpeed = width * 0.3;
    for (const w of waves) {
      w.radius = (time - w.emitTime) * lightSpeed;
    }
    waves = waves.filter((w) => w.radius < width * 1.5);
  }

  function render(): void {
    // Dark space background
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);

    // Stars
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    for (let i = 0; i < 80; i++) {
      const sx = ((i * 137.5) % width);
      const sy = ((i * 97.3) % (height * 0.6));
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    const midY = height * 0.35;

    // Draw light waves from galaxy
    const restColor = wavelengthToColor(restWavelength);
    const observedWavelength = restWavelength * Math.sqrt((1 + sourceVelocity) / (1 - sourceVelocity));
    const obsColor = wavelengthToColor(observedWavelength);

    for (const w of waves) {
      const alpha = Math.max(0, 1 - w.radius / (width * 0.7));
      ctx.beginPath();
      ctx.arc(w.x, midY, w.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `${restColor.replace("rgb", "rgba").replace(")", `,${alpha * 0.5})`)}`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Draw galaxy (source)
    const gx = galaxyX * width;
    // Spiral galaxy
    ctx.save();
    ctx.translate(gx, midY);
    const spiralGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 35);
    spiralGlow.addColorStop(0, "rgba(200,180,255,0.8)");
    spiralGlow.addColorStop(0.5, "rgba(100,80,200,0.4)");
    spiralGlow.addColorStop(1, "rgba(50,30,100,0)");
    ctx.fillStyle = spiralGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 35, 0, Math.PI * 2);
    ctx.fill();

    // Spiral arms
    ctx.strokeStyle = "rgba(180,160,255,0.5)";
    ctx.lineWidth = 2;
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      for (let t = 0; t < 4; t += 0.1) {
        const r = 5 + t * 6;
        const angle = t * 2 + arm * Math.PI + time * 0.3;
        const px = r * Math.cos(angle);
        const py = r * Math.sin(angle) * 0.4;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Galaxy", 0, 50);
    ctx.restore();

    // Draw Earth (observer)
    const earthX = width * 0.85;
    ctx.save();
    ctx.translate(earthX, midY);
    // Earth
    const earthGrad = ctx.createRadialGradient(-3, -3, 0, 0, 0, 18);
    earthGrad.addColorStop(0, "#6fa8dc");
    earthGrad.addColorStop(0.6, "#3d85c6");
    earthGrad.addColorStop(1, "#1a5276");
    ctx.fillStyle = earthGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    // Continents hint
    ctx.fillStyle = "rgba(76,175,80,0.6)";
    ctx.beginPath();
    ctx.arc(-5, -4, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4, 6, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Earth", 0, 35);
    ctx.restore();

    // Velocity arrow
    ctx.strokeStyle = "#ff6666";
    ctx.lineWidth = 2;
    const arrowY = midY - 55;
    ctx.beginPath();
    ctx.moveTo(gx, arrowY);
    ctx.lineTo(gx + 50, arrowY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(gx + 50, arrowY);
    ctx.lineTo(gx + 42, arrowY - 5);
    ctx.moveTo(gx + 50, arrowY);
    ctx.lineTo(gx + 42, arrowY + 5);
    ctx.stroke();
    ctx.fillStyle = "#ff6666";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`v = ${(sourceVelocity * 100).toFixed(0)}% c`, gx + 25, arrowY - 10);

    // Spectrum comparison
    if (showSpectrum) {
      const specY = height * 0.6;
      const specH = 30;
      const specW = width * 0.7;
      const specX = width * 0.15;

      // Draw full visible spectrum
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Visible Light Spectrum", width / 2, specY - 8);

      for (let x = 0; x < specW; x++) {
        const wl = 380 + (x / specW) * 400;
        ctx.fillStyle = wavelengthToColor(wl);
        ctx.fillRect(specX + x, specY, 1, specH);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.strokeRect(specX, specY, specW, specH);

      // Labels
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = "#aaa";
      ctx.textAlign = "left";
      ctx.fillText("380nm (violet)", specX, specY + specH + 14);
      ctx.textAlign = "right";
      ctx.fillText("780nm (red)", specX + specW, specY + specH + 14);

      // Rest wavelength marker
      const restPos = specX + ((restWavelength - 380) / 400) * specW;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(restPos, specY - 3);
      ctx.lineTo(restPos, specY + specH + 3);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Emitted: ${restWavelength}nm`, restPos, specY + specH + 28);

      // Observed wavelength marker
      const obsClamp = Math.max(380, Math.min(780, observedWavelength));
      const obsPos = specX + ((obsClamp - 380) / 400) * specW;
      ctx.strokeStyle = obsColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(obsPos, specY - 3);
      ctx.lineTo(obsPos, specY + specH + 3);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = obsColor;
      ctx.fillText(`Observed: ${observedWavelength.toFixed(0)}nm`, obsPos, specY + specH + 42);

      // Shift arrow
      if (Math.abs(obsPos - restPos) > 5) {
        ctx.strokeStyle = observedWavelength > restWavelength ? "#ff4444" : "#4444ff";
        ctx.lineWidth = 2;
        const arrowMidY = specY + specH + 52;
        ctx.beginPath();
        ctx.moveTo(restPos, arrowMidY);
        ctx.lineTo(obsPos, arrowMidY);
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = "bold 12px system-ui, sans-serif";
        const shiftLabel = observedWavelength > restWavelength ? "REDSHIFT" : "BLUESHIFT";
        ctx.fillText(shiftLabel, (restPos + obsPos) / 2, arrowMidY + 18);
      }
    }

    // Info panel
    const z = (observedWavelength - restWavelength) / restWavelength;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(10, height - 65, 260, 55, 6);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Redshift z = ${z.toFixed(4)}`, 20, height - 45);
    ctx.fillText(`λ_obs = λ_rest × √((1+β)/(1-β))`, 20, height - 28);
    ctx.fillStyle = "#aaa";
    ctx.fillText(`β = v/c = ${sourceVelocity.toFixed(3)}`, 20, height - 14);
  }

  function reset(): void {
    time = 0;
    galaxyX = 0.3;
    waves = [];
    lastEmit = 0;
  }

  function destroy(): void {
    waves = [];
  }

  function getStateDescription(): string {
    const observedWavelength = restWavelength * Math.sqrt((1 + sourceVelocity) / (1 - sourceVelocity));
    const z = (observedWavelength - restWavelength) / restWavelength;
    return (
      `Doppler Effect & Redshift: source velocity=${(sourceVelocity * 100).toFixed(0)}% of c, ` +
      `rest wavelength=${restWavelength} nm (${wavelengthToColor(restWavelength)}), ` +
      `observed wavelength=${observedWavelength.toFixed(1)} nm, ` +
      `redshift z=${z.toFixed(4)}. ` +
      `Relativistic Doppler: λ_obs = λ_rest × √((1+v/c)/(1-v/c)). ` +
      `Galaxy is receding, so light is redshifted — evidence for expanding universe.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DopplerEffectAndRedshiftFactory;
