import * as THREE from 'three';
import { createKartMesh, KART_TYPES } from './karts.js';
import { buildTrack } from './tracks.js';
import { sound } from './audio.js';

const ITEMS = [
  { id: 'mushroom', emoji: '🍄', name: '加速蘑菇' },
  { id: 'star', emoji: '⭐', name: '無敵星星' },
  { id: 'bubble', emoji: '🫧', name: '泡泡護盾' },
];

export class RacingGame {
  constructor(container, callbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.mode = 'idle'; // 'idle' | 'showroom' | 'race'
    this.running = false;
    this.paused = false;
    this.steerInput = 0; // -1 left, 1 right
    this.totalLaps = 2;
    this.rafId = null;
    this.lastFrameTime = 0;
    this.elapsedTime = 0;
    this.countdownTimers = [];
    this.countdownStep = 0;
    this.rocketStartReady = false;
    this.victoryTimer = 0;
    this.victoryStats = null;
    this.showroomKart = null;
    this.baseFov = 72;
    this.boostFovOffset = 0;
    this.cameraShake = 0;
    this.particles = [];
    this.particleMats = null;
    this.skidMarks = [];
    this.emoteTextures = {};
    this.activeEmotes = [];
    this.lastReportedSpeed = -1;
    this.lastBoostState = false;
    this.minimapCanvas = document.getElementById('minimap');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;
    this.minimapData = null;

    // Reusable vectors to avoid per-frame GC allocations
    this._tmpPt = new THREE.Vector3();
    this._tmpTan = new THREE.Vector3();
    this._tmpTan2 = new THREE.Vector3();
    this._tmpNorm = new THREE.Vector3();
    this._tmpPos = new THREE.Vector3();
    this._tmpLook = new THREE.Vector3();
    this._tmpCamPos = new THREE.Vector3();
    this._tmpCamLook = new THREE.Vector3();
    this._tmpCamUp = new THREE.Vector3(0, 5.5, 0);
    this.camBasePos = new THREE.Vector3();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      72,
      container.clientWidth / container.clientHeight,
      0.1,
      600
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);
    this.onResize();

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.onResize(), 120));
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.onResize());
    }
  }

  onResize() {
    if (!this.container) return;
    if (window.scrollX !== 0 || window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }
    const w = this.container.clientWidth || window.innerWidth || 1;
    const h = this.container.clientHeight || window.innerHeight || 1;
    const aspect = w / h;

    // Preserve horizontal field of view on portrait / narrow WebViews
    const baseVFov = 72;
    if (aspect < 1.25) {
      const tanHalfH = Math.tan(THREE.MathUtils.degToRad(baseVFov / 2)) * 1.25;
      const vFov = THREE.MathUtils.radToDeg(2 * Math.atan(tanHalfH / Math.max(0.45, aspect)));
      this.baseFov = Math.min(104, Math.max(baseVFov, vFov));
    } else {
      this.baseFov = baseVFov;
    }

    this.camera.fov = this.baseFov + this.boostFovOffset;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  stopLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.countdownTimers.forEach((id) => clearTimeout(id));
    this.countdownTimers = [];
    sound.stopEngine();
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    sound.stopEngine();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    if (this.mode === 'showroom') {
      this.lastFrameTime = performance.now();
      this.rafId = requestAnimationFrame((t) => this.animate(t));
      return;
    }
    if (this.mode === 'race' && this.player && (this.player.lap <= this.totalLaps || this.victoryTimer > 0)) {
      if (this.running) sound.startEngine();
      this.lastFrameTime = performance.now();
      this.rafId = requestAnimationFrame((t) => this.animate(t));
    }
  }

  showShowroom(kartId, customColor = null, heroPhotoUrl = null) {
    this.stopLoop();
    this.disposeScene();
    this.mode = 'showroom';
    this.running = false;
    this.paused = false;
    this.player = null;
    this.track = null;
    this.boostFovOffset = 0;
    this.elapsedTime = 0;
    this.lastFrameTime = performance.now();
    this.onResize();

    this.scene.background = new THREE.Color(0xfff9f0);
    this.scene.fog = null;

    const hemi = new THREE.HemisphereLight(0xffffff, 0xb2ebf2, 1.25);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfffde7, 1.15);
    dir.position.set(12, 22, 16);
    this.scene.add(dir);

    // Cute rotating podium
    const podium = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 3.0, 0.45, 28),
      new THREE.MeshStandardMaterial({ color: 0xffd54f, roughness: 0.35, metalness: 0.1 })
    );
    podium.position.set(0, -0.25, 0);
    this.scene.add(podium);

    const kart = createKartMesh(kartId, customColor, heroPhotoUrl, false);
    kart.position.set(0, 0, 0);
    this.scene.add(kart);
    this.showroomKart = kart;

    this.camera.position.set(0, 3.4, 7.6);
    this.camera.lookAt(0, -0.35, 0);
    this.rafId = requestAnimationFrame((t) => this.animate(t));
  }

  disposeScene() {
    const disposedGeos = new Set();
    const disposedMats = new Set();
    const disposedTexs = new Set();

    this.scene.traverse((obj) => {
      if (obj.geometry && !disposedGeos.has(obj.geometry)) {
        disposedGeos.add(obj.geometry);
        obj.geometry.dispose();
      }
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mat) => {
          if (!mat || disposedMats.has(mat)) return;
          disposedMats.add(mat);
          if (mat.map && !disposedTexs.has(mat.map)) {
            disposedTexs.add(mat.map);
            mat.map.dispose();
          }
          mat.dispose();
        });
      }
    });

    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
  }

  initParticles() {
    this.particles = [];
    const geo = new THREE.SphereGeometry(0.24, 6, 6);
    this.particleMats = {
      flame: new THREE.MeshBasicMaterial({ color: 0xff9100, transparent: true, opacity: 0.9 }),
      spark: new THREE.MeshBasicMaterial({ color: 0xffee58, transparent: true, opacity: 0.95 }),
      dust: new THREE.MeshBasicMaterial({ color: 0xe0e0e0, transparent: true, opacity: 0.65 }),
      coin: new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.95 }),
      wind: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }),
      confettiA: new THREE.MeshBasicMaterial({ color: 0xff5252 }),
      confettiB: new THREE.MeshBasicMaterial({ color: 0x4fc3f7 }),
      confettiC: new THREE.MeshBasicMaterial({ color: 0xffeb3b }),
      confettiD: new THREE.MeshBasicMaterial({ color: 0x69f0ae }),
    };
    for (let i = 0; i < 110; i++) {
      const mesh = new THREE.Mesh(geo, this.particleMats.flame);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        baseScale: 1,
      });
    }
  }

  initSkidMarks() {
    this.skidMarks = [];
    const geo = new THREE.PlaneGeometry(0.32, 1.15);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 40; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x263238,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.skidMarks.push({ mesh, life: 0, maxLife: 1.4 });
    }
    this.skidCursor = 0;
  }

  spawnSkidMark(x, z, tanX, tanZ) {
    if (!this.skidMarks.length) return;
    const s = this.skidMarks[this.skidCursor % this.skidMarks.length];
    this.skidCursor++;
    s.mesh.position.set(x, 0.045, z);
    s.mesh.lookAt(x + tanX, 0.045, z + tanZ);
    s.mesh.material.opacity = 0.45;
    s.mesh.visible = true;
    s.life = s.maxLife;
  }

  updateSkidMarks(dt) {
    for (let i = 0; i < this.skidMarks.length; i++) {
      const s = this.skidMarks[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.visible = false;
      } else {
        s.mesh.material.opacity = 0.45 * (s.life / s.maxLife);
      }
    }
  }

  getEmoteTexture(emoji) {
    if (this.emoteTextures[emoji]) return this.emoteTextures[emoji];
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '68px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 68);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.emoteTextures[emoji] = tex;
    return tex;
  }

  showKartEmote(kart, emoji) {
    if (!kart || !kart.mesh) return;
    const existing = this.activeEmotes.find((e) => e.kart === kart);
    if (existing) {
      existing.sprite.material.map = this.getEmoteTexture(emoji);
      existing.sprite.material.needsUpdate = true;
      existing.life = 1.05;
      existing.sprite.visible = true;
      return;
    }
    const mat = new THREE.SpriteMaterial({
      map: this.getEmoteTexture(emoji),
      transparent: true,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.5, 1.5, 1);
    sprite.position.set(0, 3.6, 0);
    sprite.frustumCulled = false;
    kart.mesh.add(sprite);
    this.activeEmotes.push({ kart, sprite, life: 1.05 });
  }

  updateEmotes(dt) {
    for (let i = 0; i < this.activeEmotes.length; i++) {
      const e = this.activeEmotes[i];
      if (e.life <= 0) continue;
      e.life -= dt;
      if (e.life <= 0) {
        e.sprite.visible = false;
      } else {
        e.sprite.position.y = 3.5 + (1.05 - e.life) * 0.7;
        e.sprite.material.opacity = Math.min(1, e.life * 2.5);
      }
    }
  }

  spawnParticle(type, x, y, z, vx, vy, vz, life = 0.4, scale = 1) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.life <= 0) {
        p.mesh.material = this.particleMats[type] || this.particleMats.flame;
        p.mesh.position.set(x, y, z);
        p.vx = vx;
        p.vy = vy;
        p.vz = vz;
        p.life = life;
        p.maxLife = life;
        p.baseScale = scale;
        p.mesh.scale.setScalar(scale);
        p.mesh.visible = true;
        return;
      }
    }
  }

  updateParticles(dt) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 4.5 * dt;
      const ratio = Math.max(0.05, p.life / p.maxLife);
      p.mesh.scale.setScalar(p.baseScale * ratio);
    }
  }

  initMinimap() {
    if (!this.track || !this.minimapCanvas) return;
    const pts = [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const samples = 96;
    for (let i = 0; i < samples; i++) {
      const p = this.track.curve.getPointAt(i / samples);
      pts.push({ x: p.x, z: p.z });
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const pad = 14;
    const span = Math.max(maxX - minX, maxZ - minZ, 1);
    const size = this.minimapCanvas.width - pad * 2;
    const offsetX = pad + (size - ((maxX - minX) / span) * size) * 0.5;
    const offsetY = pad + (size - ((maxZ - minZ) / span) * size) * 0.5;
    this.minimapData = {
      pts,
      minX,
      minZ,
      scale: size / span,
      offsetX,
      offsetY,
    };
  }

  drawMinimap() {
    if (!this.minimapCtx || !this.minimapData || !this.player) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const { pts, minX, minZ, scale, offsetX, offsetY } = this.minimapData;

    ctx.clearRect(0, 0, w, h);

    // Track outline
    ctx.beginPath();
    pts.forEach((p, idx) => {
      const mx = offsetX + (p.x - minX) * scale;
      const my = offsetY + (p.z - minZ) * scale;
      if (idx === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(55, 71, 79, 0.45)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // AI dots
    this.ais.forEach((ai) => {
      const pos = ai.mesh.position;
      const mx = offsetX + (pos.x - minX) * scale;
      const my = offsetY + (pos.z - minZ) * scale;
      ctx.beginPath();
      ctx.arc(mx, my, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = ai.colorCss;
      ctx.fill();
    });

    // Player dot (larger with crisp white border)
    const pPos = this.player.mesh.position;
    const px = offsetX + (pPos.x - minX) * scale;
    const py = offsetY + (pPos.z - minZ) * scale;
    ctx.beginPath();
    ctx.arc(px, py, 5.8, 0, Math.PI * 2);
    ctx.fillStyle = this.player.colorCss;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  start(kartId, trackId, customColor = null, heroPhotoUrl = null) {
    this.stopLoop();
    this.disposeScene();
    this.mode = 'race';
    this.showroomKart = null;
    this.paused = false;
    this.boostFovOffset = 0;
    this.cameraShake = 0;
    this.victoryTimer = 0;
    this.victoryStats = null;
    this.countdownStep = 0;
    this.rocketStartReady = false;
    this.activeEmotes = [];
    this.emoteTextures = {};
    this.lastReportedSpeed = -1;
    this.lastBoostState = false;
    this.elapsedTime = 0;
    this.lastFrameTime = performance.now();
    this.onResize();

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x5d6d7e, 1.15);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfffde7, 1.05);
    dir.position.set(60, 120, 60);
    dir.castShadow = true;
    dir.shadow.camera.left = -160;
    dir.shadow.camera.right = 160;
    dir.shadow.camera.top = 160;
    dir.shadow.camera.bottom = -160;
    this.scene.add(dir);

    this.track = buildTrack(this.scene, trackId);
    this.initParticles();
    this.initSkidMarks();
    this.initMinimap();

    // Setup Player
    const playerMesh = createKartMesh(kartId, customColor, heroPhotoUrl, true);
    this.scene.add(playerMesh);
    const playerColorHex = playerMesh.userData.baseColor;
    this.player = {
      mesh: playerMesh,
      colorCss: `#${new THREE.Color(playerColorHex).getHexString()}`,
      t: 0,
      lateral: 0, // -1 to 1 across roadWidth
      lateralVel: 0,
      yPos: 0,
      yVel: 0,
      squash: 0,
      tilt: 0,
      pitch: 0,
      driftTime: 0,
      driftDir: 0,
      driftYaw: 0,
      steerAngle: 0,
      slipstreamTime: 0,
      slipstreamActive: false,
      slipstreamToastShown: false,
      hitCooldown: 0,
      itemRouletteTimer: 0,
      itemRouletteTick: 0,
      pendingItem: null,
      speed: 0,
      baseSpeed: 0.00052, // relaxed kid-friendly speed for longer track
      lap: 1,
      coins: 0,
      item: null,
      boostTimer: 0,
      starTimer: 0,
      bubbleTimer: 0,
      slowTimer: 0,
      bounceTimer: 0,
    };

    // Setup 7 AI opponents (8 cars total) with colors guaranteed distinct from player
    const playerHsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(playerColorHex).getHSL(playerHsl);
    const aiColorPool = [
      0xab47bc, // purple
      0x26a69a, // teal
      0xff9800, // orange
      0x5c6bc0, // indigo
      0x66bb6a, // green
      0x8d6e63, // brown
      0x78909c, // slate
      0x00acc1, // cyan
      0x9ccc65, // lime
      0x7e57c2, // deep purple
      0x29b6f6, // sky blue
      0xec407a, // magenta
    ];
    const tmpHsl = { h: 0, s: 0, l: 0 };
    const aiColors = aiColorPool.filter((hex) => {
      if (hex === playerColorHex) return false;
      new THREE.Color(hex).getHSL(tmpHsl);
      const rawDiff = Math.abs(tmpHsl.h - playerHsl.h);
      const hueDiff = Math.min(rawDiff, 1 - rawDiff);
      // Avoid colors visually close to player's hue when both are saturated
      if (tmpHsl.s > 0.25 && playerHsl.s > 0.25 && hueDiff < 0.085) return false;
      return true;
    });

    this.ais = Array.from({ length: 7 }, (_, idx) => {
      const typeId = KART_TYPES[idx % KART_TYPES.length].id;
      const colorHex = aiColors[idx % aiColors.length];
      const mesh = createKartMesh(typeId, colorHex);
      this.scene.add(mesh);
      const initLat = ((idx % 3) - 1) * 0.45;
      return {
        mesh,
        colorCss: `#${new THREE.Color(colorHex).getHexString()}`,
        t: 0.01 * (idx + 1),
        lateral: initLat,
        targetLateral: initLat,
        laneTimer: 1.5 + idx * 0.4,
        yPos: 0,
        yVel: 0,
        squash: 0,
        tilt: 0,
        pitch: 0,
        driftYaw: 0,
        steerAngle: 0,
        baseSpeed: 0.00046 + (idx % 4) * 0.000025,
        speed: 0.00046,
        lap: 1,
      };
    });

    this.updateKartTransform(this.player, 0, 1);
    this.ais.forEach((ai) => this.updateKartTransform(ai, 0, 1));
    this.snapCamera();
    this.drawMinimap();

    this.running = false;
    this.lastReportedRank = -1;
    this.callbacks.onLapChange(1, this.totalLaps);
    this.callbacks.onCoinChange(0);
    this.callbacks.onItemChange(null);
    this.callbacks.onRankChange?.(1 + this.ais.length, 1 + this.ais.length);

    // 3-2-1-GO Countdown
    this.runCountdown();
    this.rafId = requestAnimationFrame((t) => this.animate(t));
  }

  runCountdown() {
    const steps = ['3', '2', '1', 'GO!'];
    steps.forEach((label, idx) => {
      const id = setTimeout(() => {
        this.countdownStep = idx;
        this.callbacks.onCountdown(label);
        sound.playCountdown(label === 'GO!');
        if (label === 'GO!') {
          this.running = true;
          sound.startEngine();
          if (this.rocketStartReady && this.player) {
            this.player.boostTimer = 70;
            this.player.speed = this.player.baseSpeed * 1.28;
            sound.playBoost();
            this.callbacks.onActionToast?.('🚀 完美起跑！');
            this.showKartEmote(this.player, '🔥');
          }
          const clearId = setTimeout(() => this.callbacks.onCountdown(''), 700);
          this.countdownTimers.push(clearId);
        }
      }, idx * 800);
      this.countdownTimers.push(id);
    });
  }

  setSteer(val) {
    this.steerInput = val;
    if (!this.running && this.mode === 'race' && this.countdownStep === 2 && val !== 0) {
      this.rocketStartReady = true;
    }
  }

  useItem() {
    if (!this.running || !this.player || !this.player.item) return;
    const item = this.player.item;
    this.player.item = null;
    this.callbacks.onItemChange(null);

    if (item.id === 'mushroom') {
      this.player.boostTimer = 110;
      sound.playBoost();
    } else if (item.id === 'star') {
      this.player.starTimer = 180;
      this.player.boostTimer = 180;
      sound.playStar();
    } else if (item.id === 'bubble') {
      this.player.bubbleTimer = 240;
      this.player.mesh.userData.bubble.visible = true;
      sound.playBubble();
    }
  }

  computeRank() {
    if (!this.player) return 1;
    const playerProg = this.player.lap + this.player.t;
    let aheadCount = 0;
    this.ais.forEach((ai) => {
      if (ai.lap + ai.t > playerProg) aheadCount++;
    });
    return 1 + aheadCount;
  }

  snapCamera() {
    if (!this.player || !this.track) return;
    const safeT = ((this.player.t % 1) + 1) % 1;
    const kartPos = this.player.mesh.position;
    this.track.curve.getTangentAt(safeT, this._tmpTan);
    if (this._tmpTan.lengthSq() > 1e-6) this._tmpTan.normalize();
    else this._tmpTan.set(0, 0, 1);

    this._tmpCamPos
      .copy(kartPos)
      .addScaledVector(this._tmpTan, -11)
      .add(this._tmpCamUp);
    this.camBasePos.copy(this._tmpCamPos);
    this.camera.position.copy(this.camBasePos);
    this._tmpCamLook.copy(kartPos).addScaledVector(this._tmpTan, 5);
    this._tmpCamLook.y += 1.2;
    this.camera.lookAt(this._tmpCamLook);
  }

  updateKartTransform(kart, yOffset = 0, dt60 = 1) {
    const safeT = Number.isFinite(kart.t) ? ((kart.t % 1) + 1) % 1 : 0;
    const safeLat = Number.isFinite(kart.lateral) ? Math.max(-1, Math.min(1, kart.lateral)) : 0;
    const safeY = Number.isFinite(yOffset) ? Math.max(0, Math.min(12, yOffset)) : 0;

    this.track.curve.getPointAt(safeT, this._tmpPt);
    this.track.curve.getTangentAt(safeT, this._tmpTan);
    if (this._tmpTan.lengthSq() > 1e-6) this._tmpTan.normalize();
    else this._tmpTan.set(0, 0, 1);
    this._tmpNorm.set(-this._tmpTan.z, 0, this._tmpTan.x);

    const maxOffset = this.track.roadWidth * 0.38;
    this._tmpPos.copy(this._tmpPt).addScaledVector(this._tmpNorm, safeLat * maxOffset);
    kart.mesh.position.set(this._tmpPos.x, safeY, this._tmpPos.z);

    this._tmpLook.copy(this._tmpPos).add(this._tmpTan);
    this._tmpLook.y = safeY;
    kart.mesh.lookAt(this._tmpLook);
    kart.mesh.visible = true;

    // Apply chassis animations (drift yaw, roll, pitch, suspension squash, idle hum) cleanly on child group
    const ud = kart.mesh.userData;
    const chassis = ud.chassisGroup;
    if (chassis) {
      const tilt = Number.isFinite(kart.tilt) ? Math.max(-0.26, Math.min(0.26, kart.tilt)) : 0;
      const pitch = Number.isFinite(kart.pitch) ? Math.max(-0.22, Math.min(0.22, kart.pitch)) : 0;
      const driftYaw = Number.isFinite(kart.driftYaw) ? Math.max(-0.25, Math.min(0.25, kart.driftYaw)) : 0;
      const squash = Number.isFinite(kart.squash) ? Math.max(0, Math.min(0.2, kart.squash)) : 0;
      const idleHum = Math.sin(this.elapsedTime * 28 + safeLat * 3) * 0.016;

      chassis.rotation.set(pitch, driftYaw, tilt);
      chassis.position.y = idleHum;
      chassis.scale.set(1 + squash * 0.45, 1 - squash, 1 + squash * 0.25);
    }

    // Steer front wheel pivots
    if (ud.frontWheelPivots) {
      const steerAng = Number.isFinite(kart.steerAngle) ? kart.steerAngle : 0;
      ud.frontWheelPivots.forEach((pivot) => {
        pivot.rotation.y = steerAng;
      });
    }

    // Spin wheels proportionally to speed
    const wheelSpin = this.running ? 0.25 * dt60 : 0.04 * dt60;
    ud.wheels.forEach((w) => {
      w.rotation.x += wheelSpin;
    });
  }

  animate(now = performance.now()) {
    if (!this.renderer || this.paused) return;

    const dt = this.lastFrameTime ? Math.min(Math.max((now - this.lastFrameTime) / 1000, 0.001), 0.05) : 1 / 60;
    this.lastFrameTime = now;
    const dt60 = dt * 60;
    this.elapsedTime += dt;

    // Live 3D Showroom rotation on Menu
    if (this.mode === 'showroom') {
      if (this.showroomKart) {
        this.showroomKart.rotation.y += dt * 0.75;
        this.showroomKart.position.y = Math.sin(this.elapsedTime * 3) * 0.06;
        const ud = this.showroomKart.userData;
        if (ud && ud.wheels) {
          ud.wheels.forEach((w) => {
            w.rotation.x += 0.08 * dt60;
          });
        }
      }
      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame((t) => this.animate(t));
      return;
    }

    let finishedThisFrame = false;

    if (this.running && this.player) {
      const p = this.player;
      if (p.hitCooldown > 0) p.hitCooldown = Math.max(0, p.hitCooldown - dt);

      // Item Roulette spin
      if (p.itemRouletteTimer > 0) {
        p.itemRouletteTimer -= dt;
        p.itemRouletteTick += dt;
        if (p.itemRouletteTimer <= 0) {
          p.item = p.pendingItem;
          p.pendingItem = null;
          this.callbacks.onItemChange?.(p.item);
          sound.playPickup();
        } else if (p.itemRouletteTick >= 0.09) {
          p.itemRouletteTick = 0;
          const idx = Math.floor(this.elapsedTime * 15) % ITEMS.length;
          this.callbacks.onItemRoulette?.(ITEMS[idx].emoji);
          sound.playRouletteTick(idx);
        }
      }

      // Compute track curvature for cornering physics (strictly bounded)
      const safeTNow = ((p.t % 1) + 1) % 1;
      this.track.curve.getTangentAt(safeTNow, this._tmpTan);
      this.track.curve.getTangentAt((safeTNow + 0.012) % 1, this._tmpTan2);
      if (this._tmpTan.lengthSq() > 1e-6) this._tmpTan.normalize();
      else this._tmpTan.set(0, 0, 1);
      if (this._tmpTan2.lengthSq() > 1e-6) this._tmpTan2.normalize();
      else this._tmpTan2.copy(this._tmpTan);
      const rawCurv = this._tmpTan.z * this._tmpTan2.x - this._tmpTan.x * this._tmpTan2.z;
      const curvature = Number.isFinite(rawCurv) ? Math.max(-0.35, Math.min(0.35, rawCurv)) : 0;

      // 1. Target Speed with Boost, Slow, Slipstream, and Inner-Lane Apex Bonus
      let targetSpeed = p.baseSpeed;
      if (p.boostTimer > 0) {
        targetSpeed *= 1.38;
        p.boostTimer = Math.max(0, p.boostTimer - dt60);
      } else if (p.slowTimer > 0) {
        targetSpeed *= 0.48;
        p.slowTimer = Math.max(0, p.slowTimer - dt60);
      }
      if (p.slipstreamActive && p.slowTimer <= 0) {
        targetSpeed *= 1.14;
      }
      const apexMult = Math.max(0.95, Math.min(1.05, 1 - curvature * p.lateral * 0.16));
      targetSpeed *= apexMult;

      // Smooth acceleration & inertia curve
      const accelRate = targetSpeed > p.speed ? 4.2 : 6.5;
      p.speed += (targetSpeed - p.speed) * Math.min(1, dt * accelRate);

      // 2. Gravity, Jump Ramps & Suspension Squash
      if (p.yPos > 0 || p.yVel > 0) {
        p.yPos += p.yVel * dt;
        p.yVel -= 34 * dt;
        if (p.yPos <= 0) {
          p.yPos = 0;
          if (p.yVel < -5) {
            p.squash = 0.14;
            this.cameraShake = Math.max(this.cameraShake, 0.16);
            const kp = p.mesh.position;
            for (let k = 0; k < 5; k++) {
              this.spawnParticle(
                'dust',
                kp.x + (Math.random() - 0.5) * 1.8,
                0.3,
                kp.z + (Math.random() - 0.5) * 1.8,
                (Math.random() - 0.5) * 4,
                1.5 + Math.random() * 2,
                (Math.random() - 0.5) * 4,
                0.35,
                1.2
              );
            }
          }
          p.yVel = 0;
        }
      }
      p.squash *= Math.pow(0.84, dt60);

      let bounceY = 0;
      if (p.bounceTimer > 0) {
        p.bounceTimer = Math.max(0, p.bounceTimer - dt60);
        bounceY = Math.abs(Math.sin(p.bounceTimer * 0.4)) * 1.4;
      }

      // Rainbow star effect
      if (p.starTimer > 0) {
        p.starTimer = Math.max(0, p.starTimer - dt60);
        const hue = (this.elapsedTime * 3.0) % 1;
        p.mesh.userData.bodyMat.color.setHSL(hue, 0.9, 0.55);
        if (p.starTimer === 0) {
          p.mesh.userData.bodyMat.color.setHex(p.mesh.userData.baseColor);
        }
      }

      if (p.bubbleTimer > 0) {
        p.bubbleTimer = Math.max(0, p.bubbleTimer - dt60);
        if (p.bubbleTimer === 0) {
          p.mesh.userData.bubble.visible = false;
        }
      }

      // 3. Steering with Lateral Velocity + Cornering Centrifugal Force + Auto-Drift & Mini-Turbo
      if (this.steerInput !== 0) {
        const targetLatVel = this.steerInput * 1.95;
        p.lateralVel += (targetLatVel - p.lateralVel) * Math.min(1, dt * 11);
        if (p.driftDir === this.steerInput) {
          p.driftTime += dt;
        } else {
          p.driftDir = this.steerInput;
          p.driftTime = 0;
        }
      } else {
        // Release after sustained drift triggers Mini-Turbo!
        if (p.driftTime >= 0.75) {
          p.boostTimer = Math.max(p.boostTimer, 48);
          try { sound.playBoost(); } catch (_) {}
          this.callbacks.onActionToast?.('🔥 甩尾加速！');
          this.showKartEmote(p, '🔥');
        }
        p.driftTime = 0;
        p.driftDir = 0;
        p.lateralVel *= Math.pow(0.82, dt60);
        // Gentle auto-center assist
        p.lateral *= Math.pow(0.975, dt60);
      }

      // Gentle outward centrifugal push in corners
      p.lateralVel += curvature * 1.15 * dt;

      p.lateral += p.lateralVel * dt;
      if (p.lateral < -1 || p.lateral > 1) {
        p.lateral = Math.max(-1, Math.min(1, p.lateral));
        p.lateralVel *= 0.3;
      }

      // Visual chassis roll, drift yaw, pitch, and front wheel angle
      const isDrifting = p.driftTime >= 0.65 && p.yPos <= 0.05;
      const targetTilt = -p.lateralVel * 0.09;
      p.tilt += (targetTilt - p.tilt) * Math.min(1, dt * 12);

      const targetDriftYaw = isDrifting ? -p.driftDir * 0.14 : 0;
      p.driftYaw += (targetDriftYaw - p.driftYaw) * Math.min(1, dt * 8);

      const targetPitch =
        p.yPos > 0.1
          ? Math.max(-0.18, Math.min(0.18, -p.yVel * 0.012))
          : p.boostTimer > 0
          ? -0.06
          : p.slowTimer > 0
          ? 0.06
          : 0;
      p.pitch += (targetPitch - p.pitch) * Math.min(1, dt * 10);

      const targetSteerAng = -this.steerInput * 0.36;
      p.steerAngle += (targetSteerAng - p.steerAngle) * Math.min(1, dt * 14);

      // Exhaust flames toggle & flicker + Speedometer & Speed Lines & Engine Audio
      const isBoosting = p.boostTimer > 0 || p.slipstreamActive;
      if (p.mesh.userData.exhaustFlames) {
        p.mesh.userData.exhaustFlames.forEach((flame) => {
          flame.visible = isBoosting;
          if (isBoosting) {
            const flicker = 0.8 + Math.random() * 0.45;
            flame.scale.set(0.9, 0.9, flicker);
          }
        });
      }

      const kmh = Math.round((p.speed / p.baseSpeed) * 62);
      if (kmh !== this.lastReportedSpeed || isBoosting !== this.lastBoostState) {
        this.lastReportedSpeed = kmh;
        this.callbacks.onSpeedChange?.(kmh, isBoosting);
      }
      if (isBoosting !== this.lastBoostState) {
        this.lastBoostState = isBoosting;
        this.callbacks.onBoostStateChange?.(isBoosting);
      }
      sound.updateEngine(p.speed / p.baseSpeed, isBoosting, p.yPos > 0.25);

      // Advance along track
      const prevT = p.t;
      p.t = ((p.t + p.speed * dt60) % 1 + 1) % 1;

      if (p.t < prevT) {
        p.lap++;
        if (p.lap > this.totalLaps) {
          this.running = false;
          sound.stopEngine();
          sound.playFinish();
          this.callbacks.onBoostStateChange?.(false);
          this.callbacks.onActionToast?.('🏆 衝過終點線！');
          this.showKartEmote(p, '😆');
          this.victoryTimer = 1.75;
          this.victoryStats = {
            rank: this.computeRank(),
            total: 1 + this.ais.length,
            coins: p.coins,
          };
        } else {
          this.callbacks.onLapChange(p.lap, this.totalLaps);
          if (p.lap === this.totalLaps) {
            this.callbacks.onActionToast?.('🏁 最後一圈！加油！');
          }
        }
      }

      this.updateKartTransform(p, p.yPos + bounceY, dt60);

      // Spawn drift sparks, skid marks & boost flame particles
      const kp = p.mesh.position;
      if (isDrifting) {
        if (Math.random() < 0.55) {
          this.spawnParticle(
            'spark',
            kp.x + (Math.random() - 0.5) * 1.6,
            0.25,
            kp.z + (Math.random() - 0.5) * 1.6,
            (Math.random() - 0.5) * 4,
            1.8 + Math.random() * 2.2,
            (Math.random() - 0.5) * 4,
            0.28,
            0.85
          );
        }
        if (Math.random() < 0.65) {
          const rx = kp.x - this._tmpTan.x * 1.0;
          const rz = kp.z - this._tmpTan.z * 1.0;
          this.spawnSkidMark(rx + this._tmpNorm.x * 1.05, rz + this._tmpNorm.z * 1.05, this._tmpTan.x, this._tmpTan.z);
          this.spawnSkidMark(rx - this._tmpNorm.x * 1.05, rz - this._tmpNorm.z * 1.05, this._tmpTan.x, this._tmpTan.z);
        }
      }
      if (isBoosting && Math.random() < 0.65) {
        this.spawnParticle(
          p.slipstreamActive && p.boostTimer <= 0 ? 'wind' : 'flame',
          kp.x - this._tmpTan.x * 2.1 + (Math.random() - 0.5) * 0.9,
          kp.y + 0.85,
          kp.z - this._tmpTan.z * 2.1 + (Math.random() - 0.5) * 0.9,
          -this._tmpTan.x * 5 + (Math.random() - 0.5) * 1.5,
          0.8 + Math.random(),
          -this._tmpTan.z * 5 + (Math.random() - 0.5) * 1.5,
          0.25,
          1.1
        );
      }

      // 4. Update AI with rubber-banding, lane variety, slipstream detection & Kart-to-Kart Collision
      const playerProg = p.lap + p.t;
      let aheadCount = 0;
      let draftingNow = false;

      this.ais.forEach((ai) => {
        const aiProg = ai.lap + ai.t;
        if (aiProg > playerProg) aheadCount++;

        // Slipstream check (player right behind AI)
        const progDiff = aiProg - playerProg;
        if (progDiff > 0.008 && progDiff < 0.032 && Math.abs(p.lateral - ai.lateral) < 0.36) {
          draftingNow = true;
        }

        let aiTargetSpeed = ai.baseSpeed;
        if (aiProg < playerProg - 0.04) {
          aiTargetSpeed *= 1.18;
        } else if (aiProg > playerProg + 0.08) {
          aiTargetSpeed *= 0.92;
        }
        ai.speed += (aiTargetSpeed - ai.speed) * Math.min(1, dt * 4);

        // Smooth AI lane changes
        ai.laneTimer -= dt;
        if (ai.laneTimer <= 0) {
          ai.targetLateral = (Math.random() * 2 - 1) * 0.72;
          ai.laneTimer = 2.0 + Math.random() * 2.5;
        }
        const prevLat = ai.lateral;
        ai.lateral += (ai.targetLateral - ai.lateral) * Math.min(1, dt * 2.2);
        const latDelta = ai.lateral - prevLat;
        ai.tilt = Math.max(-0.18, Math.min(0.18, -latDelta * 4));
        ai.steerAngle = Math.max(-0.32, Math.min(0.32, -latDelta * 10));

        // AI jump gravity
        if (ai.yPos > 0 || ai.yVel > 0) {
          ai.yPos += ai.yVel * dt;
          ai.yVel -= 34 * dt;
          if (ai.yPos <= 0) {
            ai.yPos = 0;
            ai.yVel = 0;
            ai.squash = 0.1;
          }
        }
        ai.squash *= Math.pow(0.84, dt60);

        const prevAiT = ai.t;
        ai.t = ((ai.t + ai.speed * dt60) % 1 + 1) % 1;
        if (ai.t < prevAiT) ai.lap++;
        this.updateKartTransform(ai, ai.yPos, dt60);

        // Player vs AI Collision (with cooldown & emote reaction)
        const dist = p.mesh.position.distanceTo(ai.mesh.position);
        if (dist < 3.0) {
          const pushDir = p.lateral >= ai.lateral ? 1 : -1;
          ai.lateral = Math.max(-1, Math.min(1, ai.lateral - pushDir * 0.15));
          ai.targetLateral = ai.lateral;
          if (p.hitCooldown <= 0) {
            p.hitCooldown = 0.35;
            this.cameraShake = Math.max(this.cameraShake, 0.22);
            this.showKartEmote(ai, '😮');
            if (p.starTimer <= 0 && p.bubbleTimer <= 0) {
              p.lateralVel += pushDir * 1.4;
              p.slowTimer = Math.max(p.slowTimer, 15);
            } else {
              this.showKartEmote(p, '😆');
            }
            try { sound.playBoing(); } catch (_) {}
          }
        }
      });

      // AI vs AI pairwise separation so opponents don't overlap each other
      for (let i = 0; i < this.ais.length; i++) {
        for (let j = i + 1; j < this.ais.length; j++) {
          const a = this.ais[i];
          const b = this.ais[j];
          const dSq = a.mesh.position.distanceToSquared(b.mesh.position);
          if (dSq < 8.4) {
            const dir = a.lateral >= b.lateral ? 1 : -1;
            a.lateral = Math.max(-1, Math.min(1, a.lateral + dir * 0.08));
            b.lateral = Math.max(-1, Math.min(1, b.lateral - dir * 0.08));
          }
        }
      }

      // Slipstream timer update
      if (draftingNow) {
        p.slipstreamTime += dt;
        p.slipstreamActive = p.slipstreamTime >= 0.8;
        if (p.slipstreamActive && !p.slipstreamToastShown) {
          p.slipstreamToastShown = true;
          this.callbacks.onActionToast?.('💨 尾流衝刺！');
        }
      } else {
        p.slipstreamTime = Math.max(0, p.slipstreamTime - dt * 1.5);
        p.slipstreamActive = false;
        if (p.slipstreamTime <= 0.1) p.slipstreamToastShown = false;
      }

      const currentRank = 1 + aheadCount;
      if (currentRank !== this.lastReportedRank) {
        if (this.lastReportedRank > 0 && currentRank < this.lastReportedRank) {
          this.showKartEmote(p, '😆');
        }
        this.lastReportedRank = currentRank;
        this.callbacks.onRankChange?.(currentRank, 1 + this.ais.length);
      }

      // Jump Ramps collisions (Player & AI)
      if (this.track.jumpRamps) {
        this.track.jumpRamps.forEach((ramp) => {
          if (ramp.userData.cooldown > 0) {
            ramp.userData.cooldown = Math.max(0, ramp.userData.cooldown - dt);
          }
          if (
            ramp.userData.cooldown <= 0 &&
            p.yPos <= 0.2 &&
            ramp.position.distanceTo(p.mesh.position) < 3.6
          ) {
            ramp.userData.cooldown = 0.8;
            p.yVel = 14.5;
            p.boostTimer = Math.max(p.boostTimer, 35);
            this.callbacks.onActionToast?.('🦘 飛躍跳台！');
            try { sound.playBoing(); } catch (_) {}
          }
          this.ais.forEach((ai) => {
            if (ai.yPos <= 0.2 && ramp.position.distanceTo(ai.mesh.position) < 3.4) {
              ai.yVel = 13.5;
            }
          });
        });
      }

      // Boost Pads collisions
      if (this.track.boostPads) {
        this.track.boostPads.forEach((pad) => {
          if (pad.userData.cooldown > 0) {
            pad.userData.cooldown = Math.max(0, pad.userData.cooldown - dt);
            return;
          }
          if (pad.position.distanceTo(p.mesh.position) < 3.4) {
            pad.userData.cooldown = 1.2;
            p.boostTimer = Math.max(p.boostTimer, 75);
            this.callbacks.onActionToast?.('⚡ 加速帶衝刺！');
            try { sound.playBoost(); } catch (_) {}
          }
        });
      }

      // Coin collisions + burst particles
      if (this.track.coins) {
        this.track.coins.forEach((coin) => {
          coin.rotation.y += 0.06 * dt60;
          if (!coin.userData.active) {
            coin.userData.respawnTimer -= dt60;
            if (coin.userData.respawnTimer <= 0) {
              coin.userData.active = true;
              coin.visible = true;
            }
            return;
          }
          if (coin.position.distanceTo(p.mesh.position) < 2.8) {
            coin.userData.active = false;
            coin.visible = false;
            coin.userData.respawnTimer = 240;
            p.coins++;
            this.callbacks.onCoinChange(p.coins);
            for (let k = 0; k < 6; k++) {
              this.spawnParticle(
                'coin',
                coin.position.x,
                coin.position.y,
                coin.position.z,
                (Math.random() - 0.5) * 6,
                2.5 + Math.random() * 3,
                (Math.random() - 0.5) * 6,
                0.35,
                1.0
              );
            }
            try { sound.playCoin(); } catch (_) {}
          }
        });
      }

      // 3D Obstacle collisions (with Star/Bubble knockback launch!)
      if (this.track.obstacles) {
        this.track.obstacles.forEach((obs) => {
          const ud = obs.userData;
          if (ud.knockbackTimer > 0) {
            ud.knockbackTimer -= dt;
            obs.position.x += ud.kvx * dt;
            obs.position.y += ud.kvy * dt;
            obs.position.z += ud.kvz * dt;
            ud.kvy -= 30 * dt;
            obs.rotation.x += 7 * dt;
            obs.rotation.z += 5 * dt;
            if (ud.knockbackTimer <= 0) {
              obs.visible = false;
              obs.position.copy(ud.basePos);
              obs.rotation.set(0, 0, 0);
            }
            return;
          }
          if (!ud.active) {
            ud.respawnTimer -= dt60;
            if (ud.respawnTimer <= 0) {
              ud.active = true;
              obs.visible = true;
              obs.position.copy(ud.basePos);
              obs.rotation.set(0, 0, 0);
            }
            return;
          }
          const dist = obs.position.distanceTo(p.mesh.position);
          if (dist < 2.8 && p.yPos < 1.2) {
            ud.active = false;
            ud.respawnTimer = 220;
            sound.playBoing();
            this.cameraShake = Math.max(this.cameraShake, 0.22);
            if (p.starTimer > 0 || p.bubbleTimer > 0) {
              // Blast obstacle flying into the air!
              ud.knockbackTimer = 1.0;
              ud.kvx = this._tmpTan.x * 22 + (Math.random() - 0.5) * 10;
              ud.kvy = 16;
              ud.kvz = this._tmpTan.z * 22 + (Math.random() - 0.5) * 10;
              this.callbacks.onActionToast?.('💥 撞飛障礙物！');
              this.showKartEmote(p, '😆');
            } else {
              obs.visible = false;
              p.slowTimer = 34;
              p.bounceTimer = 18;
              this.showKartEmote(p, '😮');
            }
          }
        });
      }

      // Item Box collisions (triggers Item Roulette!)
      this.track.itemBoxes.forEach((box) => {
        box.rotation.y += 0.04 * dt60;
        box.rotation.x += 0.02 * dt60;
        if (!box.userData.active) {
          box.userData.respawnTimer -= dt60;
          if (box.userData.respawnTimer <= 0) {
            box.userData.active = true;
            box.visible = true;
          }
          return;
        }
        const dist = box.position.distanceTo(p.mesh.position);
        if (dist < 3.2) {
          box.userData.active = false;
          box.visible = false;
          box.userData.respawnTimer = 180;
          if (!p.item && p.itemRouletteTimer <= 0) {
            p.pendingItem = ITEMS[Math.floor(Math.random() * ITEMS.length)];
            p.itemRouletteTimer = 0.65;
            p.itemRouletteTick = 0;
            this.callbacks.onItemRoulette?.(ITEMS[0].emoji);
            sound.playRouletteTick(0);
          }
        }
      });
    }

    // Update pooled particles, skid marks, emotes & ambient scenery
    this.updateParticles(dt);
    this.updateSkidMarks(dt);
    this.updateEmotes(dt);

    if (this.track && this.track.animatedProps) {
      const time = this.elapsedTime * 2.0;
      this.track.animatedProps.forEach((prop) => {
        if (prop.type === 'bob') {
          prop.mesh.position.y = prop.baseY + Math.abs(Math.sin(time + prop.phase)) * 0.35;
        } else if (prop.type === 'float') {
          prop.mesh.position.y = prop.baseY + Math.sin(time * 0.8 + prop.phase) * 0.9;
        } else if (prop.type === 'swim') {
          prop.mesh.position.y = prop.baseY + Math.sin(time + prop.phase) * 0.6;
          prop.mesh.rotation.y += 0.015 * dt60;
        }
      });
    }

    if (this.track && this.track.clouds) {
      this.track.clouds.forEach((cloud) => {
        cloud.userData.angle += dt * 0.008 * cloud.userData.speed;
        const a = cloud.userData.angle;
        const r = cloud.userData.rad;
        cloud.position.x = Math.cos(a) * r + 90;
        cloud.position.z = Math.sin(a) * r - 20;
      });
    }

    if (this.track && this.track.ambientParticles) {
      const amb = this.track.ambientParticles;
      const posAttr = amb.geometry.getAttribute('position');
      const meta = amb.userData.meta;
      const isRising = amb.userData.isRising;
      for (let i = 0; i < meta.length; i++) {
        const m = meta[i];
        let y = posAttr.getY(i);
        if (isRising) {
          y += m.speed * dt * 2.2;
          if (y > 28) y = 2;
        } else {
          y = m.baseY + Math.sin(this.elapsedTime * m.speed + m.phase) * 1.4;
        }
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;
    }

    // Victory Orbit Celebration OR Smooth Third-Person Follow Camera
    if (this.player && this.track) {
      const marker = this.player.mesh.userData.playerMarker;
      if (marker) {
        marker.position.y = marker.userData.baseY + Math.sin(this.elapsedTime * 5) * 0.18;
        marker.rotation.y += 0.04 * dt60;
      }

      if (this.victoryTimer > 0) {
        this.victoryTimer -= dt;
        const happyY = Math.abs(Math.sin(this.elapsedTime * 9)) * 0.95;
        this.updateKartTransform(this.player, happyY, dt60 * 0.3);

        // Confetti shower!
        const confettiTypes = ['confettiA', 'confettiB', 'confettiC', 'confettiD'];
        const kp = this.player.mesh.position;
        for (let c = 0; c < 3; c++) {
          this.spawnParticle(
            confettiTypes[Math.floor(Math.random() * confettiTypes.length)],
            kp.x + (Math.random() - 0.5) * 8,
            kp.y + 5.5 + Math.random() * 3,
            kp.z + (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 4,
            2 + Math.random() * 2,
            (Math.random() - 0.5) * 4,
            1.1,
            1.15
          );
        }

        // Orbit camera safely around player kart
        const orbitAngle = this.elapsedTime * 2.2;
        this.camera.position.set(
          kp.x + Math.cos(orbitAngle) * 9.5,
          kp.y + 4.8,
          kp.z + Math.sin(orbitAngle) * 9.5
        );
        this._tmpCamLook.set(kp.x, kp.y + 1.4, kp.z);
        this.camera.lookAt(this._tmpCamLook);

        if (this.victoryTimer <= 0) {
          finishedThisFrame = true;
          this.callbacks.onFinish?.(this.victoryStats);
        }
      } else {
        const safeT = ((this.player.t % 1) + 1) % 1;
        const kartPos = this.player.mesh.position;
        this.track.curve.getTangentAt(safeT, this._tmpTan);
        if (this._tmpTan.lengthSq() > 1e-6) this._tmpTan.normalize();
        else this._tmpTan.set(0, 0, 1);

        this._tmpCamPos
          .copy(kartPos)
          .addScaledVector(this._tmpTan, -11)
          .add(this._tmpCamUp);

        const camLerp = 1 - Math.exp(-9 * dt);
        this.camBasePos.lerp(this._tmpCamPos, camLerp);

        // Sharp-corner safety clamp: guarantee camera NEVER clips into or passes through the kart!
        const dx = this.camBasePos.x - kartPos.x;
        const dz = this.camBasePos.z - kartPos.z;
        const horizDist = Math.hypot(dx, dz);
        if (horizDist < 7.5) {
          const nx = horizDist > 0.001 ? dx / horizDist : -this._tmpTan.x;
          const nz = horizDist > 0.001 ? dz / horizDist : -this._tmpTan.z;
          this.camBasePos.x = kartPos.x + nx * 8.5;
          this.camBasePos.z = kartPos.z + nz * 8.5;
        }
        if (this.camBasePos.y < kartPos.y + 3.2) {
          this.camBasePos.y = kartPos.y + 3.2;
        }

        this.camera.position.copy(this.camBasePos);

        // Apply bounded temporary camera shake AFTER lerp (never drifts or clips kart)
        if (this.cameraShake > 0.005) {
          const s = Math.min(0.25, this.cameraShake);
          this.camera.position.x += (Math.random() - 0.5) * 2 * s;
          this.camera.position.y += (Math.random() - 0.5) * 2 * s;
          this.cameraShake *= Math.pow(0.82, dt60);
        } else {
          this.cameraShake = 0;
        }

        this._tmpCamLook.copy(kartPos).addScaledVector(this._tmpTan, 5);
        this._tmpCamLook.y += 1.2;
        this.camera.lookAt(this._tmpCamLook);

        const targetBoostFov =
          this.player.boostTimer > 0 ? 9 : this.player.slipstreamActive ? 4.5 : 0;
        this.boostFovOffset += (targetBoostFov - this.boostFovOffset) * Math.min(1, dt * 6);
        const desiredFov = Math.min(110, this.baseFov + this.boostFovOffset);
        if (Math.abs(this.camera.fov - desiredFov) > 0.05) {
          this.camera.fov = desiredFov;
          this.camera.updateProjectionMatrix();
        }
      }

      this.drawMinimap();
    }

    this.renderer.render(this.scene, this.camera);

    if (finishedThisFrame) {
      this.stopLoop();
    } else {
      this.rafId = requestAnimationFrame((t) => this.animate(t));
    }
  }
}
