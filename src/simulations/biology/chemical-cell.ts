import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// Ion types for animation
interface Ion {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "Zn2+" | "Cu2+" | "SO4" | "K+" | "Cl-";
  alpha: number;
}

interface Electron {
  position: number; // 0-1 along the wire path
  speed: number;
}

const ChemicalCellFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("chemical-cell") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let speed = 1;
  let showIonFlow = 1;
  let showElectronFlow = 1;
  let cellType = 1; // 0=Voltaic, 1=Daniell

  // Animated entities
  let anodeIons: Ion[] = [];
  let cathodeIons: Ion[] = [];
  let saltBridgeIons: Ion[] = [];
  let electrons: Electron[] = [];

  // State
  let voltage = 1.1; // Standard cell potential Zn-Cu
  let bulbGlow = 0;
  let reactionProgress = 0;

  // Layout helpers (recalculated on resize)
  let anodeCenterX = 0;
  let cathodeCenterX = 0;
  let beakerTop = 0;
  let beakerBottom = 0;
  let beakerWidth = 0;
  let solutionTop = 0;
  let wireY = 0;

  function computeLayout(): void {
    const margin = width * 0.08;
    beakerWidth = (width - margin * 3) / 2;
    anodeCenterX = margin + beakerWidth / 2;
    cathodeCenterX = width - margin - beakerWidth / 2;
    beakerTop = height * 0.35;
    beakerBottom = height * 0.82;
    solutionTop = beakerTop + (beakerBottom - beakerTop) * 0.15;
    wireY = height * 0.12;
  }

  function initIons(): void {
    anodeIons = [];
    cathodeIons = [];
    saltBridgeIons = [];
    electrons = [];

    const anodeLeft = anodeCenterX - beakerWidth * 0.4;
    const anodeRight = anodeCenterX + beakerWidth * 0.4;
    const cathodeLeft = cathodeCenterX - beakerWidth * 0.4;
    const cathodeRight = cathodeCenterX + beakerWidth * 0.4;

    // Zinc sulfate ions in anode half-cell
    for (let i = 0; i < 12; i++) {
      anodeIons.push({
        x: anodeLeft + Math.random() * (anodeRight - anodeLeft),
        y: solutionTop + 10 + Math.random() * (beakerBottom - solutionTop - 30),
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 15,
        type: Math.random() < 0.5 ? "Zn2+" : "SO4",
        alpha: 0.6 + Math.random() * 0.4,
      });
    }

    // Copper sulfate ions in cathode half-cell
    for (let i = 0; i < 12; i++) {
      cathodeIons.push({
        x: cathodeLeft + Math.random() * (cathodeRight - cathodeLeft),
        y: solutionTop + 10 + Math.random() * (beakerBottom - solutionTop - 30),
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 15,
        type: Math.random() < 0.5 ? "Cu2+" : "SO4",
        alpha: 0.6 + Math.random() * 0.4,
      });
    }

    // Salt bridge ions
    for (let i = 0; i < 6; i++) {
      saltBridgeIons.push({
        x: (anodeCenterX + cathodeCenterX) / 2 + (Math.random() - 0.5) * (cathodeCenterX - anodeCenterX) * 0.6,
        y: solutionTop + 5 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 10,
        vy: 0,
        type: Math.random() < 0.5 ? "K+" : "Cl-",
        alpha: 0.5 + Math.random() * 0.3,
      });
    }

    // Electrons along wire
    for (let i = 0; i < 8; i++) {
      electrons.push({
        position: Math.random(),
        speed: 0.08 + Math.random() * 0.04,
      });
    }
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawBeaker(cx: number, label: string, solutionColor: string): void {
    const left = cx - beakerWidth / 2;
    const right = cx + beakerWidth / 2;
    const bTop = beakerTop;
    const bBottom = beakerBottom;

    // Solution
    ctx.fillStyle = solutionColor;
    ctx.fillRect(left + 3, solutionTop, beakerWidth - 6, bBottom - solutionTop - 3);

    // Solution surface highlight
    ctx.strokeStyle = "rgba(200, 220, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left + 4, solutionTop);
    ctx.lineTo(right - 4, solutionTop);
    ctx.stroke();

    // Beaker glass
    ctx.strokeStyle = "rgba(140, 180, 220, 0.5)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(left, bTop);
    ctx.lineTo(left, bBottom);
    ctx.lineTo(right, bBottom);
    ctx.lineTo(right, bTop);
    ctx.stroke();

    // Glass body fill
    ctx.fillStyle = "rgba(120, 160, 200, 0.04)";
    ctx.fillRect(left, bTop, beakerWidth, bBottom - bTop);

    // Glass highlight
    const hlGrad = ctx.createLinearGradient(left, 0, left + 10, 0);
    hlGrad.addColorStop(0, "rgba(200, 230, 255, 0.12)");
    hlGrad.addColorStop(1, "rgba(200, 230, 255, 0)");
    ctx.fillStyle = hlGrad;
    ctx.fillRect(left + 1, bTop + 8, 10, bBottom - bTop - 16);

    // Label below beaker
    const fontSize = Math.max(10, Math.min(12, width / 55));
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(label, cx, bBottom + 8);
  }

  function drawElectrodePlate(
    cx: number, plateColor: string, metalLabel: string, isAnode: boolean
  ): void {
    const plateWidth = 14;
    const plateTop = beakerTop - 20;
    const plateBottom = beakerBottom - 20;

    // Metallic plate gradient
    const grad = ctx.createLinearGradient(cx - plateWidth / 2, 0, cx + plateWidth / 2, 0);
    grad.addColorStop(0, darkenColor(plateColor, 0.2));
    grad.addColorStop(0.35, lightenColor(plateColor, 0.15));
    grad.addColorStop(0.65, plateColor);
    grad.addColorStop(1, darkenColor(plateColor, 0.3));
    ctx.fillStyle = grad;
    ctx.fillRect(cx - plateWidth / 2, plateTop, plateWidth, plateBottom - plateTop);

    // Metallic highlight strip
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(cx - plateWidth / 2 + 2, plateTop + 5, 3, plateBottom - plateTop - 10);

    // Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - plateWidth / 2, plateTop, plateWidth, plateBottom - plateTop);

    // Metal label
    const fontSize = Math.max(10, Math.min(12, width / 55));
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(metalLabel, cx, plateTop - 4);

    // Anode/Cathode label
    ctx.font = `${Math.max(9, fontSize - 1)}px system-ui, sans-serif`;
    ctx.fillStyle = isAnode ? "rgba(255, 100, 100, 0.7)" : "rgba(100, 200, 255, 0.7)";
    ctx.fillText(isAnode ? "Anode (\u2212)" : "Cathode (+)", cx, plateTop - 18);

    // Reaction equation
    ctx.font = `${Math.max(8, fontSize - 2)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    if (isAnode) {
      ctx.fillText("Zn \u2192 Zn\u00B2\u207A + 2e\u207B", cx, plateTop - 32);
      ctx.fillText("(oxidation)", cx, plateTop - 44);
    } else {
      ctx.fillText("Cu\u00B2\u207A + 2e\u207B \u2192 Cu", cx, plateTop - 32);
      ctx.fillText("(reduction)", cx, plateTop - 44);
    }

    // Dissolving / depositing animation at solution line
    if (isAnode && reactionProgress > 0) {
      // Tiny particles leaving the anode into solution
      for (let i = 0; i < 4; i++) {
        const t = (time * speed * 2 + i * 0.8) % 2;
        if (t < 1.5) {
          const px = cx + (Math.sin(i * 3.1 + time) * 12);
          const py = solutionTop + 30 + t * 30;
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(160, 170, 190, ${0.5 * (1 - t / 1.5)})`;
          ctx.fill();
        }
      }
    }
    if (!isAnode && reactionProgress > 0) {
      // Tiny particles depositing on cathode
      for (let i = 0; i < 3; i++) {
        const t = (time * speed * 1.5 + i * 1.1) % 2;
        if (t < 1.5) {
          const px = cx + (Math.sin(i * 2.3 + time * 0.8) * 15);
          const py = solutionTop + 50 - t * 20;
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200, 140, 60, ${0.5 * (1 - t / 1.5)})`;
          ctx.fill();
        }
      }
    }
  }

  function lightenColor(hex: string, amount: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.min(255, Math.round(r + (255 - r) * amount))},${Math.min(255, Math.round(g + (255 - g) * amount))},${Math.min(255, Math.round(b + (255 - b) * amount))})`;
  }

  function darkenColor(hex: string, amount: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.round(r * (1 - amount))},${Math.round(g * (1 - amount))},${Math.round(b * (1 - amount))})`;
  }

  function drawSaltBridge(): void {
    // U-shaped salt bridge connecting the two solutions
    const bridgeTop = solutionTop - 15;
    const bridgeLeft = anodeCenterX + beakerWidth * 0.3;
    const bridgeRight = cathodeCenterX - beakerWidth * 0.3;
    const bridgeDip = solutionTop + 25;
    const tubeWidth = 12;

    // Glass tube outline
    ctx.strokeStyle = "rgba(160, 200, 230, 0.5)";
    ctx.lineWidth = tubeWidth;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bridgeLeft, bridgeDip);
    ctx.quadraticCurveTo(bridgeLeft, bridgeTop, (bridgeLeft + bridgeRight) / 2, bridgeTop);
    ctx.quadraticCurveTo(bridgeRight, bridgeTop, bridgeRight, bridgeDip);
    ctx.stroke();

    // Inner fill (gel/solution)
    ctx.strokeStyle = "rgba(220, 200, 160, 0.25)";
    ctx.lineWidth = tubeWidth - 4;
    ctx.beginPath();
    ctx.moveTo(bridgeLeft, bridgeDip);
    ctx.quadraticCurveTo(bridgeLeft, bridgeTop, (bridgeLeft + bridgeRight) / 2, bridgeTop);
    ctx.quadraticCurveTo(bridgeRight, bridgeTop, bridgeRight, bridgeDip);
    ctx.stroke();

    // Label
    if (showIonFlow >= 0.5) {
      const fontSize = Math.max(9, Math.min(11, width / 65));
      ctx.font = `${fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("Salt Bridge", (bridgeLeft + bridgeRight) / 2, bridgeTop - 4);

      if (cellType === 1) {
        ctx.font = `${Math.max(8, fontSize - 1)}px system-ui, sans-serif`;
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.fillText("(KCl or KNO\u2083)", (bridgeLeft + bridgeRight) / 2, bridgeTop - 16);
      }
    }
  }

  function drawExternalCircuit(): void {
    const anodePlateX = anodeCenterX - beakerWidth * 0.15;
    const cathodePlateX = cathodeCenterX + beakerWidth * 0.15;
    const plateTop = beakerTop - 20;

    // Wire from anode up and across to cathode
    ctx.strokeStyle = "rgba(180, 180, 180, 0.6)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(anodePlateX, plateTop);
    ctx.lineTo(anodePlateX, wireY);
    ctx.lineTo(cathodePlateX, wireY);
    ctx.lineTo(cathodePlateX, plateTop);
    ctx.stroke();

    // Voltmeter in the middle-top
    const vmX = (anodePlateX + cathodePlateX) / 2;
    const vmY = wireY - 2;
    const vmR = Math.min(28, width * 0.04);

    // Voltmeter body
    ctx.beginPath();
    ctx.arc(vmX, vmY, vmR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(30, 40, 60, 0.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Voltmeter reading
    const displayVoltage = voltage * Math.min(1, reactionProgress * 3);
    const vmFontSize = Math.max(9, vmR * 0.5);
    ctx.font = `bold ${vmFontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "#34d399";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${displayVoltage.toFixed(2)}V`, vmX, vmY - 2);

    // "V" label
    ctx.font = `${Math.max(7, vmFontSize - 2)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText("Voltmeter", vmX, vmY + vmR * 0.55);

    // Needle (simple line showing voltage)
    const needleAngle = -Math.PI * 0.75 + (displayVoltage / 2.0) * Math.PI * 0.75;
    ctx.beginPath();
    ctx.moveTo(vmX, vmY - 2);
    ctx.lineTo(
      vmX + Math.cos(needleAngle) * vmR * 0.6,
      vmY - 2 + Math.sin(needleAngle) * vmR * 0.6
    );
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Light bulb
    const bulbX = vmX + (cathodePlateX - vmX) * 0.6;
    const bulbY = wireY;
    const bulbR = Math.min(16, width * 0.025);

    // Bulb glow
    if (bulbGlow > 0.1) {
      const glowGrad = ctx.createRadialGradient(bulbX, bulbY, bulbR * 0.3, bulbX, bulbY, bulbR * 4);
      glowGrad.addColorStop(0, `rgba(255, 240, 150, ${bulbGlow * 0.4})`);
      glowGrad.addColorStop(0.5, `rgba(255, 220, 100, ${bulbGlow * 0.15})`);
      glowGrad.addColorStop(1, "rgba(255, 200, 50, 0)");
      ctx.beginPath();
      ctx.arc(bulbX, bulbY, bulbR * 4, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();
    }

    // Bulb glass
    ctx.beginPath();
    ctx.arc(bulbX, bulbY - bulbR * 0.2, bulbR, 0, Math.PI * 2);
    const bulbGrad = ctx.createRadialGradient(
      bulbX - bulbR * 0.2, bulbY - bulbR * 0.4, 0,
      bulbX, bulbY, bulbR
    );
    bulbGrad.addColorStop(0, `rgba(255, 255, 200, ${0.3 + bulbGlow * 0.7})`);
    bulbGrad.addColorStop(1, `rgba(200, 200, 150, ${0.15 + bulbGlow * 0.3})`);
    ctx.fillStyle = bulbGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 200, 200, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Filament
    ctx.beginPath();
    const fSegments = 5;
    for (let i = 0; i <= fSegments; i++) {
      const fx = bulbX - bulbR * 0.3 + (i / fSegments) * bulbR * 0.6;
      const fy = bulbY - bulbR * 0.2 + Math.sin(i * 2) * bulbR * 0.2;
      if (i === 0) ctx.moveTo(fx, fy);
      else ctx.lineTo(fx, fy);
    }
    ctx.strokeStyle = `rgba(255, 200, 100, ${0.4 + bulbGlow * 0.6})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Bulb base
    ctx.fillStyle = "rgba(160, 160, 160, 0.6)";
    ctx.fillRect(bulbX - bulbR * 0.4, bulbY + bulbR * 0.6, bulbR * 0.8, bulbR * 0.4);

    // Electron flow animation
    if (showElectronFlow >= 0.5) {
      for (const e of electrons) {
        // Map position 0-1 along the wire path
        const t = e.position;
        let ex: number, ey: number;

        if (t < 0.25) {
          // Going up from anode plate
          const seg = t / 0.25;
          ex = anodePlateX;
          ey = plateTop - seg * (plateTop - wireY);
        } else if (t < 0.75) {
          // Going across the top
          const seg = (t - 0.25) / 0.5;
          ex = anodePlateX + seg * (cathodePlateX - anodePlateX);
          ey = wireY;
        } else {
          // Going down to cathode plate
          const seg = (t - 0.75) / 0.25;
          ex = cathodePlateX;
          ey = wireY + seg * (plateTop - wireY);
        }

        // Draw electron
        ctx.beginPath();
        ctx.arc(ex, ey, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(80, 180, 255, 0.8)";
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(ex, ey, 6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(80, 180, 255, 0.15)";
        ctx.fill();
      }

      // Arrow showing direction
      const arrowX = (anodePlateX + cathodePlateX) / 2 - (cathodePlateX - anodePlateX) * 0.25;
      const arrowY = wireY - 12;
      const fontSize = Math.max(8, Math.min(10, width / 70));
      ctx.font = `${fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = "rgba(80, 180, 255, 0.6)";
      ctx.textAlign = "center";
      ctx.fillText("e\u207B flow \u2192", (anodePlateX + cathodePlateX) / 2, arrowY);
    }
  }

  function drawIons(): void {
    if (showIonFlow < 0.5) return;

    const ionFontSize = Math.max(7, Math.min(9, width / 80));

    const drawIon = (ion: Ion): void => {
      let color: string;
      let label: string;

      switch (ion.type) {
        case "Zn2+":
          color = "rgba(160, 170, 190, 0.8)";
          label = "Zn\u00B2\u207A";
          break;
        case "Cu2+":
          color = "rgba(60, 180, 200, 0.8)";
          label = "Cu\u00B2\u207A";
          break;
        case "SO4":
          color = "rgba(230, 210, 80, 0.7)";
          label = "SO\u2084\u00B2\u207B";
          break;
        case "K+":
          color = "rgba(180, 130, 255, 0.7)";
          label = "K\u207A";
          break;
        case "Cl-":
          color = "rgba(100, 220, 180, 0.7)";
          label = "Cl\u207B";
          break;
        default:
          color = "rgba(200, 200, 200, 0.6)";
          label = "?";
      }

      ctx.save();
      ctx.globalAlpha = ion.alpha;

      // Ion circle
      const r = 5;
      ctx.beginPath();
      ctx.arc(ion.x, ion.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Label
      ctx.font = `bold ${ionFontSize}px system-ui, sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, ion.x, ion.y);

      ctx.restore();
    };

    for (const ion of anodeIons) drawIon(ion);
    for (const ion of cathodeIons) drawIon(ion);
    for (const ion of saltBridgeIons) drawIon(ion);
  }

  function drawInfoPanel(): void {
    const panelW = Math.min(width * 0.3, 200);
    const panelH = 85;
    const panelX = width - panelW - 10;
    const panelY = height - panelH - 10;
    const fontSize = Math.max(9, Math.min(11, width / 65));

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = `bold ${fontSize + 1}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(cellType === 1 ? "Daniell Cell" : "Voltaic Cell", panelX + 10, panelY + 8);

    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText(`E\u00B0cell = +${voltage.toFixed(2)} V`, panelX + 10, panelY + 26);
    ctx.fillText(`Anode: Zn (oxidation)`, panelX + 10, panelY + 42);
    ctx.fillText(`Cathode: Cu (reduction)`, panelX + 10, panelY + 58);

    // Ion color key
    const keyY = panelY - 80;
    const keyX = panelX;

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(keyX, keyY, panelW, 70, 8);
    ctx.fill();

    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText("Ion Colors:", keyX + 10, keyY + 8);

    const ionColors = [
      { color: "rgba(160, 170, 190, 0.8)", label: "Zn\u00B2\u207A (gray)" },
      { color: "rgba(60, 180, 200, 0.8)", label: "Cu\u00B2\u207A (teal)" },
      { color: "rgba(230, 210, 80, 0.7)", label: "SO\u2084\u00B2\u207B (yellow)" },
    ];

    ctx.font = `${fontSize - 1}px system-ui, sans-serif`;
    ionColors.forEach((ic, i) => {
      const iy = keyY + 24 + i * 14;
      ctx.beginPath();
      ctx.arc(keyX + 16, iy + 4, 4, 0, Math.PI * 2);
      ctx.fillStyle = ic.color;
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillText(ic.label, keyX + 26, iy);
    });
  }

  function drawTitle(): void {
    const fontSize = Math.max(12, Math.min(15, width / 45));
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      cellType === 1 ? "Daniell Cell (Electrochemical Cell)" : "Voltaic Cell (Electrochemical Cell)",
      width / 2,
      height * 0.02
    );
  }

  function updateIons(dt: number, ions: Ion[], leftBound: number, rightBound: number): void {
    for (const ion of ions) {
      ion.vx += (Math.random() - 0.5) * 35 * dt;
      ion.vy += (Math.random() - 0.5) * 25 * dt;
      ion.vx *= 0.97;
      ion.vy *= 0.97;

      ion.x += ion.vx * dt * speed;
      ion.y += ion.vy * dt * speed;

      if (ion.x < leftBound + 8) { ion.x = leftBound + 8; ion.vx = Math.abs(ion.vx); }
      if (ion.x > rightBound - 8) { ion.x = rightBound - 8; ion.vx = -Math.abs(ion.vx); }
      if (ion.y < solutionTop + 8) { ion.y = solutionTop + 8; ion.vy = Math.abs(ion.vy); }
      if (ion.y > beakerBottom - 10) { ion.y = beakerBottom - 10; ion.vy = -Math.abs(ion.vy); }
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    reactionProgress = 0;
    bulbGlow = 0;
    computeLayout();
    initIons();
  }

  function update(dt: number, params: Record<string, number>): void {
    speed = params.speed ?? 1;
    showIonFlow = params.showIonFlow ?? 1;
    showElectronFlow = params.showElectronFlow ?? 1;
    const newCellType = Math.round(params.cellType ?? 1);

    if (newCellType !== cellType) {
      cellType = newCellType;
      // Both types use Zn-Cu in this simulation; label changes
    }

    const dtClamped = Math.min(dt, 0.05);
    time += dtClamped * speed;

    // Reaction progresses continuously
    reactionProgress = Math.min(reactionProgress + dtClamped * speed * 0.08, 1);

    // Bulb glows based on reaction
    const targetGlow = reactionProgress > 0.1 ? 0.6 + Math.sin(time * 3) * 0.15 : 0;
    bulbGlow = bulbGlow + (targetGlow - bulbGlow) * 0.05;

    // Update ion positions
    const anodeLeft = anodeCenterX - beakerWidth * 0.45;
    const anodeRight = anodeCenterX + beakerWidth * 0.45;
    const cathodeLeft = cathodeCenterX - beakerWidth * 0.45;
    const cathodeRight = cathodeCenterX + beakerWidth * 0.45;

    updateIons(dtClamped, anodeIons, anodeLeft, anodeRight);
    updateIons(dtClamped, cathodeIons, cathodeLeft, cathodeRight);

    // Salt bridge ions drift slowly
    for (const ion of saltBridgeIons) {
      // K+ drifts toward cathode, Cl- toward anode
      const drift = ion.type === "K+" ? 5 : -5;
      ion.vx += drift * dtClamped + (Math.random() - 0.5) * 10 * dtClamped;
      ion.vx *= 0.96;

      ion.x += ion.vx * dtClamped * speed;

      const bridgeLeft = anodeCenterX + beakerWidth * 0.2;
      const bridgeRight = cathodeCenterX - beakerWidth * 0.2;
      if (ion.x < bridgeLeft) { ion.x = bridgeLeft; ion.vx = Math.abs(ion.vx); }
      if (ion.x > bridgeRight) { ion.x = bridgeRight; ion.vx = -Math.abs(ion.vx); }

      ion.y = solutionTop + 5 + Math.sin(time * 2 + ion.x * 0.1) * 5;
    }

    // Electrons flow along wire
    for (const e of electrons) {
      e.position = (e.position + e.speed * dtClamped * speed) % 1;
    }

    // Standard cell potential: E = E_cathode - E_anode
    // Cu2+/Cu = +0.34V, Zn2+/Zn = -0.76V
    // E_cell = 0.34 - (-0.76) = 1.10V
    voltage = 1.1;
  }

  function render(): void {
    if (!ctx || width === 0 || height === 0) return;

    drawBackground();
    drawTitle();

    // Draw beakers
    drawBeaker(
      anodeCenterX,
      "ZnSO\u2084 (aq)",
      "rgba(180, 200, 220, 0.2)"
    );
    drawBeaker(
      cathodeCenterX,
      "CuSO\u2084 (aq)",
      "rgba(60, 130, 200, 0.25)"
    );

    // Draw electrode plates
    const anodePlateX = anodeCenterX - beakerWidth * 0.15;
    const cathodePlateX = cathodeCenterX + beakerWidth * 0.15;
    drawElectrodePlate(anodePlateX, "#7b8ea0", "Zn", true);
    drawElectrodePlate(cathodePlateX, "#c87533", "Cu", false);

    drawSaltBridge();
    drawIons();
    drawExternalCircuit();
    drawInfoPanel();

    // Time
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 8, height - 6);
  }

  function reset(): void {
    time = 0;
    reactionProgress = 0;
    bulbGlow = 0;
    computeLayout();
    initIons();
  }

  function destroy(): void {
    anodeIons = [];
    cathodeIons = [];
    saltBridgeIons = [];
    electrons = [];
  }

  function getStateDescription(): string {
    const cellName = cellType === 1 ? "Daniell" : "Voltaic";
    return (
      `${cellName} Cell (Electrochemical Cell) | ` +
      `Standard cell potential: E\u00B0 = +${voltage.toFixed(2)} V | ` +
      `Anode (oxidation): Zn \u2192 Zn\u00B2\u207A + 2e\u207B (E\u00B0 = -0.76 V) | ` +
      `Cathode (reduction): Cu\u00B2\u207A + 2e\u207B \u2192 Cu (E\u00B0 = +0.34 V) | ` +
      `E\u00B0cell = E\u00B0cathode - E\u00B0anode = 0.34 - (-0.76) = 1.10 V | ` +
      `Electrons flow through external wire from Zn (anode) to Cu (cathode). ` +
      `Salt bridge maintains electrical neutrality. ` +
      `Ion flow: ${showIonFlow >= 0.5 ? "visible" : "hidden"} | ` +
      `Electron flow: ${showElectronFlow >= 0.5 ? "visible" : "hidden"} | ` +
      `Speed: ${speed}x | Reaction progress: ${(reactionProgress * 100).toFixed(0)}% | ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    computeLayout();
    initIons();
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default ChemicalCellFactory;
