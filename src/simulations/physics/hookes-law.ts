import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface DataPoint {
  force: number;
  extension: number;
}

const HookesLawFactory: SimulationFactory = () => {
  const config = getSimConfig("hookes-law") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let springConstant = 50;
  let appliedForce = 10;
  let restLength = 100;
  let maxForce = 50;

  // State
  let currentExtension = 0;
  let dataPoints: DataPoint[] = [];
  let springPosition = 0;
  let massPosition = 0;
  let recordData = 0;

  // Visual constants
  const SPRING_X = W * 0.15;
  const SPRING_TOP = H * 0.15;
  const MASS_SIZE = 30;

  function calculateExtension() {
    // From Hooke's law: F = kx, so x = F/k
    currentExtension = appliedForce / springConstant;
    springPosition = SPRING_TOP + restLength + currentExtension;
    massPosition = springPosition + MASS_SIZE / 2;
  }

  function addDataPoint() {
    if (recordData && dataPoints.length < 20) {
      dataPoints.push({
        force: appliedForce,
        extension: currentExtension
      });
    }
  }

  function drawSpring(x: number, y1: number, y2: number) {
    const coils = Math.max(8, Math.floor((y2 - y1) / 12));
    const amplitude = 12;
    const length = y2 - y1;
    
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    
    for (let i = 0; i <= coils; i++) {
      const t = i / coils;
      const y = y1 + t * length;
      const offset = (i === 0 || i === coils) ? 0 : amplitude * Math.sin(i * Math.PI * 0.8);
      ctx.lineTo(x + offset, y);
    }
    
    ctx.stroke();
  }

  function drawMass(x: number, y: number) {
    // Mass with handle for force application
    const gradient = ctx.createRadialGradient(x - 8, y - 8, 0, x, y, MASS_SIZE);
    gradient.addColorStop(0, "#dc2626");
    gradient.addColorStop(1, "#991b1b");
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x - MASS_SIZE/2, y - MASS_SIZE/2, MASS_SIZE, MASS_SIZE);
    
    ctx.strokeStyle = "#7f1d1d";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - MASS_SIZE/2, y - MASS_SIZE/2, MASS_SIZE, MASS_SIZE);
    
    // Handle/hook
    ctx.fillStyle = "#374151";
    ctx.fillRect(x - 5, y + MASS_SIZE/2, 10, 15);
    ctx.beginPath();
    ctx.arc(x, y + MASS_SIZE/2 + 20, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawForceArrow(x: number, y: number, force: number) {
    if (Math.abs(force) < 0.1) return;
    
    const arrowLength = Math.min(force * 2, 100);
    const endY = y + arrowLength;
    
    // Arrow shaft
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, endY);
    ctx.stroke();
    
    // Arrow head
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(x, endY);
    ctx.lineTo(x - 8, endY - 12);
    ctx.lineTo(x + 8, endY - 12);
    ctx.closePath();
    ctx.fill();
    
    // Force label
    ctx.fillStyle = "#ef4444";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`F = ${force.toFixed(1)} N`, x + 35, y + arrowLength / 2);
  }

  function drawRuler() {
    const rulerX = W * 0.05;
    const rulerTop = SPRING_TOP;
    const rulerBottom = H * 0.7;
    
    // Ruler background
    ctx.fillStyle = "#374151";
    ctx.fillRect(rulerX, rulerTop, 20, rulerBottom - rulerTop);
    
    // Tick marks every 10 units of extension
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#ffffff";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    
    const pixelsPerMeter = 200; // Scale factor
    const tickInterval = 0.5; // Every 0.5m
    
    for (let ext = 0; ext <= 2; ext += tickInterval) {
      const y = SPRING_TOP + restLength + ext * pixelsPerMeter;
      if (y <= rulerBottom) {
        const tickLength = ext % 1 === 0 ? 15 : 8;
        
        ctx.beginPath();
        ctx.moveTo(rulerX + 20, y);
        ctx.lineTo(rulerX + 20 - tickLength, y);
        ctx.stroke();
        
        if (ext % 1 === 0) {
          ctx.fillText(`${ext.toFixed(0)}m`, rulerX - 15, y + 3);
        }
      }
    }
    
    // Current extension marker
    const currentY = SPRING_TOP + restLength + currentExtension * pixelsPerMeter;
    if (currentY <= rulerBottom) {
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.moveTo(rulerX - 5, currentY);
      ctx.lineTo(rulerX + 25, currentY);
      ctx.lineTo(rulerX + 20, currentY - 5);
      ctx.lineTo(rulerX + 20, currentY + 5);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = "#22d3ee";
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${currentExtension.toFixed(2)}m`, rulerX - 10, currentY - 8);
    }
  }

  function drawGraph() {
    const graphX = W * 0.45;
    const graphY = H * 0.15;
    const graphW = W * 0.5;
    const graphH = H * 0.4;
    
    // Graph background
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.strokeRect(graphX, graphY, graphW, graphH);
    
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Force vs Extension (Hooke's Law)", graphX + graphW / 2, graphY - 10);
    
    // Axes
    const axisX = graphX + 40;
    const axisY = graphY + graphH - 40;
    const plotW = graphW - 80;
    const plotH = graphH - 80;
    
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(axisX, graphY + 20);
    ctx.lineTo(axisX, axisY);
    ctx.lineTo(axisX + plotW, axisY);
    ctx.stroke();
    
    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Extension (m)", axisX + plotW / 2, graphY + graphH - 5);
    
    ctx.save();
    ctx.translate(graphX + 15, graphY + graphH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Force (N)", 0, 0);
    ctx.restore();
    
    // Grid lines
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    
    for (let i = 1; i <= 4; i++) {
      // Vertical grid lines
      const x = axisX + (plotW * i) / 5;
      ctx.beginPath();
      ctx.moveTo(x, graphY + 20);
      ctx.lineTo(x, axisY);
      ctx.stroke();
      
      // Horizontal grid lines
      const y = axisY - (plotH * i) / 5;
      ctx.beginPath();
      ctx.moveTo(axisX, y);
      ctx.lineTo(axisX + plotW, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    
    // Scale markers
    ctx.fillStyle = "#64748b";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    
    const maxExt = 2; // 2 meters
    for (let i = 0; i <= 5; i++) {
      const ext = (maxExt * i) / 5;
      const x = axisX + (plotW * i) / 5;
      ctx.fillText(ext.toFixed(1), x, axisY + 15);
    }
    
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const force = (maxForce * i) / 5;
      const y = axisY - (plotH * i) / 5;
      ctx.fillText(force.toFixed(0), axisX - 5, y + 3);
    }
    
    // Theoretical line (Hooke's law: F = kx)
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const maxTheoreticalExt = maxForce / springConstant;
    const theoreticalEndX = axisX + (maxTheoreticalExt / maxExt) * plotW;
    const theoreticalEndY = axisY - plotH;
    
    ctx.moveTo(axisX, axisY);
    ctx.lineTo(Math.min(theoreticalEndX, axisX + plotW), Math.min(theoreticalEndY, axisY));
    ctx.stroke();
    
    // Theoretical line label
    ctx.fillStyle = "#10b981";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`F = ${springConstant}x (Theory)`, axisX + plotW * 0.1, graphY + 35);
    
    // Data points
    if (dataPoints.length > 0) {
      ctx.fillStyle = "#ef4444";
      
      for (const point of dataPoints) {
        const x = axisX + (point.extension / maxExt) * plotW;
        const y = axisY - (point.force / maxForce) * plotH;
        
        if (x >= axisX && x <= axisX + plotW && y >= graphY + 20 && y <= axisY) {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      ctx.fillStyle = "#ef4444";
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`Data Points (${dataPoints.length})`, axisX + plotW * 0.1, graphY + 50);
    }
    
    // Current point
    if (currentExtension <= maxExt && appliedForce <= maxForce) {
      const currentX = axisX + (currentExtension / maxExt) * plotW;
      const currentY = axisY - (appliedForce / maxForce) * plotH;
      
      // Highlight current point
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(currentX, currentY, 6, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(currentX, currentY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawInfoPanel() {
    const panelX = W * 0.45;
    const panelY = H * 0.6;
    const panelW = W * 0.5;
    const panelH = H * 0.35;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    let infoY = panelY + 25;
    
    ctx.fillText("Hooke's Law: F = kx", panelX + 15, infoY);
    infoY += 25;
    
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Spring Constant (k): ${springConstant.toFixed(1)} N/m`, panelX + 15, infoY);
    infoY += 20;
    
    ctx.fillStyle = "#ef4444";
    ctx.fillText(`Applied Force (F): ${appliedForce.toFixed(1)} N`, panelX + 15, infoY);
    infoY += 20;
    
    ctx.fillStyle = "#22d3ee";
    ctx.fillText(`Extension (x): ${currentExtension.toFixed(3)} m`, panelX + 15, infoY);
    infoY += 20;
    
    // Elastic potential energy
    const elasticPE = 0.5 * springConstant * currentExtension * currentExtension;
    ctx.fillStyle = "#8b5cf6";
    ctx.fillText(`Elastic PE: ${elasticPE.toFixed(2)} J`, panelX + 15, infoY);
    infoY += 25;
    
    // Instructions
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.fillText("• Adjust force to see spring extend", panelX + 15, infoY);
    infoY += 16;
    ctx.fillText("• Enable 'Record Data' to collect points", panelX + 15, infoY);
    infoY += 16;
    ctx.fillText("• Graph shows F vs x relationship", panelX + 15, infoY);
    infoY += 16;
    
    if (dataPoints.length > 2) {
      // Calculate slope from data points
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (const point of dataPoints) {
        sumX += point.extension;
        sumY += point.force;
        sumXY += point.extension * point.force;
        sumXX += point.extension * point.extension;
      }
      
      const n = dataPoints.length;
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      
      ctx.fillStyle = "#10b981";
      ctx.fillText(`Measured k ≈ ${slope.toFixed(1)} N/m`, panelX + 15, infoY);
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      calculateExtension();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      springConstant = params.springConstant ?? springConstant;
      appliedForce = params.force ?? appliedForce;
      restLength = params.restLength ?? restLength;
      maxForce = params.maxForce ?? maxForce;
      recordData = Math.round(params.recordData ?? recordData);
      
      calculateExtension();
      
      if (recordData) {
        addDataPoint();
      }
      
      time += dt;
    },

    render() {
      if (!ctx) return;

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0f172a");
      bgGrad.addColorStop(1, "#1e293b");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Hooke's Law", W / 2, 30);
      
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("F = kx - Force is proportional to extension", W / 2, 50);

      // Draw ceiling mount
      ctx.fillStyle = "#374151";
      ctx.fillRect(SPRING_X - 20, SPRING_TOP - 20, 40, 20);
      
      // Hatching pattern
      ctx.strokeStyle = "#6b7280";
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const x = SPRING_X - 18 + (36 * i) / 6;
        ctx.beginPath();
        ctx.moveTo(x, SPRING_TOP - 20);
        ctx.lineTo(x + 3, SPRING_TOP - 15);
        ctx.stroke();
      }

      // Draw spring
      drawSpring(SPRING_X, SPRING_TOP, springPosition);

      // Draw mass
      drawMass(SPRING_X, massPosition);

      // Draw force arrow
      drawForceArrow(SPRING_X, massPosition + MASS_SIZE/2 + 30, appliedForce);

      // Draw ruler
      drawRuler();

      // Rest length indicator
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(SPRING_X - 30, SPRING_TOP + restLength);
      ctx.lineTo(SPRING_X + 40, SPRING_TOP + restLength);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText("Rest length", SPRING_X + 45, SPRING_TOP + restLength + 4);

      // Draw graph and info panel
      drawGraph();
      drawInfoPanel();

      // Clear data button indicator
      if (dataPoints.length > 0) {
        ctx.fillStyle = "#ef4444";
        ctx.font = "10px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`${dataPoints.length} data points collected`, W * 0.02, H - 15);
        ctx.fillText("(Adjust recordData parameter to clear)", W * 0.02, H - 5);
      }
    },

    reset() {
      time = 0;
      dataPoints = [];
      calculateExtension();
    },

    destroy() {},

    getStateDescription(): string {
      const elasticPE = 0.5 * springConstant * currentExtension * currentExtension;
      
      return `Hooke's Law demonstration: Spring with k=${springConstant}N/m under ${appliedForce}N force. ` +
             `Extension: ${currentExtension.toFixed(3)}m (F=kx gives ${(springConstant * currentExtension).toFixed(1)}N). ` +
             `Elastic potential energy: ${elasticPE.toFixed(2)}J. ` +
             `Data points collected: ${dataPoints.length}. Shows linear relationship between force and extension.`;
    },

    resize(width: number, height: number) {
      W = width;
      H = height;
    },
  };

  return engine;
};

export default HookesLawFactory;