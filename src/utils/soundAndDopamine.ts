// ============================================================
// ADHD DOPAMINE & SOUND ENGINE
// Web Audio API pure tone synthesizers + Canvas particle burst
// 100% offline, zero asset downloads, zero external dependencies
// ============================================================

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play a rich 3-note harmonic chime (C5 -> E5 -> G5 -> C6) for task completion dopamine.
 */
export function playSuccessChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 523.25, time: 0, duration: 0.35, gain: 0.15 },    // C5
    { freq: 659.25, time: 0.08, duration: 0.4, gain: 0.18 },  // E5
    { freq: 783.99, time: 0.16, duration: 0.45, gain: 0.2 },  // G5
    { freq: 1046.50, time: 0.24, duration: 0.7, gain: 0.25 }, // C6
  ];

  notes.forEach(({ freq, time, duration, gain }) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + time);

    // Warm harmonics
    gainNode.gain.setValueAtTime(0, now + time);
    gainNode.gain.linearRampToValueAtTime(gain, now + time + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + time + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now + time);
    osc.stop(now + time + duration + 0.05);
  });
}

/**
 * Crisp subtle wooden pop tone when checking off a micro subtask.
 */
export function playSubtaskTick() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(1400, now + 0.05);

  gainNode.gain.setValueAtTime(0.12, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.07);
}

/**
 * Victory fanfare chime when completing a focus timer session.
 */
export function playTimerCompleteFanfare() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const fanfareNotes = [
    { freq: 587.33, time: 0, duration: 0.2 },      // D5
    { freq: 659.25, time: 0.15, duration: 0.2 },   // E5
    { freq: 783.99, time: 0.3, duration: 0.25 },   // G5
    { freq: 880.00, time: 0.45, duration: 0.3 },   // A5
    { freq: 1174.66, time: 0.6, duration: 0.9 },   // D6
  ];

  fanfareNotes.forEach(({ freq, time, duration }) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + time);

    gainNode.gain.setValueAtTime(0, now + time);
    gainNode.gain.linearRampToValueAtTime(0.22, now + time + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + time + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now + time);
    osc.stop(now + time + duration + 0.05);
  });
}

// ============================================================
// PROCEDURAL AMBIENT SOUND GENERATOR (Web Audio API)
// Brown noise, Gentle rain, and Alpha focus drone
// ============================================================

export type AmbientSoundType = 'off' | 'brown' | 'rain' | 'drone';

let activeAmbientNodes: {
  sources: (AudioNode | AudioBufferSourceNode | OscillatorNode)[];
  gainNode: GainNode;
} | null = null;

let currentAmbientVolume = 0.35;

/**
 * Generate 5 seconds of pink/white noise buffer for looping.
 */
function createNoiseBuffer(ctx: AudioContext, type: 'white' | 'pink'): AudioBuffer {
  const bufferSize = ctx.sampleRate * 5;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  } else {
    // Pink noise filter algorithm
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  }
  return buffer;
}

export function stopAmbientSound() {
  if (activeAmbientNodes) {
    try {
      activeAmbientNodes.gainNode.gain.setTargetAtTime(0, audioCtx ? audioCtx.currentTime : 0, 0.1);
      setTimeout(() => {
        if (activeAmbientNodes) {
          activeAmbientNodes.sources.forEach((node) => {
            if ('stop' in node && typeof node.stop === 'function') {
              try { node.stop(); } catch {}
            }
            try { node.disconnect(); } catch {}
          });
          activeAmbientNodes = null;
        }
      }, 150);
    } catch {
      activeAmbientNodes = null;
    }
  }
}

export function setAmbientVolume(volume: number) {
  currentAmbientVolume = Math.max(0, Math.min(1, volume));
  if (activeAmbientNodes && audioCtx) {
    activeAmbientNodes.gainNode.gain.setTargetAtTime(currentAmbientVolume, audioCtx.currentTime, 0.05);
  }
}

