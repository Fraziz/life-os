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
// 100% offline nature soundscapes & focus noise synthesizers
// ============================================================

export type AmbientSoundType =
  | 'off'
  | 'gamma40'
  | 'alpha10'
  | 'pink'
  | 'brown'
  | 'rain'
  | 'thunder'
  | 'waves'
  | 'stream'
  | 'forest'
  | 'fire'
  | 'wind'
  | 'cafe'
  | 'drone';

let activeAmbientNodes: {
  sources: (AudioNode | AudioBufferSourceNode | OscillatorNode)[];
  gainNode: GainNode;
  timers?: number[];
  intervalId?: number;
} | null = null;

let currentAmbientVolume = 0.35;

/**
 * Generate 6 seconds of seamless looping noise buffer (Pink / White / Brown).
 */
function createNoiseBuffer(ctx: AudioContext, type: 'white' | 'pink' | 'brown'): AudioBuffer {
  const bufferSize = ctx.sampleRate * 6;
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  if (type === 'white') {
    for (let i = 0; i < bufferSize; i++) {
      left[i] = Math.random() * 2 - 1;
      right[i] = Math.random() * 2 - 1;
    }
  } else if (type === 'pink') {
    // Paul Kellet's refined pink noise filter
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    let r0 = 0, r1 = 0, r2 = 0, r3 = 0, r4 = 0, r5 = 0, r6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const wL = Math.random() * 2 - 1;
      const wR = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + wL * 0.0555179;
      b1 = 0.99332 * b1 + wL * 0.0750759;
      b2 = 0.96900 * b2 + wL * 0.1538520;
      b3 = 0.86650 * b3 + wL * 0.3104856;
      b4 = 0.55000 * b4 + wL * 0.5329522;
      b5 = -0.7616 * b5 - wL * 0.0168980;
      left[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + wL * 0.5362) * 0.11;
      b6 = wL * 0.115926;

      r0 = 0.99886 * r0 + wR * 0.0555179;
      r1 = 0.99332 * r1 + wR * 0.0750759;
      r2 = 0.96900 * r2 + wR * 0.1538520;
      r3 = 0.86650 * r3 + wR * 0.3104856;
      r4 = 0.55000 * r4 + wR * 0.5329522;
      r5 = -0.7616 * r5 - wR * 0.0168980;
      right[i] = (r0 + r1 + r2 + r3 + r4 + r5 + r6 + wR * 0.5362) * 0.11;
      r6 = wR * 0.115926;
    }
  } else {
    // Deep Brown Noise (integrated white noise)
    let lastL = 0;
    let lastR = 0;
    for (let i = 0; i < bufferSize; i++) {
      const wL = Math.random() * 2 - 1;
      const wR = Math.random() * 2 - 1;
      lastL = (lastL + 0.02 * wL) / 1.02;
      lastR = (lastR + 0.02 * wR) / 1.02;
      left[i] = lastL * 3.5;
      right[i] = lastR * 3.5;
    }
  }
  return buffer;
}

export function stopAmbientSound() {
  if (activeAmbientNodes) {
    if (activeAmbientNodes.timers) {
      activeAmbientNodes.timers.forEach((t) => window.clearTimeout(t));
    }
    if (activeAmbientNodes.intervalId) {
      window.clearInterval(activeAmbientNodes.intervalId);
    }
    try {
      const ctx = audioCtx;
      if (ctx && activeAmbientNodes.gainNode) {
        activeAmbientNodes.gainNode.gain.setValueAtTime(activeAmbientNodes.gainNode.gain.value, ctx.currentTime);
        activeAmbientNodes.gainNode.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      }
      const nodesToClean = activeAmbientNodes.sources;
      setTimeout(() => {
        nodesToClean.forEach((node) => {
          if ('stop' in node && typeof node.stop === 'function') {
            try { node.stop(); } catch {}
          }
          try { node.disconnect(); } catch {}
        });
      }, 180);
      activeAmbientNodes = null;
    } catch {
      activeAmbientNodes = null;
    }
  }
}

export function setAmbientVolume(volume: number) {
  currentAmbientVolume = Math.max(0, Math.min(1, volume));
  if (activeAmbientNodes && audioCtx) {
    try {
      activeAmbientNodes.gainNode.gain.setTargetAtTime(currentAmbientVolume, audioCtx.currentTime, 0.05);
    } catch {}
  }
}

