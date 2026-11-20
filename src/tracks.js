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
  tex.repeat.set(42, 42);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSkyDomeTexture(skyHex) {
  const topColor = new THREE.Color(skyHex);
  const horizonColor = topColor.clone().lerp(new THREE.Color(0xffffff), 0.58);
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, `#${topColor.getHexString()}`);
  grad.addColorStop(0.55, `#${horizonColor.getHexString()}`);
  grad.addColorStop(1, '#ffffff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildTrack(scene, themeId) {
  const theme = TRACK_THEMES.find((t) => t.id === themeId) || TRACK_THEMES[0];
  scene.background = new THREE.Color(theme.skyColor);
  scene.fog = new THREE.FogExp2(theme.skyColor, 0.002);

  // Gradient Sky Dome
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(540, 24, 16),
    new THREE.MeshBasicMaterial({
      map: createSkyDomeTexture(theme.skyColor),
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    })
  );
  scene.add(skyDome);

  const points = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 165),
    new THREE.Vector3(95, 0, 290),
    new THREE.Vector3(245, 0, 275),
    new THREE.Vector3(345, 0, 160),
    new THREE.Vector3(285, 0, 35),
    new THREE.Vector3(375, 0, -95),
    new THREE.Vector3(330, 0, -245),
    new THREE.Vector3(195, 0, -335),
    new THREE.Vector3(45, 0, -285),
    new THREE.Vector3(-85, 0, -330),
    new THREE.Vector3(-155, 0, -210),
    new THREE.Vector3(-75, 0, -110),
  ];

  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
  const roadWidth = 18;
  const segments = 420;

  // Textured Ground
  const groundGeo = new THREE.PlaneGeometry(1500, 1500);
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

  // Item Boxes (?)
  const itemBoxes = [];
  const boxGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
  const qCanvas = document.createElement('canvas');
  qCanvas.width = 128;
  qCanvas.height = 128;
  const qCtx = qCanvas.getContext('2d');
  qCtx.fillStyle = '#ffd54f';
  qCtx.fillRect(0, 0, 128, 128);
  qCtx.strokeStyle = '#ff8f00';
  qCtx.lineWidth = 10;
  qCtx.strokeRect(5, 5, 118, 118);
  qCtx.fillStyle = '#ffffff';
  qCtx.font = 'bold 84px sans-serif';
  qCtx.textAlign = 'center';
  qCtx.textBaseline = 'middle';
  qCtx.fillText('?', 64, 68);
  const boxMat = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(qCanvas) });
  [0.15, 0.35, 0.55, 0.75, 0.9].forEach((t) => {
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const norm = new THREE.Vector3(-tan.z, 0, tan.x);
    [-3.5, 3.5].forEach((offset) => {
      const box = new THREE.Mesh(boxGeo, boxMat.clone());
      const pos = pt.clone().addScaledVector(norm, offset);
      box.position.set(pos.x, 1.8, pos.z);
      box.userData = { active: true, respawnTimer: 0 };
      scene.add(box);
      itemBoxes.push(box);
    });
  });

  // Background Hills
  const hillColor = theme.id === 'desert' ? 0xfbc02d : theme.id === 'dino' ? 0x5d4037 : theme.id === 'underwater' ? 0x00838f : 0x689f38;
  const hillMat = new THREE.MeshLambertMaterial({ color: hillColor });
  for (let h = 0; h < 14; h++) {
    const angle = (h / 14) * Math.PI * 2;
    const rad = 320 + (h % 2) * 45;
    const hill = new THREE.Mesh(
      theme.id === 'desert' ? new THREE.ConeGeometry(28, 36, 4) : new THREE.ConeGeometry(34, 28, 10),
      hillMat
    );
    hill.position.set(Math.cos(angle) * rad + 100, 14, Math.sin(angle) * rad - 20);
    scene.add(hill);
  }

  // 3D Theme Landmarks + Moving Fluffy Clouds + Glowing Sun
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({
    color: theme.id === 'underwater' ? 0xb2ebf2 : 0xffffff,
    roughness: 0.9,
    metalness: 0,
    transparent: true,
    opacity: theme.id === 'underwater' ? 0.45 : 0.92,
  });
  const puffGeo = new THREE.SphereGeometry(7, 10, 10);
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    const offsets = [
      [0, 0, 0, 1.0],
      [-6, -1.2, 1, 0.75],
      [6, -1.0, -1, 0.8],
      [2, 2.2, 0.5, 0.68],
    ];
    offsets.forEach(([ox, oy, oz, sc]) => {
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      puff.position.set(ox, oy, oz);
      puff.scale.setScalar(sc);
      cloud.add(puff);
    });
    const ang = (i / 14) * Math.PI * 2;
    const rad = 180 + (i % 3) * 85;
    cloud.position.set(
      Math.cos(ang) * rad + 90,
      75 + (i % 4) * 14,
      Math.sin(ang) * rad - 20
    );
    cloud.userData = { speed: 2.5 + (i % 3) * 1.4, angle: ang, rad };
    scene.add(cloud);
    clouds.push(cloud);
  }

  // Glowing Sun / Underwater Light Orb
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(24, 16, 16),
    new THREE.MeshBasicMaterial({
      color: theme.id === 'underwater' ? 0xe0f7fa : 0xfff59d,
      fog: false,
    })
  );
  sun.position.set(220, 180, -240);
  scene.add(sun);

  // Theme-specific 3D Landmarks around the track
  if (theme.id === 'desert') {
    const pyrGeo = new THREE.ConeGeometry(42, 54, 4);
    const pyrMat = new THREE.MeshStandardMaterial({ color: 0xffca28, roughness: 0.78 });
    [
      [180, 27, 45, 1.0],
      [-140, 22, 60, 0.82],
      [40, 32, -160, 1.15],
    ].forEach(([lx, ly, lz, sc]) => {
      const pyr = new THREE.Mesh(pyrGeo, pyrMat);
      pyr.position.set(lx, ly, lz);
      pyr.scale.setScalar(sc);
      pyr.rotation.y = Math.PI / 4;
      scene.add(pyr);
    });
  } else if (theme.id === 'dino') {
    const volcGeo = new THREE.ConeGeometry(46, 62, 12);
    const volcMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
    const lavaGeo = new THREE.CylinderGeometry(9, 12, 4, 10);
    const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff5722 });
    [
      [175, 31, 40],
      [-135, 31, 45],
      [60, 31, -155],
    ].forEach(([lx, ly, lz]) => {
      const volc = new THREE.Mesh(volcGeo, volcMat);
      volc.position.set(lx, ly, lz);
      const lava = new THREE.Mesh(lavaGeo, lavaMat);
      lava.position.set(lx, ly + 29, lz);
      scene.add(volc, lava);
    });
  } else if (theme.id === 'zoo') {
    const bGeo = new THREE.SphereGeometry(9, 14, 14);
    const bColors = [0xff5252, 0xffeb3b, 0x4fc3f7, 0xff80ab, 0x66bb6a];
    bColors.forEach((col, i) => {
      const ang = (i / bColors.length) * Math.PI * 2 + 0.4;
      const b = new THREE.Mesh(bGeo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.3 }));
      b.scale.set(1, 1.25, 1);
      b.position.set(Math.cos(ang) * 165 + 80, 42 + (i % 3) * 8, Math.sin(ang) * 165 - 20);
      scene.add(b);
    });
  } else if (theme.id === 'underwater') {
    const jellyGeo = new THREE.SphereGeometry(11, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const jellyMat = new THREE.MeshStandardMaterial({
      color: 0xff80ab,
      transparent: true,
      opacity: 0.7,
      roughness: 0.25,
    });
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const j = new THREE.Mesh(jellyGeo, jellyMat);
      j.position.set(Math.cos(ang) * 155 + 90, 32 + (i % 3) * 10, Math.sin(ang) * 155 - 20);
      scene.add(j);
    }
  }

  // Interactive 3D Theme Obstacles (cute, non-punishing, can be blasted away with Star/Bubble!)
  const obstacles = [];
  const createObstacleMesh = (id, idx) => {
    const g = new THREE.Group();
    if (id === 'desert') {
      const cMat = new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.7 });
      const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.5, 6, 8), cMat);
      trunk.position.y = 1.1;
      const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.7, 5, 8), cMat);
      armL.position.set(-0.6, 1.2, 0);
      armL.rotation.z = 0.7;
      const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.7, 5, 8), cMat);
      armR.position.set(0.6, 1.35, 0);
      armR.rotation.z = -0.7;
      g.add(trunk, armL, armR);
    } else if (id === 'underwater') {
      const crabMat = new THREE.MeshStandardMaterial({ color: 0xff5252, roughness: 0.4 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), crabMat);
      body.scale.set(1.25, 0.65, 0.9);
      body.position.y = 0.65;
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), eyeMat);
      eyeL.position.set(-0.32, 1.15, 0.45);
      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), eyeMat);
      eyeR.position.set(0.32, 1.15, 0.45);
      g.add(body, eyeL, eyeR);
    } else if (id === 'dino' || idx % 2 === 1) {
      const logMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.85 });
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 2.2, 10), logMat);
      log.rotation.z = Math.PI / 2;
      log.position.y = 0.6;
      g.add(log);
    } else {
      // Cute bright banana peel cone
      const bMat = new THREE.MeshStandardMaterial({ color: 0xffeb3b, roughness: 0.35 });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.4, 8), bMat);
      cone.position.y = 0.7;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
      tip.position.y = 1.4;
      g.add(cone, tip);
    }
    g.traverse((o) => {
      o.castShadow = true;
    });
    return g;
  };

  [0.12, 0.21, 0.31, 0.43, 0.52, 0.65, 0.77, 0.88].forEach((t, idx) => {
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const norm = new THREE.Vector3(-tan.z, 0, tan.x);
    const side = idx % 2 === 0 ? 1 : -1;
    const offset = side * (2.6 + (idx % 3) * 1.4);
    const pos = pt.clone().addScaledVector(norm, offset);
    const obs = createObstacleMesh(theme.id, idx);
    obs.position.set(pos.x, 0.02, pos.z);
    obs.userData = {
      active: true,
      respawnTimer: 0,
      knockbackTimer: 0,
      kvx: 0,
      kvy: 0,
      kvz: 0,
      basePos: new THREE.Vector3(pos.x, 0.02, pos.z),
    };
    scene.add(obs);
    obstacles.push(obs);
  });

  // Collectible Coins (⭐)
  const coins = [];
  const coinGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.25, 14);
  coinGeo.rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshPhongMaterial({ color: 0xffeb3b, shininess: 100 });
  for (let i = 0; i < 28; i++) {
    const t = (i + 0.5) / 28;
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

  // Glowing Boost Pads (>>>)
  const boostPads = [];
  const padCanvas = document.createElement('canvas');
  padCanvas.width = 128;
  padCanvas.height = 128;
  const pCtx = padCanvas.getContext('2d');
  pCtx.fillStyle = '#00bcd4';
  pCtx.fillRect(0, 0, 128, 128);
  pCtx.fillStyle = '#ffeb3b';
  for (let row = 0; row < 2; row++) {
    const y = 26 + row * 56;
    pCtx.beginPath();
    pCtx.moveTo(20, y + 36);
    pCtx.lineTo(64, y);
    pCtx.lineTo(108, y + 36);
    pCtx.lineTo(90, y + 36);
    pCtx.lineTo(64, y + 14);
    pCtx.lineTo(38, y + 36);
    pCtx.closePath();
    pCtx.fill();
  }
  const padTex = new THREE.CanvasTexture(padCanvas);
  const padGeo = new THREE.PlaneGeometry(4.6, 6.2);
  padGeo.rotateX(-Math.PI / 2);
  const padMat = new THREE.MeshBasicMaterial({
    map: padTex,
    transparent: true,
    opacity: 0.92,
  });
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.35) / 5;
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const norm = new THREE.Vector3(-tan.z, 0, tan.x);
    const offset = ((i % 3) - 1) * 3.4;
    const pad = new THREE.Mesh(padGeo, padMat);
    const pos = pt.clone().addScaledVector(norm, offset);
    pad.position.set(pos.x, 0.06, pos.z);
    pad.lookAt(pos.x + tan.x, 0.06, pos.z + tan.z);
    pad.userData = { cooldown: 0 };
    scene.add(pad);
    boostPads.push(pad);
  }

  // Jump Ramps (striped wedges that launch karts)
  const jumpRamps = [];
  const rampCanvas = document.createElement('canvas');
  rampCanvas.width = 128;
  rampCanvas.height = 128;
  const rCtx = rampCanvas.getContext('2d');
  rCtx.fillStyle = '#ff7043';
  rCtx.fillRect(0, 0, 128, 128);
  rCtx.fillStyle = '#fff59d';
  for (let s = 0; s < 4; s++) {
    rCtx.fillRect(0, s * 32, 128, 14);
  }
  const rampTex = new THREE.CanvasTexture(rampCanvas);
  rampTex.colorSpace = THREE.SRGBColorSpace;
  const rampGeo = new THREE.BoxGeometry(5.2, 0.75, 5.8);
  const rampMat = new THREE.MeshStandardMaterial({
    map: rampTex,
    roughness: 0.45,
    metalness: 0.05,
  });
  [0.24, 0.58, 0.84].forEach((t, idx) => {
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const norm = new THREE.Vector3(-tan.z, 0, tan.x);
    const offset = idx === 1 ? -2.8 : idx === 2 ? 2.8 : 0;
    const pos = pt.clone().addScaledVector(norm, offset);
    const rampHolder = new THREE.Group();
    rampHolder.position.set(pos.x, 0.02, pos.z);
    rampHolder.lookAt(pos.x + tan.x, 0.02, pos.z + tan.z);
    const wedge = new THREE.Mesh(rampGeo, rampMat);
    wedge.position.set(0, 0.28, 0);
    wedge.rotation.x = -0.22;
    wedge.castShadow = true;
    wedge.receiveShadow = true;
    rampHolder.add(wedge);
    rampHolder.userData = { cooldown: 0 };
    scene.add(rampHolder);
    jumpRamps.push(rampHolder);
  });

  // Ambient Theme Particles (floating petals, embers, sand, or bubbles)
  const particleCount = 140;
  const pPositions = new Float32Array(particleCount * 3);
  const pMeta = [];
  for (let i = 0; i < particleCount; i++) {
    const t = Math.random();
    const pt = curve.getPointAt(t);
    const px = pt.x + (Math.random() - 0.5) * 90;
    const py = 2 + Math.random() * 24;
    const pz = pt.z + (Math.random() - 0.5) * 90;
    pPositions[i * 3] = px;
    pPositions[i * 3 + 1] = py;
    pPositions[i * 3 + 2] = pz;
    pMeta.push({ baseY: py, speed: 0.6 + Math.random() * 1.4, phase: Math.random() * Math.PI * 2 });
  }
  const ambGeo = new THREE.BufferGeometry();
  ambGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  const ambColor =
    theme.id === 'underwater'
      ? 0xe0f7fa
      : theme.id === 'desert'
      ? 0xffe082
      : theme.id === 'dino'
      ? 0xffab40
      : 0xffffff;
  const ambMat = new THREE.PointsMaterial({
    color: ambColor,
    size: theme.id === 'underwater' ? 1.5 : 1.1,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const ambientParticles = new THREE.Points(ambGeo, ambMat);
  ambientParticles.userData = { meta: pMeta, isRising: theme.id === 'underwater' };
  scene.add(ambientParticles);

  // Vivid Illustrated Animals & Plants around the track
  const animatedProps = [];
  for (let i = 0; i < 88; i++) {
    const t = i / 88;
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

  return {
    curve,
    roadWidth,
    itemBoxes,
    obstacles,
    coins,
    boostPads,
    jumpRamps,
    ambientParticles,
    clouds,
    theme,
    animatedProps,
  };
}
