// Kid-friendly Web Audio API sound synthesizer (no external audio files needed)
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, duration, type = 'sine', volume = 0.2, slideTo = null) {
    if (this.muted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playCountdown(isGo = false) {
    if (isGo) {
      this.playTone(880, 0.4, 'triangle', 0.3);
    } else {
      this.playTone(440, 0.18, 'sine', 0.25);
    }
  }

  playPickup() {
    this.playTone(523, 0.1, 'sine', 0.2);
    setTimeout(() => this.playTone(659, 0.1, 'sine', 0.2), 70);
    setTimeout(() => this.playTone(784, 0.15, 'sine', 0.25), 140);
  }

  playBoost() {
    this.playTone(220, 0.45, 'sawtooth', 0.15, 660);
  }

  playStar() {
    const notes = [523, 659, 784, 1046, 784, 1046];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 0.12, 'triangle', 0.2), i * 80);
    });
  }

  playBubble() {
    this.playTone(300, 0.15, 'sine', 0.2, 600);
  }

  playBoing() {
    this.playTone(180, 0.22, 'sine', 0.25, 380);
  }

  playCoin() {
    this.playTone(987, 0.08, 'sine', 0.22);
    setTimeout(() => this.playTone(1318, 0.14, 'sine', 0.22), 65);
  }

  playFinish() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 0.25, 'triangle', 0.28), i * 120);
    });
  }

  playRouletteTick(step = 0) {
    this.playTone(540 + (step % 3) * 110, 0.05, 'sine', 0.14);
  }

  startEngine() {
    if (!this.ctx || this.engineOsc) return;
    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(65, this.ctx.currentTime);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, this.ctx.currentTime);
      gain.gain.setValueAtTime(this.muted ? 0.0001 : 0.032, this.ctx.currentTime);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      this.engineOsc = osc;
      this.engineFilter = filter;
      this.engineGain = gain;
    } catch {}
  }

  updateEngine(speedRatio = 0, isBoosting = false, isAirborne = false) {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.engineFilter) return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(2, speedRatio));
    const targetFreq = 62 + clamped * 68 + (isBoosting ? 28 : 0) + (isAirborne ? 18 : 0);
    const targetCutoff = isBoosting ? 460 : 210 + clamped * 140;
    const targetVol = this.muted ? 0.0001 : isBoosting ? 0.048 : 0.026 + clamped * 0.012;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.06);
    this.engineFilter.frequency.setTargetAtTime(targetCutoff, now, 0.06);
    this.engineGain.gain.setTargetAtTime(targetVol, now, 0.06);
  }

  stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch {}
      this.engineOsc = null;
      this.engineFilter = null;
      this.engineGain = null;
    }
  }

  startBGM() {
    if (this.bgmTimer) return;
    // Cheerful bouncy kid-friendly melody (C major pentatonic)
    const melody = [
      523, 659, 784, 659, 880, 784, 659, 523,
      587, 659, 784, 880, 784, 659, 587, 0,
    ];
    const bass = [261, 0, 392, 0, 349, 0, 392, 0, 293, 0, 392, 0, 261, 0, 392, 0];

    this.bgmTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const m = melody[this.bgmStep % melody.length];
      const b = bass[this.bgmStep % bass.length];
      if (m > 0) this.playTone(m, 0.16, 'triangle', 0.08);
      if (b > 0) this.playTone(b, 0.22, 'sine', 0.07);
      this.bgmStep++;
    }, 220);
  }

  stopBGM() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

export const sound = new SoundManager();
