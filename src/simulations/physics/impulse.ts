import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ImpulseFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("impulse") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let dropHeight = 3; // meters
  let ballMass = 0.5; // kg
  let surfaceHardness = 5; // 1-9 (soft to hard)

  const GRAVITY = 9.81;
  let ballY = 0; // current height in meters
  let ballVelocity = 0;
  let phase: "falling" | "impact" | "bouncing" | "rest" = "falling";
  let impactTime = 0;
  let impactDuration = 0;
  let peakForce = 0;
  let bounceVelocity = 0;

  // Force-time graph data
  let forceData: { t: number; f: number }[] = [];

  function resetBall() {
    ballY = dropHeight;
    ballVelocity = 0;
    phase = "falling";
    impactTime = 0;
    forceData = [];
    peakForce = 0;
    bounceVelocity = 0;
  }

  function calculateImpact() {
    // Velocity at impact: v = sqrt(2gh)
    const impactVelocity = Math.sqrt(2 * GRAVITY * dropHeight);

    // Impact duration depends on surface hardness
    // Soft surfaces: longer duration, lower force
    // Hard surfaces: shorter duration, higher force
    impactDuration = 0.005 + (1 - (surfaceHardness - 1) / 8) * 0.095; // 5ms to 100ms

    // Impulse = change in momentum = m * v (assuming ball stops)
    const impulse = ballMass * impactVelocity;

    // Peak force (assuming triangular force profile): F_peak = 2 * impulse / dt
    peakForce = (2 * impulse) / impactDuration;

    // Coefficient of restitution based on hardness
    const cor = 0.3 + (surfaceHardness - 1) / 8 * 0.4;
    bounceVelocity = impactVelocity * cor;

    // Generate force-time curve (bell-shaped)
    forceData = [];
    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * impactDuration;
      const normalized = t / impactDuration;
      // Smooth bell curve
      const f = peakForce * Math.sin(normalized * Math.PI);
      forceData.push({ t, f });
    }
  }

  function drawSurface(surfaceY: number) {
    // Surface with variable softness visualization
    const softness = 1 - (surfaceHardness - 1) / 8;
    const surfaceColor = `rgb(${Math.round(100 + softness * 100)},${Math.round(80 + softness * 80)},${Math.round(60 + softness * 60)})`;

    // Surface deformation during impact
    let deformation = 0;
    if (phase === "impact") {
      const impactProgress = impactTime / impactDuration;
      deformation = softness * 20 * Math.sin(impactProgress * Math.PI);
    }

    // Draw deformable surface
    ctx.fillStyle = surfaceColor;
    ctx.beginPath();
    ctx.moveTo(0, surfaceY);
    for (let x = 0; x < width * 0.5; x += 2) {
      const dist = Math.abs(x - width * 0.25);
      const localDeform = deformation * Math.max(0, 1 - dist / 50);
      ctx.lineTo(x, surfaceY + localDeform);
    }
    ctx.lineTo(width * 0.5, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Surface texture lines
    ctx.strokeStyle = `rgba(0,0,0,${0.1 + softness * 0.1})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const ly = surfaceY + 10 + i * 12;
      ctx.beginPath();
      ctx.moveTo(10, ly);
      ctx.lineTo(width * 0.5 - 10, ly);
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = "#ddd";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    const label = surfaceHardness <= 3 ? "Soft (foam)" : surfaceHardness <= 6 ? "Medium (wood)" : "Hard (concrete)";
    ctx.fillText(label, width * 0.25, surfaceY + deformation + 20);
  }

  function drawBall(screenY: number) {
    const ballX = width * 0.25;
    const ballR = 15;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    const shadowScale = Math.max(0.5, 1 - ballY / dropHeight);
    ctx.beginPath();
    ctx.ellipse(ballX, height * 0.65 + 2, ballR * shadowScale * 1.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ball
    const grad = ctx.createRadialGradient(ballX - 4, screenY - 4, 2, ballX, screenY, ballR);
    grad.addColorStop(0, "#ff8888");
    grad.addColorStop(0.7, "#cc3333");
    grad.addColorStop(1, "#881111");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ballX, screenY, ballR, 0, Math.PI * 2);
    ctx.fill();

    // Velocity arrow
    if (Math.abs(ballVelocity) > 0.5 && phase === "falling") {
      ctx.strokeStyle = "#ffcc44";
      ctx.lineWidth = 2;
      const arrowLen = Math.min(40, Math.abs(ballVelocity) * 3);
      const arrowDir = ballVelocity > 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(ballX + 25, screenY);
      ctx.lineTo(ballX + 25, screenY + arrowLen * arrowDir);
      ctx.stroke();

      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(ballX + 25, screenY + arrowLen * arrowDir);
      ctx.lineTo(ballX + 20, screenY + (arrowLen - 8) * arrowDir);
      ctx.lineTo(ballX + 30, screenY + (arrowLen - 8) * arrowDir);
      ctx.closePath();
      ctx.fillStyle = "#ffcc44";
      ctx.fill();
    }
  }

  function drawForceGraph() {
    const graphX = width * 0.52;
    const graphY = 70;
    const graphW = width * 0.44;
    const graphH = height * 0.4;

    ctx.fillStyle = "rgba(15,20,35,0.8)";
    ctx.strokeStyle = "rgba(100,150,200,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(graphX, graphY, graphW, graphH, 8);
    ctx.fill();
    ctx.stroke();

    const plotX = graphX + 55;
    const plotY = graphY + 20;
    const plotW = graphW - 70;
    const plotH = graphH - 45;

    // Title
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Force vs Time", graphX + graphW / 2, graphY + 15);

    // Axes
    ctx.strokeStyle = "#556";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    // Y axis label
    ctx.fillStyle = "#889";
    ctx.font = "10px sans-serif";
    ctx.save();
    ctx.translate(graphX + 12, plotY + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("Force (N)", 0, 0);
    ctx.restore();

    // X axis label
    ctx.textAlign = "center";
    ctx.fillText("Time (ms)", plotX + plotW / 2, plotY + plotH + 15);

    if (forceData.length > 1) {
      // Force curve
      ctx.strokeStyle = "#ff4444";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#ff4444";
      ctx.shadowBlur = 3;
      ctx.beginPath();
      for (let i = 0; i < forceData.length; i++) {
        const x = plotX + (forceData[i].t / impactDuration) * plotW;
        const y = plotY + plotH - (forceData[i].f / (peakForce * 1.2)) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Peak force annotation
      ctx.fillStyle = "#ffaa44";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`F_peak = ${peakForce.toFixed(0)} N`, plotX + 5, plotY + 15);
      ctx.fillStyle = "#aabbcc";
      ctx.font = "10px monospace";
      ctx.fillText(`Δt = ${(impactDuration * 1000).toFixed(1)} ms`, plotX + 5, plotY + 30);

      // Impulse area shading
      ctx.fillStyle = "rgba(255,68,68,0.15)";
      ctx.beginPath();
      ctx.moveTo(plotX, plotY + plotH);
      for (let i = 0; i < forceData.length; i++) {
        const x = plotX + (forceData[i].t / impactDuration) * plotW;
        const y = plotY + plotH - (forceData[i].f / (peakForce * 1.2)) * plotH;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(plotX + plotW, plotY + plotH);
      ctx.closePath();
      ctx.fill();

      // Y-axis values
      ctx.fillStyle = "#778";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      for (let i = 0; i <= 4; i++) {
        const val = (peakForce * 1.2 * i) / 4;
        const y = plotY + plotH - (i / 4) * plotH;
        ctx.fillText(val.toFixed(0), plotX - 3, y + 3);
      }
    }
  }

  function drawInfoPanel() {
    const panelX = width * 0.52;
    const panelY = height * 0.55;
    const panelW = width * 0.44;
    const panelH = height * 0.38;

    ctx.fillStyle = "rgba(10,15,30,0.85)";
    ctx.strokeStyle = "rgba(100,150,200,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Impulse-Momentum Theorem", panelX + 12, panelY + 22);

    const impactVelocity = Math.sqrt(2 * GRAVITY * dropHeight);
    const momentum = ballMass * impactVelocity;
    const impulse = peakForce > 0 ? momentum : 0;

    ctx.fillStyle = "#aabbcc";
    ctx.font = "11px monospace";
    const lines = [
      `v = √(2gh) = ${impactVelocity.toFixed(2)} m/s`,
      `p = mv = ${momentum.toFixed(2)} kg·m/s`,
      `J = Δp = F·Δt = ${impulse.toFixed(2)} N·s`,
      `F = Δp/Δt = ${peakForce.toFixed(0)} N`,
      ``,
      `Hardness: ${surfaceHardness}/9`,
      `Δt = ${(impactDuration * 1000).toFixed(1)} ms`,
    ];

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], panelX + 12, panelY + 42 + i * 18);
    }

    // Key insight
    ctx.fillStyle = "#ffcc88";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText("Same impulse, different force!", panelX + 12, panelY + panelH - 15);
    ctx.fillStyle = "#889";
    ctx.font = "10px sans-serif";
    ctx.fillText("Softer surface → longer Δt → lower F", panelX + 12, panelY + panelH - 2);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      resetBall();
    },

    update(dt: number, params: Record<string, number>) {
      const newHeight = params.dropHeight ?? 3;
      const newMass = params.ballMass ?? 0.5;
      const newHardness = Math.round(params.surfaceHardness ?? 5);

      if (Math.abs(newHeight - dropHeight) > 0.1 || Math.abs(newMass - ballMass) > 0.01 || newHardness !== surfaceHardness) {
        dropHeight = newHeight;
        ballMass = newMass;
        surfaceHardness = newHardness;
        resetBall();
      }

      if (phase === "falling") {
        ballVelocity += GRAVITY * dt;
        ballY -= ballVelocity * dt;
        if (ballY <= 0) {
          ballY = 0;
          phase = "impact";
          impactTime = 0;
          calculateImpact();
        }
      } else if (phase === "impact") {
        impactTime += dt;
        if (impactTime >= impactDuration) {
          phase = "bouncing";
          ballVelocity = -bounceVelocity;
        }
      } else if (phase === "bouncing") {
        ballVelocity += GRAVITY * dt;
        ballY -= ballVelocity * dt;
        if (ballY <= 0 && ballVelocity > 0) {
          ballY = 0;
          if (bounceVelocity < 0.5) {
            phase = "rest";
          } else {
            bounceVelocity *= 0.5;
            ballVelocity = -bounceVelocity;
          }
        }
      }

      time += dt;
    },

    render() {
      ctx.fillStyle = "#0c1222";
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Impulse & Impact Force", width / 2, 28);

      ctx.fillStyle = "#889";
      ctx.font = "12px monospace";
      ctx.fillText(`J = F·Δt = Δp  |  Drop: ${dropHeight}m  |  Mass: ${ballMass}kg`, width / 2, 48);

      // Drop zone (left half)
      const surfaceY = height * 0.65;
      const topY = 70;
      const dropRange = surfaceY - topY;

      // Height scale
      ctx.strokeStyle = "#445";
      ctx.lineWidth = 1;
      for (let h = 0; h <= dropHeight; h++) {
        const y = surfaceY - (h / dropHeight) * dropRange;
        ctx.beginPath();
        ctx.moveTo(5, y);
        ctx.lineTo(15, y);
        ctx.stroke();
        ctx.fillStyle = "#667";
        ctx.font = "9px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`${h}m`, 2, y - 3);
      }

      // Surface
      drawSurface(surfaceY);

      // Ball
      const screenBallY = surfaceY - (ballY / dropHeight) * dropRange;
      drawBall(screenBallY);

      // Force graph
      drawForceGraph();

      // Info panel
      drawInfoPanel();
    },

    reset() {
      time = 0;
      resetBall();
    },

    destroy() {
      forceData = [];
    },

    getStateDescription() {
      const impactVelocity = Math.sqrt(2 * GRAVITY * dropHeight);
      return `Impulse simulation: ${ballMass}kg ball dropped from ${dropHeight}m. Impact velocity=${impactVelocity.toFixed(2)} m/s. Surface hardness=${surfaceHardness}/9. Peak force=${peakForce.toFixed(0)}N over ${(impactDuration * 1000).toFixed(1)}ms. J=F·Δt=Δp: same momentum change, softer surface means longer contact time and lower peak force.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default ImpulseFactory;