export function startAmbientSound(type: AmbientSoundType, volume = currentAmbientVolume) {
  stopAmbientSound();
  if (type === 'off') return;

  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  currentAmbientVolume = volume;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.25);
  masterGain.connect(ctx.destination);

  const sources: (AudioNode | AudioBufferSourceNode | OscillatorNode)[] = [masterGain];
  const timers: number[] = [];

  if (type === 'gamma40') {
    // 🧠 40Hz Gamma Binaural Entrainment (ADHD Hyperfocus & Deep Mental Clarity)
    // Left Ear = 200 Hz, Right Ear = 240 Hz -> Brain perceives 40Hz Gamma wave
    const merger = ctx.createChannelMerger(2);

    const oscLeft = ctx.createOscillator();
    const oscRight = ctx.createOscillator();
    const gainLeft = ctx.createGain();
    const gainRight = ctx.createGain();

    oscLeft.type = 'sine';
    oscLeft.frequency.setValueAtTime(200, ctx.currentTime);

    oscRight.type = 'sine';
    oscRight.frequency.setValueAtTime(240, ctx.currentTime); // 40Hz difference

    gainLeft.gain.setValueAtTime(0.35, ctx.currentTime);
    gainRight.gain.setValueAtTime(0.35, ctx.currentTime);

    oscLeft.connect(gainLeft);
    oscRight.connect(gainRight);

    gainLeft.connect(merger, 0, 0);  // Left channel
    gainRight.connect(merger, 0, 1); // Right channel

    // Add soft pink background bed for soothing comfort
    const bed = ctx.createBufferSource();
    bed.buffer = createNoiseBuffer(ctx, 'pink');
    bed.loop = true;
    const bedFilter = ctx.createBiquadFilter();
    bedFilter.type = 'lowpass';
    bedFilter.frequency.setValueAtTime(400, ctx.currentTime);
    const bedGain = ctx.createGain();
    bedGain.gain.setValueAtTime(0.15, ctx.currentTime);

    bed.connect(bedFilter);
    bedFilter.connect(bedGain);
    bedGain.connect(masterGain);
    bed.start();

    merger.connect(masterGain);
    oscLeft.start();
    oscRight.start();
    sources.push(oscLeft, oscRight, gainLeft, gainRight, merger, bed, bedFilter, bedGain);

  } else if (type === 'alpha10') {
    // 🧘 10Hz Alpha Waves (Calm Flow State, Working Memory & Zero Stress)
    // Left Ear = 210 Hz, Right Ear = 220 Hz -> 10Hz Alpha rhythm
    const merger = ctx.createChannelMerger(2);

    const oscLeft = ctx.createOscillator();
    const oscRight = ctx.createOscillator();
    const subOsc = ctx.createOscillator();

    oscLeft.type = 'sine';
    oscLeft.frequency.setValueAtTime(210, ctx.currentTime);

    oscRight.type = 'sine';
    oscRight.frequency.setValueAtTime(220, ctx.currentTime);

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(105, ctx.currentTime); // 1-octave warm sub base

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.2, ctx.currentTime);
    subOsc.connect(subGain);
    subGain.connect(masterGain);

    const gL = ctx.createGain();
    const gR = ctx.createGain();
    gL.gain.setValueAtTime(0.32, ctx.currentTime);
    gR.gain.setValueAtTime(0.32, ctx.currentTime);

    oscLeft.connect(gL);
    oscRight.connect(gR);

    gL.connect(merger, 0, 0);
    gR.connect(merger, 0, 1);
    merger.connect(masterGain);

    oscLeft.start();
    oscRight.start();
    subOsc.start();
    sources.push(oscLeft, oscRight, subOsc, gL, gR, subGain, merger);

  } else if (type === 'pink') {
    // 🛡️ Pink Noise (1/f Balanced Spectrum - Blocks Intrusive Thoughts for ADHD)
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 'pink');
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, ctx.currentTime);
    filter.Q.setValueAtTime(0.5, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start();
    sources.push(noise, filter, gain);

  } else if (type === 'brown') {
    // 🎧 Deep Brown Noise (Heavy Low-End Rumble - Ultimate Executive Focus)
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 'brown');
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, ctx.currentTime);
    filter.Q.setValueAtTime(0.7, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9, ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start();
    sources.push(noise, filter, gain);

  } else if (type === 'rain') {
    // 🌧️ Gentle Rainfall: Rich stereo rain sound with soothing pitter-patter
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 'pink');
    noise.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1400, ctx.currentTime);
    bandpass.Q.setValueAtTime(0.7, ctx.currentTime);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(4000, ctx.currentTime);

    const rainGain = ctx.createGain();
    rainGain.gain.setValueAtTime(0.75, ctx.currentTime);

    noise.connect(bandpass);
    bandpass.connect(lowpass);
    lowpass.connect(rainGain);
    rainGain.connect(masterGain);
    noise.start();
    sources.push(noise, bandpass, lowpass, rainGain);

  } else if (type === 'thunder') {
    // ⛈️ Rain & Rolling Distant Thunder
    const rain = ctx.createBufferSource();
    rain.buffer = createNoiseBuffer(ctx, 'pink');
    rain.loop = true;

    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.setValueAtTime(1200, ctx.currentTime);
    rainFilter.Q.setValueAtTime(0.6, ctx.currentTime);

    const rainGain = ctx.createGain();
    rainGain.gain.setValueAtTime(0.65, ctx.currentTime);

    rain.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(masterGain);
    rain.start();
    sources.push(rain, rainFilter, rainGain);

    const scheduleThunder = () => {
      if (!activeAmbientNodes) return;
      try {
        const now = ctx.currentTime;
        const rumble = ctx.createBufferSource();
        rumble.buffer = createNoiseBuffer(ctx, 'brown');

        const rumbleFilter = ctx.createBiquadFilter();
        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.setValueAtTime(110, now);
        rumbleFilter.Q.setValueAtTime(2.0, now);

        const rumbleGain = ctx.createGain();
        rumbleGain.gain.setValueAtTime(0.0001, now);
        rumbleGain.gain.linearRampToValueAtTime(0.5, now + 1.2);
        rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);

        rumble.connect(rumbleFilter);
        rumbleFilter.connect(rumbleGain);
        rumbleGain.connect(masterGain);

        rumble.start(now);
        rumble.stop(now + 4.8);
      } catch {}

      const nextDelay = 8000 + Math.random() * 10000;
      const tid = window.setTimeout(scheduleThunder, nextDelay);
      timers.push(tid);
    };

    const initialTid = window.setTimeout(scheduleThunder, 1500);
    timers.push(initialTid);

  } else if (type === 'waves') {
    // 🌊 Ocean Waves (Dynamic smooth rolling tidal swell)
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 'pink');
    noise.loop = true;

    const waveFilter = ctx.createBiquadFilter();
    waveFilter.type = 'lowpass';
    waveFilter.frequency.setValueAtTime(350, ctx.currentTime);
    waveFilter.Q.setValueAtTime(1.0, ctx.currentTime);

    const waveGain = ctx.createGain();
    waveGain.gain.setValueAtTime(0.4, ctx.currentTime);

    // Continuous smooth sine modulation of the lowpass cutoff (swelling up to 1100Hz and back)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.12, ctx.currentTime); // ~8.3 sec per wave

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(350, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(waveFilter.frequency);

    noise.connect(waveFilter);
    waveFilter.connect(waveGain);
    waveGain.connect(masterGain);

    noise.start();
    lfo.start();
    sources.push(noise, waveFilter, waveGain, lfo, lfoGain);

  } else if (type === 'stream') {
    // 💧 River Stream / Babbling Brook
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 'pink');
    noise.loop = true;

    const bp1 = ctx.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.frequency.setValueAtTime(900, ctx.currentTime);
    bp1.Q.setValueAtTime(1.2, ctx.currentTime);

    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.setValueAtTime(1900, ctx.currentTime);
    bp2.Q.setValueAtTime(1.8, ctx.currentTime);

    const streamGain = ctx.createGain();
    streamGain.gain.setValueAtTime(0.65, ctx.currentTime);

    noise.connect(bp1);
    noise.connect(bp2);
    bp1.connect(streamGain);
    bp2.connect(streamGain);
    streamGain.connect(masterGain);

    noise.start();
    sources.push(noise, bp1, bp2, streamGain);

  } else if (type === 'forest') {
    // 🌲 Forest Birds & Rustling Leaves
    const breeze = ctx.createBufferSource();
    breeze.buffer = createNoiseBuffer(ctx, 'pink');
    breeze.loop = true;

    const breezeFilter = ctx.createBiquadFilter();
    breezeFilter.type = 'bandpass';
    breezeFilter.frequency.setValueAtTime(650, ctx.currentTime);
    breezeFilter.Q.setValueAtTime(0.6, ctx.currentTime);

    const breezeGain = ctx.createGain();
    breezeGain.gain.setValueAtTime(0.4, ctx.currentTime);

    breeze.connect(breezeFilter);
    breezeFilter.connect(breezeGain);
    breezeGain.connect(masterGain);
    breeze.start();
    sources.push(breeze, breezeFilter, breezeGain);

    const scheduleBirdChirp = () => {
      if (!activeAmbientNodes) return;
      try {
        const now = ctx.currentTime;
        const baseFreq = 2600 + Math.random() * 1200;
        const chirpCount = Math.floor(Math.random() * 3) + 2;

        for (let i = 0; i < chirpCount; i++) {
          const chirpOsc = ctx.createOscillator();
          const chirpGain = ctx.createGain();

          chirpOsc.type = 'sine';
          const startTime = now + i * 0.12;
          const duration = 0.08 + Math.random() * 0.04;

          chirpOsc.frequency.setValueAtTime(baseFreq + (Math.random() * 300 - 150), startTime);
          chirpOsc.frequency.exponentialRampToValueAtTime(baseFreq + 400, startTime + duration * 0.6);
          chirpOsc.frequency.exponentialRampToValueAtTime(baseFreq - 200, startTime + duration);

          chirpGain.gain.setValueAtTime(0.0001, startTime);
          chirpGain.gain.linearRampToValueAtTime(0.08, startTime + 0.01);
          chirpGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

          chirpOsc.connect(chirpGain);
          chirpGain.connect(masterGain);

          chirpOsc.start(startTime);
          chirpOsc.stop(startTime + duration + 0.05);
        }
      } catch {}

      const nextDelay = 3500 + Math.random() * 5000;
      const tid = window.setTimeout(scheduleBirdChirp, nextDelay);
      timers.push(tid);
    };

    const initialTid = window.setTimeout(scheduleBirdChirp, 1000);
    timers.push(initialTid);

  } else if (type === 'fire') {
    // 🔥 Campfire: Low warm body + crackles
    const baseHiss = ctx.createBufferSource();
    baseHiss.buffer = createNoiseBuffer(ctx, 'pink');
    baseHiss.loop = true;

    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'lowpass';
    hissFilter.frequency.setValueAtTime(700, ctx.currentTime);

    const hissGain = ctx.createGain();
    hissGain.gain.setValueAtTime(0.4, ctx.currentTime);

    baseHiss.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(masterGain);
    baseHiss.start();
    sources.push(baseHiss, hissFilter, hissGain);

    const scheduleCrackle = () => {
      if (!activeAmbientNodes) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400 + Math.random() * 1200, now);

        gain.gain.setValueAtTime(0.07 + Math.random() * 0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02 + Math.random() * 0.03);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.06);
      } catch {}

      const nextDelay = 150 + Math.random() * 400;
      const tid = window.setTimeout(scheduleCrackle, nextDelay);
      timers.push(tid);
    };

    const initialTid = window.setTimeout(scheduleCrackle, 200);
    timers.push(initialTid);

  } else if (type === 'wind') {
    // 🍃 Mountain Wind: Sweeping resonant breeze
    const wind = ctx.createBufferSource();
    wind.buffer = createNoiseBuffer(ctx, 'pink');
    wind.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(450, ctx.currentTime);
    windFilter.Q.setValueAtTime(1.5, ctx.currentTime);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.08, ctx.currentTime);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(250, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.6, ctx.currentTime);

    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);
    wind.start();
    lfo.start();
    sources.push(wind, windFilter, windGain, lfo, lfoGain);

  } else if (type === 'cafe') {
    // ☕ Cozy Cafe Ambience: Warm chatter drone + soft filtered room tones
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 'pink');
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime);
    filter.Q.setValueAtTime(0.9, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start();
    sources.push(noise, filter, gain);

  } else if (type === 'drone') {
    // 🌌 Deep Space Nebula Drone: Warm multi-harmonic ambient chord
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(108, ctx.currentTime); // A2 fundamental

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(162, ctx.currentTime); // E3 perfect fifth

    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(216, ctx.currentTime); // A3 octave

    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    const g3 = ctx.createGain();

    g1.gain.setValueAtTime(0.3, ctx.currentTime);
    g2.gain.setValueAtTime(0.2, ctx.currentTime);
    g3.gain.setValueAtTime(0.15, ctx.currentTime);

    osc1.connect(g1);
    osc2.connect(g2);
    osc3.connect(g3);

    g1.connect(masterGain);
    g2.connect(masterGain);
    g3.connect(masterGain);

    osc1.start();
    osc2.start();
    osc3.start();
    sources.push(osc1, osc2, osc3, g1, g2, g3);
  }

  activeAmbientNodes = { sources, gainNode: masterGain, timers };
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
