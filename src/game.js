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
    this.running = false;
    this.paused = false;
    this.steerInput = 0; // -1 left, 1 right
    this.totalLaps = 2;
    this.rafId = null;
    this.lastFrameTime = 0;
    this.elapsedTime = 0;
    this.countdownTimers = [];
    this.baseFov = 72;
    this.boostFovOffset = 0;

    // Reusable vectors to avoid per-frame GC allocations
    this._tmpPt = new THREE.Vector3();
    this._tmpTan = new THREE.Vector3();
    this._tmpNorm = new THREE.Vector3();
    this._tmpPos = new THREE.Vector3();
    this._tmpLook = new THREE.Vector3();
    this._tmpCamPos = new THREE.Vector3();
    this._tmpCamLook = new THREE.Vector3();
    this._tmpCamUp = new THREE.Vector3(0, 5.5, 0);

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
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    if (this.player && this.player.lap <= this.totalLaps) {
      this.lastFrameTime = performance.now();
      this.rafId = requestAnimationFrame((t) => this.animate(t));
    }
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

  start(kartId, trackId, customColor = null, heroPhotoUrl = null) {
    this.stopLoop();
    this.disposeScene();
    this.paused = false;
    this.boostFovOffset = 0;
    this.elapsedTime = 0;
    this.lastFrameTime = performance.now();
    this.onResize();

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.1);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(60, 120, 60);
    dir.castShadow = true;
    dir.shadow.camera.left = -160;
    dir.shadow.camera.right = 160;
    dir.shadow.camera.top = 160;
    dir.shadow.camera.bottom = -160;
    this.scene.add(dir);

    this.track = buildTrack(this.scene, trackId);

    // Setup Player
    const playerMesh = createKartMesh(kartId, customColor, heroPhotoUrl);
    this.scene.add(playerMesh);
    this.player = {
      mesh: playerMesh,
      t: 0,
      lateral: 0, // -1 to 1 across roadWidth
      tilt: 0,
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

    // Setup 7 AI opponents (8 cars total)
    const aiColors = [0x29b6f6, 0xab47bc, 0xffa726, 0x26a69a, 0xec407a, 0x8d6e63, 0x5c6bc0];
    this.ais = Array.from({ length: 7 }, (_, idx) => {
      const typeId = KART_TYPES[idx % KART_TYPES.length].id;
      const mesh = createKartMesh(typeId, aiColors[idx]);
      this.scene.add(mesh);
      const initLat = ((idx % 3) - 1) * 0.45;
      return {
        mesh,
        t: 0.01 * (idx + 1),
        lateral: initLat,
        targetLateral: initLat,
        laneTimer: 1.5 + idx * 0.4,
        tilt: 0,
        baseSpeed: 0.00046 + (idx % 4) * 0.000025,
        lap: 1,
      };
    });

    this.updateKartTransform(this.player, 0, 1);
    this.ais.forEach((ai) => this.updateKartTransform(ai, 0, 1));
    this.snapCamera();

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
        this.callbacks.onCountdown(label);
        sound.playCountdown(label === 'GO!');
        if (label === 'GO!') {
          this.running = true;
          const clearId = setTimeout(() => this.callbacks.onCountdown(''), 700);
          this.countdownTimers.push(clearId);
        }
      }, idx * 800);
      this.countdownTimers.push(id);
    });
  }

  setSteer(val) {
    this.steerInput = val;
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
    const kartPos = this.player.mesh.position;
    this.track.curve.getTangentAt(this.player.t % 1, this._tmpTan).normalize();
    this._tmpCamPos
      .copy(kartPos)
      .addScaledVector(this._tmpTan, -11)
      .add(this._tmpCamUp);
    this.camera.position.copy(this._tmpCamPos);
    this._tmpCamLook.copy(kartPos).addScaledVector(this._tmpTan, 5);
    this._tmpCamLook.y += 1.2;
    this.camera.lookAt(this._tmpCamLook);
  }

  updateKartTransform(kart, yOffset = 0, dt60 = 1) {
    this.track.curve.getPointAt(kart.t % 1, this._tmpPt);
    this.track.curve.getTangentAt(kart.t % 1, this._tmpTan).normalize();
    this._tmpNorm.set(-this._tmpTan.z, 0, this._tmpTan.x);

    const maxOffset = this.track.roadWidth * 0.38;
    this._tmpPos.copy(this._tmpPt).addScaledVector(this._tmpNorm, kart.lateral * maxOffset);
    kart.mesh.position.set(this._tmpPos.x, yOffset, this._tmpPos.z);

    this._tmpLook.copy(this._tmpPos).add(this._tmpTan);
    this._tmpLook.y = yOffset;
    kart.mesh.lookAt(this._tmpLook);
    if (kart.tilt) {
      kart.mesh.rotateZ(kart.tilt);
    }

    // Spin wheels
    kart.mesh.userData.wheels.forEach((w) => {
      w.rotation.x += 0.25 * dt60;
    });
  }

  animate(now = performance.now()) {
    if (!this.renderer || this.paused) return;

    const dt = this.lastFrameTime ? Math.min((now - this.lastFrameTime) / 1000, 0.05) : 1 / 60;
    this.lastFrameTime = now;
    const dt60 = dt * 60;
    this.elapsedTime += dt;

    let finishedThisFrame = false;

    if (this.running && this.player) {
      // Player movement (auto-accelerate + smart steering)
      let speed = this.player.baseSpeed;
      if (this.player.boostTimer > 0) {
        speed *= 1.35;
        this.player.boostTimer = Math.max(0, this.player.boostTimer - dt60);
      } else if (this.player.slowTimer > 0) {
        speed *= 0.45;
        this.player.slowTimer = Math.max(0, this.player.slowTimer - dt60);
      }
      let bounceY = 0;
      if (this.player.bounceTimer > 0) {
        this.player.bounceTimer = Math.max(0, this.player.bounceTimer - dt60);
        bounceY = Math.abs(Math.sin(this.player.bounceTimer * 0.4)) * 1.6;
      }

      // Rainbow star effect
      if (this.player.starTimer > 0) {
        this.player.starTimer = Math.max(0, this.player.starTimer - dt60);
        const hue = (this.elapsedTime * 3.0) % 1;
        this.player.mesh.userData.bodyMat.color.setHSL(hue, 0.9, 0.55);
        if (this.player.starTimer === 0) {
          this.player.mesh.userData.bodyMat.color.setHex(
            this.player.mesh.userData.baseColor
          );
        }
      }

      if (this.player.bubbleTimer > 0) {
        this.player.bubbleTimer = Math.max(0, this.player.bubbleTimer - dt60);
        if (this.player.bubbleTimer === 0) {
          this.player.mesh.userData.bubble.visible = false;
        }
      }

      // Steering with gentle auto-center assist + subtle body roll
      if (this.steerInput !== 0) {
        this.player.lateral += this.steerInput * 0.032 * dt60;
      } else {
        this.player.lateral *= Math.pow(0.97, dt60);
      }
      this.player.lateral = Math.max(-1, Math.min(1, this.player.lateral));
      const targetTilt = -this.steerInput * 0.16;
      this.player.tilt += (targetTilt - this.player.tilt) * Math.min(1, dt * 12);

      const prevT = this.player.t;
      this.player.t = (this.player.t + speed * dt60) % 1;

      if (this.player.t < prevT) {
        this.player.lap++;
        if (this.player.lap > this.totalLaps) {
          this.running = false;
          finishedThisFrame = true;
          const finalRank = this.computeRank();
          sound.playFinish();
          this.callbacks.onFinish({
            rank: finalRank,
            total: 1 + this.ais.length,
            coins: this.player.coins,
          });
        } else {
          this.callbacks.onLapChange(this.player.lap, this.totalLaps);
        }
      }

      this.player.mesh.visible = true;
      this.updateKartTransform(this.player, bounceY, dt60);

      // Update AI with dynamic rubber-banding, lane variety & Kart-to-Kart Physics Collision
      const playerProg = this.player.lap + this.player.t;
      let aheadCount = 0;
      this.ais.forEach((ai) => {
        const aiProg = ai.lap + ai.t;
        if (aiProg > playerProg) aheadCount++;
        let aiSpeed = ai.baseSpeed;
        if (aiProg < playerProg - 0.04) {
          aiSpeed *= 1.18; // catch up!
        } else if (aiProg > playerProg + 0.08) {
          aiSpeed *= 0.92; // keep race close
        }

        // Smooth AI lane changes
        ai.laneTimer -= dt;
        if (ai.laneTimer <= 0) {
          ai.targetLateral = (Math.random() * 2 - 1) * 0.72;
          ai.laneTimer = 2.0 + Math.random() * 2.5;
        }
        const prevLat = ai.lateral;
        ai.lateral += (ai.targetLateral - ai.lateral) * Math.min(1, dt * 2.2);
        ai.tilt = -(ai.lateral - prevLat) * 4;

        const prevAiT = ai.t;
        ai.t = (ai.t + aiSpeed * dt60) % 1;
        if (ai.t < prevAiT) ai.lap++;
        this.updateKartTransform(ai, 0, dt60);

        const dist = this.player.mesh.position.distanceTo(ai.mesh.position);
        if (dist < 3.0) {
          const pushDir = this.player.lateral >= ai.lateral ? 1 : -1;
          ai.lateral = Math.max(-1, Math.min(1, ai.lateral - pushDir * 0.14));
          ai.targetLateral = ai.lateral;
          if (this.player.starTimer <= 0 && this.player.bubbleTimer <= 0) {
            this.player.lateral = Math.max(-1, Math.min(1, this.player.lateral + pushDir * 0.1));
            this.player.slowTimer = Math.max(this.player.slowTimer, 15);
          }
          try { sound.playBoing(); } catch (_) {}
        }
      });

      const currentRank = 1 + aheadCount;
      if (currentRank !== this.lastReportedRank) {
        this.lastReportedRank = currentRank;
        this.callbacks.onRankChange?.(currentRank, 1 + this.ais.length);
      }

      // Boost Pads collisions
      if (this.track.boostPads) {
        this.track.boostPads.forEach((pad) => {
          if (pad.userData.cooldown > 0) {
            pad.userData.cooldown = Math.max(0, pad.userData.cooldown - dt);
            return;
          }
          if (pad.position.distanceTo(this.player.mesh.position) < 3.4) {
            pad.userData.cooldown = 1.2;
            this.player.boostTimer = Math.max(this.player.boostTimer, 75);
            try { sound.playBoost(); } catch (_) {}
          }
        });
      }

      // Coin collisions
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
          if (coin.position.distanceTo(this.player.mesh.position) < 2.8) {
            coin.userData.active = false;
            coin.visible = false;
            coin.userData.respawnTimer = 240;
            this.player.coins++;
            this.callbacks.onCoinChange(this.player.coins);
            try { sound.playCoin(); } catch (_) {}
          }
        });
      }

      // Obstacle collisions
      if (this.track.obstacles) {
        this.track.obstacles.forEach((obs) => {
          if (!obs.userData.active) {
            obs.userData.respawnTimer -= dt60;
            if (obs.userData.respawnTimer <= 0) {
              obs.userData.active = true;
              obs.visible = true;
            }
            return;
          }
          const dist = obs.position.distanceTo(this.player.mesh.position);
          if (dist < 3.0) {
            obs.userData.active = false;
            obs.visible = false;
            obs.userData.respawnTimer = 180;
            sound.playBoing();
            if (this.player.starTimer <= 0 && this.player.bubbleTimer <= 0) {
              this.player.slowTimer = 45;
              this.player.bounceTimer = 20;
            }
          }
        });
      }

      // Item Box collisions
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
        const dist = box.position.distanceTo(this.player.mesh.position);
        if (dist < 3.2) {
          box.userData.active = false;
          box.visible = false;
          box.userData.respawnTimer = 180;
          if (!this.player.item) {
            const picked = ITEMS[Math.floor(Math.random() * ITEMS.length)];
            this.player.item = picked;
            this.callbacks.onItemChange(picked);
            sound.playPickup();
          }
        }
      });
    }

    // Animated track scenery
    if (this.track && this.track.animatedProps) {
      const time = this.elapsedTime * 2.0;
      this.track.animatedProps.forEach((p) => {
        if (p.type === 'bob') {
          p.mesh.position.y = p.baseY + Math.abs(Math.sin(time + p.phase)) * 0.35;
        } else if (p.type === 'float') {
          p.mesh.position.y = p.baseY + Math.sin(time * 0.8 + p.phase) * 0.9;
        } else if (p.type === 'swim') {
          p.mesh.position.y = p.baseY + Math.sin(time + p.phase) * 0.6;
          p.mesh.rotation.y += 0.015 * dt60;
        }
      });
    }

    // Smooth Third-Person Follow Camera + Dynamic Boost FOV
    if (this.player && this.track) {
      const kartPos = this.player.mesh.position;
      this.track.curve.getTangentAt(this.player.t % 1, this._tmpTan).normalize();
      this._tmpCamPos
        .copy(kartPos)
        .addScaledVector(this._tmpTan, -11)
        .add(this._tmpCamUp);

      const camLerp = 1 - Math.exp(-9 * dt);
      this.camera.position.lerp(this._tmpCamPos, camLerp);

      this._tmpCamLook.copy(kartPos).addScaledVector(this._tmpTan, 5);
      this._tmpCamLook.y += 1.2;
      this.camera.lookAt(this._tmpCamLook);

      const targetBoostFov = this.player.boostTimer > 0 ? 8 : 0;
      this.boostFovOffset += (targetBoostFov - this.boostFovOffset) * Math.min(1, dt * 6);
      const desiredFov = Math.min(110, this.baseFov + this.boostFovOffset);
      if (Math.abs(this.camera.fov - desiredFov) > 0.05) {
        this.camera.fov = desiredFov;
        this.camera.updateProjectionMatrix();
      }
    }

    this.renderer.render(this.scene, this.camera);

    if (finishedThisFrame) {
      this.stopLoop();
    } else {
      this.rafId = requestAnimationFrame((t) => this.animate(t));
    }
  }
}
