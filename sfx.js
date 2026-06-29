/* ═══════════════════════════════════════════════════════════════
   MiniGFS — Sound Effects (Web Audio API)
   Procedural audio. No audio files needed.
   Muted by default. Toggle with 🔊 button.
   ═══════════════════════════════════════════════════════════════ */

// ponytail: Web Audio API oscillators. No files, no Howler.js. ~80 lines.

(function () {
  'use strict';

  let audioCtx = null;
  let muted = true;
  let masterGain = null;

  function ensureCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = muted ? 0 : 0.15;
      masterGain.connect(audioCtx.destination);
    }
    return audioCtx;
  }

  function setMuted(val) {
    muted = val;
    if (masterGain) {
      masterGain.gain.setTargetAtTime(muted ? 0 : 0.15, audioCtx.currentTime, 0.05);
    }
  }

  function isMuted() { return muted; }

  // ─── Keyboard click (boot sequence typing) ───
  function playKeyClick() {
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 800 + Math.random() * 400;
    gain.gain.value = 0.03;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  }

  // ─── Data whoosh (chunk transfers) ───
  function playWhoosh() {
    const ctx = ensureCtx();
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.15);
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.value = 0.06;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start(ctx.currentTime);
  }

  // ─── Success ping (replication complete) ───
  function playSuccess() {
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    osc.frequency.setTargetAtTime(1320, ctx.currentTime + 0.08, 0.02);
    gain.gain.value = 0.08;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  }

  // ─── Alert tone (node failure) ───
  function playAlert() {
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 220;
    osc.frequency.setTargetAtTime(180, ctx.currentTime + 0.1, 0.05);
    gain.gain.value = 0.06;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  }

  // ─── Boot OK beep ───
  function playBootOk() {
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 660;
    gain.gain.value = 0.04;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }

  // ─── Boot complete chime ───
  function playBootComplete() {
    const ctx = ensureCtx();
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.05;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15 * (i + 1) + 0.2);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(ctx.currentTime + 0.12 * i);
      osc.stop(ctx.currentTime + 0.12 * i + 0.25);
    });
  }

  window.SFX = {
    setMuted,
    isMuted,
    playKeyClick,
    playWhoosh,
    playSuccess,
    playAlert,
    playBootOk,
    playBootComplete,
  };
})();
