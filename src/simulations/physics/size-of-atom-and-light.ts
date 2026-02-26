import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const SizeOfAtomAndLightFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("size-of-atom-and-light") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let wavelength = 550; // nm
  let atomicNumber = 1;
  let zoom = 1;

  // Physical constants
  const BOHR_RADIUS_NM = 0.0529177; // Bohr radius in nm

  // Element data for first 54 elements
  const ELEMENT_SYMBOLS = [
    "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne",
    "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca",
    "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn",
    "Ga", "Ge", "As", "Se", "Br", "Kr", "Rb", "Sr", "Y", "Zr",
    "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn",
    "Sb", "Te", "I", "Xe",
  ];

  // Approximate empirical atomic radii in pm (picometers)
  const ATOMIC_RADII_PM = [
    53, 31, 167, 112, 87, 77, 75, 73, 71, 69,
    190, 145, 118, 111, 98, 88, 79, 71, 243, 194,
    184, 176, 171, 166, 161, 156, 152, 149, 145, 142,
    136, 125, 114, 103, 94, 88, 265, 219, 212, 206,
    198, 190, 183, 178, 173, 169, 165, 161, 156, 145,
    133, 123, 115, 108,
  ];

  // Electron shell configuration: [n_electrons_per_shell]
  function getShellConfig(z: number): number[] {
    const shells: number[] = [];
    let remaining = z;
    const maxPerShell = [2, 8, 18, 32, 32, 18, 8];
    for (let i = 0; i < maxPerShell.length && remaining > 0; i++) {
      const n = Math.min(remaining, maxPerShell[i]);
      shells.push(n);
      remaining -= n;
    }
    return shells;
  }

  function wavelengthToRGB(nm: number): { r: number; g: number; b: number } {
    let r = 0, g = 0, b = 0;
    if (nm >= 380 && nm < 440) {
      r = -(nm - 440) / (440 - 380);
      g = 0;
      b = 1;
    } else if (nm >= 440 && nm < 490) {
      r = 0;
      g = (nm - 440) / (490 - 440);
      b = 1;
    } else if (nm >= 490 && nm < 510) {
      r = 0;
      g = 1;
      b = -(nm - 510) / (510 - 490);
    } else if (nm >= 510 && nm < 580) {
      r = (nm - 510) / (580 - 510);
      g = 1;
      b = 0;
    } else if (nm >= 580 && nm < 645) {
      r = 1;
      g = -(nm - 645) / (645 - 580);
      b = 0;
    } else if (nm >= 645 && nm <= 780) {
      r = 1;
      g = 0;
      b = 0;
    }
    // Intensity falloff at edges
    let factor = 1.0;
    if (nm >= 380 && nm < 420) factor = 0.3 + 0.7 * (nm - 380) / (420 - 380);
    else if (nm >= 700 && nm <= 780) factor = 0.3 + 0.7 * (780 - nm) / (780 - 700);

    return {
      r: Math.round(r * factor * 255),
      g: Math.round(g * factor * 255),
      b: Math.round(b * factor * 255),
    };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    wavelength = params.wavelength ?? 550;
    atomicNumber = Math.max(1, Math.min(54, Math.round(params.atomicNumber ?? 1)));
    zoom = params.zoom ?? 1;
    time += dt;
  }

  function drawBackground(): void {
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);

    // Subtle grid
    ctx.strokeStyle = "rgba(60, 80, 120, 0.08)";
    ctx.lineWidth = 0.5;
    const spacing = 40;
    for (let x = 0; x < width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  function drawAtom(cx: number, cy: number, maxRadius: number): void {
    const shells = getShellConfig(atomicNumber);
    const numShells = shells.length;

    // Draw nucleus
    const nucleusR = Math.max(4, maxRadius * 0.08);
    const nucleusGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, nucleusR);
    nucleusGrad.addColorStop(0, "#ff6644");
    nucleusGrad.addColorStop(0.6, "#cc3322");
    nucleusGrad.addColorStop(1, "rgba(180, 30, 20, 0.3)");
    ctx.beginPath();
    ctx.arc(cx, cy, nucleusR, 0, Math.PI * 2);
    ctx.fillStyle = nucleusGrad;
    ctx.fill();

    // Proton count label
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = `${Math.max(8, nucleusR * 0.8)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (nucleusR > 8) {
      ctx.fillText(`${atomicNumber}`, cx, cy);
    }

    // Draw electron shells
    for (let s = 0; s < numShells; s++) {
      const shellRadius = nucleusR + ((s + 1) / numShells) * (maxRadius - nucleusR);
      const numElectrons = shells[s];

      // Shell orbit ring
      ctx.beginPath();
      ctx.arc(cx, cy, shellRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(100, 160, 255, ${0.15 + 0.05 * s})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Electrons on this shell
      for (let e = 0; e < numElectrons; e++) {
        const angle = (e / numElectrons) * Math.PI * 2 + time * (1.5 - s * 0.2);
        const ex = cx + Math.cos(angle) * shellRadius;
        const ey = cy + Math.sin(angle) * shellRadius;

        // Electron glow
        const eGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, 5);
        eGrad.addColorStop(0, "rgba(100, 180, 255, 0.9)");
        eGrad.addColorStop(1, "rgba(100, 180, 255, 0)");
        ctx.beginPath();
        ctx.arc(ex, ey, 5, 0, Math.PI * 2);
        ctx.fillStyle = eGrad;
        ctx.fill();

        // Electron dot
        ctx.beginPath();
        ctx.arc(ex, ey, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#80c0ff";
        ctx.fill();
      }
    }
  }

  function drawLightWave(startX: number, endX: number, cy: number, waveHeight: number): void {
    const rgb = wavelengthToRGB(wavelength);
    const color = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    const colorAlpha = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;

    // The wave frequency on screen: we show a few cycles
    const waveLen = (endX - startX) / 4; // show ~4 cycles
    const phaseShift = time * 3;

    // Draw filled wave
    ctx.beginPath();
    ctx.moveTo(startX, cy);
    for (let x = startX; x <= endX; x += 1) {
      const phase = ((x - startX) / waveLen) * Math.PI * 2 - phaseShift;
      const y = cy + Math.sin(phase) * waveHeight;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Glow effect
    ctx.beginPath();
    ctx.moveTo(startX, cy);
    for (let x = startX; x <= endX; x += 1) {
      const phase = ((x - startX) / waveLen) * Math.PI * 2 - phaseShift;
      const y = cy + Math.sin(phase) * waveHeight;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = colorAlpha;
    ctx.lineWidth = 8;
    ctx.stroke();

    // Center line
    ctx.beginPath();
    ctx.moveTo(startX, cy);
    ctx.lineTo(endX, cy);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Wavelength marker
    const markerY = cy + waveHeight + 20;
    const mStartX = startX + waveLen * 0.5;
    const mEndX = mStartX + waveLen;
    ctx.beginPath();
    ctx.moveTo(mStartX, markerY - 5);
    ctx.lineTo(mStartX, markerY + 5);
    ctx.moveTo(mStartX, markerY);
    ctx.lineTo(mEndX, markerY);
    ctx.moveTo(mEndX, markerY - 5);
    ctx.lineTo(mEndX, markerY + 5);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${wavelength.toFixed(0)} nm`, (mStartX + mEndX) / 2, markerY + 18);
  }

  function drawScaleComparison(): void {
    const atomRadius = ATOMIC_RADII_PM[atomicNumber - 1] / 1000; // convert pm to nm
    const ratio = wavelength / atomRadius;

    // Scale bar section at the bottom
    const barY = height * 0.82;
    const barLeft = width * 0.1;
    const barRight = width * 0.9;
    const barWidth = barRight - barLeft;

    // The bar represents the wavelength
    ctx.beginPath();
    ctx.moveTo(barLeft, barY);
    ctx.lineTo(barRight, barY);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Wavelength bracket
    ctx.beginPath();
    ctx.moveTo(barLeft, barY - 8);
    ctx.lineTo(barLeft, barY + 8);
    ctx.moveTo(barRight, barY - 8);
    ctx.lineTo(barRight, barY + 8);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const rgb = wavelengthToRGB(wavelength);
    ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Light wavelength: ${wavelength.toFixed(0)} nm`, (barLeft + barRight) / 2, barY + 25);

    // Atom size indicator (tiny on same scale)
    const atomBarWidth = Math.max(2, barWidth / ratio * zoom);
    const atomBarX = barLeft;
    ctx.fillStyle = "rgba(100, 180, 255, 0.8)";
    ctx.fillRect(atomBarX, barY - 4, atomBarWidth, 8);

    // Atom label
    ctx.fillStyle = "#80c0ff";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    const atomLabelX = atomBarX + atomBarWidth + 6;
    ctx.fillText(
      `${ELEMENT_SYMBOLS[atomicNumber - 1]} atom: ${atomRadius.toFixed(3)} nm`,
      atomLabelX, barY + 4
    );

    // Ratio display
    ctx.fillStyle = "rgba(255, 220, 100, 0.9)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `Ratio: light is ~${ratio.toFixed(0)}x larger than the atom`,
      (barLeft + barRight) / 2, barY + 48
    );

    if (zoom > 1) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText(`(atom enlarged ${zoom.toFixed(0)}x for visibility)`, (barLeft + barRight) / 2, barY + 65);
    }
  }

  function drawInfoPanel(): void {
    ctx.save();
    const panelW = 240;
    const panelH = 130;
    const panelX = 12;
    const panelY = 12;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 160, 220, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Atom vs Light Wavelength", panelX + 12, panelY + 10);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(100, 180, 255, 0.9)";
    const symbol = ELEMENT_SYMBOLS[atomicNumber - 1];
    const radiusPm = ATOMIC_RADII_PM[atomicNumber - 1];
    const radiusNm = radiusPm / 1000;
    ctx.fillText(`Element: ${symbol} (Z = ${atomicNumber})`, panelX + 12, panelY + 32);
    ctx.fillText(`Atomic radius: ${radiusPm} pm (${radiusNm.toFixed(3)} nm)`, panelX + 12, panelY + 48);

    const rgb = wavelengthToRGB(wavelength);
    ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    ctx.fillText(`Wavelength: ${wavelength.toFixed(0)} nm`, panelX + 12, panelY + 68);

    const freq = (2.998e8 / (wavelength * 1e-9) / 1e12).toFixed(1);
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText(`Frequency: ${freq} THz`, panelX + 12, panelY + 84);

    const energy = (1240 / wavelength).toFixed(2);
    ctx.fillText(`Photon energy: ${energy} eV`, panelX + 12, panelY + 100);

    ctx.fillStyle = "rgba(255, 220, 100, 0.7)";
    ctx.fillText(`Bohr radius (a0): ${BOHR_RADIUS_NM.toFixed(4)} nm`, panelX + 12, panelY + 116);
    ctx.restore();
  }

  function render(): void {
    drawBackground();

    // Layout: atom on the left, wave on the right
    const atomCx = width * 0.22;
    const atomCy = height * 0.38;
    const atomMaxR = Math.min(width * 0.16, height * 0.28);
    drawAtom(atomCx, atomCy, atomMaxR);

    // Atom label
    ctx.fillStyle = "#80c0ff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${ELEMENT_SYMBOLS[atomicNumber - 1]} Atom`, atomCx, atomCy + atomMaxR + 20);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(100, 180, 255, 0.6)";
    ctx.fillText("(not to scale)", atomCx, atomCy + atomMaxR + 36);

    // Light wave on the right
    const waveStartX = width * 0.42;
    const waveEndX = width * 0.92;
    const waveCy = height * 0.38;
    const waveHeight = Math.min(60, height * 0.12);
    drawLightWave(waveStartX, waveEndX, waveCy, waveHeight);

    // Light wave label
    const rgb = wavelengthToRGB(wavelength);
    ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Visible Light Wave", (waveStartX + waveEndX) / 2, waveCy - waveHeight - 16);

    // Scale comparison bar
    drawScaleComparison();

    // Info panel
    drawInfoPanel();

    // Spectrum bar at top right
    const specX = width - 180;
    const specY = 16;
    const specW = 160;
    const specH = 14;
    for (let i = 0; i < specW; i++) {
      const nm = 380 + (i / specW) * (780 - 380);
      const c = wavelengthToRGB(nm);
      ctx.fillStyle = `rgb(${c.r}, ${c.g}, ${c.b})`;
      ctx.fillRect(specX + i, specY, 1, specH);
    }
    // Current wavelength marker
    const markerPos = specX + ((wavelength - 380) / (780 - 380)) * specW;
    ctx.beginPath();
    ctx.moveTo(markerPos, specY + specH);
    ctx.lineTo(markerPos - 4, specY + specH + 7);
    ctx.lineTo(markerPos + 4, specY + specH + 7);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(specX, specY, specW, specH);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    // no cleanup needed
  }

  function getStateDescription(): string {
    const symbol = ELEMENT_SYMBOLS[atomicNumber - 1];
    const radiusPm = ATOMIC_RADII_PM[atomicNumber - 1];
    const radiusNm = radiusPm / 1000;
    const ratio = (wavelength / radiusNm).toFixed(0);
    return (
      `Size of Atom and Light simulation. Comparing ${symbol} (Z=${atomicNumber}) ` +
      `with atomic radius ${radiusPm} pm (${radiusNm.toFixed(3)} nm) to visible light ` +
      `at wavelength ${wavelength.toFixed(0)} nm. The light wavelength is ~${ratio}x ` +
      `larger than the atom. Bohr radius a0 = ${BOHR_RADIUS_NM} nm. ` +
      `Zoom factor: ${zoom}x. Atoms are far smaller than visible light wavelengths, ` +
      `which is why visible light cannot resolve individual atoms.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SizeOfAtomAndLightFactory;
