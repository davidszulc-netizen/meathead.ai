const Sound = (() => {
  let _ctx = null;

  function getCtx() {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  // ── SFX ─────────────────────────────────────────────────────────────────────

  function whack() {
    const c = getCtx();
    const buf = c.createBuffer(1, c.sampleRate * 0.08, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 900;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.6, c.currentTime);
    src.connect(filter); filter.connect(gain); gain.connect(c.destination);
    src.start();
  }

  function miss() {
    const c = getCtx();
    const osc = c.createOscillator(); const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, c.currentTime);
    osc.frequency.linearRampToValueAtTime(150, c.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, c.currentTime);
    gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.2);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(); osc.stop(c.currentTime + 0.2);
  }

  function escape() {
    const c = getCtx();
    const osc = c.createOscillator(); const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, c.currentTime);
    osc.frequency.linearRampToValueAtTime(600, c.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, c.currentTime);
    gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.15);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(); osc.stop(c.currentTime + 0.15);
  }

  function ouch() {
    // Trump takes damage — quick downward pitch yelp
    const c   = getCtx();
    const now = c.currentTime;
    // Main yelp tone
    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.linearRampToValueAtTime(180, now + 0.28);
    gain.gain.setValueAtTime(0.40, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.28);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(now); osc.stop(now + 0.28);
    // Short impact thud underneath
    const buf  = c.createBuffer(1, c.sampleRate * 0.06, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource(); src.buffer = buf;
    const lp  = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    const g2  = c.createGain(); g2.gain.setValueAtTime(0.5, now);
    src.connect(lp); lp.connect(g2); g2.connect(c.destination);
    src.start(now);
  }

  function gameOver() {
    const c   = getCtx();
    const now = c.currentTime;
    // Ascending victory fanfare: C4 → E4 → G4 → C5 → E5 (held)
    const notes = [
      [262, 0.00, 0.13],  // C4
      [330, 0.11, 0.13],  // E4
      [392, 0.22, 0.13],  // G4
      [523, 0.33, 0.18],  // C5
      [659, 0.48, 0.50],  // E5  — held finale
    ];
    for (const [freq, offset, dur] of notes) {
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const t = now + offset;
      gain.gain.setValueAtTime(0,    t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.02);
      gain.gain.setValueAtTime(0.28, t + dur - 0.06);
      gain.gain.linearRampToValueAtTime(0,    t + dur);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(t); osc.stop(t + dur);
    }
    // Harmony on the finale note (major third above E5 = G#5)
    const harm = c.createOscillator(); const hg = c.createGain();
    harm.type = 'sine'; harm.frequency.value = 830; // G#5
    const ht = now + 0.48;
    hg.gain.setValueAtTime(0, ht);
    hg.gain.linearRampToValueAtTime(0.14, ht + 0.04);
    hg.gain.linearRampToValueAtTime(0,    ht + 0.50);
    harm.connect(hg); hg.connect(c.destination);
    harm.start(ht); harm.stop(ht + 0.50);
  }

  function comboUp() {
    const c = getCtx();
    const osc = c.createOscillator(); const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, c.currentTime);
    osc.frequency.linearRampToValueAtTime(784, c.currentTime + 0.12);
    gain.gain.setValueAtTime(0.3, c.currentTime);
    gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.12);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(); osc.stop(c.currentTime + 0.12);
  }

  // ── Background Music ─────────────────────────────────────────────────────────

  // ── Track 1 — Level 1: Jaunty C-major 130 BPM ────────────────────────────
  const _T1 = {
    BPM: 130,
    mel: [
      [392,0.5],[330,0.5],[523,0.5],[330,0.5],[392,0.5],[440,0.5],[392,0.5],[330,0.5],
      [349,0.5],[294,0.5],[247,0.5],[294,0.5],[349,0.5],[392,0.5],[330,0.5],[262,0.5],
    ],
    bass: [[131,2],[196,2],[175,2],[196,2]],
    kick: [0,2,4,6],
    hat:  [0,1,2,3,4,5,6,7],
    melVol: 0.11, bassVol: 0.09, melType: 'square',
  };

  // ── Track 2 — Level 2: Intense A-minor 150 BPM ───────────────────────────
  const _T2 = {
    BPM: 150,
    mel: [
      [440,0.5],[494,0.25],[523,0.25],[494,0.5],[440,0.5],[392,0.25],[349,0.25],[440,0.5],
      [392,0.5],[440,0.25],[494,0.25],[440,0.5],[392,0.5],[330,0.25],[294,0.25],[330,0.75],
    ],
    bass: [[110,2],[146,2],[131,2],[146,2]],
    kick: [0,1,2,3,4,5,6,7], // every step — driving
    hat:  [0,1,2,3,4,5,6,7],
    melVol: 0.10, bassVol: 0.10, melType: 'sawtooth',
  };

  // ── Track 3 — Level 3: Epic G-major 140 BPM ──────────────────────────────
  const _T3 = {
    BPM: 140,
    mel: [
      [392,0.5],[523,0.5],[659,0.5],[784,0.25],[698,0.25],[659,0.5],[587,0.25],[523,0.25],
      [494,0.5],[523,0.5],[587,0.5],[659,0.75],[523,0.25],[440,0.5],[392,0.5],[330,0.5],
    ],
    bass: [[98,2],[131,2],[110,2],[131,2]],
    kick: [0,2,4,6],
    hat:  [0,1,2,3,4,5,6,7],
    melVol: 0.13, bassVol: 0.11, melType: 'square',
  };

  let _masterGain   = null;
  let _musicPlaying = false;
  let _nextLoopAt   = 0;
  let _schedTimer   = null;
  let _currentTrack = _T1;

  function _note(dest, freq, start, dur, vol, type) {
    const c   = getCtx();
    const osc = c.createOscillator();
    const g   = c.createGain();
    osc.type            = type || 'square';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur * 0.86);
    osc.connect(g); g.connect(dest);
    osc.start(start); osc.stop(start + dur);
  }

  function _kick(dest, start) {
    const c   = getCtx();
    const dur = 0.12;
    const osc = c.createOscillator(); const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, start);
    osc.frequency.exponentialRampToValueAtTime(40, start + dur);
    g.gain.setValueAtTime(0.5, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g); g.connect(dest);
    osc.start(start); osc.stop(start + dur);
  }

  function _hat(dest, start) {
    const c   = getCtx();
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.04), c.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f   = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000;
    const g   = c.createGain();
    g.gain.setValueAtTime(0.04, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.04);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(start);
  }

  function _scheduleLoop(dest, t, track) {
    const B = 60 / track.BPM;
    // Melody
    let cursor = t;
    for (const [freq, beats] of track.mel) {
      const dur = beats * B;
      _note(dest, freq, cursor, dur, track.melVol, track.melType);
      cursor += dur;
    }
    // Bass
    cursor = t;
    for (const [freq, beats] of track.bass) {
      const dur = beats * B;
      _note(dest, freq, cursor, dur * 0.65, track.bassVol, 'sine');
      cursor += dur;
    }
    // Drums (2 bars)
    for (let bar = 0; bar < 2; bar++) {
      for (let step = 0; step < 8; step++) {
        const st = t + (bar * 4 + step * 0.5) * B;
        if (track.kick.includes(step)) _kick(dest, st);
        _hat(dest, st);
      }
    }
  }

  function _loopLen(track) {
    const B = 60 / track.BPM;
    return track.mel.reduce((s, [, b]) => s + b, 0) * B;
  }

  function startMusic(trackNum) {
    if (_musicPlaying) stopMusic();
    _currentTrack = trackNum === 2 ? _T2 : trackNum === 3 ? _T3 : _T1;
    const c = getCtx();
    _musicPlaying = true;
    _masterGain   = c.createGain();
    _masterGain.gain.value = 1.0;
    _masterGain.connect(c.destination);
    const now = c.currentTime + 0.05;
    _scheduleLoop(_masterGain, now, _currentTrack);
    _nextLoopAt = now + _loopLen(_currentTrack);
    _schedTimer = setInterval(() => {
      if (!_musicPlaying) return;
      const ac = getCtx();
      if (ac.currentTime > _nextLoopAt - 0.35) {
        _scheduleLoop(_masterGain, _nextLoopAt, _currentTrack);
        _nextLoopAt += _loopLen(_currentTrack);
      }
    }, 100);
  }

  function stopMusic() {
    _musicPlaying = false;
    clearInterval(_schedTimer);
    if (_masterGain) {
      const c = getCtx();
      _masterGain.gain.linearRampToValueAtTime(0, c.currentTime + 0.35);
      setTimeout(() => {
        try { _masterGain.disconnect(); } catch { /* ignore */ }
        _masterGain = null;
      }, 450);
    }
  }

  return { whack, miss, escape, ouch, gameOver, comboUp, startMusic, stopMusic };
})();
