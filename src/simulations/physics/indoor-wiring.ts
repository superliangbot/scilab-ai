import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const IndoorWiringFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("indoor-wiring") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let supplyVoltage = 220; // V (household)
  let numDevices = 3;
  let breakerLimit = 20; // Amps

  interface Device {
    name: string;
    resistance: number; // Ohms
    power: number; // Watts
    x: number;
    y: number;
    on: boolean;
    icon: string;
  }

  const deviceTemplates = [
    { name: "Refrigerator", resistance: 48.4, power: 1000, icon: "❄" },
    { name: "Microwave", resistance: 32.3, power: 1500, icon: "📡" },
    { name: "Lamp", resistance: 484, power: 100, icon: "💡" },
    { name: "TV", resistance: 161.3, power: 300, icon: "📺" },
    { name: "Heater", resistance: 24.2, power: 2000, icon: "🔥" },
    { name: "Computer", resistance: 96.8, power: 500, icon: "💻" },
    { name: "Dryer", resistance: 16.1, power: 3000, icon: "🌪" },
    { name: "Washer", resistance: 64.5, power: 750, icon: "🫧" },
  ];

  let devices: Device[] = [];
  let breakerTripped = false;
  let sparks: { x: number; y: number; life: number }[] = [];

  function setupDevices() {
    devices = [];
    breakerTripped = false;
    sparks = [];
    const count = Math.min(numDevices, deviceTemplates.length);
    const spacing = (width - 120) / (count + 1);

    for (let i = 0; i < count; i++) {
      const tmpl = deviceTemplates[i];
      devices.push({
        ...tmpl,
        x: 60 + spacing * (i + 1),
        y: height * 0.45,
        on: true,
      });
    }
  }

  function calculateCircuit() {
    const activeDevices = devices.filter((d) => d.on);
    if (activeDevices.length === 0) {
      return { totalR: Infinity, totalI: 0, totalP: 0, deviceCurrents: [] };
    }

    // Parallel circuit: 1/R_total = sum(1/R_i)
    let invRTotal = 0;
    for (const d of activeDevices) {
      invRTotal += 1 / d.resistance;
    }
    const totalR = 1 / invRTotal;
    const totalI = supplyVoltage / totalR;
    const totalP = supplyVoltage * totalI;

    const deviceCurrents = activeDevices.map((d) => ({
      device: d,
      current: supplyVoltage / d.resistance,
      power: supplyVoltage * supplyVoltage / d.resistance,
    }));

    return { totalR, totalI, totalP, deviceCurrents };
  }

  function drawWiring() {
    const mainY = height * 0.25;
    const deviceY = height * 0.45;
    const circuit = calculateCircuit();

    // Main supply wire
    const wireStartX = 40;
    const wireEndX = width - 40;

    // Supply wire (top)
    ctx.strokeStyle = breakerTripped ? "#ff4444" : "#cc8844";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(wireStartX, mainY);
    ctx.lineTo(wireEndX, mainY);
    ctx.stroke();

    // Return wire (bottom)
    const returnY = height * 0.65;
    ctx.strokeStyle = "#4488cc";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(wireStartX, returnY);
    ctx.lineTo(wireEndX, returnY);
    ctx.stroke();

    // Breaker box
    ctx.fillStyle = "rgba(40,50,60,0.9)";
    ctx.strokeStyle = "#667";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(wireStartX - 25, mainY - 30, 50, returnY - mainY + 60, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = breakerTripped ? "#ff4444" : "#44ff88";
    ctx.beginPath();
    ctx.arc(wireStartX, (mainY + returnY) / 2, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ccc";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Breaker", wireStartX, (mainY + returnY) / 2 + 22);
    ctx.fillText(`${breakerLimit}A`, wireStartX, (mainY + returnY) / 2 + 34);

    // Draw parallel branches for each device
    for (const device of devices) {
      // Branch wires
      ctx.strokeStyle = device.on && !breakerTripped ? "#cc8844" : "#555";
      ctx.lineWidth = 2;

      // From main to device
      ctx.beginPath();
      ctx.moveTo(device.x, mainY);
      ctx.lineTo(device.x, deviceY - 30);
      ctx.stroke();

      // From device to return
      ctx.strokeStyle = device.on && !breakerTripped ? "#4488cc" : "#555";
      ctx.beginPath();
      ctx.moveTo(device.x, deviceY + 30);
      ctx.lineTo(device.x, returnY);
      ctx.stroke();

      // Device box
      ctx.fillStyle = device.on && !breakerTripped ? "rgba(30,50,40,0.8)" : "rgba(30,30,30,0.8)";
      ctx.strokeStyle = device.on && !breakerTripped ? "#44aa66" : "#444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(device.x - 35, deviceY - 30, 70, 60, 6);
      ctx.fill();
      ctx.stroke();

      // Device icon
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(device.icon, device.x, deviceY + 3);

      // Device name
      ctx.fillStyle = "#ccc";
      ctx.font = "9px sans-serif";
      ctx.fillText(device.name, device.x, deviceY + 45);

      // Power & current
      if (device.on && !breakerTripped) {
        const current = supplyVoltage / device.resistance;
        ctx.fillStyle = "#88cc88";
        ctx.font = "9px monospace";
        ctx.fillText(`${device.power}W`, device.x, deviceY + 57);
        ctx.fillText(`${current.toFixed(2)}A`, device.x, deviceY + 68);
      } else {
        ctx.fillStyle = "#666";
        ctx.font = "9px monospace";
        ctx.fillText("OFF", device.x, deviceY + 57);
      }

      // Switch indicator
      ctx.fillStyle = device.on ? "#44ff88" : "#ff4444";
      ctx.beginPath();
      ctx.arc(device.x + 28, deviceY - 22, 4, 0, Math.PI * 2);
      ctx.fill();

      // Animated current dots
      if (device.on && !breakerTripped) {
        const dotSpeed = (supplyVoltage / device.resistance) * 0.5;
        ctx.fillStyle = "#ffcc44";
        for (let d = 0; d < 3; d++) {
          const phase = ((time * dotSpeed + d * 0.33) % 1);
          // Going down on supply side
          const dotY1 = mainY + phase * (deviceY - 30 - mainY);
          ctx.beginPath();
          ctx.arc(device.x - 2, dotY1, 3, 0, Math.PI * 2);
          ctx.fill();
          // Going down on return side
          const dotY2 = deviceY + 30 + phase * (returnY - deviceY - 30);
          ctx.beginPath();
          ctx.arc(device.x + 2, dotY2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Sparks when overloaded
    for (const spark of sparks) {
      const alpha = 1 - spark.life;
      ctx.strokeStyle = `rgba(255,200,50,${alpha})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + time * 10;
        const len = 5 + Math.random() * 10;
        ctx.beginPath();
        ctx.moveTo(spark.x, spark.y);
        ctx.lineTo(spark.x + Math.cos(angle) * len, spark.y + Math.sin(angle) * len);
        ctx.stroke();
      }
    }
  }

  function drawInfoPanel() {
    const circuit = calculateCircuit();
    const panelX = 15;
    const panelY = height - 130;
    const panelW = width - 30;
    const panelH = 115;

    ctx.fillStyle = "rgba(10,15,30,0.85)";
    ctx.strokeStyle = "rgba(100,150,200,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Parallel Circuit Summary", panelX + 12, panelY + 18);

    ctx.fillStyle = "#aabbcc";
    ctx.font = "11px monospace";
    ctx.fillText(`Supply: ${supplyVoltage}V  |  1/R_total = Σ(1/Rᵢ)`, panelX + 12, panelY + 38);
    ctx.fillText(`Total R: ${circuit.totalR.toFixed(1)} Ω`, panelX + 12, panelY + 56);

    const currentColor = circuit.totalI > breakerLimit ? "#ff4444" : "#44ff88";
    ctx.fillStyle = currentColor;
    ctx.fillText(`Total I: ${circuit.totalI.toFixed(2)} A  /  ${breakerLimit} A limit`, panelX + 12, panelY + 74);

    ctx.fillStyle = "#aabbcc";
    ctx.fillText(`Total P: ${circuit.totalP.toFixed(0)} W`, panelX + 12, panelY + 92);

    if (breakerTripped) {
      ctx.fillStyle = "#ff4444";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("BREAKER TRIPPED! Current exceeds limit.", panelX + panelW - 12, panelY + 56);
    }

    // Current bar
    const barX = panelX + panelW * 0.55;
    const barY = panelY + 78;
    const barW = panelW * 0.4;
    const barH = 10;

    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 3);
    ctx.fill();

    const frac = Math.min(1, circuit.totalI / (breakerLimit * 1.2));
    ctx.fillStyle = circuit.totalI > breakerLimit ? "#ff4444" : circuit.totalI > breakerLimit * 0.8 ? "#ffaa44" : "#44ff88";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * frac, barH, 3);
    ctx.fill();

    // Breaker threshold marker
    const threshX = barX + barW * (breakerLimit / (breakerLimit * 1.2));
    ctx.strokeStyle = "#ff6666";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(threshX, barY - 3);
    ctx.lineTo(threshX, barY + barH + 3);
    ctx.stroke();
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      setupDevices();
    },

    update(dt: number, params: Record<string, number>) {
      const newVoltage = params.supplyVoltage ?? 220;
      const newDevices = Math.round(params.numDevices ?? 3);
      const newBreaker = params.breakerLimit ?? 20;

      if (newDevices !== numDevices || Math.abs(newVoltage - supplyVoltage) > 1) {
        numDevices = newDevices;
        supplyVoltage = newVoltage;
        setupDevices();
      }
      breakerLimit = newBreaker;

      // Check breaker
      const circuit = calculateCircuit();
      if (circuit.totalI > breakerLimit && !breakerTripped) {
        breakerTripped = true;
        // Add sparks at breaker
        for (let i = 0; i < 5; i++) {
          sparks.push({ x: 40, y: height * 0.45, life: 0 });
        }
      }

      // Update sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        sparks[i].life += dt * 2;
        if (sparks[i].life >= 1) sparks.splice(i, 1);
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
      ctx.fillText("Indoor Electrical Wiring", width / 2, 28);

      ctx.fillStyle = "#889";
      ctx.font = "12px monospace";
      ctx.fillText("Parallel circuit — all devices share same voltage", width / 2, 48);

      drawWiring();
      drawInfoPanel();
    },

    reset() {
      time = 0;
      setupDevices();
    },

    destroy() {
      devices = [];
      sparks = [];
    },

    getStateDescription() {
      const circuit = calculateCircuit();
      const activeCount = devices.filter((d) => d.on).length;
      return `Indoor wiring: ${supplyVoltage}V supply, ${activeCount}/${devices.length} devices on. Total current=${circuit.totalI.toFixed(2)}A (limit ${breakerLimit}A), total power=${circuit.totalP.toFixed(0)}W. Parallel circuit: 1/R_total = Σ(1/Rᵢ). ${breakerTripped ? "BREAKER TRIPPED!" : "Normal operation."}`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
      setupDevices();
    },
  };

  return engine;
};

export default IndoorWiringFactory;
