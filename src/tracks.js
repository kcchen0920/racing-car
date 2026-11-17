import * as THREE from 'three';

export const TRACK_THEMES = [
  {
    id: 'zoo',
    name: '歡樂動物園',
    emoji: '🦁',
    skyColor: 0x81d4fa,
    groundColor: '#8bc34a',
    groundAccent: '#7cb342',
    roadColor: '#607d8b',
    curbColorA: 0xff5252,
    curbColorB: 0xffeb3b,
    animals: ['🦁', '🐘', '🦒', '🐼', '🐒', '🦓'],
    plants: ['🌳', '🌻', '🌷', '🎈'],
    obstacles: ['🍌', '🪵'],
  },
  {
    id: 'dino',
    name: '恐龍世界',
    emoji: '🦕',
    skyColor: 0xffcc80,
    groundColor: '#558b2f',
    groundAccent: '#33691e',
    roadColor: '#8d6e63',
    curbColorA: 0xff7043,
    curbColorB: 0xaed581,
    animals: ['🦕', '🦖', '🐊', '🥚'],
    plants: ['🌴', '🌿', '🌋', '🍄'],
    obstacles: ['🪨', '🪵'],
  },
  {
    id: 'desert',
    name: '沙漠金字塔',
    emoji: '🐪',
    skyColor: 0x4fc3f7,
    groundColor: '#ffd54f',
    groundAccent: '#ffca28',
    roadColor: '#d7ccc8',
    curbColorA: 0xffa726,
    curbColorB: 0xffffff,
    animals: ['🐪', '🦎', '🦅'],
    plants: ['🌵', '🌴', '☀️'],
    obstacles: ['🌵', '🪨'],
  },
  {
    id: 'underwater',
    name: '水中世界',
    emoji: '🐠',
    skyColor: 0x00acc1,
    groundColor: '#26c6da',
    groundAccent: '#00bcd4',
    roadColor: '#80deea',
    curbColorA: 0xff4081,
    curbColorB: 0xffeb3b,
    animals: ['🐠', '🐡', '🐢', '🐙', '🐬', '🪼'],
    plants: ['🪸', '🫧', '🐚'],
    obstacles: ['🦀', '🐚'],
  },
];

function createEmojiSprite(emoji, scale = 6) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.font = '180px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 128, 138);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

