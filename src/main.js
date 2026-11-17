import './style.css';
import { RacingGame } from './game.js';
import { KART_TYPES } from './karts.js';
import { TRACK_THEMES } from './tracks.js';
import { sound } from './audio.js';

let selectedKart = KART_TYPES[0].id;
let selectedTrack = TRACK_THEMES[0].id;
let selectedColor = 0xff5252;

const CANDY_COLORS = [
  { hex: 0xff5252, css: '#ff5252' },
  { hex: 0x29b6f6, css: '#29b6f6' },
  { hex: 0xffeb3b, css: '#ffeb3b' },
  { hex: 0xff80ab, css: '#ff80ab' },
];

const menuEl = document.getElementById('menu-overlay');
const finishEl = document.getElementById('finish-overlay');
const hudEl = document.getElementById('hud');
const lapBadge = document.getElementById('lap-badge');
const coinBadge = document.getElementById('coin-badge');
const countdownEl = document.getElementById('countdown');
const itemBtn = document.getElementById('item-btn');

// Render Kart & Track choices
const kartRow = document.getElementById('kart-choices');
KART_TYPES.forEach((k) => {
  const btn = document.createElement('button');
  btn.className = `pick-btn ${k.id === selectedKart ? 'selected' : ''}`;
  btn.innerHTML = `<span class="emoji">${k.emoji}</span><span>${k.name}</span>`;
  btn.onclick = () => {
    selectedKart = k.id;
    document.querySelectorAll('#kart-choices .pick-btn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
  };
  kartRow.appendChild(btn);
});

const colorRow = document.getElementById('color-choices');
CANDY_COLORS.forEach((c, idx) => {
  const dot = document.createElement('button');
  dot.className = `color-dot ${idx === 0 ? 'selected' : ''}`;
  dot.style.background = c.css;
  dot.onclick = () => {
    selectedColor = c.hex;
    document.querySelectorAll('#color-choices .color-dot').forEach((d) => d.classList.remove('selected'));
    dot.classList.add('selected');
  };
  colorRow.appendChild(dot);
});

const trackRow = document.getElementById('track-choices');
TRACK_THEMES.forEach((t) => {
  const btn = document.createElement('button');
  btn.className = `pick-btn ${t.id === selectedTrack ? 'selected' : ''}`;
  btn.innerHTML = `<span class="emoji">${t.emoji}</span><span>${t.name}</span>`;
  btn.onclick = () => {
    selectedTrack = t.id;
    document.querySelectorAll('#track-choices .pick-btn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
  };
  trackRow.appendChild(btn);
});

const game = new RacingGame(document.getElementById('game-container'), {
  onLapChange: (lap, total) => {
    lapBadge.textContent = `🏁 第 ${lap} / ${total} 圈`;
  },
  onCoinChange: (coins) => {
    coinBadge.textContent = `⭐ ${coins}`;
  },
  onCountdown: (text) => {
    countdownEl.textContent = text;
  },
  onItemChange: (item) => {
    if (item) {
      itemBtn.textContent = item.emoji;
      itemBtn.classList.remove('hidden');
    } else {
      itemBtn.classList.add('hidden');
    }
  },
  onFinish: () => {
    sound.stopBGM();
    hudEl.classList.add('hidden');
    finishEl.classList.remove('hidden');
  },
});

function startGame() {
  sound.init();
  sound.startBGM();
  menuEl.classList.add('hidden');
  finishEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  game.start(selectedKart, selectedTrack, selectedColor);
}

document.getElementById('start-btn').onclick = startGame;
document.getElementById('replay-btn').onclick = () => {
  finishEl.classList.add('hidden');
  menuEl.classList.remove('hidden');
};

// Touch controls
const touchLeft = document.getElementById('touch-left');
const touchRight = document.getElementById('touch-right');
const leftHint = touchLeft.querySelector('.steer-hint');
const rightHint = touchRight.querySelector('.steer-hint');

const stopSteer = () => {
  game.setSteer(0);
  leftHint.classList.remove('active');
  rightHint.classList.remove('active');
};

touchLeft.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  game.setSteer(-1);
  leftHint.classList.add('active');
});
touchLeft.addEventListener('pointerup', stopSteer);
touchLeft.addEventListener('pointercancel', stopSteer);
touchLeft.addEventListener('pointerleave', stopSteer);

touchRight.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  game.setSteer(1);
  rightHint.classList.add('active');
});
touchRight.addEventListener('pointerup', stopSteer);
touchRight.addEventListener('pointercancel', stopSteer);
touchRight.addEventListener('pointerleave', stopSteer);

const muteBtn = document.getElementById('mute-btn');
muteBtn.onclick = () => {
  sound.muted = !sound.muted;
  muteBtn.textContent = sound.muted ? '🔇' : '🔊';
};

itemBtn.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  game.useItem();
});

// Keyboard support (for desktop testing)
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') game.setSteer(-1);
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') game.setSteer(1);
  if (e.key === ' ') game.useItem();
});
window.addEventListener('keyup', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(e.key)) {
    game.setSteer(0);
  }
});

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
