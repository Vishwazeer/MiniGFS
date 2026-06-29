const COLORS = {
  bg: '#0A0A0F',
  blue: '#00D4FF',
  green: '#00FF88',
  amber: '#FFB800',
  red: '#FF4444',
  purple: '#A855F7',
  text: '#E8E8E8',
  textDim: '#8888AA',
  textMuted: '#555577',
  line: 'rgba(255,255,255,0.06)',
  lineFaint: 'rgba(255,255,255,0.03)',
};

// Hexagon
function drawHexagon(ctx, x, y, size, color, glowIntensity = 0, fill = true) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  if (glowIntensity > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 15 * glowIntensity;
  }

  if (fill) {
    ctx.fillStyle = color + '18';
    ctx.fill();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

// Rounded rect
function drawRoundedRect(ctx, x, y, w, h, r, color, glowIntensity = 0) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  if (glowIntensity > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 * glowIntensity;
  }

  ctx.fillStyle = color + '12';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

// Data flow
function drawFlowLine(ctx, fromX, fromY, toX, toY, color, progress = 0, dotCount = 3, lineWidth = 1, dashed = false) {
  ctx.save();
  ctx.beginPath();
  if (dashed) ctx.setLineDash([4, 6]);
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.strokeStyle = color + '30';
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.setLineDash([]);

  if (progress >= 0) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    for (let i = 0; i < dotCount; i++) {
      const t = ((progress + i / dotCount) % 1);
      const px = fromX + dx * t;
      const py = fromY + dy * t;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.fill();
    }
  }
  ctx.restore();
}

// Health bar
function drawHealthBar(ctx, x, y, width, height, percent, color) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, height / 2);
  ctx.fill();
  const fw = width * Math.max(0, Math.min(1, percent));
  if (fw > 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, fw, height, height / 2);
    ctx.fill();
  }
  ctx.restore();
}

// Label text
function drawLabel(ctx, text, x, y, color = COLORS.text, size = 11, align = 'center', font = 'JetBrains Mono') {
  ctx.save();
  ctx.font = `${size}px '${font}', monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Glowing text
function drawLabelGlow(ctx, text, x, y, color, size = 11) {
  ctx.save();
  ctx.font = `bold ${size}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Particles
class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.init();
  }

  init() {
    const count = Math.min(40, Math.floor(this.canvas.width * this.canvas.height / 30000));
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle() {
    const colors = [COLORS.blue, COLORS.green, COLORS.amber];
    return {
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: Math.random() * 0.3 + 0.05,
    };
  }

  update() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.restore();
    }
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.init();
  }
}

// Throughput chart
function drawLineChart(ctx, data, x, y, w, h, color, maxVal, label) {
  ctx.save();

  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const gy = y + (h / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const val = (maxVal - (maxVal / gridLines) * i).toFixed(1);
    drawLabel(ctx, val, x - 8, gy, COLORS.textMuted, 9, 'right');
  }

  if (data.length < 2) { ctx.restore(); return; }

  ctx.beginPath();
  const step = w / (data.length - 1);
  for (let i = 0; i < data.length; i++) {
    const px = x + step * i;
    const py = y + h - (data[i] / maxVal) * h;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.stroke();

  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, color + '30');
  grad.addColorStop(1, color + '00');
  ctx.fillStyle = grad;
  ctx.shadowBlur = 0;
  ctx.fill();

  const maxIdx = data.indexOf(Math.max(...data));
  const peakX = x + step * maxIdx;
  const peakY = y + h - (data[maxIdx] / maxVal) * h;
  ctx.beginPath();
  ctx.arc(peakX, peakY, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fill();

  drawLabel(ctx, `${data[maxIdx].toFixed(1)} ${label}`, peakX, peakY - 14, color, 10);

  ctx.restore();
}

// Hash ring
function drawHashRing(ctx, cx, cy, radius, nodes, chunks, highlightNode, removedNode, time) {
  ctx.save();

  const ringGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  ringGrad.addColorStop(0, COLORS.blue);
  ringGrad.addColorStop(0.5, COLORS.green);
  ringGrad.addColorStop(1, COLORS.purple);

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius - 12, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  ctx.stroke();

  for (const node of nodes) {
    if (node.id === removedNode) continue;
    const angle = node.angle;
    const nx = cx + radius * Math.cos(angle);
    const ny = cy + radius * Math.sin(angle);

    ctx.beginPath();
    ctx.arc(nx, ny, 7, 0, Math.PI * 2);
    ctx.fillStyle = node.id === highlightNode ? COLORS.amber : COLORS.green;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    const labelDist = radius + 22;
    const lx = cx + labelDist * Math.cos(angle);
    const ly = cy + labelDist * Math.sin(angle);
    drawLabel(ctx, node.label, lx, ly, COLORS.textDim, 9);

    if (node.vnodes) {
      for (const va of node.vnodes) {
        const vx = cx + radius * Math.cos(va);
        const vy = cy + radius * Math.sin(va);
        ctx.beginPath();
        ctx.arc(vx, vy, 3, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.green + '60';
        ctx.fill();
      }
    }
  }

  for (const chunk of chunks) {
    const angle = chunk.angle;
    const chx = cx + (radius - 12) * Math.cos(angle);
    const chy = cy + (radius - 12) * Math.sin(angle);

    ctx.beginPath();
    ctx.arc(chx, chy, 3, 0, Math.PI * 2);
    ctx.fillStyle = chunk.color || COLORS.blue;
    ctx.fill();

    if (chunk.assignedNode !== undefined && chunk.showArrow) {
      const targetNode = nodes.find(n => n.id === chunk.assignedNode);
      if (targetNode && targetNode.id !== removedNode) {
        const tnx = cx + radius * Math.cos(targetNode.angle);
        const tny = cy + radius * Math.sin(targetNode.angle);
        ctx.beginPath();
        ctx.moveTo(chx, chy);
        ctx.lineTo(tnx, tny);
        ctx.strokeStyle = COLORS.blue + '40';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  ctx.restore();
}

// Gauge
function drawGauge(ctx, cx, cy, radius, value, maxValue, color, bgColor = 'rgba(255,255,255,0.05)') {
  ctx.save();
  const startAngle = Math.PI * 0.75;
  const endAngle = Math.PI * 2.25;
  const totalArc = endAngle - startAngle;
  const valueAngle = startAngle + (value / maxValue) * totalArc;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle);
  ctx.strokeStyle = bgColor;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, Math.min(valueAngle, endAngle));
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.stroke();

  const nx = cx + radius * Math.cos(valueAngle);
  const ny = cy + radius * Math.sin(valueAngle);
  ctx.beginPath();
  ctx.arc(nx, ny, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.restore();
}

// Setup
function setupCanvas(canvas, width, height) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

window.CanvasEngine = {
  COLORS,
  drawHexagon,
  drawRoundedRect,
  drawFlowLine,
  drawHealthBar,
  drawLabel,
  drawLabelGlow,
  drawLineChart,
  drawHashRing,
  drawGauge,
  setupCanvas,
  ParticleSystem,
};
