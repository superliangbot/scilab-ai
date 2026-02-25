import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

interface Neuron {
  id: string;
  x: number;
  y: number;
  activation: number;
  bias: number;
  layer: number;
  type: 'input' | 'hidden' | 'output';
}

interface Connection {
  from: string;
  to: string;
  weight: number;
  strength: number; // For visualization
}

interface TrainingExample {
  inputs: number[];
  target: number[];
  prediction?: number[];
  error?: number;
}

const NeuralNetworkPerceptron: SimulationFactory = () => {
  const config = getSimConfig("neural-network-perceptron")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Network parameters
  let learningRate = 0.1;
  let networkStructure = [2, 3, 1]; // [inputs, hidden, outputs]
  let activationFunction = 0; // 0=sigmoid, 1=tanh, 2=ReLU
  let isTraining = 1;
  let time = 0;
  let epoch = 0;

  // Network state
  let neurons: Neuron[] = [];
  let connections: Connection[] = [];
  let trainingData: TrainingExample[] = [];
  let currentExample: TrainingExample | null = null;
  let trainingHistory: { epoch: number; loss: number }[] = [];

  // Animation state
  let forwardPropAnimation = 0;
  let backPropAnimation = 0;
  let lastTrainingTime = 0;

  // Colors
  const BG = "#0f172a";
  const INPUT_COLOR = "#10b981";
  const HIDDEN_COLOR = "#3b82f6";
  const OUTPUT_COLOR = "#ef4444";
  const POSITIVE_WEIGHT = "#22d3ee";
  const NEGATIVE_WEIGHT = "#f87171";
  const ACTIVATION_COLOR = "#fbbf24";
  const ERROR_COLOR = "#dc2626";
  const TEXT_COLOR = "#e2e8f0";
  const PANEL_BG = "rgba(30, 41, 59, 0.9)";

  function initializeNetwork() {
    neurons = [];
    connections = [];

    const layerSpacing = width / (networkStructure.length + 1);
    let neuronId = 0;

    // Create neurons for each layer
    for (let layer = 0; layer < networkStructure.length; layer++) {
      const layerSize = networkStructure[layer];
      const neuronSpacing = height / (layerSize + 1);
      const x = layerSpacing * (layer + 1);

      for (let neuron = 0; neuron < layerSize; neuron++) {
        const y = neuronSpacing * (neuron + 1);
        
        let type: 'input' | 'hidden' | 'output';
        if (layer === 0) type = 'input';
        else if (layer === networkStructure.length - 1) type = 'output';
        else type = 'hidden';

        neurons.push({
          id: `neuron_${neuronId++}`,
          x,
          y,
          activation: 0,
          bias: type === 'input' ? 0 : (Math.random() - 0.5) * 2,
          layer,
          type
        });
      }
    }

    // Create connections between adjacent layers
    for (let layer = 0; layer < networkStructure.length - 1; layer++) {
      const currentLayerNeurons = neurons.filter(n => n.layer === layer);
      const nextLayerNeurons = neurons.filter(n => n.layer === layer + 1);

      for (const from of currentLayerNeurons) {
        for (const to of nextLayerNeurons) {
          connections.push({
            from: from.id,
            to: to.id,
            weight: (Math.random() - 0.5) * 2, // Random weights between -1 and 1
            strength: 0
          });
        }
      }
    }

    // Generate training data (XOR problem for 2 inputs, 1 output)
    generateTrainingData();
  }

  function generateTrainingData() {
    trainingData = [];
    
    if (networkStructure[0] === 2 && networkStructure[networkStructure.length - 1] === 1) {
      // XOR problem
      trainingData = [
        { inputs: [0, 0], target: [0] },
        { inputs: [0, 1], target: [1] },
        { inputs: [1, 0], target: [1] },
        { inputs: [1, 1], target: [0] }
      ];
    } else {
      // Generate random classification data
      for (let i = 0; i < 20; i++) {
        const inputs = Array.from({ length: networkStructure[0] }, () => Math.random());
        const target = inputs[0] > inputs[1] ? [1] : [0]; // Simple rule
        trainingData.push({ inputs, target });
      }
    }
  }

  function computePhysics(dt: number, params: Record<string, number>) {
    learningRate = Math.max(0.01, Math.min(1, params.learningRate ?? learningRate));
    activationFunction = Math.floor((params.activationFunction ?? 0) * 3) % 3;
    isTraining = params.isTraining ?? isTraining;

    time += dt;

    // Training cycle
    if (isTraining && time - lastTrainingTime > 0.5) { // Train every 0.5 seconds
      if (trainingData.length > 0) {
        trainSingleExample();
        lastTrainingTime = time;
        epoch++;
      }
    }

    // Update animations
    forwardPropAnimation = ((time * 2) % 1);
    backPropAnimation = ((time * 2 + 0.5) % 1);
  }

  function trainSingleExample() {
    // Select random training example
    currentExample = trainingData[Math.floor(Math.random() * trainingData.length)];
    
    // Forward propagation
    forwardPropagate(currentExample.inputs);
    
    // Calculate prediction
    const outputNeurons = neurons.filter(n => n.type === 'output');
    currentExample.prediction = outputNeurons.map(n => n.activation);
    
    // Calculate error
    let totalError = 0;
    for (let i = 0; i < currentExample.target.length; i++) {
      const error = currentExample.target[i] - currentExample.prediction[i];
      totalError += error * error;
    }
    currentExample.error = totalError / currentExample.target.length;
    
    // Backward propagation
    backwardPropagate(currentExample.target);
    
    // Update training history
    trainingHistory.push({ epoch, loss: currentExample.error });
    if (trainingHistory.length > 100) {
      trainingHistory.shift();
    }
  }

  function forwardPropagate(inputs: number[]) {
    // Set input values
    const inputNeurons = neurons.filter(n => n.type === 'input');
    for (let i = 0; i < inputs.length && i < inputNeurons.length; i++) {
      inputNeurons[i].activation = inputs[i];
    }

    // Propagate through hidden and output layers
    for (let layer = 1; layer < networkStructure.length; layer++) {
      const layerNeurons = neurons.filter(n => n.layer === layer);
      
      for (const neuron of layerNeurons) {
        let sum = neuron.bias;
        
        // Sum weighted inputs
        const incomingConnections = connections.filter(c => c.to === neuron.id);
        for (const conn of incomingConnections) {
          const fromNeuron = neurons.find(n => n.id === conn.from)!;
          sum += fromNeuron.activation * conn.weight;
          
          // Update connection strength for visualization
          conn.strength = Math.abs(fromNeuron.activation * conn.weight);
        }
        
        // Apply activation function
        neuron.activation = activationFunctions[activationFunction](sum);
      }
    }
  }

  function backwardPropagate(targets: number[]) {
    const outputNeurons = neurons.filter(n => n.type === 'output');
    const hiddenNeurons = neurons.filter(n => n.type === 'hidden');
    
    // Calculate output layer errors
    const outputErrors: Map<string, number> = new Map();
    for (let i = 0; i < outputNeurons.length && i < targets.length; i++) {
      const neuron = outputNeurons[i];
      const error = targets[i] - neuron.activation;
      const gradient = error * activationDerivatives[activationFunction](neuron.activation);
      outputErrors.set(neuron.id, gradient);
    }

    // Calculate hidden layer errors (simplified)
    const hiddenErrors: Map<string, number> = new Map();
    for (const hiddenNeuron of hiddenNeurons) {
      let errorSum = 0;
      const outgoingConnections = connections.filter(c => c.from === hiddenNeuron.id);
      
      for (const conn of outgoingConnections) {
        const outputError = outputErrors.get(conn.to) || 0;
        errorSum += outputError * conn.weight;
      }
      
      const gradient = errorSum * activationDerivatives[activationFunction](hiddenNeuron.activation);
      hiddenErrors.set(hiddenNeuron.id, gradient);
    }

    // Update weights
    for (const connection of connections) {
      const fromNeuron = neurons.find(n => n.id === connection.from)!;
      const toNeuron = neurons.find(n => n.id === connection.to)!;
      
      let error = 0;
      if (toNeuron.type === 'output') {
        error = outputErrors.get(toNeuron.id) || 0;
      } else {
        error = hiddenErrors.get(toNeuron.id) || 0;
      }
      
      const weightUpdate = learningRate * error * fromNeuron.activation;
      connection.weight += weightUpdate;
      
      // Clamp weights to prevent explosion
      connection.weight = Math.max(-5, Math.min(5, connection.weight));
    }

    // Update biases
    for (const neuron of neurons) {
      if (neuron.type !== 'input') {
        let error = 0;
        if (neuron.type === 'output') {
          error = outputErrors.get(neuron.id) || 0;
        } else {
          error = hiddenErrors.get(neuron.id) || 0;
        }
        
        neuron.bias += learningRate * error;
        neuron.bias = Math.max(-5, Math.min(5, neuron.bias));
      }
    }
  }

  const activationFunctions = {
    0: (x: number) => 1 / (1 + Math.exp(-x)), // Sigmoid
    1: (x: number) => Math.tanh(x), // Tanh
    2: (x: number) => Math.max(0, x), // ReLU
  };

  const activationDerivatives = {
    0: (y: number) => y * (1 - y), // Sigmoid derivative (using output)
    1: (y: number) => 1 - y * y, // Tanh derivative (using output)
    2: (y: number) => y > 0 ? 1 : 0, // ReLU derivative
  };

  function drawNeuralNetwork() {
    const networkX = width * 0.05;
    const networkY = height * 0.05;
    const networkW = width * 0.6;
    const networkH = height * 0.6;

    // Draw connections first
    for (const connection of connections) {
      const fromNeuron = neurons.find(n => n.id === connection.from)!;
      const toNeuron = neurons.find(n => n.id === connection.to)!;

      if (!fromNeuron || !toNeuron) continue;

      // Connection color and thickness based on weight
      const isPositive = connection.weight > 0;
      const weightStrength = Math.abs(connection.weight) / 5; // Normalize to 0-1
      const alpha = Math.min(weightStrength, 1);

      ctx.strokeStyle = isPositive ? 
        `rgba(34, 211, 238, ${alpha})` : 
        `rgba(248, 113, 113, ${alpha})`;
      ctx.lineWidth = 1 + weightStrength * 3;

      ctx.beginPath();
      ctx.moveTo(fromNeuron.x, fromNeuron.y);
      ctx.lineTo(toNeuron.x, toNeuron.y);
      ctx.stroke();

      // Show data flow during forward propagation
      if (isTraining && connection.strength > 0) {
        const flowProgress = forwardPropAnimation;
        const flowX = fromNeuron.x + (toNeuron.x - fromNeuron.x) * flowProgress;
        const flowY = fromNeuron.y + (toNeuron.y - fromNeuron.y) * flowProgress;

        ctx.fillStyle = ACTIVATION_COLOR;
        ctx.globalAlpha = connection.strength;
        ctx.beginPath();
        ctx.arc(flowX, flowY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Weight labels on selected connections
      if (weightStrength > 0.5) {
        const midX = (fromNeuron.x + toNeuron.x) / 2;
        const midY = (fromNeuron.y + toNeuron.y) / 2;
        
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(connection.weight.toFixed(2), midX, midY - 5);
      }
    }

    // Draw neurons
    for (const neuron of neurons) {
      let neuronColor = INPUT_COLOR;
      let neuronSize = 15;

      switch (neuron.type) {
        case 'hidden':
          neuronColor = HIDDEN_COLOR;
          neuronSize = 18;
          break;
        case 'output':
          neuronColor = OUTPUT_COLOR;
          neuronSize = 20;
          break;
      }

      // Neuron activation visualization
      const activation = Math.abs(neuron.activation);
      ctx.fillStyle = neuronColor;
      ctx.globalAlpha = 0.3 + activation * 0.7;
      ctx.beginPath();
      ctx.arc(neuron.x, neuron.y, neuronSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Neuron border
      ctx.strokeStyle = neuronColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(neuron.x, neuron.y, neuronSize, 0, Math.PI * 2);
      ctx.stroke();

      // Activation value
      ctx.fillStyle = "#000";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(neuron.activation.toFixed(2), neuron.x, neuron.y);

      // Bias value for non-input neurons
      if (neuron.type !== 'input') {
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`b:${neuron.bias.toFixed(1)}`, neuron.x, neuron.y + neuronSize + 8);
      }

      // Layer labels
      if (neuron.layer === 0 && neurons.filter(n => n.layer === 0).indexOf(neuron) === 0) {
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Input", neuron.x, networkY + networkH + 30);
      } else if (neuron.layer === networkStructure.length - 1 && 
                 neurons.filter(n => n.layer === networkStructure.length - 1).indexOf(neuron) === 0) {
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Output", neuron.x, networkY + networkH + 30);
      } else if (neuron.type === 'hidden' && 
                 neurons.filter(n => n.type === 'hidden').indexOf(neuron) === 0) {
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Hidden", neuron.x, networkY + networkH + 30);
      }
    }
  }

  function drawTrainingPanel() {
    const panelX = width * 0.68;
    const panelY = height * 0.05;
    const panelW = width * 0.3;
    const panelH = height * 0.6;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Training Progress", panelX + panelW / 2, panelY + 20);

    let y = panelY + 45;
    ctx.font = "11px monospace";
    ctx.textAlign = "left";

    // Training status
    ctx.fillStyle = isTraining ? "#10b981" : "#6b7280";
    ctx.fillText(`Status: ${isTraining ? "Training" : "Paused"}`, panelX + 10, y);
    y += 18;

    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`Epoch: ${epoch}`, panelX + 10, y);
    y += 18;

    ctx.fillText(`Learning Rate: ${learningRate.toFixed(3)}`, panelX + 10, y);
    y += 18;

    const activationNames = ["Sigmoid", "Tanh", "ReLU"];
    ctx.fillText(`Activation: ${activationNames[activationFunction]}`, panelX + 10, y);
    y += 25;

    // Current training example
    if (currentExample) {
      ctx.fillStyle = "#9ca3af";
      ctx.fillText("Current Example:", panelX + 10, y);
      y += 18;

      ctx.fillStyle = INPUT_COLOR;
      ctx.fillText(`Input: [${currentExample.inputs.map(x => x.toFixed(2)).join(', ')}]`, panelX + 10, y);
      y += 15;

      ctx.fillStyle = OUTPUT_COLOR;
      ctx.fillText(`Target: [${currentExample.target.map(x => x.toFixed(2)).join(', ')}]`, panelX + 10, y);
      y += 15;

      if (currentExample.prediction) {
        ctx.fillStyle = "#a855f7";
        ctx.fillText(`Predict: [${currentExample.prediction.map(x => x.toFixed(2)).join(', ')}]`, panelX + 10, y);
        y += 15;
      }

      if (currentExample.error !== undefined) {
        ctx.fillStyle = ERROR_COLOR;
        ctx.fillText(`Error: ${currentExample.error.toFixed(4)}`, panelX + 10, y);
        y += 15;
      }
    }

    // Training data overview
    y += 10;
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Training Data:", panelX + 10, y);
    y += 18;

    const maxExamples = Math.min(trainingData.length, 8);
    for (let i = 0; i < maxExamples; i++) {
      const example = trainingData[i];
      ctx.fillStyle = "#64748b";
      ctx.font = "9px monospace";
      const inputStr = example.inputs.map(x => x.toFixed(1)).join(',');
      const targetStr = example.target.map(x => x.toFixed(1)).join(',');
      ctx.fillText(`[${inputStr}] → [${targetStr}]`, panelX + 10, y);
      y += 12;
    }

    if (trainingData.length > maxExamples) {
      ctx.fillText(`... and ${trainingData.length - maxExamples} more`, panelX + 10, y);
    }
  }

  function drawLossChart() {
    const chartX = width * 0.05;
    const chartY = height * 0.68;
    const chartW = width * 0.9;
    const chartH = height * 0.28;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(chartX, chartY, chartW, chartH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(chartX, chartY, chartW, chartH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Training Loss", chartX + chartW / 2, chartY + 20);

    if (trainingHistory.length < 2) return;

    // Find loss range
    const losses = trainingHistory.map(h => h.loss);
    const maxLoss = Math.max(...losses);
    const minLoss = Math.min(...losses);
    const lossRange = maxLoss - minLoss;

    // Draw loss curve
    ctx.strokeStyle = ERROR_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const plotX = chartX + 50;
    const plotY = chartY + 40;
    const plotW = chartW - 100;
    const plotH = chartH - 80;

    trainingHistory.forEach((point, index) => {
      const x = plotX + (index / Math.max(trainingHistory.length - 1, 1)) * plotW;
      const y = plotY + plotH - ((point.loss - minLoss) / (lossRange || 1)) * plotH;
      
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw axes
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Epoch", plotX + plotW / 2, chartY + chartH - 10);

    ctx.save();
    ctx.translate(chartX + 15, plotY + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Loss", 0, 0);
    ctx.restore();

    // Loss value labels
    ctx.textAlign = "right";
    ctx.fillText(maxLoss.toFixed(3), plotX - 5, plotY + 5);
    ctx.fillText(minLoss.toFixed(3), plotX - 5, plotY + plotH);

    // Current loss indicator
    if (currentExample && currentExample.error !== undefined) {
      ctx.fillStyle = ERROR_COLOR;
      ctx.font = "12px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`Current Loss: ${currentExample.error.toFixed(4)}`, plotX + 10, plotY + 20);
    }

    // Network architecture info
    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`Architecture: ${networkStructure.join('-')}`, plotX + plotW - 10, plotY + 20);
    
    const totalParams = connections.length + neurons.filter(n => n.type !== 'input').length;
    ctx.fillText(`Parameters: ${totalParams}`, plotX + plotW - 10, plotY + 35);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      epoch = 0;
      lastTrainingTime = 0;
      forwardPropAnimation = 0;
      backPropAnimation = 0;
      trainingHistory = [];
      currentExample = null;
      initializeNetwork();
    },

    update(dt: number, params: Record<string, number>) {
      computePhysics(dt, params);
    },

    render() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      drawNeuralNetwork();
      drawTrainingPanel();
      drawLossChart();
    },

    reset() {
      time = 0;
      epoch = 0;
      lastTrainingTime = 0;
      forwardPropAnimation = 0;
      backPropAnimation = 0;
      trainingHistory = [];
      currentExample = null;
      initializeNetwork();
    },

    destroy() {
      neurons = [];
      connections = [];
      trainingData = [];
      trainingHistory = [];
    },

    getStateDescription(): string {
      const activationNames = ["sigmoid", "tanh", "ReLU"];
      const totalParams = connections.length + neurons.filter(n => n.type !== 'input').length;
      const currentLoss = currentExample?.error || 0;
      const avgLoss = trainingHistory.length > 0 ? 
        trainingHistory.slice(-10).reduce((sum, h) => sum + h.loss, 0) / Math.min(10, trainingHistory.length) : 0;

      return (
        `Neural network perceptron: ${networkStructure.join('-')} architecture with ${totalParams} parameters. ` +
        `Training epoch ${epoch} using ${activationNames[activationFunction]} activation, learning rate ${learningRate.toFixed(3)}. ` +
        `Current loss: ${currentLoss.toFixed(4)}, recent average: ${avgLoss.toFixed(4)}. ` +
        `${isTraining ? "Actively training" : "Training paused"} on ${trainingData.length} examples. ` +
        `Demonstrates gradient descent, backpropagation, and neural network fundamentals for pattern recognition.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default NeuralNetworkPerceptron;