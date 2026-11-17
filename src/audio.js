// Kid-friendly Web Audio API sound synthesizer (no external audio files needed)
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmTimer = null;
    this.bgmStep = 0;
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

  playFinish() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 0.25, 'triangle', 0.28), i * 120);
    });
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
