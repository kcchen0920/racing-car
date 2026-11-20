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
const pauseEl = document.getElementById('pause-overlay');
const hudEl = document.getElementById('hud');
const lapBadge = document.getElementById('lap-badge');
const coinBadge = document.getElementById('coin-badge');
const rankBadge = document.getElementById('rank-badge');
const speedBadge = document.getElementById('speed-badge');
const actionToast = document.getElementById('action-toast');
const speedLines = document.getElementById('speed-lines');
const countdownEl = document.getElementById('countdown');
const itemBtn = document.getElementById('item-btn');
let toastTimer = null;

function showActionToast(text) {
  if (!actionToast) return;
  actionToast.textContent = text;
  actionToast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    actionToast.classList.add('hidden');
  }, 1300);
}

function refreshShowroom() {
  if (!menuEl.classList.contains('hidden')) {
    game.showShowroom(selectedKart, selectedColor, localStorage.getItem('migou_hero_photo'));
  }
}

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
    refreshShowroom();
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
    refreshShowroom();
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

const heroUpload = document.getElementById('hero-upload');
const heroPreview = document.getElementById('hero-preview');
const heroRemove = document.getElementById('hero-remove');
const savedHero = localStorage.getItem('migou_hero_photo');
if (savedHero) {
  heroPreview.src = savedHero;
  heroPreview.classList.remove('hidden');
  heroRemove.classList.remove('hidden');
}

heroUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    heroPreview.src = reader.result;
    heroPreview.classList.remove('hidden');
    heroRemove.classList.remove('hidden');
    localStorage.setItem('migou_hero_photo', reader.result);
    refreshShowroom();
  };
  reader.readAsDataURL(file);
});

heroRemove.addEventListener('click', () => {
  localStorage.removeItem('migou_hero_photo');
  heroPreview.src = '';
  heroPreview.classList.add('hidden');
  heroRemove.classList.add('hidden');
  heroUpload.value = '';
  refreshShowroom();
});

const STORY_CHAPTERS = {
  zoo: '第 1 關完成！接下來要穿過時光門，前往「🦕 恐龍世界」找恐龍好朋友囉！',
  dino: '第 2 關完成！恐龍說「🐪 沙漠金字塔」裡有閃亮寶藏，我們出發吧！',
  desert: '第 3 關完成！最後一站潛入「🐠 水中世界」，跟海龜和熱帶魚開派對！',
  underwater: '🎊 恭喜米果哥完成全部 4 關大冒險！你是超級小賽車手！🏆',
};

const finishTitle = document.getElementById('finish-title');
const finishStatsEl = document.getElementById('finish-stats');
const storyText = document.getElementById('story-text');
const nextStageBtn = document.getElementById('next-stage-btn');

const BEST_RANKS_KEY = 'migou_best_ranks';
function loadBestRanks() {
  try {
    return JSON.parse(localStorage.getItem(BEST_RANKS_KEY) || '{}');
  } catch {
    return {};
  }
}
function updateBestRank(trackId, rank) {
  const bests = loadBestRanks();
  const prev = bests[trackId];
  const isNewBest = !prev || rank < prev;
  if (isNewBest) {
    bests[trackId] = rank;
    try {
      localStorage.setItem(BEST_RANKS_KEY, JSON.stringify(bests));
    } catch {}
  }
  return { best: bests[trackId], isNewBest };
}

