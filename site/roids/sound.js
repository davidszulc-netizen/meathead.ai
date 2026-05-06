'use strict';

const Sound = (() => {
  let ctx = null;
  let beatInterval = null;
  let beatPhase = 0;
  let beatTempo = 1.0;
  let ufoTimer = null;

  // m-3: Robust AudioContext creation with error handling
  function getCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null; // AudioContext unavailable (private browsing, restricted env)
      }
    }
    // NOTE: resume() intentionally NOT called here — calling it outside a user gesture
    // spams the console with DOMException: NotAllowedError rejections on page load.
    // Resume is handled exclusively in unlock(), which is bound to user gesture events.
    return ctx;
  }

  function noise(duration, frequency, gain = 0.4) {
    const c = getCtx();
    if (!c) return; // m-3: guard against unavailable context
    const bufferSize = Math.floor(c.sampleRate * duration);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = c.createBufferSource();
    source.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;

    const gainNode = c.createGain();
    gainNode.gain.setValueAtTime(gain, c.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(c.destination);
    source.start();
    source.stop(c.currentTime + duration);
  }

  function tone(type, freq, duration, gain = 0.3, freqEnd = null) {
    const c = getCtx();
    if (!c) return; // m-3: guard against unavailable context
    const osc = c.createOscillator();
    const gainNode = c.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + duration);
    }

    gainNode.gain.setValueAtTime(gain, c.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
  }

  // Thrust: looping noise
  let thrustNode = null;
  let thrustGain = null;

  // C-1: Cached thrust buffer — generated once at first use, reused for all thrust playback.
  // Previously a new 2-second (96k-sample) buffer was allocated on every keypress,
  // causing synchronous CPU spikes on mobile and unbounded memory growth.
  let _thrustBuffer = null;

  function _getThrustBuffer() {
    if (_thrustBuffer) return _thrustBuffer;
    const c = getCtx();
    if (!c) return null;
    const bufferSize = c.sampleRate * 2;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    _thrustBuffer = buffer;
    return _thrustBuffer;
  }

  function startThrust() {
    if (thrustNode) return;
    const c = getCtx();
    if (!c) return;
    const buffer = _getThrustBuffer();
    if (!buffer) return;

    thrustNode = c.createBufferSource();
    thrustNode.buffer = buffer; // C-1: reuse cached buffer — no new allocation
    thrustNode.loop = true;

    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 120;

    thrustGain = c.createGain();
    thrustGain.gain.setValueAtTime(0.25, c.currentTime);

    thrustNode.connect(filter);
    filter.connect(thrustGain);
    thrustGain.connect(c.destination);
    thrustNode.start();
  }

  function stopThrust() {
    if (!thrustNode) return;
    try {
      const c = getCtx();
      if (c) {
        thrustGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
        thrustNode.stop(c.currentTime + 0.1);
      }
    } catch (e) { console.warn('stopThrust AudioContext error:', e); }
    thrustNode = null;
    thrustGain = null;
  }

  function fire() {
    tone('sawtooth', 880, 0.1, 0.3, 220);
  }

  function asteroidExplode(size) {
    const freq = size === 'large' ? 400 : size === 'medium' ? 700 : 1200;
    noise(0.3, freq, 0.5);
  }

  function shipExplode() {
    noise(1.5, 2000, 0.6);
    tone('sawtooth', 200, 1.5, 0.2, 40);
  }

  function hyperspace() {
    tone('sine', 200, 0.5, 0.3, 800);
    tone('sine', 220, 0.5, 0.2, 850);
  }

  function extraLife() {
    tone('sine', 600, 0.1, 0.3);
    setTimeout(() => tone('sine', 800, 0.1, 0.3), 120);
    setTimeout(() => tone('sine', 1000, 0.15, 0.3), 240);
  }

  function startBeat(asteroidCount, totalAsteroids) {
    stopBeat();
    beatPhase = 0;
    beatTempo = 1.0 + (1 - Math.min(asteroidCount / Math.max(totalAsteroids, 1), 1)) * 2;
    _scheduleBeat();
  }

  function updateBeat(asteroidCount, totalAsteroids) {
    beatTempo = 1.0 + (1 - Math.min(asteroidCount / Math.max(totalAsteroids, 1), 1)) * 2;
  }

  function _scheduleBeat() {
    const interval = Math.max(120, 800 / beatTempo);
    tone('sine', beatPhase === 0 ? 55 : 48, 0.08, 0.35);
    beatPhase = beatPhase === 0 ? 1 : 0;
    beatInterval = setTimeout(_scheduleBeat, interval);
  }

  function stopBeat() {
    if (beatInterval) { clearTimeout(beatInterval); beatInterval = null; }
  }

  function startUFO() {
    if (ufoTimer) return;
    let phase = 0;
    function beep() {
      tone('square', phase === 0 ? 440 : 330, 0.08, 0.15);
      phase = phase === 0 ? 1 : 0;
      ufoTimer = setTimeout(beep, 200);
    }
    beep();
  }

  function stopUFO() {
    if (ufoTimer) { clearTimeout(ufoTimer); ufoTimer = null; }
  }

  function unlock() {
    const c = getCtx();
    // Resume here only — this is always called from a user gesture event handler
    if (c && c.state === 'suspended') c.resume().catch(e => console.warn('AudioContext.resume failed:', e));
    _getThrustBuffer(); // C-1: pre-warm the thrust buffer on first user interaction
  }

  return {
    unlock, startThrust, stopThrust, fire, asteroidExplode, shipExplode,
    hyperspace, extraLife, startBeat, updateBeat, stopBeat, startUFO, stopUFO,
  };
})();
