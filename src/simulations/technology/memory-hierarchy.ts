import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

interface CacheLine {
  valid: boolean;
  tag: number;
  data: number[];
  dirty: boolean;
  lastAccessed: number;
  accessCount: number;
}

interface MemoryAccess {
  address: number;
  type: 'read' | 'write';
  data?: number;
  cycle: number;
  hit: boolean;
  level: number; // 0=L1, 1=L2, 2=memory
  latency: number;
}

const MemoryHierarchy: SimulationFactory = () => {
  const config = getSimConfig("memory-hierarchy")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Memory system parameters
  let cacheSize = 8; // Number of cache lines
  let blockSize = 4; // Words per block
  let associativity = 1; // 1=direct mapped, 2=2-way set associative
  let replacementPolicy = 0; // 0=LRU, 1=FIFO, 2=Random
  let writePolicy = 0; // 0=write-back, 1=write-through
  let accessPattern = 0; // 0=sequential, 1=random, 2=locality

  let time = 0;
  let cycle = 0;
  let autoGenerate = 1;

  // Cache and memory state
  let l1Cache: CacheLine[] = [];
  let l2Cache: CacheLine[] = [];
  let mainMemory: number[] = new Array(256).fill(0);
  let recentAccesses: MemoryAccess[] = [];

  // Statistics
  let totalAccesses = 0;
  let l1Hits = 0;
  let l2Hits = 0;
  let memoryAccesses = 0;
  let writebacks = 0;

  // Animation state
  let currentAccess: MemoryAccess | null = null;
  let animationProgress = 0;

  // Colors
  const BG = "#0f172a";
  const L1_COLOR = "#ef4444";
  const L2_COLOR = "#f59e0b";
  const MEMORY_COLOR = "#3b82f6";
  const HIT_COLOR = "#10b981";
  const MISS_COLOR = "#ef4444";
  const DIRTY_COLOR = "#a855f7";
  const DATA_COLOR = "#06b6d4";
  const TEXT_COLOR = "#e2e8f0";
  const PANEL_BG = "rgba(30, 41, 59, 0.9)";
  const ACCESS_COLOR = "#fbbf24";

  function initializeCache() {
    // Initialize L1 cache
    l1Cache = Array.from({ length: cacheSize }, () => ({
      valid: false,
      tag: 0,
      data: new Array(blockSize).fill(0),
      dirty: false,
      lastAccessed: 0,
      accessCount: 0
    }));

    // Initialize L2 cache (4x larger than L1)
    l2Cache = Array.from({ length: cacheSize * 4 }, () => ({
      valid: false,
      tag: 0,
      data: new Array(blockSize).fill(0),
      dirty: false,
      lastAccessed: 0,
      accessCount: 0
    }));

    // Initialize main memory with some patterns
    for (let i = 0; i < mainMemory.length; i++) {
      mainMemory[i] = (i * 17 + 42) % 256; // Pseudo-random data
    }
  }

  function computePhysics(dt: number, params: Record<string, number>) {
    cacheSize = Math.pow(2, Math.floor((params.cacheSize ?? 0.5) * 4) + 2); // 4, 8, 16, 32
    blockSize = Math.pow(2, Math.floor((params.blockSize ?? 0.5) * 3) + 1); // 2, 4, 8
    associativity = Math.pow(2, Math.floor((params.associativity ?? 0) * 3)); // 1, 2, 4
    replacementPolicy = Math.floor((params.replacementPolicy ?? 0) * 3) % 3;
    writePolicy = Math.round(params.writePolicy ?? 0);
    accessPattern = Math.floor((params.accessPattern ?? 0) * 3) % 3;
    autoGenerate = params.autoGenerate ?? autoGenerate;

    time += dt;
    cycle++;

    // Auto-generate memory accesses
    if (autoGenerate && Math.random() < 0.3) { // ~30% chance per frame
      generateMemoryAccess();
    }

    // Update animation
    if (currentAccess) {
      animationProgress += dt * 2; // 0.5 second animation
      if (animationProgress >= 1) {
        currentAccess = null;
        animationProgress = 0;
      }
    }
  }

  function generateMemoryAccess() {
    let address: number;

    // Generate address based on access pattern
    switch (accessPattern) {
      case 0: // Sequential
        address = (totalAccesses % 64) * blockSize;
        break;
      case 1: // Random
        address = Math.floor(Math.random() * 128) * blockSize;
        break;
      case 2: // Locality (80% within small range, 20% random)
        if (Math.random() < 0.8) {
          const baseAddr = Math.floor(totalAccesses / 10) * 16;
          address = baseAddr + (Math.floor(Math.random() * 4) * blockSize);
        } else {
          address = Math.floor(Math.random() * 128) * blockSize;
        }
        break;
      default:
        address = 0;
    }

    const accessType = Math.random() < 0.7 ? 'read' : 'write';
    const data = accessType === 'write' ? Math.floor(Math.random() * 256) : undefined;

    performMemoryAccess(address, accessType, data);
  }

  function performMemoryAccess(address: number, type: 'read' | 'write', data?: number) {
    totalAccesses++;

    // Parse address
    const blockAddr = Math.floor(address / blockSize);
    const offset = address % blockSize;
    const tag = Math.floor(blockAddr / (cacheSize / associativity));
    const setIndex = blockAddr % (cacheSize / associativity);

    // Try L1 cache
    const l1Result = accessCache(l1Cache, tag, setIndex, type, data, offset, 1);
    
    if (l1Result.hit) {
      l1Hits++;
      currentAccess = {
        address,
        type,
        data,
        cycle,
        hit: true,
        level: 0,
        latency: 1
      };
    } else {
      // L1 miss - try L2
      const l2Result = accessCache(l2Cache, tag, setIndex, type, data, offset, 2);
      
      if (l2Result.hit) {
        l2Hits++;
        // Bring data to L1
        const l1VictimIndex = findVictim(l1Cache, setIndex);
        if (l1Cache[l1VictimIndex].dirty) {
          writebacks++;
        }
        l1Cache[l1VictimIndex] = { ...l2Result.line! };
        
        currentAccess = {
          address,
          type,
          data,
          cycle,
          hit: false,
          level: 1,
          latency: 10
        };
      } else {
        // L2 miss - access main memory
        memoryAccesses++;
        const memData = mainMemory[address] || 0;
        
        // Create new cache line
        const newLine: CacheLine = {
          valid: true,
          tag,
          data: Array.from({ length: blockSize }, (_, i) => mainMemory[blockAddr * blockSize + i] || 0),
          dirty: type === 'write',
          lastAccessed: cycle,
          accessCount: 1
        };
        
        if (type === 'write' && data !== undefined) {
          newLine.data[offset] = data;
          mainMemory[address] = data;
        }

        // Insert into L2
        const l2VictimIndex = findVictim(l2Cache, setIndex);
        if (l2Cache[l2VictimIndex].dirty) {
          writebacks++;
        }
        l2Cache[l2VictimIndex] = newLine;

        // Insert into L1
        const l1VictimIndex = findVictim(l1Cache, setIndex);
        if (l1Cache[l1VictimIndex].dirty) {
          writebacks++;
        }
        l1Cache[l1VictimIndex] = { ...newLine };

        currentAccess = {
          address,
          type,
          data,
          cycle,
          hit: false,
          level: 2,
          latency: 100
        };
      }
    }

    recentAccesses.push(currentAccess);
    if (recentAccesses.length > 20) {
      recentAccesses.shift();
    }
  }

  function accessCache(
    cache: CacheLine[],
    tag: number,
    setIndex: number,
    type: 'read' | 'write',
    data: number | undefined,
    offset: number,
    level: number
  ): { hit: boolean; line?: CacheLine } {
    const setSize = associativity;
    const setStart = setIndex * setSize;
    
    // Check for hit
    for (let i = 0; i < setSize; i++) {
      const lineIndex = setStart + i;
      if (lineIndex >= cache.length) break;
      
      const line = cache[lineIndex];
      if (line.valid && line.tag === tag) {
        // Hit!
        line.lastAccessed = cycle;
        line.accessCount++;
        
        if (type === 'write' && data !== undefined) {
          line.data[offset] = data;
          line.dirty = true;
        }
        
        return { hit: true, line };
      }
    }

    return { hit: false };
  }

  function findVictim(cache: CacheLine[], setIndex: number): number {
    const setSize = associativity;
    const setStart = setIndex * setSize;
    
    // Find invalid line first
    for (let i = 0; i < setSize; i++) {
      const lineIndex = setStart + i;
      if (lineIndex >= cache.length) break;
      if (!cache[lineIndex].valid) return lineIndex;
    }

    // Apply replacement policy
    switch (replacementPolicy) {
      case 0: // LRU
        let lruIndex = setStart;
        let oldestTime = cache[setStart].lastAccessed;
        for (let i = 1; i < setSize; i++) {
          const lineIndex = setStart + i;
          if (lineIndex >= cache.length) break;
          if (cache[lineIndex].lastAccessed < oldestTime) {
            oldestTime = cache[lineIndex].lastAccessed;
            lruIndex = lineIndex;
          }
        }
        return lruIndex;

      case 1: // FIFO (use access count as insertion order approximation)
        let fifoIndex = setStart;
        let lowestCount = cache[setStart].accessCount;
        for (let i = 1; i < setSize; i++) {
          const lineIndex = setStart + i;
          if (lineIndex >= cache.length) break;
          if (cache[lineIndex].accessCount < lowestCount) {
            lowestCount = cache[lineIndex].accessCount;
            fifoIndex = lineIndex;
          }
        }
        return fifoIndex;

      case 2: // Random
      default:
        return setStart + Math.floor(Math.random() * setSize);
    }
  }

  function drawMemoryHierarchy() {
    const hierarchyX = width * 0.05;
    const hierarchyY = height * 0.05;
    const hierarchyW = width * 0.6;
    const hierarchyH = height * 0.4;

    // L1 Cache
    const l1W = hierarchyW * 0.25;
    const l1H = hierarchyH * 0.3;
    const l1X = hierarchyX;
    const l1Y = hierarchyY;

    ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
    ctx.fillRect(l1X, l1Y, l1W, l1H);
    ctx.strokeStyle = L1_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(l1X, l1Y, l1W, l1H);

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("L1 Cache", l1X + l1W / 2, l1Y + 15);
    ctx.font = "10px monospace";
    ctx.fillText(`${cacheSize} lines`, l1X + l1W / 2, l1Y + 30);
    ctx.fillText("1 cycle", l1X + l1W / 2, l1Y + 45);

    // L2 Cache
    const l2W = hierarchyW * 0.35;
    const l2H = hierarchyH * 0.5;
    const l2X = hierarchyX + l1W + 20;
    const l2Y = hierarchyY;

    ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
    ctx.fillRect(l2X, l2Y, l2W, l2H);
    ctx.strokeStyle = L2_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(l2X, l2Y, l2W, l2H);

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("L2 Cache", l2X + l2W / 2, l2Y + 15);
    ctx.font = "10px monospace";
    ctx.fillText(`${cacheSize * 4} lines`, l2X + l2W / 2, l2Y + 30);
    ctx.fillText("10 cycles", l2X + l2W / 2, l2Y + 45);

    // Main Memory
    const memW = hierarchyW * 0.35;
    const memH = hierarchyH * 0.7;
    const memX = hierarchyX + l1W + l2W + 40;
    const memY = hierarchyY;

    ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
    ctx.fillRect(memX, memY, memW, memH);
    ctx.strokeStyle = MEMORY_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(memX, memY, memW, memH);

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Main Memory", memX + memW / 2, memY + 15);
    ctx.font = "10px monospace";
    ctx.fillText(`${mainMemory.length} words`, memX + memW / 2, memY + 30);
    ctx.fillText("100 cycles", memX + memW / 2, memY + 45);

    // Draw arrows showing data flow
    drawDataFlow(l1X + l1W, l1Y + l1H / 2, l2X, l2Y + l2H / 2, 0);
    drawDataFlow(l2X + l2W, l2Y + l2H / 2, memX, memY + memH / 2, 1);

    // Current access visualization
    if (currentAccess) {
      drawCurrentAccess(hierarchyX, hierarchyY, hierarchyW, hierarchyH);
    }
  }

  function drawDataFlow(x1: number, y1: number, x2: number, y2: number, level: number) {
    const progress = currentAccess && currentAccess.level === level ? animationProgress : 0;
    
    ctx.strokeStyle = progress > 0 ? ACCESS_COLOR : "#64748b";
    ctx.lineWidth = progress > 0 ? 3 : 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrow head
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowSize = 8;
    
    ctx.fillStyle = progress > 0 ? ACCESS_COLOR : "#64748b";
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - arrowSize * Math.cos(angle - Math.PI / 6), y2 - arrowSize * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - arrowSize * Math.cos(angle + Math.PI / 6), y2 - arrowSize * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    // Moving data indicator
    if (progress > 0) {
      const moveX = x1 + (x2 - x1) * progress;
      const moveY = y1 + (y2 - y1) * progress;
      
      ctx.fillStyle = ACCESS_COLOR;
      ctx.beginPath();
      ctx.arc(moveX, moveY, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCurrentAccess(x: number, y: number, w: number, h: number) {
    if (!currentAccess) return;

    const accessY = y + h + 20;
    ctx.fillStyle = currentAccess.hit ? HIT_COLOR : MISS_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    
    const hitText = currentAccess.hit ? "HIT" : "MISS";
    const levelNames = ["L1", "L2", "Memory"];
    
    ctx.fillText(`${hitText} in ${levelNames[currentAccess.level]} - ${currentAccess.type.toUpperCase()} 0x${currentAccess.address.toString(16).toUpperCase()}`, x, accessY);
  }

  function drawCacheContents() {
    const cacheX = width * 0.68;
    const cacheY = height * 0.05;
    const cacheW = width * 0.3;
    const cacheH = height * 0.55;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(cacheX, cacheY, cacheW, cacheH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(cacheX, cacheY, cacheW, cacheH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("L1 Cache Contents", cacheX + cacheW / 2, cacheY + 20);

    // Headers
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#9ca3af";
    let y = cacheY + 40;
    ctx.fillText("Set", cacheX + 5, y);
    ctx.fillText("V", cacheX + 30, y);
    ctx.fillText("Tag", cacheX + 45, y);
    ctx.fillText("Data", cacheX + 80, y);
    ctx.fillText("D", cacheX + 150, y);

    y += 15;

    // Cache lines
    const linesPerSet = associativity;
    const numSets = l1Cache.length / linesPerSet;

    for (let set = 0; set < Math.min(numSets, 12); set++) {
      for (let way = 0; way < linesPerSet; way++) {
        const lineIndex = set * linesPerSet + way;
        if (lineIndex >= l1Cache.length) break;

        const line = l1Cache[lineIndex];
        
        // Highlight recently accessed lines
        const isRecentlyAccessed = line.lastAccessed > cycle - 10;
        if (isRecentlyAccessed) {
          ctx.fillStyle = "rgba(251, 191, 36, 0.2)";
          ctx.fillRect(cacheX + 2, y - 10, cacheW - 4, 12);
        }

        ctx.fillStyle = line.valid ? TEXT_COLOR : "#64748b";
        ctx.font = "8px monospace";
        
        // Set number
        if (way === 0) {
          ctx.fillText(set.toString(), cacheX + 5, y);
        }
        
        // Valid bit
        ctx.fillText(line.valid ? "1" : "0", cacheX + 30, y);
        
        // Tag
        if (line.valid) {
          ctx.fillText(line.tag.toString(16).toUpperCase(), cacheX + 45, y);
        }
        
        // Data (first word only)
        if (line.valid) {
          ctx.fillText(line.data[0].toString(16).padStart(2, '0').toUpperCase(), cacheX + 80, y);
        }
        
        // Dirty bit
        if (line.dirty) {
          ctx.fillStyle = DIRTY_COLOR;
          ctx.fillText("D", cacheX + 150, y);
        }

        y += 12;
      }
      
      if (y > cacheY + cacheH - 20) break;
    }

    // Configuration info
    y += 10;
    ctx.fillStyle = "#9ca3af";
    ctx.font = "9px monospace";
    const configs = [
      `Size: ${cacheSize} lines`,
      `Block: ${blockSize} words`,
      `Assoc: ${associativity}-way`,
      `Replace: ${['LRU', 'FIFO', 'Random'][replacementPolicy]}`,
      `Write: ${['Back', 'Through'][writePolicy]}`
    ];
    
    configs.forEach(config => {
      ctx.fillText(config, cacheX + 5, y);
      y += 12;
    });
  }

  function drawStatistics() {
    const statsX = width * 0.05;
    const statsY = height * 0.62;
    const statsW = width * 0.9;
    const statsH = height * 0.35;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(statsX, statsY, statsW, statsH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(statsX, statsY, statsW, statsH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Performance Statistics", statsX + statsW / 2, statsY + 20);

    // Statistics in columns
    const col1X = statsX + 20;
    const col2X = statsX + statsW / 3;
    const col3X = statsX + 2 * statsW / 3;
    const statY = statsY + 45;

    ctx.font = "12px monospace";
    ctx.textAlign = "left";

    // Column 1: Hit rates
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Cache Performance:", col1X, statY);
    
    const l1HitRate = totalAccesses > 0 ? (l1Hits / totalAccesses) * 100 : 0;
    const l2HitRate = totalAccesses > 0 ? ((l1Hits + l2Hits) / totalAccesses) * 100 : 0;
    const missRate = 100 - l2HitRate;

    ctx.fillStyle = HIT_COLOR;
    ctx.fillText(`L1 Hit Rate: ${l1HitRate.toFixed(1)}%`, col1X, statY + 20);
    ctx.fillText(`L2 Hit Rate: ${l2HitRate.toFixed(1)}%`, col1X, statY + 40);
    ctx.fillStyle = MISS_COLOR;
    ctx.fillText(`Miss Rate: ${missRate.toFixed(1)}%`, col1X, statY + 60);

    // Column 2: Access counts
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Access Counts:", col2X, statY);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`Total: ${totalAccesses}`, col2X, statY + 20);
    ctx.fillText(`L1 Hits: ${l1Hits}`, col2X, statY + 40);
    ctx.fillText(`L2 Hits: ${l2Hits}`, col2X, statY + 60);
    ctx.fillText(`Memory: ${memoryAccesses}`, col2X, statY + 80);

    // Column 3: Performance metrics
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Performance:", col3X, statY);
    
    const avgLatency = totalAccesses > 0 ? 
      (l1Hits * 1 + l2Hits * 10 + memoryAccesses * 100) / totalAccesses : 0;
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`Avg Latency: ${avgLatency.toFixed(1)} cycles`, col3X, statY + 20);
    ctx.fillText(`Writebacks: ${writebacks}`, col3X, statY + 40);
    
    const patterns = ["Sequential", "Random", "Locality"];
    ctx.fillText(`Pattern: ${patterns[accessPattern]}`, col3X, statY + 60);

    // Recent accesses timeline
    drawAccessTimeline(statsX + 20, statsY + 140, statsW - 40, 60);
  }

  function drawAccessTimeline(x: number, y: number, w: number, h: number) {
    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Recent Memory Accesses:", x, y);

    if (recentAccesses.length === 0) return;

    const timelineY = y + 20;
    const barWidth = w / Math.max(recentAccesses.length, 10);

    recentAccesses.forEach((access, index) => {
      const barX = x + index * barWidth;
      const barH = h - 20;

      // Color based on cache level
      const colors = [HIT_COLOR, L2_COLOR, MEMORY_COLOR];
      ctx.fillStyle = colors[access.level];
      ctx.fillRect(barX, timelineY, barWidth - 1, barH);

      // Access type indicator
      ctx.fillStyle = access.type === 'write' ? "#ef4444" : "#3b82f6";
      ctx.fillRect(barX, timelineY, barWidth - 1, 3);
    });
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      cycle = 0;
      totalAccesses = 0;
      l1Hits = 0;
      l2Hits = 0;
      memoryAccesses = 0;
      writebacks = 0;
      recentAccesses = [];
      currentAccess = null;
      animationProgress = 0;
      initializeCache();
    },

    update(dt: number, params: Record<string, number>) {
      computePhysics(dt, params);
    },

    render() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      drawMemoryHierarchy();
      drawCacheContents();
      drawStatistics();
    },

    reset() {
      time = 0;
      cycle = 0;
      totalAccesses = 0;
      l1Hits = 0;
      l2Hits = 0;
      memoryAccesses = 0;
      writebacks = 0;
      recentAccesses = [];
      currentAccess = null;
      animationProgress = 0;
      initializeCache();
    },

    destroy() {
      l1Cache = [];
      l2Cache = [];
      mainMemory = [];
      recentAccesses = [];
    },

    getStateDescription(): string {
      const l1HitRate = totalAccesses > 0 ? (l1Hits / totalAccesses) * 100 : 0;
      const l2HitRate = totalAccesses > 0 ? ((l1Hits + l2Hits) / totalAccesses) * 100 : 0;
      const avgLatency = totalAccesses > 0 ? 
        (l1Hits * 1 + l2Hits * 10 + memoryAccesses * 100) / totalAccesses : 0;
      
      const patterns = ["sequential", "random", "spatial locality"];
      const policies = ["LRU", "FIFO", "random"];
      
      return (
        `Memory hierarchy simulation: L1 cache (${cacheSize} lines, ${associativity}-way), L2 cache (${cacheSize * 4} lines). ` +
        `${totalAccesses} memory accesses with L1 hit rate ${l1HitRate.toFixed(1)}%, L2 hit rate ${l2HitRate.toFixed(1)}%. ` +
        `Average latency: ${avgLatency.toFixed(1)} cycles. Using ${policies[replacementPolicy]} replacement policy. ` +
        `Access pattern: ${patterns[accessPattern]}. ${writebacks} writebacks performed. ` +
        `Demonstrates cache hierarchy performance, temporal/spatial locality effects, and memory system optimization.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default MemoryHierarchy;