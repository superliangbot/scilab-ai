import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * RGB Color Filter
 * Simulates placing color filters (R, G, B) over a light source.
 * A red filter only passes the red component, green only green, blue only blue.
 * Shows the light source, the filter, and the resulting transmitted light.
 */

const RGBFilterFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("rgb-filter") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let lightRed = 255;
  let lightGreen = 255;
  let lightBlue = 255;
  let filterType = 0; // 0=none, 1=red, 2=green, 3=blue

  // Animated light ray particles
  let rays: { x: number; y: number; speed: number; offset: number }[] = [];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;

    // Seed initial rays
    rays = [];
    for (let i = 0; i < 20; i++) {
      rays.push({
        x: Math.random() * width,
        y: height * 0.3 + Math.random() * height * 0.4,
        speed: 60 + Math.random() * 80,
        offset: Math.random() * Math.PI * 2,
      });
    }
  }

  function getFilteredColor(): { r: number; g: number; b: number } {
    switch (filterType) {
      case 1: return { r: lightRed, g: 0, b: 0 };           // Red filter
      case 2: return { r: 0, g: lightGreen, b: 0 };         // Green filter
      case 3: return { r: 0, g: 0, b: lightBlue };          // Blue filter
      default: return { r: lightRed, g: lightGreen, b: lightBlue }; // No filter
    }
  }

  function getFilterName(): string {
    switch (filterType) {
      case 1: return "Red Filter";
      case 2: return "Green Filter";
      case 3: return "Blue Filter";
      default: return "No Filter";
    }
  }

  function getFilterColor(): string {
    switch (filterType) {
      case 1: return "rgba(255,0,0,0.35)";
      case 2: return "rgba(0,255,0,0.35)";
      case 3: return "rgba(0,0,255,0.35)";
      default: return "rgba(200,200,200,0.08)";
    }
  }

  function getFilterBorder(): string {
    switch (filterType) {
      case 1: return "rgba(255,80,80,0.7)";
      case 2: return "rgba(80,255,80,0.7)";
      case 3: return "rgba(80,80,255,0.7)";
      default: return "rgba(200,200,200,0.25)";
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    lightRed = Math.round(Math.min(255, Math.max(0, params.lightRed ?? 255)));
    lightGreen = Math.round(Math.min(255, Math.max(0, params.lightGreen ?? 255)));
    lightBlue = Math.round(Math.min(255, Math.max(0, params.lightBlue ?? 255)));
    filterType = Math.round(Math.min(3, Math.max(0, params.filterType ?? 0)));
    time += dt;

    // Update ray positions
    for (const ray of rays) {
      ray.x += ray.speed * dt;
      if (ray.x > width + 20) {
        ray.x = -20;
        ray.y = height * 0.3 + Math.random() * height * 0.4;
      }
    }
  }

  function render(): void {
    // Dark background
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.save();
    ctx.font = `bold ${Math.max(14, width * 0.026)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.75)";
    ctx.textAlign = "center";
    ctx.fillText("RGB Color Filter", width / 2, 22);
    ctx.restore();

    const midY = height / 2;
    const filtered = getFilteredColor();

    // ---- LAYOUT ----
    // Light source: left 20%
    // Filter: center 40-60%
    // Result: right 80%

    const sourceX = width * 0.12;
    const filterX = width * 0.42;
    const filterW = width * 0.16;
    const resultX = width * 0.82;

    // -- Light source (circle with glow) --
    const sourceR = Math.min(width, height) * 0.1;
    const sourceGrad = ctx.createRadialGradient(sourceX, midY, 0, sourceX, midY, sourceR * 2);
    sourceGrad.addColorStop(0, `rgba(${lightRed},${lightGreen},${lightBlue},0.9)`);
    sourceGrad.addColorStop(0.4, `rgba(${lightRed},${lightGreen},${lightBlue},0.3)`);
    sourceGrad.addColorStop(1, `rgba(${lightRed},${lightGreen},${lightBlue},0)`);
    ctx.fillStyle = sourceGrad;
    ctx.beginPath();
    ctx.arc(sourceX, midY, sourceR * 2, 0, Math.PI * 2);
    ctx.fill();

    // Solid core
    ctx.fillStyle = `rgb(${lightRed},${lightGreen},${lightBlue})`;
    ctx.beginPath();
    ctx.arc(sourceX, midY, sourceR, 0, Math.PI * 2);
    ctx.fill();

    // Source label
    ctx.save();
    const srcLum = 0.299 * lightRed + 0.587 * lightGreen + 0.114 * lightBlue;
    ctx.fillStyle = srcLum > 128 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)";
    ctx.font = `bold ${Math.max(10, sourceR * 0.3)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Light", sourceX, midY - 8);
    ctx.font = `${Math.max(9, sourceR * 0.22)}px monospace`;
    ctx.fillText(`(${lightRed},${lightGreen},${lightBlue})`, sourceX, midY + 8);
    ctx.restore();

    // -- Light beam from source to filter --
    const beamH = height * 0.28;
    ctx.save();
    const beamGrad = ctx.createLinearGradient(sourceX + sourceR, 0, filterX, 0);
    beamGrad.addColorStop(0, `rgba(${lightRed},${lightGreen},${lightBlue},0.45)`);
    beamGrad.addColorStop(1, `rgba(${lightRed},${lightGreen},${lightBlue},0.25)`);
    ctx.fillStyle = beamGrad;
    ctx.fillRect(sourceX + sourceR, midY - beamH / 2, filterX - sourceX - sourceR, beamH);

    // Glow on the beam
    ctx.fillStyle = `rgba(${lightRed},${lightGreen},${lightBlue},0.06)`;
    ctx.fillRect(sourceX + sourceR, midY - beamH * 0.7, filterX - sourceX - sourceR, beamH * 1.4);
    ctx.restore();

    // -- Filter rectangle --
    const filterH = height * 0.55;
    const filterY = midY - filterH / 2;

    ctx.fillStyle = getFilterColor();
    ctx.beginPath();
    ctx.roundRect(filterX, filterY, filterW, filterH, 6);
    ctx.fill();

    ctx.strokeStyle = getFilterBorder();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(filterX, filterY, filterW, filterH, 6);
    ctx.stroke();

    // Filter label
    ctx.save();
    ctx.font = `bold ${Math.max(12, filterW * 0.12)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(getFilterName(), filterX + filterW / 2, filterY + 20);

    if (filterType > 0) {
      ctx.font = `${Math.max(9, filterW * 0.08)}px system-ui, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      const passLabel =
        filterType === 1 ? "Passes Red only" :
        filterType === 2 ? "Passes Green only" :
        "Passes Blue only";
      ctx.fillText(passLabel, filterX + filterW / 2, filterY + 38);
    }
    ctx.restore();

    // -- Light beam from filter to result --
    const beamOutGrad = ctx.createLinearGradient(filterX + filterW, 0, resultX, 0);
    beamOutGrad.addColorStop(0, `rgba(${filtered.r},${filtered.g},${filtered.b},0.35)`);
    beamOutGrad.addColorStop(1, `rgba(${filtered.r},${filtered.g},${filtered.b},0.15)`);
    ctx.fillStyle = beamOutGrad;
    ctx.fillRect(filterX + filterW, midY - beamH / 2, resultX - filterX - filterW - sourceR, beamH);

    // -- Animated ray particles --
    ctx.save();
    for (const ray of rays) {
      const inBeforeFilter = ray.x < filterX;
      const color = inBeforeFilter
        ? `rgba(${lightRed},${lightGreen},${lightBlue},`
        : `rgba(${filtered.r},${filtered.g},${filtered.b},`;

      // Skip particles after filter if filtered result is black
      if (!inBeforeFilter && filtered.r + filtered.g + filtered.b < 10) continue;

      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(time * 3 + ray.offset));
      ctx.fillStyle = color + (pulse * 0.7).toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(ray.x, ray.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // -- Result display (circle on right) --
    const resR = Math.min(width, height) * 0.1;
    const resGrad = ctx.createRadialGradient(resultX, midY, 0, resultX, midY, resR * 1.8);
    resGrad.addColorStop(0, `rgba(${filtered.r},${filtered.g},${filtered.b},0.8)`);
    resGrad.addColorStop(0.5, `rgba(${filtered.r},${filtered.g},${filtered.b},0.2)`);
    resGrad.addColorStop(1, `rgba(${filtered.r},${filtered.g},${filtered.b},0)`);
    ctx.fillStyle = resGrad;
    ctx.beginPath();
    ctx.arc(resultX, midY, resR * 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgb(${filtered.r},${filtered.g},${filtered.b})`;
    ctx.beginPath();
    ctx.arc(resultX, midY, resR, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(resultX, midY, resR, 0, Math.PI * 2);
    ctx.stroke();

    // Result label
    ctx.save();
    const resLum = 0.299 * filtered.r + 0.587 * filtered.g + 0.114 * filtered.b;
    ctx.fillStyle = resLum > 128 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)";
    ctx.font = `bold ${Math.max(10, resR * 0.3)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Result", resultX, midY - 8);
    ctx.font = `${Math.max(9, resR * 0.22)}px monospace`;
    ctx.fillText(`(${filtered.r},${filtered.g},${filtered.b})`, resultX, midY + 8);
    ctx.restore();

    // -- Intensity info panel at bottom --
    ctx.save();
    const panelW = width * 0.7;
    const panelH = 60;
    const panelX = (width - panelW) / 2;
    const panelY = height - panelH - 10;

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 6);
    ctx.fill();

    ctx.font = `bold ${Math.max(11, width * 0.019)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(200,210,230,0.8)";
    ctx.fillText(`Source: RGB(${lightRed}, ${lightGreen}, ${lightBlue})`, panelX + panelW / 2, panelY + 8);

    ctx.font = `${Math.max(10, width * 0.017)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(170,180,210,0.7)";
    ctx.fillText(
      `Filter: ${getFilterName()}`,
      panelX + panelW / 2,
      panelY + 24
    );

    ctx.fillStyle = "rgba(220,230,250,0.85)";
    const totalTransmitted = filtered.r + filtered.g + filtered.b;
    const totalSource = lightRed + lightGreen + lightBlue;
    const pct = totalSource > 0 ? ((totalTransmitted / totalSource) * 100).toFixed(0) : "0";
    ctx.fillText(
      `Transmitted: RGB(${filtered.r}, ${filtered.g}, ${filtered.b}) - ${pct}% intensity`,
      panelX + panelW / 2,
      panelY + 40
    );
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    rays = [];
    for (let i = 0; i < 20; i++) {
      rays.push({
        x: Math.random() * width,
        y: height * 0.3 + Math.random() * height * 0.4,
        speed: 60 + Math.random() * 80,
        offset: Math.random() * Math.PI * 2,
      });
    }
  }

  function destroy(): void {
    rays = [];
  }

  function getStateDescription(): string {
    const filtered = getFilteredColor();
    const totalTransmitted = filtered.r + filtered.g + filtered.b;
    const totalSource = lightRed + lightGreen + lightBlue;
    const pct = totalSource > 0 ? ((totalTransmitted / totalSource) * 100).toFixed(0) : "0";
    return (
      `RGB Color Filter: source RGB(${lightRed},${lightGreen},${lightBlue}), ` +
      `filter: ${getFilterName()}, ` +
      `transmitted: RGB(${filtered.r},${filtered.g},${filtered.b}) (${pct}% of source intensity). ` +
      `Color filters work by absorbing certain wavelengths and transmitting others. ` +
      `A red filter absorbs green and blue, passing only red light.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default RGBFilterFactory;