const game = new RacingGame(document.getElementById('game-container'), {
  onLapChange: (lap, total) => {
    lapBadge.textContent = `🏁 第 ${lap} / ${total} 圈`;
  },
  onCoinChange: (coins) => {
    coinBadge.textContent = `⭐ ${coins}`;
  },
  onRankChange: (rank, total) => {
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏆';
    rankBadge.textContent = `${medal} 第 ${rank} / ${total} 名`;
  },
  onCountdown: (text) => {
    countdownEl.textContent = text;
  },
  onSpeedChange: (kmh, isBoosting) => {
    if (!speedBadge) return;
    speedBadge.textContent = `${kmh} km/h`;
    speedBadge.classList.toggle('boosting', Boolean(isBoosting));
  },
  onBoostStateChange: (isBoosting) => {
    if (!speedLines) return;
    speedLines.classList.toggle('hidden', !isBoosting);
  },
  onActionToast: (text) => {
    showActionToast(text);
  },
  onItemRoulette: (emoji) => {
    itemBtn.textContent = emoji;
    itemBtn.classList.remove('hidden');
    itemBtn.classList.add('roulette');
  },
  onItemChange: (item) => {
    itemBtn.classList.remove('roulette');
    if (item) {
      itemBtn.textContent = item.emoji;
      itemBtn.classList.remove('hidden');
    } else {
      itemBtn.classList.add('hidden');
    }
  },
  onFinish: (stats = {}) => {
    sound.stopBGM();
    hudEl.classList.add('hidden');
    finishEl.classList.remove('hidden');
    const rank = stats.rank || 1;
    const total = stats.total || 8;
    const coins = stats.coins ?? 0;
    const { best, isNewBest } = updateBestRank(selectedTrack, rank);
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏆';
    finishStatsEl.innerHTML = `
      <span class="stat-pill">${medal} 第 ${rank} / ${total} 名</span>
      <span class="stat-pill">⭐ 金幣 ${coins} 枚</span>
      <span class="stat-pill">${isNewBest ? '✨ 新紀錄！' : '🏅 最佳：'}第 ${best} 名</span>
    `;
    const idx = TRACK_THEMES.findIndex((t) => t.id === selectedTrack);
    const isLast = idx >= TRACK_THEMES.length - 1;
    finishTitle.textContent = isLast ? '🎉 大冒險全破關！🏆' : '🎉 太棒了！過關囉！🏆';
    storyText.textContent = STORY_CHAPTERS[selectedTrack] || '';
    if (isLast) {
      nextStageBtn.classList.add('hidden');
    } else {
      nextStageBtn.classList.remove('hidden');
    }
  },
});

async function startGame() {
  sound.init();
  sound.startBGM();
  if (gyroEnabled) {
    await ensureGyroPermission();
    calibrateGyro();
  }
  menuEl.classList.add('hidden');
  finishEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  speedLines.classList.add('hidden');
  actionToast.classList.add('hidden');
  game.start(selectedKart, selectedTrack, selectedColor, localStorage.getItem('migou_hero_photo'));
}

function goHome() {
  sound.stopBGM();
  sound.stopEngine();
  game.stopLoop();
  game.setGyroSteer(0);
  hudEl.classList.add('hidden');
  finishEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  speedLines.classList.add('hidden');
  actionToast.classList.add('hidden');
  menuEl.classList.remove('hidden');
  refreshShowroom();
}

document.getElementById('start-btn').onclick = startGame;
nextStageBtn.onclick = () => {
  const idx = TRACK_THEMES.findIndex((t) => t.id === selectedTrack);
  if (idx >= 0 && idx < TRACK_THEMES.length - 1) {
    selectedTrack = TRACK_THEMES[idx + 1].id;
    startGame();
  }
};
document.getElementById('replay-btn').onclick = goHome;

// Pause menu controls
const pauseBtn = document.getElementById('pause-btn');
pauseBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  resetAllSteer();
  sound.stopBGM();
  game.pause();
  pauseEl.classList.remove('hidden');
});
document.getElementById('resume-btn').onclick = () => {
  pauseEl.classList.add('hidden');
  sound.startBGM();
  game.resume();
};
document.getElementById('restart-btn').onclick = startGame;
document.getElementById('pause-home-btn').onclick = goHome;

// Launch live 3D showroom immediately on menu
refreshShowroom();

