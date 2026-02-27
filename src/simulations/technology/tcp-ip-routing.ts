import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

interface NetworkNode {
  id: string;
  x: number;
  y: number;
  type: 'host' | 'router' | 'switch';
  ip: string;
  subnet: string;
  isDestination?: boolean;
  packetQueue: Packet[];
  routingTable: RoutingEntry[];
}

interface Packet {
  id: string;
  sourceIP: string;
  destIP: string;
  data: string;
  ttl: number;
  currentNode: string;
  nextHop: string;
  progress: number; // 0-1 along current link
  path: string[];
  layer: 'physical' | 'datalink' | 'network' | 'transport';
}

interface RoutingEntry {
  network: string;
  netmask: string;
  nextHop: string;
  interface: string;
  metric: number;
}

interface NetworkLink {
  from: string;
  to: string;
  latency: number;
  bandwidth: number;
  utilization: number;
}

const TCPIPRouting: SimulationFactory = () => {
  const config = getSimConfig("tcp-ip-routing")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Network topology
  let nodes: NetworkNode[] = [];
  let links: NetworkLink[] = [];
  let packets: Packet[] = [];

  // Simulation parameters
  let packetGenRate = 2.0; // packets per second
  let routingProtocol = 0; // 0=static, 1=RIP, 2=OSPF
  let showLayers = 1;
  let time = 0;
  let lastPacketTime = 0;
  let packetCounter = 0;

  // Animation
  let selectedPacket: string | null = null;
  let routingTableVisible = false;

  // Colors
  const BG = "#0f172a";
  const HOST_COLOR = "#10b981";
  const ROUTER_COLOR = "#3b82f6";
  const SWITCH_COLOR = "#f59e0b";
  const PACKET_COLOR = "#ef4444";
  const LINK_COLOR = "#64748b";
  const ACTIVE_LINK_COLOR = "#fbbf24";
  const PHYSICAL_COLOR = "#9ca3af";
  const DATALINK_COLOR = "#06b6d4";
  const NETWORK_COLOR = "#8b5cf6";
  const TRANSPORT_COLOR = "#ef4444";
  const TEXT_COLOR = "#e2e8f0";
  const PANEL_BG = "rgba(30, 41, 59, 0.9)";

  function initializeNetwork() {
    nodes = [
      // Subnet 192.168.1.0/24
      { id: 'host1', x: 50, y: 150, type: 'host', ip: '192.168.1.10', subnet: '192.168.1.0/24', packetQueue: [], routingTable: [] },
      { id: 'host2', x: 50, y: 250, type: 'host', ip: '192.168.1.20', subnet: '192.168.1.0/24', packetQueue: [], routingTable: [] },
      { id: 'switch1', x: 150, y: 200, type: 'switch', ip: '192.168.1.1', subnet: '192.168.1.0/24', packetQueue: [], routingTable: [] },
      
      // Core routers
      { id: 'router1', x: 300, y: 200, type: 'router', ip: '10.0.1.1', subnet: '10.0.0.0/8', packetQueue: [], routingTable: [] },
      { id: 'router2', x: 500, y: 150, type: 'router', ip: '10.0.2.1', subnet: '10.0.0.0/8', packetQueue: [], routingTable: [] },
      { id: 'router3', x: 500, y: 250, type: 'router', ip: '10.0.3.1', subnet: '10.0.0.0/8', packetQueue: [], routingTable: [] },
      
      // Subnet 192.168.2.0/24
      { id: 'switch2', x: 650, y: 200, type: 'switch', ip: '192.168.2.1', subnet: '192.168.2.0/24', packetQueue: [], routingTable: [] },
      { id: 'host3', x: 750, y: 150, type: 'host', ip: '192.168.2.10', subnet: '192.168.2.0/24', packetQueue: [], routingTable: [] },
      { id: 'host4', x: 750, y: 250, type: 'host', ip: '192.168.2.20', subnet: '192.168.2.0/24', isDestination: true, packetQueue: [], routingTable: [] },
    ];

    links = [
      // Local subnet 1
      { from: 'host1', to: 'switch1', latency: 1, bandwidth: 100, utilization: 0 },
      { from: 'host2', to: 'switch1', latency: 1, bandwidth: 100, utilization: 0 },
      { from: 'switch1', to: 'router1', latency: 2, bandwidth: 1000, utilization: 0 },
      
      // Core network
      { from: 'router1', to: 'router2', latency: 10, bandwidth: 1000, utilization: 0 },
      { from: 'router1', to: 'router3', latency: 15, bandwidth: 1000, utilization: 0 },
      { from: 'router2', to: 'router3', latency: 8, bandwidth: 1000, utilization: 0 },
      
      // Local subnet 2
      { from: 'router2', to: 'switch2', latency: 2, bandwidth: 1000, utilization: 0 },
      { from: 'router3', to: 'switch2', latency: 2, bandwidth: 1000, utilization: 0 },
      { from: 'switch2', to: 'host3', latency: 1, bandwidth: 100, utilization: 0 },
      { from: 'switch2', to: 'host4', latency: 1, bandwidth: 100, utilization: 0 },
    ];

    // Initialize routing tables
    initializeRoutingTables();
  }

  function initializeRoutingTables() {
    // Simplified static routing - in practice this would be learned via routing protocols
    const routingTables = {
      'host1': [
        { network: '0.0.0.0', netmask: '0.0.0.0', nextHop: '192.168.1.1', interface: 'eth0', metric: 1 }
      ],
      'host2': [
        { network: '0.0.0.0', netmask: '0.0.0.0', nextHop: '192.168.1.1', interface: 'eth0', metric: 1 }
      ],
      'switch1': [
        { network: '192.168.1.0', netmask: '255.255.255.0', nextHop: 'direct', interface: 'local', metric: 0 },
        { network: '0.0.0.0', netmask: '0.0.0.0', nextHop: '10.0.1.1', interface: 'uplink', metric: 1 }
      ],
      'router1': [
        { network: '192.168.1.0', netmask: '255.255.255.0', nextHop: 'direct', interface: 'eth0', metric: 0 },
        { network: '192.168.2.0', netmask: '255.255.255.0', nextHop: '10.0.2.1', interface: 'eth1', metric: 10 },
        { network: '10.0.0.0', netmask: '255.0.0.0', nextHop: 'direct', interface: 'eth2', metric: 0 }
      ],
      'router2': [
        { network: '192.168.2.0', netmask: '255.255.255.0', nextHop: 'direct', interface: 'eth0', metric: 0 },
        { network: '192.168.1.0', netmask: '255.255.255.0', nextHop: '10.0.1.1', interface: 'eth1', metric: 10 },
        { network: '10.0.0.0', netmask: '255.0.0.0', nextHop: 'direct', interface: 'eth2', metric: 0 }
      ],
      'router3': [
        { network: '192.168.2.0', netmask: '255.255.255.0', nextHop: 'direct', interface: 'eth0', metric: 0 },
        { network: '192.168.1.0', netmask: '255.255.255.0', nextHop: '10.0.1.1', interface: 'eth1', metric: 15 },
        { network: '10.0.0.0', netmask: '255.0.0.0', nextHop: 'direct', interface: 'eth2', metric: 0 }
      ],
      'switch2': [
        { network: '192.168.2.0', netmask: '255.255.255.0', nextHop: 'direct', interface: 'local', metric: 0 },
        { network: '0.0.0.0', netmask: '0.0.0.0', nextHop: '10.0.2.1', interface: 'uplink', metric: 1 }
      ],
      'host3': [
        { network: '0.0.0.0', netmask: '0.0.0.0', nextHop: '192.168.2.1', interface: 'eth0', metric: 1 }
      ],
      'host4': [
        { network: '0.0.0.0', netmask: '0.0.0.0', nextHop: '192.168.2.1', interface: 'eth0', metric: 1 }
      ]
    };

    for (const node of nodes) {
      node.routingTable = routingTables[node.id as keyof typeof routingTables] || [];
    }
  }

  function computePhysics(dt: number, params: Record<string, number>) {
    packetGenRate = params.packetGenRate ?? packetGenRate;
    routingProtocol = Math.floor((params.routingProtocol ?? 0) * 3) % 3;
    showLayers = params.showLayers ?? showLayers;

    time += dt;

    // Generate packets
    if (time - lastPacketTime > 1 / packetGenRate) {
      generatePacket();
      lastPacketTime = time;
    }

    // Update packet positions
    updatePackets(dt);

    // Update link utilization
    updateLinkUtilization();
  }

  function generatePacket() {
    const sourceNodes = nodes.filter(n => n.type === 'host' && !n.isDestination);
    const destNodes = nodes.filter(n => n.type === 'host' && n.isDestination);
    
    if (sourceNodes.length === 0 || destNodes.length === 0) return;

    const source = sourceNodes[Math.floor(Math.random() * sourceNodes.length)];
    const dest = destNodes[Math.floor(Math.random() * destNodes.length)];

    const packet: Packet = {
      id: `packet-${++packetCounter}`,
      sourceIP: source.ip,
      destIP: dest.ip,
      data: `Hello ${packetCounter}`,
      ttl: 64,
      currentNode: source.id,
      nextHop: '',
      progress: 0,
      path: [source.id],
      layer: 'transport'
    };

    // Route the packet
    routePacket(packet);
    packets.push(packet);
  }

  function routePacket(packet: Packet) {
    const currentNode = nodes.find(n => n.id === packet.currentNode);
    if (!currentNode) return;

    // Find best route from routing table
    const destIP = packet.destIP;
    let bestMatch: RoutingEntry | null = null;
    let longestPrefix = -1;

    for (const route of currentNode.routingTable) {
      if (isIPInNetwork(destIP, route.network, route.netmask)) {
        const prefixLength = calculatePrefixLength(route.netmask);
        if (prefixLength > longestPrefix) {
          longestPrefix = prefixLength;
          bestMatch = route;
        }
      }
    }

    if (bestMatch) {
      if (bestMatch.nextHop === 'direct') {
        // Destination is directly connected
        packet.nextHop = destIP;
      } else {
        packet.nextHop = bestMatch.nextHop;
      }
    } else {
      // No route found - packet will be dropped
      packet.nextHop = 'drop';
    }
  }

  function isIPInNetwork(ip: string, network: string, netmask: string): boolean {
    // Simplified IP matching - in practice would use proper subnet calculations
    if (network === '0.0.0.0') return true; // Default route
    
    const ipParts = ip.split('.').map(Number);
    const netParts = network.split('.').map(Number);
    const maskParts = netmask.split('.').map(Number);

    for (let i = 0; i < 4; i++) {
      if ((ipParts[i] & maskParts[i]) !== (netParts[i] & maskParts[i])) {
        return false;
      }
    }
    return true;
  }

  function calculatePrefixLength(netmask: string): number {
    return netmask.split('.').reduce((acc, octet) => {
      return acc + (parseInt(octet).toString(2).match(/1/g) || []).length;
    }, 0);
  }

  function updatePackets(dt: number) {
    for (let i = packets.length - 1; i >= 0; i--) {
      const packet = packets[i];
      
      if (packet.nextHop === 'drop' || packet.ttl <= 0) {
        packets.splice(i, 1);
        continue;
      }

      // Move packet along current link
      const currentNode = nodes.find(n => n.id === packet.currentNode);
      const nextNode = nodes.find(n => n.ip === packet.nextHop || n.id === packet.nextHop);

      if (!currentNode || !nextNode) {
        // Find next hop node by routing
        const nextHopIP = packet.nextHop;
        const nextHopNode = nodes.find(n => n.ip === nextHopIP);
        
        if (nextHopNode) {
          const link = links.find(l => 
            (l.from === packet.currentNode && l.to === nextHopNode.id) ||
            (l.to === packet.currentNode && l.from === nextHopNode.id)
          );
          
          if (link) {
            packet.progress += dt * 50 / link.latency; // Speed based on latency
            
            if (packet.progress >= 1) {
              // Packet reached next hop
              packet.progress = 0;
              packet.currentNode = nextHopNode.id;
              packet.path.push(nextHopNode.id);
              packet.ttl--;
              
              // Check if reached destination
              if (nextHopNode.ip === packet.destIP) {
                packets.splice(i, 1);
                continue;
              }
              
              // Route to next hop
              routePacket(packet);
            }
          }
        } else {
          packets.splice(i, 1); // Drop packet
        }
      }
    }
  }

  function updateLinkUtilization() {
    // Reset utilization
    for (const link of links) {
      link.utilization = 0;
    }

    // Calculate utilization based on active packets
    for (const packet of packets) {
      const nextHopNode = nodes.find(n => n.ip === packet.nextHop || n.id === packet.nextHop);
      if (nextHopNode) {
        const link = links.find(l => 
          (l.from === packet.currentNode && l.to === nextHopNode.id) ||
          (l.to === packet.currentNode && l.from === nextHopNode.id)
        );
        
        if (link) {
          link.utilization = Math.min(100, link.utilization + 20);
        }
      }
    }
  }

  function drawNetwork() {
    // Draw links first
    for (const link of links) {
      const fromNode = nodes.find(n => n.id === link.from);
      const toNode = nodes.find(n => n.id === link.to);
      
      if (fromNode && toNode) {
        // Link color based on utilization
        const intensity = link.utilization / 100;
        ctx.strokeStyle = intensity > 0 ? `rgba(251, 191, 36, ${0.3 + intensity * 0.7})` : LINK_COLOR;
        ctx.lineWidth = 2 + intensity * 3;
        
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.stroke();

        // Bandwidth/latency labels
        if (link.utilization > 0) {
          const midX = (fromNode.x + toNode.x) / 2;
          const midY = (fromNode.y + toNode.y) / 2;
          
          ctx.fillStyle = "#fbbf24";
          ctx.font = "9px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`${link.bandwidth}Mb`, midX, midY - 5);
          ctx.fillText(`${link.latency}ms`, midX, midY + 8);
        }
      }
    }

    // Draw nodes
    for (const node of nodes) {
      let nodeColor = HOST_COLOR;
      let nodeSize = 15;
      
      switch (node.type) {
        case 'router':
          nodeColor = ROUTER_COLOR;
          nodeSize = 18;
          break;
        case 'switch':
          nodeColor = SWITCH_COLOR;
          nodeSize = 16;
          break;
        case 'host':
          nodeColor = node.isDestination ? "#ef4444" : HOST_COLOR;
          break;
      }

      // Node circle
      ctx.fillStyle = nodeColor;
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Node icon
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      const icons = { host: "💻", router: "🌐", switch: "⚡" };
      ctx.fillText(icons[node.type] || "?", node.x, node.y);

      // Node labels
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(node.id, node.x, node.y + nodeSize + 3);
      ctx.fillText(node.ip, node.x, node.y + nodeSize + 15);

      // Packet queue indicator
      if (node.packetQueue.length > 0) {
        ctx.fillStyle = PACKET_COLOR;
        ctx.font = "8px monospace";
        ctx.fillText(`${node.packetQueue.length}`, node.x + nodeSize, node.y - nodeSize);
      }
    }
  }

  function drawPackets() {
    for (const packet of packets) {
      const currentNode = nodes.find(n => n.id === packet.currentNode);
      const nextHopNode = nodes.find(n => n.ip === packet.nextHop || n.id === packet.nextHop);
      
      if (currentNode && nextHopNode) {
        // Calculate packet position along link
        const x = currentNode.x + (nextHopNode.x - currentNode.x) * packet.progress;
        const y = currentNode.y + (nextHopNode.y - currentNode.y) * packet.progress;

        // Packet layers visualization
        if (showLayers) {
          const layerColors = {
            physical: PHYSICAL_COLOR,
            datalink: DATALINK_COLOR,
            network: NETWORK_COLOR,
            transport: TRANSPORT_COLOR
          };

          // Draw layer stack
          for (let i = 0; i < 4; i++) {
            const layerNames = ['physical', 'datalink', 'network', 'transport'] as const;
            const layer = layerNames[i];
            const isCurrentLayer = layer === packet.layer;
            
            ctx.fillStyle = isCurrentLayer ? layerColors[layer] : `${layerColors[layer]}40`;
            ctx.fillRect(x - 8 + i * 2, y - 8 + i * 2, 8, 8);
          }
        } else {
          // Simple packet
          ctx.fillStyle = PACKET_COLOR;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Packet ID
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(packet.id.split('-')[1], x, y + 15);

        // Show packet info if selected
        if (selectedPacket === packet.id) {
          drawPacketInfo(packet, x + 20, y - 20);
        }
      }
    }
  }

  function drawPacketInfo(packet: Packet, x: number, y: number) {
    const infoW = 200;
    const infoH = 80;

    // Background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(x, y, infoW, infoH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, infoW, infoH);

    // Info text
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    
    let infoY = y + 15;
    ctx.fillText(`Packet: ${packet.id}`, x + 5, infoY);
    infoY += 12;
    ctx.fillText(`From: ${packet.sourceIP}`, x + 5, infoY);
    infoY += 12;
    ctx.fillText(`To: ${packet.destIP}`, x + 5, infoY);
    infoY += 12;
    ctx.fillText(`TTL: ${packet.ttl}`, x + 5, infoY);
    infoY += 12;
    ctx.fillText(`Path: ${packet.path.join(' → ')}`, x + 5, infoY);
  }

  function drawControlPanel() {
    const panelX = 10;
    const panelY = height - 150;
    const panelW = width - 20;
    const panelH = 140;

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
    ctx.fillText("TCP/IP Packet Routing", panelX + panelW / 2, panelY + 20);

    // Statistics
    const col1X = panelX + 20;
    const col2X = panelX + panelW / 3;
    const col3X = panelX + 2 * panelW / 3;
    const statsY = panelY + 45;

    ctx.font = "11px monospace";
    ctx.textAlign = "left";

    // Column 1: Network stats
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Network Status:", col1X, statsY);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`Active packets: ${packets.length}`, col1X, statsY + 15);
    ctx.fillText(`Nodes: ${nodes.length}`, col1X, statsY + 30);
    ctx.fillText(`Links: ${links.length}`, col1X, statsY + 45);

    const protocols = ["Static", "RIP", "OSPF"];
    ctx.fillText(`Protocol: ${protocols[routingProtocol]}`, col1X, statsY + 60);

    // Column 2: Packet info
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Traffic:", col2X, statsY);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`Generation rate: ${packetGenRate.toFixed(1)}/s`, col2X, statsY + 15);
    ctx.fillText(`Packets sent: ${packetCounter}`, col2X, statsY + 30);
    
    const avgHops = packets.length > 0 ? 
      packets.reduce((sum, p) => sum + p.path.length, 0) / packets.length : 0;
    ctx.fillText(`Avg hops: ${avgHops.toFixed(1)}`, col2X, statsY + 45);

    // Column 3: Layer info
    if (showLayers) {
      ctx.fillStyle = "#9ca3af";
      ctx.fillText("OSI Layers:", col3X, statsY);
      
      const layers = [
        { name: "Transport", color: TRANSPORT_COLOR },
        { name: "Network", color: NETWORK_COLOR },
        { name: "Data Link", color: DATALINK_COLOR },
        { name: "Physical", color: PHYSICAL_COLOR }
      ];
      
      layers.forEach((layer, i) => {
        ctx.fillStyle = layer.color;
        ctx.fillRect(col3X, statsY + 15 + i * 12, 8, 8);
        ctx.fillStyle = TEXT_COLOR;
        ctx.fillText(layer.name, col3X + 12, statsY + 23 + i * 12);
      });
    }
  }

  function drawRoutingTable() {
    if (!routingTableVisible) return;

    const tableX = width - 300;
    const tableY = 50;
    const tableW = 280;
    const tableH = 200;

    // Background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(tableX, tableY, tableW, tableH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(tableX, tableY, tableW, tableH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Routing Table (Router1)", tableX + tableW / 2, tableY + 18);

    // Headers
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Network", tableX + 5, tableY + 35);
    ctx.fillText("Netmask", tableX + 70, tableY + 35);
    ctx.fillText("Next Hop", tableX + 140, tableY + 35);
    ctx.fillText("Metric", tableX + 210, tableY + 35);

    // Routing entries
    const router1 = nodes.find(n => n.id === 'router1');
    if (router1) {
      let y = tableY + 50;
      ctx.fillStyle = TEXT_COLOR;
      
      for (const route of router1.routingTable) {
        ctx.fillText(route.network, tableX + 5, y);
        ctx.fillText(route.netmask, tableX + 70, y);
        ctx.fillText(route.nextHop, tableX + 140, y);
        ctx.fillText(route.metric.toString(), tableX + 210, y);
        y += 12;
      }
    }
  }

  function drawLegend() {
    const legendX = 10;
    const legendY = 10;
    const legendW = 250;
    const legendH = 100;

    // Background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(legendX, legendY, legendW, legendH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, legendW, legendH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Network Legend", legendX + legendW / 2, legendY + 18);

    // Legend items
    const items = [
      { color: HOST_COLOR, icon: "💻", text: "Host" },
      { color: ROUTER_COLOR, icon: "🌐", text: "Router" },
      { color: SWITCH_COLOR, icon: "⚡", text: "Switch" },
      { color: PACKET_COLOR, icon: "●", text: "Packet" }
    ];

    let x = legendX + 10;
    let y = legendY + 35;
    
    items.forEach((item, i) => {
      if (i === 2) {
        x = legendX + 10;
        y += 25;
      }
      
      ctx.fillStyle = item.color;
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(item.icon, x + 8, y);
      
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(item.text, x + 20, y);
      
      x += 120;
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
      lastPacketTime = 0;
      packetCounter = 0;
      initializeNetwork();
    },

    update(dt: number, params: Record<string, number>) {
      computePhysics(dt, params);
    },

    render() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      drawNetwork();
      drawPackets();
      drawLegend();
      drawControlPanel();
      drawRoutingTable();
    },

    reset() {
      time = 0;
      lastPacketTime = 0;
      packetCounter = 0;
      packets = [];
      initializeNetwork();
    },

    destroy() {
      nodes = [];
      links = [];
      packets = [];
    },

    getStateDescription(): string {
      const protocols = ["static routing", "RIP", "OSPF"];
      const avgLatency = links.reduce((sum, l) => sum + l.latency, 0) / links.length;
      
      return (
        `TCP/IP packet routing simulation with ${nodes.length} nodes and ${links.length} links. ` +
        `Using ${protocols[routingProtocol]} protocol. ${packets.length} packets currently in transit. ` +
        `Average network latency: ${avgLatency.toFixed(1)}ms. Packet generation rate: ${packetGenRate}/second. ` +
        `${showLayers ? "OSI layer visualization enabled. " : ""}` +
        `Demonstrates Internet routing principles: longest prefix matching, hop-by-hop forwarding, TTL decrement, ` +
        `and distributed packet switching across heterogeneous networks.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default TCPIPRouting;