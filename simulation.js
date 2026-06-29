/* ═══════════════════════════════════════════════════════════════
   MiniGFS — GFS Simulation Engine
   State machine, consistent hashing, node management, log gen.
   Zero deps. ~300 lines.
   ═══════════════════════════════════════════════════════════════ */

// ponytail: Simple state machine. No RxJS, no xstate. Switch statement is fine.

// ─── Consistent Hash Ring ───
class HashRing {
  constructor(vnodeCount = 3) {
    this.vnodeCount = vnodeCount;
    this.nodes = new Map(); // id → { label, angles[] }
    this.ring = []; // sorted array of { angle, nodeId }
  }

  // Simple hash: string → 0..2π
  hash(key) {
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) - h + key.charCodeAt(i)) | 0;
    }
    return ((h >>> 0) / 0xFFFFFFFF) * Math.PI * 2;
  }

  addNode(id, label) {
    const angles = [];
    for (let v = 0; v < this.vnodeCount; v++) {
      const angle = this.hash(`${id}-vnode-${v}`);
      angles.push(angle);
      this.ring.push({ angle, nodeId: id });
    }
    // Primary angle (for display)
    const primaryAngle = this.hash(id);
    this.nodes.set(id, { label, primaryAngle, vnodeAngles: angles });
    this.ring.sort((a, b) => a.angle - b.angle);
  }

  removeNode(id) {
    this.ring = this.ring.filter(r => r.nodeId !== id);
    this.nodes.delete(id);
  }

  lookup(key) {
    if (this.ring.length === 0) return null;
    const angle = this.hash(key);
    for (const entry of this.ring) {
      if (entry.angle >= angle) return entry.nodeId;
    }
    return this.ring[0].nodeId; // wrap around
  }

  getNodePositions() {
    const result = [];
    for (const [id, info] of this.nodes) {
      result.push({
        id,
        label: info.label,
        angle: info.primaryAngle,
        vnodes: info.vnodeAngles,
      });
    }
    return result;
  }

  getChunkDistribution(chunkCount = 100) {
    const dist = {};
    for (const [id] of this.nodes) dist[id] = 0;
    for (let i = 0; i < chunkCount; i++) {
      const node = this.lookup(`chunk-${i}`);
      if (node) dist[node] = (dist[node] || 0) + 1;
    }
    return dist;
  }
}

// ─── Simulation States ───
const SimState = {
  IDLE: 'IDLE',
  WRITE: 'WRITE',
  READ: 'READ',
  FAILURE: 'FAILURE',
};

// ─── Node Model ───
class ChunkserverNode {
  constructor(id, label) {
    this.id = id;
    this.label = label;
    this.online = true;
    this.utilization = 0.3 + Math.random() * 0.5; // 30-80%
    this.usedTB = +(this.utilization * 10).toFixed(1);
    this.totalTB = 10;
    this.chunks = Math.floor(150 + Math.random() * 100);
  }

  randomizeUtil() {
    this.utilization = Math.max(0.1, Math.min(0.95, this.utilization + (Math.random() - 0.5) * 0.05));
    this.usedTB = +(this.utilization * this.totalTB).toFixed(1);
  }
}

// ─── Simulation Engine ───
class SimulationEngine {
  constructor() {
    this.state = SimState.IDLE;
    this.stateTime = 0;
    this.chunkservers = [];
    this.nodeCount = 16;
    this.replicationFactor = 3;
    this.masterChunks = 2847;
    this.cycleTime = 0;
    this.cycleDuration = 15; // seconds per full cycle
    this.operationLabel = '';
    this.operationDetail = '';

    // Write operation state
    this.writePhase = 0;
    this.writePrimary = -1;
    this.writeReplicas = [];

    // Read operation state
    this.readPhase = 0;
    this.readTarget = -1;

    // Failure operation state
    this.failedNode = -1;
    this.recoveryProgress = 0;
    this.recoveryTarget = -1;

    // Animation markers
    this.activeFlows = []; // { from, to, color, progress, speed }
    this.notifications = []; // { text, color, x, y, alpha }

    this.initNodes(this.nodeCount);
  }

  initNodes(count) {
    this.chunkservers = [];
    for (let i = 0; i < count; i++) {
      this.chunkservers.push(new ChunkserverNode(i, `CS-${String(i + 1).padStart(2, '0')}`));
    }
    this.nodeCount = count;
  }

