import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const SeismicWaves: SimulationFactory = () => {
  const config = getSimConfig("seismic-waves")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let magnitude = 6.5;
  let depth = 10; // km
  let time = 0;
  let pWaveSpeed = 6; // km/s (typical P-wave speed in crust)
  let sWaveSpeed = 3.5; // km/s (typical S-wave speed in crust)
  let epicenterX = width * 0.3;
  let epicenterY = height * 0.6;

  // Wave data
  interface SeismicWave {
    x: number;
    y: number;
    radius: number;
    type: "P" | "S";
    birthTime: number;
    amplitude: number;
  }

  const waves: SeismicWave[] = [];
  const MAX_WAVE_LIFETIME = 15; // seconds

  // Seismograph stations
  interface SeismographStation {
    x: number;
    y: number;
    name: string;
    pArrivalTime: number | null;
    sArrivalTime: number | null;
    recording: number[];
    maxRecording: number;
  }

  const stations: SeismographStation[] = [
    {
      x: width * 0.1,
      y: height * 0.3,
      name: "Station A",
      pArrivalTime: null,
      sArrivalTime: null,
      recording: [],
      maxRecording: 0
    },
    {
      x: width * 0.7,
      y: height * 0.2,
      name: "Station B",
      pArrivalTime: null,
      sArrivalTime: null,
      recording: [],
      maxRecording: 0
    },
    {
      x: width * 0.8,
      y: height * 0.7,
      name: "Station C",
      pArrivalTime: null,
      sArrivalTime: null,
      recording: [],
      maxRecording: 0
    }
  ];

  // Earthquake initiated flag
  let earthquakeStarted = false;
  let earthquakeTime = 0;

  // Colors
  const BG_COLOR = "#0f172a";
  const EARTH_COLOR = "#8b5a3c";
  const P_WAVE_COLOR = "#3b82f6";
  const S_WAVE_COLOR = "#ef4444";
  const EPICENTER_COLOR = "#fbbf24";
  const STATION_COLOR = "#10b981";
  const FAULT_COLOR = "#dc2626";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#9ca3af";

  function startEarthquake() {
    if (earthquakeStarted) return;
    
    earthquakeStarted = true;
    earthquakeTime = time;
    
    // Clear previous data
    waves.length = 0;
    for (const station of stations) {
      station.pArrivalTime = null;
      station.sArrivalTime = null;
      station.recording = [];
      station.maxRecording = 0;
    }

    // Create initial P and S waves
    const energy = Math.pow(10, magnitude);
    const baseAmplitude = Math.min(50, energy / 1000);
    
    waves.push({
      x: epicenterX,
      y: epicenterY,
      radius: 0,
      type: "P",
      birthTime: time,
      amplitude: baseAmplitude
    });

    waves.push({
      x: epicenterX,
      y: epicenterY,
      radius: 0,
      type: "S",
      birthTime: time,
      amplitude: baseAmplitude * 0.8
    });
  }

  function updateWaves(dt: number) {
    if (!earthquakeStarted) return;

    const pixelsPerKm = 20; // scaling factor

    // Update existing waves
    for (let i = waves.length - 1; i >= 0; i--) {
      const wave = waves[i];
      const age = time - wave.birthTime;
      const speed = wave.type === "P" ? pWaveSpeed : sWaveSpeed;
      
      wave.radius = speed * age * pixelsPerKm;
      
      // Amplitude decreases with distance (geometric spreading)
      wave.amplitude = Math.max(0, wave.amplitude * Math.exp(-age * 0.1));
      
      // Check if wave reaches stations
      for (const station of stations) {
        const distance = Math.sqrt(
          Math.pow(station.x - wave.x, 2) + Math.pow(station.y - wave.y, 2)
        );
        
        if (distance <= wave.radius) {
          if (wave.type === "P" && station.pArrivalTime === null) {
            station.pArrivalTime = time;
          } else if (wave.type === "S" && station.sArrivalTime === null) {
            station.sArrivalTime = time;
          }
        }
      }
      
      // Remove old or weak waves
      if (age > MAX_WAVE_LIFETIME || wave.amplitude < 0.1) {
        waves.splice(i, 1);
      }
    }

    // Update seismograph recordings
    for (const station of stations) {
      const distance = Math.sqrt(
        Math.pow(station.x - epicenterX, 2) + Math.pow(station.y - epicenterY, 2)
      );
      
      let currentAmplitude = 0;
      
      // Calculate ground motion from all waves
      for (const wave of waves) {
        const waveDistance = Math.sqrt(
          Math.pow(station.x - wave.x, 2) + Math.pow(station.y - wave.y, 2)
        );
        
        if (Math.abs(waveDistance - wave.radius) < 10) {
          // Station is near the wave front
          const intensity = wave.amplitude * (1 / (1 + distance / 100));
          const frequency = wave.type === "P" ? 8 : 4; // Hz
          currentAmplitude += intensity * Math.sin(time * frequency * 2 * Math.PI);
        }
      }
      
      station.recording.push(currentAmplitude);
      station.maxRecording = Math.max(station.maxRecording, Math.abs(currentAmplitude));
      
      // Keep recording length manageable
      if (station.recording.length > 200) {
        station.recording.shift();
      }
    }
  }

  function drawEarth() {
    // Earth surface
    ctx.fillStyle = EARTH_COLOR;
    ctx.fillRect(0, height * 0.4, width, height * 0.6);
    
    // Earth layers (simplified)
    ctx.fillStyle = "#654321";
    ctx.fillRect(0, height * 0.7, width, height * 0.3);
    
    // Surface line
    ctx.strokeStyle = TEXT_DIM;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.4);
    ctx.lineTo(width, height * 0.4);
    ctx.stroke();
    
    // Depth scale
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    
    const depths = [0, 10, 20, 50];
    for (let i = 0; i < depths.length; i++) {
      const y = height * 0.4 + (i / (depths.length - 1)) * (height * 0.3);
      ctx.fillText(`${depths[i]}km`, width - 10, y);
      
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawFault() {
    // Fault line
    ctx.strokeStyle = FAULT_COLOR;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    
    const faultStartY = height * 0.4;
    const faultEndY = height * 0.8;
    const faultX = epicenterX;
    
    ctx.beginPath();
    ctx.moveTo(faultX, faultStartY);
    ctx.lineTo(faultX + 20, faultEndY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Fault movement indicators
    if (earthquakeStarted && (time - earthquakeTime) < 2) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      
      for (let i = 0; i < 3; i++) {
        const offset = 5 * Math.sin(time * 10 + i);
        ctx.beginPath();
        ctx.moveTo(faultX - 10 + offset, faultStartY + i * 30);
        ctx.lineTo(faultX + 10 + offset, faultStartY + i * 30);
        ctx.stroke();
      }
    }
  }

  function drawEpicenter() {
    if (!earthquakeStarted) {
      // Show potential epicenter
      ctx.fillStyle = "rgba(251, 191, 36, 0.5)";
      ctx.beginPath();
      ctx.arc(epicenterX, epicenterY, 8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = TEXT_DIM;
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("Epicenter", epicenterX, epicenterY - 12);
      return;
    }
    
    // Active epicenter
    const pulseRadius = 8 + 5 * Math.sin(time * 8);
    
    ctx.fillStyle = EPICENTER_COLOR;
    ctx.beginPath();
    ctx.arc(epicenterX, epicenterY, pulseRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Hypocenter (focus) below epicenter
    const hypocenterY = epicenterY + (depth / 50) * (height * 0.3);
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(epicenterX, hypocenterY, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Connection line
    ctx.strokeStyle = TEXT_DIM;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(epicenterX, epicenterY);
    ctx.lineTo(epicenterX, hypocenterY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Labels
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("Epicenter", epicenterX, epicenterY - 15);
    ctx.fillText("Focus", epicenterX + 25, hypocenterY);
  }

  function drawSeismicWaves() {
    for (const wave of waves) {
      const alpha = Math.max(0.1, wave.amplitude / 50);
      
      if (wave.type === "P") {
        ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
      } else {
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
      }
      
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Wave labels
      if (wave.radius > 30 && wave.radius < 100) {
        ctx.fillStyle = wave.type === "P" ? P_WAVE_COLOR : S_WAVE_COLOR;
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        const labelX = wave.x + wave.radius * Math.cos(Math.PI / 4);
        const labelY = wave.y + wave.radius * Math.sin(Math.PI / 4);
        ctx.fillText(wave.type, labelX, labelY);
      }
    }
  }

  function drawStations() {
    for (const station of stations) {
      // Station marker
      ctx.fillStyle = STATION_COLOR;
      ctx.beginPath();
      ctx.arc(station.x, station.y, 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Station name
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(station.name, station.x, station.y - 10);
      
      // Arrival time indicators
      if (station.pArrivalTime !== null) {
        ctx.fillStyle = P_WAVE_COLOR;
        ctx.fillText(`P: ${(station.pArrivalTime - earthquakeTime).toFixed(1)}s`, 
                    station.x, station.y + 20);
      }
      
      if (station.sArrivalTime !== null) {
        ctx.fillStyle = S_WAVE_COLOR;
        ctx.fillText(`S: ${(station.sArrivalTime - earthquakeTime).toFixed(1)}s`, 
                    station.x, station.y + 32);
      }
    }
  }

  function drawSeismographs() {
    const graphHeight = 60;
    const graphWidth = 150;
    const graphY = height - graphHeight - 10;
    
    for (let i = 0; i < stations.length; i++) {
      const station = stations[i];
      const graphX = 10 + i * (graphWidth + 10);
      
      // Graph background
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(graphX, graphY, graphWidth, graphHeight);
      
      ctx.strokeStyle = "#374151";
      ctx.lineWidth = 1;
      ctx.strokeRect(graphX, graphY, graphWidth, graphHeight);
      
      // Station label
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(station.name, graphX + 2, graphY + 2);
      
      // Zero line
      ctx.strokeStyle = "#6b7280";
      ctx.lineWidth = 1;
      const zeroY = graphY + graphHeight / 2;
      ctx.beginPath();
      ctx.moveTo(graphX, zeroY);
      ctx.lineTo(graphX + graphWidth, zeroY);
      ctx.stroke();
      
      // Seismogram trace
      if (station.recording.length > 1) {
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        
        const scale = station.maxRecording > 0 ? (graphHeight / 2) / station.maxRecording : 1;
        
        for (let j = 0; j < station.recording.length; j++) {
          const x = graphX + (j / station.recording.length) * graphWidth;
          const y = zeroY - station.recording[j] * scale;
          
          if (j === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
      
      // P and S wave arrival markers
      if (station.pArrivalTime !== null) {
        const pTime = (station.pArrivalTime - earthquakeTime) / MAX_WAVE_LIFETIME;
        const pX = graphX + pTime * graphWidth;
        
        ctx.strokeStyle = P_WAVE_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pX, graphY);
        ctx.lineTo(pX, graphY + graphHeight);
        ctx.stroke();
        
        ctx.fillStyle = P_WAVE_COLOR;
        ctx.fillText("P", pX + 2, graphY + 12);
      }
      
      if (station.sArrivalTime !== null) {
        const sTime = (station.sArrivalTime - earthquakeTime) / MAX_WAVE_LIFETIME;
        const sX = graphX + sTime * graphWidth;
        
        ctx.strokeStyle = S_WAVE_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sX, graphY);
        ctx.lineTo(sX, graphY + graphHeight);
        ctx.stroke();
        
        ctx.fillStyle = S_WAVE_COLOR;
        ctx.fillText("S", sX + 2, graphY + 24);
      }
    }
  }

  function drawInfoPanel() {
    const panelX = width - 280;
    const panelY = 15;
    const lineH = 18;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 260, lineH * 10 + 16, 8);
    ctx.fill();
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 260, lineH * 10 + 16, 8);
    ctx.stroke();
    
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = panelX + 12;
    let y = panelY + 10;
    
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("Seismic Waves", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(`Magnitude: ${magnitude.toFixed(1)}`, x, y);
    y += lineH;
    
    ctx.fillText(`Depth: ${depth.toFixed(1)} km`, x, y);
    y += lineH;
    
    if (earthquakeStarted) {
      ctx.fillText(`Time: ${(time - earthquakeTime).toFixed(1)}s`, x, y);
    } else {
      ctx.fillText("Click to start earthquake", x, y);
    }
    y += lineH;
    
    ctx.fillStyle = P_WAVE_COLOR;
    ctx.fillText(`P-wave speed: ${pWaveSpeed.toFixed(1)} km/s`, x, y);
    y += lineH;
    
    ctx.fillStyle = S_WAVE_COLOR;
    ctx.fillText(`S-wave speed: ${sWaveSpeed.toFixed(1)} km/s`, x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText("P-waves: Faster, longitudinal", x, y);
    y += lineH;
    
    ctx.fillText("S-waves: Slower, transverse", x, y);
    y += lineH;
    
    ctx.fillText("Time difference helps locate", x, y);
    y += lineH;
    
    ctx.fillText("earthquake epicenter", x, y);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      
      // Click handler to start earthquake
      canvas.addEventListener('click', startEarthquake);
    },

    update(dt: number, params: Record<string, number>) {
      magnitude = params.magnitude ?? magnitude;
      depth = params.depth ?? depth;
      pWaveSpeed = params.pWaveSpeed ?? pWaveSpeed;
      sWaveSpeed = params.sWaveSpeed ?? sWaveSpeed;
      
      time += dt;
      
      updateWaves(dt);
    },

    render() {
      // Clear background
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);
      
      // Draw Earth structure
      drawEarth();
      
      // Draw fault line
      drawFault();
      
      // Draw epicenter and focus
      drawEpicenter();
      
      // Draw seismic waves
      drawSeismicWaves();
      
      // Draw monitoring stations
      drawStations();
      
      // Draw seismographs
      drawSeismographs();
      
      // Info panel
      drawInfoPanel();
    },

    reset() {
      time = 0;
      earthquakeStarted = false;
      earthquakeTime = 0;
      waves.length = 0;
      
      for (const station of stations) {
        station.pArrivalTime = null;
        station.sArrivalTime = null;
        station.recording = [];
        station.maxRecording = 0;
      }
    },

    destroy() {
      waves.length = 0;
      canvas.removeEventListener('click', startEarthquake);
    },

    getStateDescription(): string {
      const activeWaves = waves.length;
      let arrivals = "";
      
      if (earthquakeStarted) {
        const elapsed = time - earthquakeTime;
        const recordingStations = stations.filter(s => s.pArrivalTime !== null).length;
        
        arrivals = `Earthquake active for ${elapsed.toFixed(1)}s. ${recordingStations} stations recording. `;
        
        if (recordingStations >= 3) {
          arrivals += "Enough data for triangulation. ";
        }
      }
      
      return (
        `Seismic Waves: ${earthquakeStarted ? 'Active' : 'Dormant'} earthquake simulation. ` +
        `Magnitude ${magnitude}, depth ${depth}km. P-waves travel at ${pWaveSpeed}km/s, ` +
        `S-waves at ${sWaveSpeed}km/s. ${arrivals}` +
        `${activeWaves} wave fronts propagating. P-waves arrive first (longitudinal compression), ` +
        `followed by slower S-waves (transverse shear). Time difference helps locate epicenter.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default SeismicWaves;