// Touch controls with independent pointerId tracking
const touchLeft = document.getElementById('touch-left');
const touchRight = document.getElementById('touch-right');
const leftHint = touchLeft.querySelector('.steer-hint');
const rightHint = touchRight.querySelector('.steer-hint');
const activeSteerPointers = new Map();
let currentButtonSteer = 0;
let smoothedGyroSteer = 0;

const refreshSteerHints = () => {
  const effective = currentButtonSteer !== 0 ? currentButtonSteer : smoothedGyroSteer;
  leftHint.classList.toggle('active', effective <= -0.22);
  rightHint.classList.toggle('active', effective >= 0.22);
};

const syncSteerFromPointers = () => {
  let hasLeft = false;
  let hasRight = false;
  let latestDir = 0;
  for (const dir of activeSteerPointers.values()) {
    if (dir === -1) hasLeft = true;
    if (dir === 1) hasRight = true;
    latestDir = dir;
  }
  currentButtonSteer = hasLeft && hasRight ? latestDir : hasLeft ? -1 : hasRight ? 1 : 0;
  game.setSteer(currentButtonSteer);
  refreshSteerHints();
};

// Gyroscope / DeviceOrientation parallel steering
const GYRO_KEY = 'migou_gyro_enabled';
const menuGyroBtn = document.getElementById('menu-gyro-btn');
const hudGyroBtn = document.getElementById('gyro-btn');
let gyroEnabled = localStorage.getItem(GYRO_KEY) !== 'false';
let gyroListening = false;
let neutralTilt = null;

function syncGyroButtons() {
  if (menuGyroBtn) {
    menuGyroBtn.classList.toggle('active', gyroEnabled);
    menuGyroBtn.textContent = gyroEnabled
      ? '🎮 體感方向盤：開（可與按鍵併用）'
      : '🎮 體感方向盤：關（僅使用按鍵）';
  }
  if (hudGyroBtn) {
    hudGyroBtn.classList.toggle('active', gyroEnabled);
  }
}

function calibrateGyro() {
  neutralTilt = null;
  smoothedGyroSteer = 0;
  game.setGyroSteer(0);
  refreshSteerHints();
}

function getScreenAngle() {
  if (window.screen && window.screen.orientation && typeof window.screen.orientation.angle === 'number') {
    return window.screen.orientation.angle;
  }
  return typeof window.orientation === 'number' ? window.orientation : 0;
}

function isNaturalLandscape(angle) {
  const type = window.screen?.orientation?.type || '';
  if (type.startsWith('landscape') && (angle === 0 || angle === 180)) return true;
  if (type.startsWith('portrait') && (angle === 90 || angle === 270)) return true;
  return false;
}

function onDeviceOrientation(e) {
  if (!gyroEnabled || game.mode !== 'race' || game.paused) return;
  const gamma = typeof e.gamma === 'number' ? e.gamma : null;
  const beta = typeof e.beta === 'number' ? e.beta : null;
  if (gamma === null && beta === null) return;
  // Ignore dummy 0/0 readings emitted by some browsers before sensor warms up
  if (gamma === 0 && beta === 0 && neutralTilt === null) return;

  const angle = ((getScreenAngle() % 360) + 360) % 360;
  const naturalLand = isNaturalLandscape(angle);
  let rawTilt = 0;
  if (angle === 90) {
    rawTilt = naturalLand ? -(beta ?? 0) : (beta ?? 0);
  } else if (angle === 270) {
    rawTilt = naturalLand ? (beta ?? 0) : -(beta ?? 0);
  } else if (angle === 180) {
    rawTilt = -(gamma ?? 0);
  } else {
    rawTilt = gamma ?? 0;
  }

  if (neutralTilt === null) {
    // Do NOT clamp neutralTilt: whatever angle the player holds the tablet at is 0° straight!
    neutralTilt = rawTilt;
  }

  let delta = rawTilt - neutralTilt;
  // Wrap-around guard for +/-180 boundary
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  const deadzone = 4;
  const maxTilt = 26;
  let target = 0;
  if (Math.abs(delta) > deadzone) {
    const sign = Math.sign(delta);
    target = Math.max(-1, Math.min(1, (delta - sign * deadzone) / (maxTilt - deadzone)));
  }

  smoothedGyroSteer += (target - smoothedGyroSteer) * 0.28;
  if (Math.abs(smoothedGyroSteer) < 0.03 && target === 0) smoothedGyroSteer = 0;
  game.setGyroSteer(smoothedGyroSteer);
  refreshSteerHints();
}