  setNodeCount(count) {
    this.initNodes(count);
    this.resetCycle();
  }

  resetCycle() {
    this.cycleTime = 0;
    this.state = SimState.IDLE;
    this.writePhase = 0;
    this.readPhase = 0;
    this.failedNode = -1;
    this.recoveryProgress = 0;
    this.activeFlows = [];
    this.notifications = [];
    this.operationLabel = '';
    this.operationDetail = '';
  }

  triggerWrite() {
    this.resetCycle();
    this.state = SimState.WRITE;
    this.cycleTime = 0;
  }

  triggerRead() {
    this.resetCycle();
    this.state = SimState.READ;
    this.cycleTime = 5;
  }

  triggerFailure() {
    this.resetCycle();
    this.state = SimState.FAILURE;
    this.cycleTime = 9;
  }

  update(dt) {
    this.cycleTime += dt;

    // Randomize utilization slowly
    if (Math.random() < 0.02) {
      const idx = Math.floor(Math.random() * this.chunkservers.length);
      if (this.chunkservers[idx]) this.chunkservers[idx].randomizeUtil();
    }

    // Update active flows
    for (const flow of this.activeFlows) {
      flow.progress += flow.speed * dt;
      if (flow.progress > 1) flow.progress -= 1;
    }

    // Fade notifications
    for (const n of this.notifications) {
      n.alpha -= dt * 0.3;
    }
    this.notifications = this.notifications.filter(n => n.alpha > 0);

    // Auto cycle
    const ct = this.cycleTime % this.cycleDuration;

    if (ct < 5) {
      this.state = SimState.WRITE;
      this.updateWrite(ct);
    } else if (ct < 9) {
      this.state = SimState.READ;
      this.updateRead(ct - 5);
    } else {
      this.state = SimState.FAILURE;
      this.updateFailure(ct - 9);
    }
  }

  updateWrite(t) {
    const nc = this.chunkservers.length;
    if (nc < 3) return;
    this.writePrimary = 2; // CS-03
    this.writeReplicas = [6, 11]; // CS-07, CS-12

    if (t < 1) {
      this.writePhase = 0;
      this.operationLabel = 'FILE WRITE';
      this.operationDetail = 'Client → Master: chunk location request';
      this.activeFlows = [{ fromType: 'client', toType: 'master', color: '#ffffff', progress: t, speed: 0.8, dashed: true }];
    } else if (t < 2) {
      this.writePhase = 1;
      this.operationDetail = 'Master → Client: chunk assignments [CS-03, CS-07, CS-12]';
      this.activeFlows = [{ fromType: 'master', toType: 'client', color: '#00D4FF', progress: t - 1, speed: 0.8, dashed: true }];
    } else if (t < 3.5) {
      this.writePhase = 2;
      this.operationDetail = 'Data pipeline: Client → CS-03 (primary)';
      this.activeFlows = [
        { fromType: 'client', toIdx: this.writePrimary, color: '#00FF88', progress: (t - 2) * 0.7, speed: 0.6, dashed: false },
      ];
    } else if (t < 5) {
      this.writePhase = 3;
      this.operationDetail = '3x REPLICATED ✓';
      this.activeFlows = [
        { fromIdx: this.writePrimary, toIdx: this.writeReplicas[0], color: '#FFB800', progress: (t - 3.5) * 0.7, speed: 0.5, dashed: false },
        { fromIdx: this.writePrimary, toIdx: this.writeReplicas[1], color: '#FFB800', progress: (t - 3.5) * 0.6, speed: 0.5, dashed: false },
      ];
    }
  }

  updateRead(t) {
    const nc = this.chunkservers.length;
    this.readTarget = Math.min(6, nc - 1); // CS-07

    if (t < 1) {
      this.readPhase = 0;
      this.operationLabel = 'FILE READ';
      this.operationDetail = 'Client → Master: read request';
      this.activeFlows = [{ fromType: 'client', toType: 'master', color: '#ffffff', progress: t, speed: 0.8, dashed: true }];
    } else if (t < 2) {
      this.readPhase = 1;
      this.operationDetail = 'Master → Client: chunk locations (nearest CS-07)';
      this.activeFlows = [{ fromType: 'master', toType: 'client', color: '#00D4FF', progress: t - 1, speed: 0.8, dashed: true }];
    } else if (t < 4) {
      this.readPhase = 2;
      this.operationDetail = '2.1 GB/s aggregate read + prefetch';
      this.activeFlows = [
        { fromIdx: this.readTarget, toType: 'client', color: '#00FF88', progress: (t - 2) * 0.5, speed: 0.7, dashed: false },
        { fromIdx: Math.min(this.readTarget + 1, nc - 1), toType: 'client', color: '#00FF88', progress: (t - 2.3) * 0.4, speed: 0.6, dashed: false },
      ];
    }
  }

