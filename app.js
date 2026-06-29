/* ═══════════════════════════════════════════════════════════════
   MiniGFS — Main Application
   Scene orchestration, boot sequence, topology renderer,
   interactivity, scroll animations. Zero deps.
   ═══════════════════════════════════════════════════════════════ */

// ponytail: One file orchestrates everything. No React, no components, no virtual DOM.

(function () {
  'use strict';

  const CE = window.CanvasEngine;
  const SIM = window.Simulation;

  // ─── Globals ───
  let sim, opLog, hashRing, particles;
  let topologyCanvas, topologyCtx, topologyW, topologyH;
  let ringCanvas, ringCtx, ringW, ringH;
  let throughputCanvas, throughputCtx;
  let throughputData = [];
  let lastTime = 0;
  let bootDone = false;

  // Ring state
  let ringNodeCount = 16;
  let ringRemovedNode = null;
  let ringChunks = [];
  let ringComparisonVisible = false;

  // ═══════════════════════════════════════════════════════════════
  // SCENE 1 — BOOT SEQUENCE
  // ═══════════════════════════════════════════════════════════════

  const bootLines = [
    { text: '> Initializing MiniGFS v1.0...', tag: null },
    { text: '> Loading Master Node............', tag: '[OK]', tagClass: 'ok-tag' },
    { text: '> Registering Chunkserver-01.....', tag: '[OK]', tagClass: 'ok-tag' },
    { text: '> Registering Chunkserver-02.....', tag: '[OK]', tagClass: 'ok-tag' },
    { text: '> Registering Chunkserver-03.....', tag: '[OK]', tagClass: 'ok-tag' },
    { text: '> Replication Factor: 3x.........', tag: '[SET]', tagClass: 'set-tag' },
    { text: '> Heartbeat Protocol..............', tag: '[ACTIVE]', tagClass: 'active-tag' },
    { text: '> Consistent Hashing Ring.........', tag: '[READY]', tagClass: 'ready-tag' },
    { text: '> System Status: OPERATIONAL ✓', tag: null, tagClass: 'status-ok', fullClass: true },
  ];

  function runBootSequence() {
    const container = document.getElementById('boot-terminal-lines');
    const counter = document.getElementById('boot-throughput');
    let lineIdx = 0;
    let charIdx = 0;
    let throughputVal = 0;

    // Throughput counter
    const counterInterval = setInterval(() => {
      throughputVal = Math.min(2.1, throughputVal + 0.03 + Math.random() * 0.02);
      counter.textContent = throughputVal.toFixed(1);
    }, 30);

    function typeLine() {
      if (lineIdx >= bootLines.length) {
        clearInterval(counterInterval);
        counter.textContent = '2.1';
        setTimeout(endBoot, 800);
        return;
      }

      const line = bootLines[lineIdx];
      const el = document.createElement('div');
      el.className = 'boot-line';
      container.appendChild(el);

      // Make visible
      requestAnimationFrame(() => el.classList.add('visible'));

      const fullText = line.text;
      charIdx = 0;

      function typeChar() {
        if (charIdx <= fullText.length) {
          let content = fullText.substring(0, charIdx);
          el.innerHTML = content + '<span class="boot-cursor"></span>';
          charIdx++;
          if (window.SFX) SFX.playKeyClick();
          setTimeout(typeChar, 25 + Math.random() * 30);
        } else {
          // Add tag
          if (line.tag) {
            el.innerHTML = fullText + ' <span class="' + line.tagClass + ' flash">' + line.tag + '</span>';
            if (window.SFX) SFX.playBootOk();
          } else if (line.fullClass) {
            el.innerHTML = '<span class="' + line.tagClass + '">' + fullText + '</span>';
          } else {
            el.innerHTML = fullText;
          }
          lineIdx++;
          setTimeout(typeLine, 150);
        }
      }

      typeChar();
    }

    // Start after brief pause
    setTimeout(typeLine, 500);
  }

  function endBoot() {
    if (window.SFX) SFX.playBootComplete();
    const bootScreen = document.getElementById('boot-screen');
    bootScreen.classList.add('fade-out');
    setTimeout(() => {
      bootScreen.classList.add('hidden');
      document.body.style.overflow = '';
      bootDone = true;
      showHero();
    }, 1000);
  }

  function showHero() {
    const heroContent = document.querySelector('.hero-content');
    heroContent.classList.add('visible');

    // Animate badges sequentially
    const badges = document.querySelectorAll('.tech-badge');
    badges.forEach((badge, i) => {
      setTimeout(() => {
        badge.classList.add('visible');
        setTimeout(() => badge.classList.add('pulse'), 300);
      }, 300 + i * 200);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // SCENE 2 — NETWORK TOPOLOGY
  // ═══════════════════════════════════════════════════════════════

  function initTopology() {
    topologyCanvas = document.getElementById('topology-canvas');
    const container = topologyCanvas.parentElement;
    topologyW = container.clientWidth;
    topologyH = container.clientHeight;
    topologyCtx = CE.setupCanvas(topologyCanvas, topologyW, topologyH);

    sim = new SIM.SimulationEngine();
    opLog = new SIM.OperationLog();

    // Controls
    document.getElementById('btn-sim-write').addEventListener('click', () => { sim.triggerWrite(); if (window.SFX) SFX.playWhoosh(); });
    document.getElementById('btn-sim-read').addEventListener('click', () => { sim.triggerRead(); if (window.SFX) SFX.playWhoosh(); });
    document.getElementById('btn-sim-failure').addEventListener('click', () => { sim.triggerFailure(); if (window.SFX) SFX.playAlert(); });

    const nodeSlider = document.getElementById('node-slider');
    const nodeVal = document.getElementById('node-slider-val');
    nodeSlider.addEventListener('input', (e) => {
      const count = parseInt(e.target.value);
      nodeVal.textContent = count;
      sim.setNodeCount(count);
    });

    const replBtns = document.querySelectorAll('.repl-btn');
    replBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        replBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sim.replicationFactor = parseInt(btn.dataset.repl);
      });
    });

    // Tooltip on hover
    topologyCanvas.addEventListener('mousemove', handleTooltip);
    topologyCanvas.addEventListener('mouseleave', hideTooltip);
  }

  function getNodePositions() {
    const nodes = [];
    const padding = 60;
    const w = topologyW;
    const h = topologyH;

    // Master node — center top
    const masterX = w / 2;
    const masterY = h * 0.15;
    nodes.push({ type: 'master', x: masterX, y: masterY, size: 28, label: 'MASTER' });

    // Client node — left side
    const clientX = w * 0.1;
    const clientY = h * 0.45;
    nodes.push({ type: 'client', x: clientX, y: clientY, w: 70, h: 40, label: 'CLIENT' });

    // Chunkservers — curved arc below master
    const csCount = sim.nodeCount;
    const arcCenterX = w / 2;
    const arcCenterY = h * 0.35;
    const arcRadius = Math.min(w * 0.38, h * 0.35);
    const arcStart = Math.PI * 0.15;
    const arcEnd = Math.PI * 0.85;

    for (let i = 0; i < csCount; i++) {
      const t = csCount === 1 ? 0.5 : i / (csCount - 1);
      const angle = arcStart + (arcEnd - arcStart) * t;
      const x = arcCenterX + arcRadius * Math.cos(angle);
      const y = arcCenterY + arcRadius * Math.sin(angle);
      nodes.push({
        type: 'chunkserver',
        idx: i,
        x, y,
        size: 16,
        label: sim.chunkservers[i]?.label || `CS-${String(i + 1).padStart(2, '0')}`,
        cs: sim.chunkservers[i],
      });
    }

    return nodes;
  }

  function renderTopology(time) {
    const ctx = topologyCtx;
    ctx.clearRect(0, 0, topologyW, topologyH);

    const nodePositions = getNodePositions();
    const highlights = sim.getHighlightedNodes();
    const master = nodePositions[0];
    const client = nodePositions[1];
    const chunkservers = nodePositions.slice(2);

    // ─── Draw connections first (behind nodes) ───
    // Master ↔ Chunkserver heartbeat lines
    for (const cs of chunkservers) {
      if (!cs.cs || !cs.cs.online) continue;
      const pulse = (Math.sin(time * 2 + cs.idx * 0.5) + 1) / 2;
      CE.drawFlowLine(ctx, master.x, master.y, cs.x, cs.y, CE.COLORS.blue, pulse, 1, 0.5, true);
    }

    // Client → Master control flow
    CE.drawFlowLine(ctx, client.x + client.w / 2, client.y, master.x, master.y, '#ffffff', -1, 0, 0.5, true);

    // Active data flows from simulation
    for (const flow of sim.activeFlows) {
      let fx, fy, tx, ty;

      if (flow.fromType === 'client') { fx = client.x + client.w / 2; fy = client.y; }
      else if (flow.fromType === 'master') { fx = master.x; fy = master.y; }
      else if (flow.fromIdx !== undefined && chunkservers[flow.fromIdx]) { fx = chunkservers[flow.fromIdx].x; fy = chunkservers[flow.fromIdx].y; }
      else continue;

      if (flow.toType === 'client') { tx = client.x + client.w / 2; ty = client.y; }
      else if (flow.toType === 'master') { tx = master.x; ty = master.y; }
      else if (flow.toIdx !== undefined && chunkservers[flow.toIdx]) { tx = chunkservers[flow.toIdx].x; ty = chunkservers[flow.toIdx].y; }
      else continue;

      CE.drawFlowLine(ctx, fx, fy, tx, ty, flow.color, flow.progress, 4, flow.dashed ? 1 : 2, flow.dashed);
    }

    // ─── Draw nodes ───
    // Master (hexagon, blue)
    const masterPulse = (Math.sin(time * 3) + 1) / 2;
    CE.drawHexagon(ctx, master.x, master.y, master.size, CE.COLORS.blue, 0.3 + masterPulse * 0.7);
    CE.drawLabel(ctx, '♛', master.x, master.y - 2, CE.COLORS.blue, 14);
    CE.drawLabel(ctx, master.label, master.x, master.y + master.size + 14, CE.COLORS.blue, 10);

    // Client (rounded rect, purple)
    CE.drawRoundedRect(ctx, client.x - client.w / 2, client.y - client.h / 2, client.w, client.h, 8, CE.COLORS.purple, 0.5);
    CE.drawLabel(ctx, client.label, client.x, client.y, CE.COLORS.purple, 11);

    // Read/Write indicators for client
    if (sim.state === SIM.SimState.WRITE) {
      CE.drawLabelGlow(ctx, '📄 data.bin 256MB', client.x, client.y - 30, CE.COLORS.amber, 9);
    }

    // Chunkservers
    for (const cs of chunkservers) {
      if (!cs.cs) continue;
      const hl = highlights[cs.idx];
      let color = CE.COLORS.green;
      let glow = 0.3;

      if (!cs.cs.online) { color = CE.COLORS.red; glow = 0.8; }
      else if (hl === 'primary') { color = CE.COLORS.green; glow = 1; }
      else if (hl === 'replica') { color = CE.COLORS.amber; glow = 0.8; }
      else if (hl === 'read') { color = CE.COLORS.green; glow = 1; }
      else if (hl === 'failed') { color = CE.COLORS.red; glow = 1; }
      else if (hl === 'recovered') { color = CE.COLORS.green; glow = 1; }
      else if (hl === 'recovery-target') { color = CE.COLORS.amber; glow = 0.8; }

      CE.drawHexagon(ctx, cs.x, cs.y, cs.size, color, glow);
      CE.drawLabel(ctx, cs.label, cs.x, cs.y - 1, color, 8);

      // Health bar below node
      CE.drawHealthBar(ctx, cs.x - 16, cs.y + cs.size + 6, 32, 3, cs.cs.utilization, color);

      // Checkmark for replicated
      if (hl === 'replica' && sim.writePhase >= 3) {
        CE.drawLabelGlow(ctx, '✓', cs.x + cs.size + 8, cs.y, CE.COLORS.green, 12);
      }
      if (hl === 'recovered') {
        CE.drawLabelGlow(ctx, '✓', cs.x + cs.size + 8, cs.y, CE.COLORS.green, 12);
      }

      // Failed node warning
      if (hl === 'failed' && sim.recoveryProgress < 1) {
        CE.drawLabelGlow(ctx, '⚠', cs.x + cs.size + 8, cs.y, CE.COLORS.red, 14);
      }
    }

    // ─── Operation label ───
    if (sim.operationLabel) {
      const labelColor = sim.state === SIM.SimState.FAILURE ? CE.COLORS.red : CE.COLORS.blue;
      CE.drawLabel(ctx, sim.operationLabel, topologyW / 2, topologyH - 50, labelColor, 13, 'center', 'Space Grotesk');
      CE.drawLabel(ctx, sim.operationDetail, topologyW / 2, topologyH - 30, CE.COLORS.textDim, 11);
    }

    // Recovery progress bar
    if (sim.state === SIM.SimState.FAILURE && sim.recoveryProgress > 0 && sim.recoveryProgress < 1) {
      const barW = 200;
      const barX = topologyW / 2 - barW / 2;
      const barY = topologyH - 70;
      CE.drawHealthBar(ctx, barX, barY, barW, 6, sim.recoveryProgress, CE.COLORS.amber);
      CE.drawLabel(ctx, `RE-REPLICATING... ${Math.floor(sim.recoveryProgress * 100)}%`, topologyW / 2, barY - 10, CE.COLORS.amber, 10);
    }
  }

  // ─── Tooltip ───
  function handleTooltip(e) {
    const rect = topologyCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const nodes = getNodePositions();
    const tooltip = document.getElementById('node-tooltip');

    for (const n of nodes) {
      const dist = Math.hypot(mx - (n.x || n.x), my - (n.y || n.y));
      const hitRadius = n.size || 30;
      if (dist < hitRadius + 10) {
        tooltip.classList.add('visible');
        tooltip.style.left = (e.clientX - topologyCanvas.closest('.topology-container').getBoundingClientRect().left + 15) + 'px';
        tooltip.style.top = (e.clientY - topologyCanvas.closest('.topology-container').getBoundingClientRect().top - 10) + 'px';

        if (n.type === 'master') {
          tooltip.innerHTML = `
            <div class="tt-title">MASTER NODE</div>
            <div class="tt-row"><span class="tt-label">Status:</span> <span class="tt-status">● ONLINE</span></div>
            <div class="tt-row"><span class="tt-label">Chunks Tracked:</span> <span class="tt-value">${sim.masterChunks.toLocaleString()}</span></div>
            <div class="tt-row"><span class="tt-label">Active Servers:</span> <span class="tt-value">${sim.nodeCount}</span></div>
            <div class="tt-row"><span class="tt-label">Namespace Size:</span> <span class="tt-value">48.3 MB</span></div>
            <div class="tt-row"><span class="tt-label">Heartbeat:</span> <span class="tt-value">500ms</span></div>`;
        } else if (n.type === 'client') {
          tooltip.innerHTML = `
            <div class="tt-title" style="color: #A855F7">CLIENT NODE</div>
            <div class="tt-row"><span class="tt-label">Status:</span> <span class="tt-status">● CONNECTED</span></div>
            <div class="tt-row"><span class="tt-label">Operations:</span> <span class="tt-value">READ / WRITE</span></div>`;
        } else if (n.cs) {
          const statusColor = n.cs.online ? '#00FF88' : '#FF4444';
          const statusText = n.cs.online ? '● ONLINE' : '● OFFLINE';
          tooltip.innerHTML = `
            <div class="tt-title" style="color: ${statusColor}">${n.label}</div>
            <div class="tt-row"><span class="tt-label">Status:</span> <span style="color:${statusColor}">${statusText}</span></div>
            <div class="tt-row"><span class="tt-label">Storage:</span> <span class="tt-value">${n.cs.usedTB} TB / ${n.cs.totalTB} TB</span></div>
            <div class="tt-row"><span class="tt-label">Chunks:</span> <span class="tt-value">${n.cs.chunks}</span></div>
            <div class="tt-row"><span class="tt-label">Utilization:</span> <span class="tt-value">${Math.floor(n.cs.utilization * 100)}%</span></div>`;
        }
        return;
      }
    }
    hideTooltip();
  }

  function hideTooltip() {
    document.getElementById('node-tooltip').classList.remove('visible');
  }

  // ═══════════════════════════════════════════════════════════════
  // SCENE 3 — CONSISTENT HASHING RING
  // ═══════════════════════════════════════════════════════════════

  function initRing() {
    ringCanvas = document.getElementById('ring-canvas');
    const wrap = ringCanvas.parentElement;
    ringW = wrap.clientWidth;
    ringH = wrap.clientHeight || ringW;
    ringCtx = CE.setupCanvas(ringCanvas, ringW, ringH);

    hashRing = new SIM.HashRing(3);
    for (let i = 0; i < ringNodeCount; i++) {
      hashRing.addNode(`node-${i}`, `CS-${String(i + 1).padStart(2, '0')}`);
    }

    // Place sample chunks
    ringChunks = [];
    for (let i = 0; i < 20; i++) {
      const key = `chunk-${i}`;
      const angle = hashRing.hash(key);
      const assignedNode = hashRing.lookup(key);
      const colors = [CE.COLORS.blue, CE.COLORS.green, CE.COLORS.amber, CE.COLORS.purple];
      ringChunks.push({
        key,
        angle,
        assignedNode,
        color: colors[i % colors.length],
        showArrow: i < 8,
      });
    }

    // Controls
    document.getElementById('btn-ring-add').addEventListener('click', addRingNode);
    document.getElementById('btn-ring-remove').addEventListener('click', removeRingNode);

    updateRingStats();
  }

  function addRingNode() {
    if (ringNodeCount >= 16) return;
    ringNodeCount++;
    hashRing.addNode(`node-${ringNodeCount - 1}`, `CS-${String(ringNodeCount).padStart(2, '0')}`);
    recalcChunks();
    updateRingStats();
    ringRemovedNode = null;
    hideRingComparison();
  }

  function removeRingNode() {
    if (ringNodeCount <= 1) return;
    const removeId = `node-${ringNodeCount - 1}`;
    ringRemovedNode = removeId;
    ringNodeCount--;
    hashRing.removeNode(removeId);

    // Count remapped chunks
    let remapped = 0;
    for (const chunk of ringChunks) {
      const newNode = hashRing.lookup(chunk.key);
      if (newNode !== chunk.assignedNode) {
        remapped++;
        chunk.assignedNode = newNode;
      }
    }

    const pct = Math.floor((remapped / ringChunks.length) * 100);
    showRingComparison(pct, remapped);
    updateRingStats();
  }

  function recalcChunks() {
    for (const chunk of ringChunks) {
      chunk.assignedNode = hashRing.lookup(chunk.key);
    }
  }

  function showRingComparison(pct, count) {
    const el = document.getElementById('ring-comparison');
    el.innerHTML = `Minimal Disruption: Only ${count} chunks remapped (${pct}%)<br>Traditional: ~94% remapped | Consistent Hashing: ~${pct}% remapped`;
    el.classList.add('visible');
  }

  function hideRingComparison() {
    document.getElementById('ring-comparison').classList.remove('visible');
  }

  function updateRingStats() {
    document.getElementById('ring-total-nodes').textContent = ringNodeCount;
    document.getElementById('ring-vnodes').textContent = '3';
    document.getElementById('ring-total-points').textContent = ringNodeCount * 3;
    document.getElementById('ring-chunks').textContent = ringChunks.length.toLocaleString();

    // Compute load std deviation
    const dist = hashRing.getChunkDistribution(ringChunks.length);
    const vals = Object.values(dist);
    if (vals.length > 0) {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length;
      const stdPct = mean > 0 ? ((Math.sqrt(variance) / mean) * 100).toFixed(1) : '0.0';
      document.getElementById('ring-load-std').textContent = `±${stdPct}%`;
    }
  }

  function renderRing(time) {
    const ctx = ringCtx;
    ctx.clearRect(0, 0, ringW, ringH);

    const cx = ringW / 2;
    const cy = ringH / 2;
    const radius = Math.min(ringW, ringH) * 0.38;

    const nodes = hashRing.getNodePositions();
    CE.drawHashRing(ctx, cx, cy, radius, nodes, ringChunks, null, ringRemovedNode, time);
  }

  // ═══════════════════════════════════════════════════════════════
  // SCENE 4 — METRICS DASHBOARD
  // ═══════════════════════════════════════════════════════════════

  function initMetrics() {
    throughputCanvas = document.getElementById('throughput-canvas');
    const wrap = throughputCanvas.parentElement;
    throughputCtx = CE.setupCanvas(throughputCanvas, wrap.clientWidth, 150);

    // Seed throughput data
    for (let i = 0; i < 60; i++) {
      throughputData.push(1.5 + Math.random() * 0.6);
    }

    // Animated counters (Intersection Observer)
    const counterEls = document.querySelectorAll('.counter-animate');
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counterEls.forEach(el => counterObserver.observe(el));

    // Render gauge
    renderGauge();
  }

  function animateCounter(el) {
    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const decimals = parseInt(el.dataset.decimals || '0');
    const duration = 1500;
    const start = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = target * eased;
      el.textContent = prefix + (decimals > 0 ? current.toFixed(decimals) : Math.floor(current).toLocaleString()) + suffix;
      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  }

  function renderGauge() {
    const svgGauge = document.getElementById('fault-gauge');
    if (!svgGauge) return;
    // Use Canvas gauge instead
    const gaugeCanvas = document.getElementById('gauge-canvas');
    if (!gaugeCanvas) return;
    const gCtx = CE.setupCanvas(gaugeCanvas, 160, 100);
    CE.drawGauge(gCtx, 80, 80, 55, 487, 1000, CE.COLORS.green);
  }

  function updateThroughput(time) {
    // Add new data point
    if (throughputData.length > 60) throughputData.shift();
    const newVal = 1.6 + Math.sin(time * 0.5) * 0.3 + Math.random() * 0.3;
    throughputData.push(newVal);

    // Render
    const ctx = throughputCtx;
    const w = throughputCanvas.width / (window.devicePixelRatio || 1);
    const h = 150;
    ctx.clearRect(0, 0, w, h);
    CE.drawLineChart(ctx, throughputData, 40, 10, w - 50, h - 30, CE.COLORS.green, 2.5, 'GB/s');
  }

  function updateOpLog() {
    const container = document.getElementById('op-log-container');
    if (!container) return;

    container.innerHTML = '';
    for (const entry of opLog.entries) {
      const el = document.createElement('div');
      el.className = 'op-log-entry';
      el.innerHTML = `<span class="time">[${entry.time}]</span> <span class="${entry.cls}">${entry.type.padEnd(6)}</span> ${entry.detail}`;
      container.appendChild(el);
    }

    container.scrollTop = container.scrollHeight;
  }

  // ═══════════════════════════════════════════════════════════════
  // SCENE 5 — ATOMIC APPEND (Pipeline Animation)
  // ═══════════════════════════════════════════════════════════════

  function initAppendFlow() {
    // Pipeline animation
    const pipelineNodes = document.querySelectorAll('.pipeline-node');
    let activeIdx = 0;

    setInterval(() => {
      pipelineNodes.forEach((n, i) => {
        n.classList.toggle('active', i <= activeIdx);
      });
      activeIdx = (activeIdx + 1) % (pipelineNodes.length + 1);
      if (activeIdx === 0) {
        pipelineNodes.forEach(n => n.classList.remove('active'));
      }
    }, 600);

    // Failure toggle
    const failBtn = document.getElementById('btn-append-failure');
    const failResult = document.getElementById('append-failure-result');
    if (failBtn) {
      failBtn.addEventListener('click', () => {
        failBtn.classList.toggle('active');
        failResult.classList.toggle('visible');
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SCROLL ANIMATIONS (Intersection Observer)
  // ═══════════════════════════════════════════════════════════════

  function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.metric-card, .stack-card, .append-step, .fade-in').forEach(el => {
      observer.observe(el);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PARTICLES
  // ═══════════════════════════════════════════════════════════════

  function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    particles = new CE.ParticleSystem(canvas);

    window.addEventListener('resize', () => particles.resize());
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN ANIMATION LOOP
  // ═══════════════════════════════════════════════════════════════

  function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // cap delta
    lastTime = timestamp;

    if (bootDone) {
      // Update simulation
      sim.update(dt);
      opLog.update(dt);

      // Render canvases
      renderTopology(timestamp / 1000);
      renderRing(timestamp / 1000);
      updateThroughput(timestamp / 1000);

      // Update operation log DOM (throttle to ~1.2x per second)
      if (Math.floor(timestamp / 800) !== Math.floor((timestamp - dt * 1000) / 800)) {
        updateOpLog();
      }

      // Particles
      if (particles) {
        particles.update();
        particles.draw();
      }
    }

    requestAnimationFrame(loop);
  }

  // ═══════════════════════════════════════════════════════════════
  // RESIZE HANDLER
  // ═══════════════════════════════════════════════════════════════

  function handleResize() {
    // Topology canvas
    if (topologyCanvas) {
      const container = topologyCanvas.parentElement;
      topologyW = container.clientWidth;
      topologyH = container.clientHeight;
      topologyCtx = CE.setupCanvas(topologyCanvas, topologyW, topologyH);
    }

    // Ring canvas
    if (ringCanvas) {
      const wrap = ringCanvas.parentElement;
      ringW = wrap.clientWidth;
      ringH = wrap.clientHeight || ringW;
      ringCtx = CE.setupCanvas(ringCanvas, ringW, ringH);
    }

    // Throughput canvas
    if (throughputCanvas) {
      const wrap = throughputCanvas.parentElement;
      throughputCtx = CE.setupCanvas(throughputCanvas, wrap.clientWidth, 150);
    }

    // Gauge
    renderGauge();
  }

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleResize, 200);
  });

  // ═══════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════

  function init() {
    document.body.style.overflow = 'hidden'; // Lock during boot

    // Check reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.getElementById('boot-screen').classList.add('hidden');
      document.body.style.overflow = '';
      bootDone = true;
      document.querySelector('.hero-content').classList.add('visible');
      document.querySelectorAll('.tech-badge').forEach(b => b.classList.add('visible'));
    } else {
      runBootSequence();
    }

    // Sound toggle
    const soundBtn = document.getElementById('sound-toggle');
    const soundIcon = document.getElementById('sound-icon');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const wasMuted = window.SFX ? SFX.isMuted() : true;
        if (window.SFX) SFX.setMuted(!wasMuted);
        soundBtn.classList.toggle('active', wasMuted);
        soundIcon.textContent = wasMuted ? '🔊' : '🔇';
      });
    }

    initParticles();
    initTopology();
    initRing();
    initMetrics();
    initAppendFlow();
    initScrollAnimations();

    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