function createGroundTexture(baseColor, accentColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = accentColor;
  for (let i = 0; i < 24; i++) {
    const x = (i * 53) % 256;
    const y = (i * 97) % 256;
    ctx.beginPath();
    ctx.arc(x, y, 8 + (i % 6), 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildTrack(scene, themeId) {
  const theme = TRACK_THEMES.find((t) => t.id === themeId) || TRACK_THEMES[0];
  scene.background = new THREE.Color(theme.skyColor);
  scene.fog = new THREE.Fog(theme.skyColor, 150, 400);

  const points = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 70),
    new THREE.Vector3(45, 0, 120),
    new THREE.Vector3(110, 0, 110),
    new THREE.Vector3(140, 0, 50),
    new THREE.Vector3(115, 0, -20),
    new THREE.Vector3(145, 0, -85),
    new THREE.Vector3(95, 0, -135),
    new THREE.Vector3(20, 0, -110),
    new THREE.Vector3(-10, 0, -60),
  ];

  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
  const roadWidth = 18;
  const segments = 240;

  // Textured Ground
  const groundGeo = new THREE.PlaneGeometry(800, 800);
  const groundMat = new THREE.MeshLambertMaterial({
    map: createGroundTexture(theme.groundColor, theme.groundAccent),
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.25;
  ground.receiveShadow = true;
  scene.add(ground);

  // Road segments + dashed center line
  const trackGroup = new THREE.Group();
  const roadMat = new THREE.MeshLambertMaterial({ color: theme.roadColor, side: THREE.DoubleSide });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  for (let i = 0; i < segments; i++) {
    const t1 = i / segments;
    const t2 = (i + 1) / segments;
    const p1 = curve.getPointAt(t1);
    const p2 = curve.getPointAt(t2);
    const tangent = curve.getTangentAt(t1).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);

    const v1 = p1.clone().addScaledVector(normal, roadWidth / 2);
    const v2 = p1.clone().addScaledVector(normal, -roadWidth / 2);
    const v3 = p2.clone().addScaledVector(normal, roadWidth / 2);
    const v4 = p2.clone().addScaledVector(normal, -roadWidth / 2);

    const geo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      v1.x, 0.02, v1.z,
      v2.x, 0.02, v2.z,
      v3.x, 0.02, v3.z,
      v2.x, 0.02, v2.z,
      v4.x, 0.02, v4.z,
      v3.x, 0.02, v3.z,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, roadMat);
    mesh.receiveShadow = true;
    trackGroup.add(mesh);

    if (i % 4 === 0) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 1.8), dashMat);
      dash.position.set(p1.x, 0.05, p1.z);
      dash.lookAt(p2);
      trackGroup.add(dash);
    }

    if (i % 3 === 0) {
      const curbColor = i % 6 === 0 ? theme.curbColorA : theme.curbColorB;
      const curbGeo = new THREE.BoxGeometry(1.2, 0.4, 2.2);
      const curbMat = new THREE.MeshLambertMaterial({ color: curbColor });
      [-roadWidth / 2 - 0.6, roadWidth / 2 + 0.6].forEach((offset) => {
        const curb = new THREE.Mesh(curbGeo, curbMat);
        const pos = p1.clone().addScaledVector(normal, offset);
        curb.position.set(pos.x, 0.2, pos.z);
        curb.lookAt(p2.clone().addScaledVector(normal, offset));
        trackGroup.add(curb);
      });
    }
  }
  scene.add(trackGroup);

  // Start/Finish Arch
  const startPt = curve.getPointAt(0);
  const startTan = curve.getTangentAt(0).normalize();
  const archGroup = new THREE.Group();
  const pillarGeo = new THREE.CylinderGeometry(0.6, 0.6, 8, 10);
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  [-roadWidth / 2, roadWidth / 2].forEach((x) => {
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(x, 4, 0);
    archGroup.add(p);
  });
  const bannerGeo = new THREE.BoxGeometry(roadWidth + 2, 2.4, 1.0);
  const bannerCanvas = document.createElement('canvas');
  bannerCanvas.width = 256;
  bannerCanvas.height = 64;
  const bCtx = bannerCanvas.getContext('2d');
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 8; c++) {
      bCtx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#222222';
      bCtx.fillRect(c * 32, r * 32, 32, 32);
    }
  }
  const bannerTex = new THREE.CanvasTexture(bannerCanvas);
  const bannerMat = new THREE.MeshLambertMaterial({ map: bannerTex });
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(0, 7.5, 0);
  archGroup.add(banner);
  archGroup.position.copy(startPt);
  archGroup.lookAt(startPt.clone().add(startTan));
  scene.add(archGroup);

  // Item Boxes (?) (temporarily disabled for debugging)
  const itemBoxes = [];

  // Interactive Road Obstacles (temporarily disabled for debugging)
  const obstacles = [];

  // Collectible Coins (⭐)
  const coins = [];
  const coinGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.25, 14);
  coinGeo.rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshPhongMaterial({ color: 0xffeb3b, shininess: 100 });
  for (let i = 0; i < 16; i++) {
    const t = (i + 0.5) / 16;
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const norm = new THREE.Vector3(-tan.z, 0, tan.x);
    const offset = Math.sin(i * 1.3) * 3.8;
    const coin = new THREE.Mesh(coinGeo, coinMat);
    const pos = pt.clone().addScaledVector(norm, offset);
    coin.position.set(pos.x, 1.4, pos.z);
    coin.userData = { active: true, respawnTimer: 0 };
    scene.add(coin);
    coins.push(coin);
  }

  const boostPads = [];

  // Vivid Illustrated Animals & Plants around the track
  const animatedProps = [];
  for (let i = 0; i < 56; i++) {
    const t = i / 56;
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const norm = new THREE.Vector3(-tan.z, 0, tan.x);
    const side = i % 2 === 0 ? 1 : -1;
    const dist = roadWidth / 2 + 7 + (i % 4) * 5;
    const pos = pt.clone().addScaledVector(norm, side * dist);

    const isAnimal = i % 2 === 0;
    const list = isAnimal ? theme.animals : theme.plants;
    const emoji = list[i % list.length];
    const size = isAnimal ? 6.5 : 8.0;
    const sprite = createEmojiSprite(emoji, size);
    const baseY = theme.id === 'underwater' && isAnimal ? 4.5 + (i % 3) * 1.5 : size * 0.48;
    sprite.position.set(pos.x, baseY, pos.z);
    scene.add(sprite);

    animatedProps.push({
      mesh: sprite,
      type: isAnimal ? 'bob' : 'float',
      baseY,
      phase: i * 0.7,
    });
  }

  return { curve, roadWidth, itemBoxes, obstacles, coins, boostPads, theme, animatedProps };
}