  updateFailure(t) {
    const nc = this.chunkservers.length;
    this.failedNode = Math.min(6, nc - 1); // CS-07
    this.recoveryTarget = Math.min(8, nc - 1); // CS-09

    if (t < 1) {
      this.operationLabel = '⚠ NODE FAILURE';
      this.operationDetail = `CS-${String(this.failedNode + 1).padStart(2, '0')} HEARTBEAT TIMEOUT`;
      if (this.chunkservers[this.failedNode]) this.chunkservers[this.failedNode].online = false;
      this.activeFlows = [];
      this.recoveryProgress = 0;
    } else if (t < 3) {
      this.operationDetail = `RE-REPLICATING... ${Math.floor(((t - 1) / 2) * 100)}%`;
      this.recoveryProgress = (t - 1) / 2;
      this.activeFlows = [
        { fromIdx: Math.min(2, nc - 1), toIdx: this.recoveryTarget, color: '#FFB800', progress: (t - 1) * 0.5, speed: 0.6, dashed: false },
      ];
    } else {
      this.operationDetail = '3x REPLICATION RESTORED ✓ — 487ms';
      this.recoveryProgress = 1;
      if (this.chunkservers[this.failedNode]) this.chunkservers[this.failedNode].online = true;
      this.activeFlows = [];
    }
  }

  getHighlightedNodes() {
    const highlights = {};
    if (this.state === SimState.WRITE && this.writePhase >= 2) {
      highlights[this.writePrimary] = 'primary';
      for (const r of this.writeReplicas) highlights[r] = 'replica';
    }
    if (this.state === SimState.READ && this.readPhase >= 2) {
      highlights[this.readTarget] = 'read';
    }
    if (this.state === SimState.FAILURE) {
      highlights[this.failedNode] = this.recoveryProgress < 1 ? 'failed' : 'recovered';
      if (this.recoveryProgress > 0) highlights[this.recoveryTarget] = 'recovery-target';
    }
    return highlights;
  }
}

// ─── Operation Log Generator ───
class OperationLog {
  constructor() {
    this.entries = [];
    this.maxEntries = 12;
    this.timer = 0;
  }

  update(dt) {
    this.timer += dt;
    if (this.timer >= 0.8) {
      this.timer = 0;
      this.addEntry();
    }
  }

  addEntry() {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const ops = [
      { type: 'WRITE', cls: 'op-write', gen: () => `data/${this.randomFile()} → CS-${this.rn()},CS-${this.rn()},CS-${this.rn()} ✓` },
      { type: 'READ', cls: 'op-read', gen: () => `data/${this.randomFile()} ← CS-${this.rn()} (prefetch: +2) ✓` },
      { type: 'APPEND', cls: 'op-append', gen: () => `logs/${this.randomLog()} → CS-${this.rn()} [ATOMIC] ✓` },
      { type: 'HBEAT', cls: 'op-hbeat', gen: () => `CS-${this.rn()} → MASTER [ALIVE] ✓` },
      { type: 'REPL', cls: 'op-repl', gen: () => `Chunk#${Math.floor(Math.random() * 2847)} CS-${this.rn()}→CS-${this.rn()} [3x RESTORED] ✓` },
    ];

    const op = ops[Math.floor(Math.random() * ops.length)];
    this.entries.push({
      time,
      type: op.type,
      cls: op.cls,
      detail: op.gen(),
    });

    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  rn() {
    return String(Math.floor(Math.random() * 16) + 1).padStart(2, '0');
  }

  randomFile() {
    const files = ['model.bin', 'weights.pt', 'batch_32.bin', 'embeddings.h5', 'dataset.csv', 'checkpoint.ckpt', 'features.npy'];
    return files[Math.floor(Math.random() * files.length)];
  }

  randomLog() {
    const logs = ['train.log', 'eval.log', 'metrics.log', 'system.log'];
    return logs[Math.floor(Math.random() * logs.length)];
  }
}

// Export
window.Simulation = {
  HashRing,
  SimulationEngine,
  SimState,
  OperationLog,
};
