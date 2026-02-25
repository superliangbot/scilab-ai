import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const SortingAlgorithms: SimulationFactory = () => {
  const config = getSimConfig("sorting-algorithms")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Sorting state
  let algorithm: "bubble" | "selection" | "insertion" | "quick" | "merge" = "bubble";
  let arraySize = 20;
  let speed = 5; // operations per second
  let time = 0;
  let lastStepTime = 0;

  // Array and sorting state
  interface ArrayElement {
    value: number;
    index: number;
    color: string;
    highlight: "none" | "comparing" | "swapping" | "pivot" | "sorted";
  }

  let array: ArrayElement[] = [];
  let sortingState: any = null;
  let isRunning = false;
  let isSorted = false;
  let currentStep = 0;
  let comparisons = 0;
  let swaps = 0;

  // Colors
  const BG_COLOR = "#0f172a";
  const BAR_COLOR = "#374151";
  const COMPARING_COLOR = "#fbbf24";
  const SWAPPING_COLOR = "#ef4444";
  const PIVOT_COLOR = "#8b5cf6";
  const SORTED_COLOR = "#10b981";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#9ca3af";

  function initializeArray() {
    array = [];
    for (let i = 0; i < arraySize; i++) {
      array.push({
        value: Math.floor(Math.random() * 100) + 1,
        index: i,
        color: BAR_COLOR,
        highlight: "none"
      });
    }
    resetSorting();
  }

  function resetSorting() {
    isRunning = false;
    isSorted = false;
    currentStep = 0;
    comparisons = 0;
    swaps = 0;
    sortingState = null;
    
    // Reset all highlights
    for (const element of array) {
      element.highlight = "none";
      element.color = BAR_COLOR;
    }
    
    // Initialize algorithm-specific state
    switch (algorithm) {
      case "bubble":
        sortingState = { i: 0, j: 0 };
        break;
      case "selection":
        sortingState = { i: 0, minIndex: 0 };
        break;
      case "insertion":
        sortingState = { i: 1, j: 1 };
        break;
      case "quick":
        sortingState = { stack: [{ low: 0, high: arraySize - 1 }] };
        break;
      case "merge":
        sortingState = { 
          size: 1, 
          left: 0,
          merging: false,
          tempArray: [...array]
        };
        break;
    }
  }

  function stepBubbleSort(): boolean {
    const { i, j } = sortingState;
    const n = array.length;
    
    if (i >= n - 1) {
      return true; // Sorting complete
    }
    
    // Reset highlights
    for (const element of array) {
      element.highlight = element.highlight === "sorted" ? "sorted" : "none";
      element.color = element.highlight === "sorted" ? SORTED_COLOR : BAR_COLOR;
    }
    
    if (j >= n - i - 1) {
      // Mark last element as sorted
      array[n - i - 1].highlight = "sorted";
      array[n - i - 1].color = SORTED_COLOR;
      
      sortingState.i++;
      sortingState.j = 0;
      return false;
    }
    
    // Compare adjacent elements
    array[j].highlight = "comparing";
    array[j].color = COMPARING_COLOR;
    array[j + 1].highlight = "comparing";
    array[j + 1].color = COMPARING_COLOR;
    
    comparisons++;
    
    if (array[j].value > array[j + 1].value) {
      // Swap elements
      [array[j], array[j + 1]] = [array[j + 1], array[j]];
      array[j].highlight = "swapping";
      array[j].color = SWAPPING_COLOR;
      array[j + 1].highlight = "swapping";
      array[j + 1].color = SWAPPING_COLOR;
      swaps++;
    }
    
    sortingState.j++;
    return false;
  }

  function stepSelectionSort(): boolean {
    const { i, minIndex } = sortingState;
    const n = array.length;
    
    if (i >= n - 1) {
      // Mark last element as sorted
      array[n - 1].highlight = "sorted";
      array[n - 1].color = SORTED_COLOR;
      return true;
    }
    
    // Reset highlights except sorted
    for (let k = 0; k < array.length; k++) {
      if (array[k].highlight !== "sorted") {
        array[k].highlight = "none";
        array[k].color = BAR_COLOR;
      }
    }
    
    if (sortingState.searchIndex === undefined) {
      sortingState.searchIndex = i + 1;
      sortingState.minIndex = i;
      array[i].highlight = "pivot";
      array[i].color = PIVOT_COLOR;
      return false;
    }
    
    const { searchIndex } = sortingState;
    
    if (searchIndex >= n) {
      // Swap minimum with current position
      if (sortingState.minIndex !== i) {
        [array[i], array[sortingState.minIndex]] = [array[sortingState.minIndex], array[i]];
        swaps++;
      }
      
      // Mark as sorted
      array[i].highlight = "sorted";
      array[i].color = SORTED_COLOR;
      
      // Move to next position
      sortingState.i++;
      delete sortingState.searchIndex;
      return false;
    }
    
    // Compare current element with minimum
    array[searchIndex].highlight = "comparing";
    array[searchIndex].color = COMPARING_COLOR;
    
    comparisons++;
    
    if (array[searchIndex].value < array[sortingState.minIndex].value) {
      // Update minimum
      if (sortingState.minIndex !== i) {
        array[sortingState.minIndex].highlight = "none";
        array[sortingState.minIndex].color = BAR_COLOR;
      }
      sortingState.minIndex = searchIndex;
      array[sortingState.minIndex].highlight = "pivot";
      array[sortingState.minIndex].color = PIVOT_COLOR;
    }
    
    sortingState.searchIndex++;
    return false;
  }

  function stepInsertionSort(): boolean {
    const { i, j } = sortingState;
    const n = array.length;
    
    if (i >= n) {
      // Mark all as sorted
      for (const element of array) {
        element.highlight = "sorted";
        element.color = SORTED_COLOR;
      }
      return true;
    }
    
    // Reset highlights except sorted
    for (let k = 0; k < array.length; k++) {
      if (k < i) {
        array[k].highlight = "sorted";
        array[k].color = SORTED_COLOR;
      } else {
        array[k].highlight = "none";
        array[k].color = BAR_COLOR;
      }
    }
    
    array[i].highlight = "pivot";
    array[i].color = PIVOT_COLOR;
    
    if (j > 0 && array[j - 1].value > array[j].value) {
      // Highlight comparing elements
      array[j - 1].highlight = "comparing";
      array[j - 1].color = COMPARING_COLOR;
      array[j].highlight = "comparing";
      array[j].color = COMPARING_COLOR;
      
      // Swap elements
      [array[j], array[j - 1]] = [array[j - 1], array[j]];
      comparisons++;
      swaps++;
      
      sortingState.j--;
    } else {
      // Move to next element
      sortingState.i++;
      sortingState.j = sortingState.i;
    }
    
    return false;
  }

  function stepQuickSort(): boolean {
    const { stack } = sortingState;
    
    if (stack.length === 0) {
      // Mark all as sorted
      for (const element of array) {
        element.highlight = "sorted";
        element.color = SORTED_COLOR;
      }
      return true;
    }
    
    const { low, high } = stack.pop()!;
    
    if (low < high) {
      // Partition step
      const pivotIndex = partition(low, high);
      
      // Add sub-arrays to stack
      stack.push({ low: low, high: pivotIndex - 1 });
      stack.push({ low: pivotIndex + 1, high: high });
    }
    
    return false;
  }

  function partition(low: number, high: number): number {
    const pivot = array[high].value;
    array[high].highlight = "pivot";
    array[high].color = PIVOT_COLOR;
    
    let i = low - 1;
    
    for (let j = low; j < high; j++) {
      array[j].highlight = "comparing";
      array[j].color = COMPARING_COLOR;
      
      comparisons++;
      
      if (array[j].value < pivot) {
        i++;
        if (i !== j) {
          [array[i], array[j]] = [array[j], array[i]];
          swaps++;
        }
      }
    }
    
    [array[i + 1], array[high]] = [array[high], array[i + 1]];
    swaps++;
    
    return i + 1;
  }

  function stepMergeSort(): boolean {
    const { size, left } = sortingState;
    const n = array.length;
    
    if (size >= n) {
      // Mark all as sorted
      for (const element of array) {
        element.highlight = "sorted";
        element.color = SORTED_COLOR;
      }
      return true;
    }
    
    if (left >= n - 1) {
      // Move to next size
      sortingState.size *= 2;
      sortingState.left = 0;
      return false;
    }
    
    const mid = Math.min(left + size - 1, n - 1);
    const right = Math.min(left + size * 2 - 1, n - 1);
    
    if (mid < right) {
      merge(left, mid, right);
    }
    
    sortingState.left += size * 2;
    return false;
  }

  function merge(left: number, mid: number, right: number) {
    // Highlight merging sections
    for (let i = left; i <= right; i++) {
      array[i].highlight = "comparing";
      array[i].color = COMPARING_COLOR;
    }
    
    const leftArray = array.slice(left, mid + 1);
    const rightArray = array.slice(mid + 1, right + 1);
    
    let i = 0, j = 0, k = left;
    
    while (i < leftArray.length && j < rightArray.length) {
      comparisons++;
      
      if (leftArray[i].value <= rightArray[j].value) {
        array[k] = leftArray[i];
        i++;
      } else {
        array[k] = rightArray[j];
        j++;
      }
      k++;
    }
    
    while (i < leftArray.length) {
      array[k] = leftArray[i];
      i++;
      k++;
    }
    
    while (j < rightArray.length) {
      array[k] = rightArray[j];
      j++;
      k++;
    }
  }

  function stepSort(): boolean {
    switch (algorithm) {
      case "bubble": return stepBubbleSort();
      case "selection": return stepSelectionSort();
      case "insertion": return stepInsertionSort();
      case "quick": return stepQuickSort();
      case "merge": return stepMergeSort();
      default: return true;
    }
  }

  function drawArray() {
    const barWidth = (width - 100) / arraySize;
    const maxHeight = height * 0.5;
    const maxValue = Math.max(...array.map(e => e.value));
    const baseY = height * 0.7;
    
    for (let i = 0; i < array.length; i++) {
      const element = array[i];
      const barHeight = (element.value / maxValue) * maxHeight;
      const x = 50 + i * barWidth;
      const y = baseY - barHeight;
      
      // Draw bar
      ctx.fillStyle = element.color;
      ctx.fillRect(x, y, barWidth - 2, barHeight);
      
      // Draw value
      if (barWidth > 20) {
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(element.value.toString(), x + barWidth/2, y + barHeight/2);
      }
      
      // Draw index at bottom
      ctx.fillStyle = TEXT_DIM;
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(i.toString(), x + barWidth/2, baseY + 5);
    }
  }

  function drawInfoPanel() {
    const panelX = 20;
    const panelY = 20;
    const lineH = 18;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX - 10, panelY - 10, 350, lineH * 8 + 20);
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX - 10, panelY - 10, 350, lineH * 8 + 20);
    
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = panelX;
    let y = panelY;
    
    ctx.fillStyle = "#4f46e5";
    ctx.fillText(`${algorithm.charAt(0).toUpperCase() + algorithm.slice(1)} Sort`, x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(`Array size: ${arraySize}`, x, y);
    y += lineH;
    
    ctx.fillText(`Speed: ${speed.toFixed(1)} ops/sec`, x, y);
    y += lineH;
    
    ctx.fillText(`Step: ${currentStep}`, x, y);
    y += lineH;
    
    ctx.fillText(`Comparisons: ${comparisons}`, x, y);
    y += lineH;
    
    ctx.fillText(`Swaps: ${swaps}`, x, y);
    y += lineH;
    
    ctx.fillStyle = isSorted ? SORTED_COLOR : (isRunning ? COMPARING_COLOR : TEXT_DIM);
    ctx.fillText(isSorted ? "✓ Sorted!" : (isRunning ? "⚡ Sorting..." : "⏸ Paused"), x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText("Press SPACE to start/pause", x, y);
  }

  function drawLegend() {
    const legendX = width - 200;
    const legendY = 20;
    const lineH = 16;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(legendX - 10, legendY - 10, 190, lineH * 6 + 20);
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX - 10, legendY - 10, 190, lineH * 6 + 20);
    
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    
    const legend = [
      { color: BAR_COLOR, text: "Unsorted element" },
      { color: COMPARING_COLOR, text: "Being compared" },
      { color: SWAPPING_COLOR, text: "Being swapped" },
      { color: PIVOT_COLOR, text: "Pivot/Current" },
      { color: SORTED_COLOR, text: "Sorted position" }
    ];
    
    for (let i = 0; i < legend.length; i++) {
      const y = legendY + i * lineH;
      
      ctx.fillStyle = legend[i].color;
      ctx.fillRect(legendX, y + 3, 12, 10);
      
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText(legend[i].text, legendX + 18, y);
    }
  }

  function drawAlgorithmInfo() {
    const infoX = width - 200;
    const infoY = height - 180;
    const lineH = 16;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(infoX - 10, infoY - 10, 190, lineH * 9 + 20);
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(infoX - 10, infoY - 10, 190, lineH * 9 + 20);
    
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = infoX;
    let y = infoY;
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText("Algorithm Complexity:", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    
    const complexities: Record<string, { time: string; space: string }> = {
      bubble: { time: "O(n²)", space: "O(1)" },
      selection: { time: "O(n²)", space: "O(1)" },
      insertion: { time: "O(n²)", space: "O(1)" },
      quick: { time: "O(n log n)", space: "O(log n)" },
      merge: { time: "O(n log n)", space: "O(n)" }
    };
    
    const complexity = complexities[algorithm];
    ctx.fillText(`Time: ${complexity.time}`, x, y);
    y += lineH;
    
    ctx.fillText(`Space: ${complexity.space}`, x, y);
    y += lineH * 1.5;
    
    // Algorithm description
    const descriptions: Record<string, string[]> = {
      bubble: ["Repeatedly steps through", "the list, compares adjacent", "elements and swaps them"],
      selection: ["Finds minimum element", "and swaps it with first", "unsorted element"],
      insertion: ["Builds sorted array one", "element at a time by", "inserting into position"],
      quick: ["Divides array around", "pivot, recursively sorts", "sub-arrays"],
      merge: ["Divides array in half,", "sorts each half, then", "merges sorted halves"]
    };
    
    const desc = descriptions[algorithm];
    for (const line of desc) {
      ctx.fillText(line, x, y);
      y += lineH;
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      
      initializeArray();
      
      // Event handlers
      document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
          e.preventDefault();
          if (isSorted) {
            initializeArray();
          } else {
            isRunning = !isRunning;
          }
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          initializeArray();
        }
      });
    },

    update(dt: number, params: Record<string, number>) {
      const newAlgorithm = ["bubble", "selection", "insertion", "quick", "merge"][
        Math.floor((params.algorithm ?? 0) * 5) % 5
      ] as typeof algorithm;
      
      if (newAlgorithm !== algorithm) {
        algorithm = newAlgorithm;
        resetSorting();
      }
      
      const newArraySize = Math.floor(params.arraySize ?? arraySize);
      if (newArraySize !== arraySize && newArraySize >= 5 && newArraySize <= 50) {
        arraySize = newArraySize;
        initializeArray();
      }
      
      speed = params.speed ?? speed;
      time += dt;
      
      if (isRunning && !isSorted) {
        const stepInterval = 1 / speed;
        if (time - lastStepTime >= stepInterval) {
          isSorted = stepSort();
          currentStep++;
          lastStepTime = time;
        }
      }
    },

    render() {
      // Clear background
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);
      
      // Draw array
      drawArray();
      
      // Draw UI panels
      drawInfoPanel();
      drawLegend();
      drawAlgorithmInfo();
    },

    reset() {
      time = 0;
      lastStepTime = 0;
      initializeArray();
    },

    destroy() {
      document.removeEventListener('keydown', () => {});
    },

    getStateDescription(): string {
      const complexity = {
        bubble: "O(n²)",
        selection: "O(n²)",
        insertion: "O(n²)",
        quick: "O(n log n)",
        merge: "O(n log n)"
      }[algorithm];
      
      return (
        `Sorting Algorithms: ${algorithm.charAt(0).toUpperCase() + algorithm.slice(1)} sort ` +
        `on ${arraySize} elements. Time complexity: ${complexity}. ` +
        `Step ${currentStep}: ${comparisons} comparisons, ${swaps} swaps performed. ` +
        `Status: ${isSorted ? 'Sorting complete!' : isRunning ? 'Currently sorting...' : 'Paused'}. ` +
        `${algorithm === 'bubble' ? 'Compares adjacent elements and swaps if out of order.' : 
          algorithm === 'selection' ? 'Finds minimum and swaps with first unsorted element.' :
          algorithm === 'insertion' ? 'Inserts each element into its correct position in sorted portion.' :
          algorithm === 'quick' ? 'Partitions around pivot and recursively sorts sub-arrays.' :
          'Divides array, sorts halves, then merges them back together.'}`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default SortingAlgorithms;