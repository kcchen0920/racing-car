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
    this.steerInput = 0; // -1 left, 1 right
    this.totalLaps = 2;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      72,
      container.clientWidth / container.clientHeight,
      0.1,
      600
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    if (!this.container) return;
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  start(kartId, trackId, customColor = null, heroPhotoUrl = null) {
    // Clear previous scene
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }

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
      return {
        mesh,
        t: 0.01 * (idx + 1),
        lateral: ((idx % 3) - 1) * 0.45,
        baseSpeed: 0.00046 + (idx % 4) * 0.000025,
        lap: 1,
      };
    });

    this.updateKartTransform(this.player);
    this.ais.forEach((ai) => this.updateKartTransform(ai));

    this.running = false;
    this.callbacks.onLapChange(1, this.totalLaps);
    this.callbacks.onCoinChange(0);
    this.callbacks.onItemChange(null);

    // 3-2-1-GO Countdown
    this.runCountdown();
    this.animate();
  }

  runCountdown() {
    const steps = ['3', '2', '1', 'GO!'];
    steps.forEach((label, idx) => {
      setTimeout(() => {
        this.callbacks.onCountdown(label);
        sound.playCountdown(label === 'GO!');
        if (label === 'GO!') {
          this.running = true;
          setTimeout(() => this.callbacks.onCountdown(''), 700);
        }
      }, idx * 800);
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

  updateKartTransform(kart, yOffset = 0) {
    const pt = this.track.curve.getPointAt(kart.t % 1);
    const tan = this.track.curve.getTangentAt(kart.t % 1).normalize();
    const norm = new THREE.Vector3(-tan.z, 0, tan.x);

    const maxOffset = this.track.roadWidth * 0.38;
    const pos = pt.clone().addScaledVector(norm, kart.lateral * maxOffset);
    kart.mesh.position.set(pos.x, yOffset, pos.z);

    const lookTarget = pos.clone().add(tan);
    kart.mesh.lookAt(lookTarget);

    // Spin wheels
    kart.mesh.userData.wheels.forEach((w) => {
      w.rotation.x += 0.25;
    });
  }

  animate() {
    if (!this.renderer) return;
    requestAnimationFrame(() => this.animate());

    if (this.running && this.player) {
      // Player movement (auto-accelerate + smart steering)
      let speed = this.player.baseSpeed;
      if (this.player.boostTimer > 0) {
        speed *= 1.35;
        this.player.boostTimer--;
      } else if (this.player.slowTimer > 0) {
        speed *= 0.45;
        this.player.slowTimer--;
      }
      let bounceY = 0;
      if (this.player.bounceTimer > 0) {
        this.player.bounceTimer--;
        bounceY = Math.abs(Math.sin(this.player.bounceTimer * 0.4)) * 1.6;
      }

      // Rainbow star effect
      if (this.player.starTimer > 0) {
        this.player.starTimer--;
        const hue = (Date.now() * 0.005) % 1;
        this.player.mesh.userData.bodyMat.color.setHSL(hue, 0.9, 0.55);
        if (this.player.starTimer === 0) {
          this.player.mesh.userData.bodyMat.color.setHex(
            this.player.mesh.userData.baseColor
          );
        }
      }

      if (this.player.bubbleTimer > 0) {
        this.player.bubbleTimer--;
        if (this.player.bubbleTimer === 0) {
          this.player.mesh.userData.bubble.visible = false;
        }
      }

      // Steering with gentle auto-center assist
      if (this.steerInput !== 0) {
        this.player.lateral += this.steerInput * 0.032;
      } else {
        this.player.lateral *= 0.97; // gentle auto-center
      }
      // Smart boundary: never fall off track
      this.player.lateral = Math.max(-1, Math.min(1, this.player.lateral));

      const prevT = this.player.t;
      this.player.t = (this.player.t + speed) % 1;

      if (this.player.t < prevT) {
        this.player.lap++;
        if (this.player.lap > this.totalLaps) {
          this.running = false;
          sound.playFinish();
          this.callbacks.onFinish();
        } else {
          this.callbacks.onLapChange(this.player.lap, this.totalLaps);
        }
      }

      this.player.mesh.visible = true;
      this.updateKartTransform(this.player, bounceY);

      // Update AI with dynamic rubber-banding & Kart-to-Kart Physics Collision
      const playerProg = this.player.lap + this.player.t;
      this.ais.forEach((ai) => {
        const aiProg = ai.lap + ai.t;
        let aiSpeed = ai.baseSpeed;
        if (aiProg < playerProg - 0.04) {
          aiSpeed *= 1.18; // catch up!
        } else if (aiProg > playerProg + 0.08) {
          aiSpeed *= 0.92; // keep race close
        }
        const prevAiT = ai.t;
        ai.t = (ai.t + aiSpeed) % 1;
        if (ai.t < prevAiT) ai.lap++;
        this.updateKartTransform(ai);

        const dist = this.player.mesh.position.distanceTo(ai.mesh.position);
        if (dist < 3.0) {
          const pushDir = this.player.lateral >= ai.lateral ? 1 : -1;
          ai.lateral = Math.max(-1, Math.min(1, ai.lateral - pushDir * 0.14));
          if (this.player.starTimer <= 0 && this.player.bubbleTimer <= 0) {
            this.player.lateral = Math.max(-1, Math.min(1, this.player.lateral + pushDir * 0.1));
            this.player.slowTimer = Math.max(this.player.slowTimer, 15);
          }
          try { sound.playBoing(); } catch (_) {}
        }
      });

      // Coin collisions
      if (this.track.coins) {
        this.track.coins.forEach((coin) => {
          coin.rotation.y += 0.06;
          if (!coin.userData.active) {
            coin.userData.respawnTimer--;
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
            obs.userData.respawnTimer--;
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
        box.rotation.y += 0.04;
        box.rotation.x += 0.02;
        if (!box.userData.active) {
          box.userData.respawnTimer--;
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

    // Smooth Third-Person Follow Camera
    if (this.track && this.track.animatedProps) {
      const time = Date.now() * 0.002;
      this.track.animatedProps.forEach((p) => {
        if (p.type === 'bob') {
          p.mesh.position.y = p.baseY + Math.abs(Math.sin(time + p.phase)) * 0.35;
        } else if (p.type === 'float') {
          p.mesh.position.y = p.baseY + Math.sin(time * 0.8 + p.phase) * 0.9;
        } else if (p.type === 'swim') {
          p.mesh.position.y = p.baseY + Math.sin(time + p.phase) * 0.6;
          p.mesh.rotation.y += 0.015;
        }
      });
    }

    if (this.player && this.track) {
      const kartPos = this.player.mesh.position;
      const forward = this.track.curve.getTangentAt(this.player.t % 1).normalize();
      const camTargetPos = kartPos
        .clone()
        .addScaledVector(forward, -11)
        .add(new THREE.Vector3(0, 5.5, 0));

      this.camera.position.copy(camTargetPos);
      const lookAtPos = kartPos.clone().addScaledVector(forward, 5);
      lookAtPos.y += 1.2;
      this.camera.lookAt(lookAtPos);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