export function startAmbientSound(type: AmbientSoundType, volume = currentAmbientVolume) {
  stopAmbientSound();
  if (type === 'off') return;

  const ctx = getAudioContext();
  if (!ctx) return;

  currentAmbientVolume = volume;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.3);
  masterGain.connect(ctx.destination);

  const sources: (AudioNode | AudioBufferSourceNode | OscillatorNode)[] = [];

  if (type === 'brown') {
    // Brown noise: Low-pass filtered pink noise for deep calm
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = createNoiseBuffer(ctx, 'pink');
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, ctx.currentTime);
    filter.Q.setValueAtTime(0.7, ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(masterGain);
    noiseSource.start();
    sources.push(noiseSource, filter);

  } else if (type === 'rain') {
    // Rain noise: Filtered noise with high-pass sparkle and gentle modulation
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = createNoiseBuffer(ctx, 'pink');
    noiseSource.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1200, ctx.currentTime);
    bandpass.Q.setValueAtTime(0.5, ctx.currentTime);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(3500, ctx.currentTime);

    noiseSource.connect(bandpass);
    bandpass.connect(lowpass);
    lowpass.connect(masterGain);
    noiseSource.start();
    sources.push(noiseSource, bandpass, lowpass);

  } else if (type === 'drone') {
    // 14Hz Alpha focus wave with 216Hz base frequency
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const subOsc = ctx.createOscillator();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(216, ctx.currentTime); // Base

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(230, ctx.currentTime); // 216 + 14Hz Alpha difference

    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(108, ctx.currentTime); // Deep warm sub-octave

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.4, ctx.currentTime);
    subOsc.connect(subGain);
    subGain.connect(masterGain);

    osc1.connect(masterGain);
    osc2.connect(masterGain);

    osc1.start();
    osc2.start();
    subOsc.start();
    sources.push(osc1, osc2, subOsc, subGain);
  }

  activeAmbientNodes = { sources, gainNode: masterGain };
}

// ============================================================
// CANVAS DOPAMINE SPARKLE & CONFETTI EXPLOSION
// 60 FPS physics particle burst for task completion celebrations
// ============================================================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  rotation: number;
  rotSpeed: number;
  shape: 'circle' | 'star' | 'rect';
}

export function triggerDopamineBurst(originX?: number, originY?: number) {
  if (typeof window === 'undefined') return;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);

  const startX = originX ?? window.innerWidth / 2;
  const startY = originY ?? window.innerHeight / 2;

  const colors = ['#22d3a5', '#7c6fff', '#f5a623', '#4db8ff', '#ff79c6', '#ffd700', '#bd93f9'];
  const particles: Particle[] = [];
  const count = 55;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8 + 3;
    const shapes: ('circle' | 'star' | 'rect')[] = ['circle', 'star', 'rect'];

    particles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed * (Math.random() * 0.8 + 0.6),
      vy: Math.sin(angle) * speed * (Math.random() * 0.8 + 0.6) - 2.5, // gentle upward impulse
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 6 + 4,
      alpha: 1,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.25,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    });
  }

  let animationFrameId: number;
  const startTime = performance.now();
  const duration = 1200; // ms

  function render(time: number) {
    const elapsed = time - startTime;
    const progress = Math.min(1, elapsed / duration);

    ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22; // Gravity
      p.vx *= 0.98; // Air drag
      p.rotation += p.rotSpeed;
      p.alpha = Math.max(0, 1 - progress * 1.1);

      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rotation);
      ctx!.globalAlpha = p.alpha;
      ctx!.fillStyle = p.color;

      if (p.shape === 'circle') {
        ctx!.beginPath();
        ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx!.fill();
      } else if (p.shape === 'rect') {
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        // Star sparkle
        ctx!.beginPath();
        for (let j = 0; j < 4; j++) {
          ctx!.lineTo(Math.cos((j * Math.PI) / 2) * p.size, Math.sin((j * Math.PI) / 2) * p.size);
          ctx!.lineTo(Math.cos((j * Math.PI) / 2 + Math.PI / 4) * (p.size * 0.35), Math.sin((j * Math.PI) / 2 + Math.PI / 4) * (p.size * 0.35));
        }
        ctx!.closePath();
        ctx!.fill();
      }

      ctx!.restore();
    });

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(render);
    } else {
      cancelAnimationFrame(animationFrameId);
      canvas.remove();
    }
  }

  animationFrameId = requestAnimationFrame(render);
}
