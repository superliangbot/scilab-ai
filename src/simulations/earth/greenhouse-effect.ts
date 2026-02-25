import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const GreenhouseEffectFactory: SimulationFactory = () => {
  const config = getSimConfig("greenhouse-effect")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let co2Concentration = 400;
  let cloudCover = 0.3;
  let albedo = 0.3;
  let solarIntensity = 1.0;

  let surfaceTemp = 15;
  let incomingSolar = 1361;
  let outgoingIR = 0;

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      co2Concentration = params.co2Concentration ?? co2Concentration;
      cloudCover = params.cloudCover ?? cloudCover;
      albedo = params.albedo ?? albedo;
      solarIntensity = params.solarIntensity ?? solarIntensity;

      time += dt;

      // Simple energy balance calculation
      const effectiveIncoming = incomingSolar * solarIntensity * (1 - albedo) * (1 - cloudCover * 0.3);
      const greenhouseEffect = 1 - Math.exp(-co2Concentration / 1000);
      outgoingIR = effectiveIncoming * (1 - greenhouseEffect);
      
      const energyImbalance = effectiveIncoming - outgoingIR;
      surfaceTemp += energyImbalance * 0.0001 * dt;
    },

    render() {
      // Background gradient from space to surface
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, "#0a0a2e");
      gradient.addColorStop(0.3, "#2a4365");
      gradient.addColorStop(0.7, "#63b3ed");
      gradient.addColorStop(1, "#8fbc8f");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 20px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Greenhouse Effect", W / 2, 30);

      // Sun
      ctx.fillStyle = "#ffd700";
      ctx.beginPath();
      ctx.arc(W / 2, 0, 40, 0, Math.PI * 2);
      ctx.fill();

      // Solar radiation arrows
      ctx.strokeStyle = "#ffff00";
      ctx.lineWidth = 3;
      for (let i = 0; i < 10; i++) {
        const x = 100 + i * 60;
        ctx.beginPath();
        ctx.moveTo(x, 50);
        ctx.lineTo(x, 150);
        ctx.stroke();
      }

      // Earth's surface
      ctx.fillStyle = "#8b4513";
      ctx.fillRect(0, H * 0.8, W, H * 0.2);

      // Atmosphere layers with CO2
      const co2Opacity = Math.min(0.5, co2Concentration / 800);
      ctx.fillStyle = `rgba(255, 0, 0, ${co2Opacity})`;
      ctx.fillRect(0, H * 0.6, W, H * 0.2);

      // IR radiation arrows (some trapped)
      ctx.strokeStyle = "#ff4444";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const x = 150 + i * 80;
        const trapped = Math.random() < co2Concentration / 1000;
        
        ctx.beginPath();
        ctx.moveTo(x, H * 0.8);
        
        if (trapped) {
          // Trapped radiation - bounces back
          ctx.lineTo(x, H * 0.6);
          ctx.lineTo(x + 20, H * 0.8);
        } else {
          // Escapes to space
          ctx.lineTo(x, H * 0.3);
        }
        ctx.stroke();
      }

      // Temperature display
      ctx.font = "16px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText(`Surface Temperature: ${surfaceTemp.toFixed(1)}°C`, 20, H - 60);
      ctx.fillText(`CO₂ Concentration: ${co2Concentration} ppm`, 20, H - 40);
      ctx.fillText(`Solar Input: ${(incomingSolar * solarIntensity).toFixed(0)} W/m²`, 20, H - 20);

      // Energy balance
      ctx.textAlign = "right";
      ctx.fillText(`IR Output: ${outgoingIR.toFixed(0)} W/m²`, W - 20, H - 40);
      const imbalance = incomingSolar * solarIntensity * (1 - albedo) - outgoingIR;
      ctx.fillStyle = imbalance > 0 ? "#22c55e" : "#3b82f6";
      ctx.fillText(`Energy Imbalance: ${imbalance > 0 ? '+' : ''}${imbalance.toFixed(1)} W/m²`, W - 20, H - 20);
    },

    reset() {
      time = 0;
      surfaceTemp = 15;
    },

    destroy() {},

    getStateDescription(): string {
      return `Greenhouse Effect simulation: CO₂ ${co2Concentration}ppm, surface temperature ${surfaceTemp.toFixed(1)}°C, solar intensity ${solarIntensity.toFixed(1)}×.`;
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    }
  };

  return engine;
};

export default GreenhouseEffectFactory;