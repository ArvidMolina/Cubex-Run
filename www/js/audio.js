// ============================================================
// AUDIO — Web Audio API + WAV local
// ============================================================
export const audioState = { enabled: true };

let audioCtx = null;

export function ensureAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      audioCtx = null;
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  if (audioCtx) loadTensionBuffer(audioCtx);
  return audioCtx;
}

export function playTone(freq, duration, type = 'sine', volume = 0.2) {
  if (!audioState.enabled) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function playSlimeWarning() {
  playTone(120, 0.4, 'sawtooth', 0.18);
  setTimeout(() => playTone(80, 0.5, 'square', 0.15), 200);
  setTimeout(() => playTone(60, 0.3, 'sine', 0.2), 450);
}

export function playWin() {
  playTone(523, 0.12, 'square', 0.15);
  setTimeout(() => playTone(659, 0.12, 'square', 0.15), 100);
  setTimeout(() => playTone(784, 0.25, 'square', 0.15), 200);
}

export function playLose() {
  playTone(220, 0.3, 'square', 0.18);
  setTimeout(() => playTone(110, 0.4, 'sawtooth', 0.2), 200);
}

export function playStep() {
  if (!audioState.enabled) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const pitchVar = 0.9 + Math.random() * 0.2;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 180 * pitchVar;
  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.04);
}

export function playWallHit() {
  if (!audioState.enabled) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(140, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.14, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
  // Capa de ruido: burst breve
  const noise = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, 1024, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
  noise.buffer = buf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.08, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  noise.connect(noiseGain).connect(ctx.destination);
  noise.start();
}

export function playClick() {
  if (!audioState.enabled) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.04);
}

export function playHeartbeat() {
  playTone(105, 0.09, 'sine', 0.065);
  setTimeout(() => playTone(82, 0.11, 'sine', 0.045), 95);
}

// Thud mini al aterrizar — igual que playWallHit pero a 1/3 volumen
export function playThudMini() {
  if (!audioState.enabled) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 90 + Math.random() * 20;
  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

// Calcula el intervalo entre heartbeats según la distancia BFS slime→player
// dist = Infinity cuando el slime no existe o está lejos
export function heartbeatInterval(dist) {
  if (!isFinite(dist) || dist > 3) return Infinity;
  if (dist <= 1) return 0.48;
  return 0.62;
}

// ============================================================
// TENSION MUSIC — loop arcade suave y dinámico por distancia
// ============================================================
let _tensionBuffer = null;
let _tensionLoading = null;
let _tensionSource = null;
let _tensionGain = null;
let _tensionFilter = null;
let _tensionWanted = false;

function loadTensionBuffer(ctx) {
  if (_tensionBuffer) return Promise.resolve(_tensionBuffer);
  if (_tensionLoading) return _tensionLoading;
  const wavUrl = new URL('../assets/audio/pursuit.wav?v=2', import.meta.url);
  _tensionLoading = fetch(wavUrl)
    .then(r => r.arrayBuffer())
    .then(ab => ctx.decodeAudioData(ab))
    .then(buf => {
      _tensionBuffer = buf;
      _tensionLoading = null;
      return buf;
    })
    .catch(() => {
      _tensionLoading = null;
      return null;
    });
  return _tensionLoading;
}

function ensureTensionPlaying() {
  const ctx = ensureAudio();
  if (!ctx || !_tensionWanted || _tensionSource) return;
  loadTensionBuffer(ctx).then(buf => {
    if (!buf || !_tensionWanted || _tensionSource) return;
    const source = ctx.createBufferSource();
    _tensionSource = source;
    source.buffer = buf;
    source.loop = true;
    _tensionGain = ctx.createGain();
    _tensionFilter = ctx.createBiquadFilter();
    _tensionFilter.type = 'lowpass';
    _tensionFilter.frequency.value = 2200;
    _tensionFilter.Q.value = 0.35;
    _tensionGain.gain.value = 0;
    source.connect(_tensionFilter).connect(_tensionGain).connect(ctx.destination);
    source.playbackRate.value = 1;
    source.start();
    source.onended = () => {
      if (_tensionSource === source) _tensionSource = null;
    };
  });
}

export function startTensionMusic() {
  _tensionWanted = true;
  ensureTensionPlaying();
}

// Llamar cada frame con la distancia slime→player
export function updateTensionMusic(dist) {
  ensureTensionPlaying();
  const ctx = ensureAudio();
  if (!ctx || !_tensionGain || !_tensionFilter) return;
  if (!audioState.enabled || !isFinite(dist) || dist > 26) {
    _tensionGain.gain.setTargetAtTime(0, ctx.currentTime, 0.45);
    if (_tensionSource) _tensionSource.playbackRate.setTargetAtTime(1, ctx.currentTime, 0.45);
    return;
  }
  const d = Math.max(2, Math.min(26, dist));
  const t = 1 - (d - 2) / 24; // 0 lejos, 1 cerca
  _tensionGain.gain.setTargetAtTime(0.018 + t * 0.072, ctx.currentTime, 0.42);
  _tensionFilter.frequency.setTargetAtTime(1800 + t * 1400, ctx.currentTime, 0.45);
  if (_tensionSource) _tensionSource.playbackRate.setTargetAtTime(0.98 + t * 0.06, ctx.currentTime, 0.45);
}

export function stopTensionMusic() {
  _tensionWanted = false;
  const ctx = ensureAudio();
  if (_tensionGain && ctx) _tensionGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  const src = _tensionSource;
  _tensionSource = null;
  _tensionGain = null;
  _tensionFilter = null;
  if (src) {
    setTimeout(() => { try { src.stop(); } catch (e) {} }, 260);
  }
}

// Inicializar AudioContext en CUALQUIER evento de usuario.
// Importante: NO usar { once: true } — Chrome auto-suspende el AudioContext
// entre eventos (p.ej. al pasar por un overlay win/lose), y resumirlo
// requiere un gesto del usuario. Si solo escuchamos el primer click, los
// siguientes (Nueva, Reintentar) no reactivan el audio y el segundo
// maze queda mudo.
document.addEventListener('click',     ensureAudio);
document.addEventListener('keydown',   ensureAudio);
document.addEventListener('touchstart', ensureAudio, { passive: true });
document.addEventListener('pointerdown', ensureAudio);
document.addEventListener('visibilitychange', () => {
  if (!audioCtx) return;
  if (document.hidden && audioCtx.state === 'running') {
    audioCtx.suspend().catch(() => {});
  } else if (!document.hidden && audioState.enabled && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
});