async function ensureGyroPermission() {
  if (typeof window.DeviceOrientationEvent === 'undefined') {
    return false;
  }
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const state = await DeviceOrientationEvent.requestPermission();
      if (state !== 'granted') {
        gyroEnabled = false;
        localStorage.setItem(GYRO_KEY, 'false');
        syncGyroButtons();
        showActionToast('⚠️ 未取得體感權限，改用觸控操作');
        return false;
      }
    } catch {
      return false;
    }
  }
  if (!gyroListening) {
    window.addEventListener('deviceorientation', onDeviceOrientation, true);
    gyroListening = true;
  }
  return true;
}

window.addEventListener('orientationchange', () => {
  if (gyroEnabled) calibrateGyro();
});

if (menuGyroBtn) {
  menuGyroBtn.addEventListener('click', async () => {
    gyroEnabled = !gyroEnabled;
    localStorage.setItem(GYRO_KEY, String(gyroEnabled));
    if (gyroEnabled) {
      await ensureGyroPermission();
      calibrateGyro();
    } else {
      calibrateGyro();
    }
    syncGyroButtons();
  });
}

if (hudGyroBtn) {
  hudGyroBtn.addEventListener('pointerdown', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    gyroEnabled = !gyroEnabled;
    localStorage.setItem(GYRO_KEY, String(gyroEnabled));
    if (gyroEnabled) {
      await ensureGyroPermission();
      calibrateGyro();
      showActionToast('🎮 體感方向盤已開啟！');
    } else {
      calibrateGyro();
      showActionToast('🎮 體感已關閉（純按鍵）');
    }
    syncGyroButtons();
  });
}

syncGyroButtons();
if (gyroEnabled && typeof window.DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
  window.addEventListener('deviceorientation', onDeviceOrientation, true);
  gyroListening = true;
}

const bindSteerZone = (el, dir) => {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    activeSteerPointers.set(e.pointerId, dir);
    try {
      el.setPointerCapture(e.pointerId);
    } catch {}
    syncSteerFromPointers();
  });
  const release = (e) => {
    if (activeSteerPointers.delete(e.pointerId)) {
      syncSteerFromPointers();
    }
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('lostpointercapture', release);
};

bindSteerZone(touchLeft, -1);
bindSteerZone(touchRight, 1);

const resetAllSteer = () => {
  activeSteerPointers.clear();
  syncSteerFromPointers();
};
window.addEventListener('blur', resetAllSteer);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resetAllSteer();
    game.pause();
  } else {
    game.resume();
  }
});

const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  sound.muted = !sound.muted;
  muteBtn.textContent = sound.muted ? '🔇' : '🔊';
});

itemBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  game.useItem();
});

// Prevent iOS Safari pinch-to-zoom, double-tap zoom, and viewport shift during gameplay
const preventDefault = (e) => e.preventDefault();
['gesturestart', 'gesturechange', 'gestureend'].forEach((evt) => {
  document.addEventListener(evt, preventDefault, { passive: false });
});

document.addEventListener(
  'touchstart',
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false }
);
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false }
);

[hudEl, document.getElementById('game-container')].forEach((el) => {
  el.addEventListener('touchstart', preventDefault, { passive: false });
  el.addEventListener('touchmove', preventDefault, { passive: false });
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
