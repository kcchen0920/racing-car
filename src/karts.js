import * as THREE from 'three';

export const KART_TYPES = [
  {
    id: 'bear',
    name: '小熊卡丁車',
    emoji: '🐻',
    bodyColor: 0xff5252,
    accentColor: 0xffeb3b,
    driverColor: 0x8d6e63,
    earType: 'round',
  },
  {
    id: 'bunny',
    name: '小兔敞篷車',
    emoji: '🐰',
    bodyColor: 0xff80ab,
    accentColor: 0xffffff,
    driverColor: 0xf5f5f5,
    earType: 'long',
  },
  {
    id: 'dino',
    name: '恐龍吉普車',
    emoji: '🦖',
    bodyColor: 0x66bb6a,
    accentColor: 0xffa726,
    driverColor: 0x43a047,
    earType: 'spike',
  },
];

export function createKartMesh(typeId, customColor = null, heroPhotoUrl = null, isPlayer = false) {
  const cfg = KART_TYPES.find((k) => k.id === typeId) || KART_TYPES[0];
  const bodyColor = customColor || cfg.bodyColor;
  const group = new THREE.Group();
  const chassisGroup = new THREE.Group();
  group.add(chassisGroup);

  // Mario Kart-style Go-Kart Chassis (PBR glossy painted body + metallic chrome)
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.28,
    metalness: 0.14,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: cfg.accentColor,
    roughness: 0.35,
    metalness: 0.1,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe8eef2,
    roughness: 0.18,
    metalness: 0.82,
  });

  // Main lower tub
  const tub = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 2.4), bodyMat);
  tub.position.set(0, 0.55, -0.1);
  tub.castShadow = true;
  chassisGroup.add(tub);

  // Tapered F1-style front nose
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.72, 1.3, 12), bodyMat);
  nose.rotation.x = Math.PI / 2;
  nose.scale.set(1.2, 1, 0.55);
  nose.position.set(0, 0.58, 1.35);
  nose.castShadow = true;
  chassisGroup.add(nose);

  // Side bumper pods (rounded)
  const podGeo = new THREE.CapsuleGeometry(0.28, 1.4, 6, 10);
  podGeo.rotateX(Math.PI / 2);
  [-0.9, 0.9].forEach((px) => {
    const pod = new THREE.Mesh(podGeo, accentMat);
    pod.position.set(px, 0.5, 0);
    pod.castShadow = true;
    chassisGroup.add(pod);
  });

  // Front rounded bumper
  const bumper = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.5, 6, 10), accentMat);
  bumper.rotation.z = Math.PI / 2;
  bumper.position.set(0, 0.45, 1.85);
  chassisGroup.add(bumper);

  // Steering Wheel
  const steerCol = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8), chromeMat);
  steerCol.position.set(0, 1.0, 0.55);
  steerCol.rotation.x = -0.5;
  const steerWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.26, 0.05, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7, metalness: 0.1 })
  );
  steerWheel.position.set(0, 1.25, 0.35);
  steerWheel.rotation.x = -0.5;
  chassisGroup.add(steerCol, steerWheel);

  // Dual Exhaust Pipes + Boost Flames at the back
  const exhaustFlames = [];
  const flameGeo = new THREE.ConeGeometry(0.18, 0.95, 8);
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xffab00,
    transparent: true,
    opacity: 0.9,
  });
  [-0.42, 0.42].forEach((ex) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.85, 10), chromeMat);
    pipe.position.set(ex, 0.85, -1.55);
    pipe.rotation.x = -0.65;
    chassisGroup.add(pipe);

    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(ex, 0.92, -2.15);
    flame.visible = false;
    chassisGroup.add(flame);
    exhaustFlames.push(flame);
  });

  // Cute Headlights
  const lightGeo = new THREE.SphereGeometry(0.16, 10, 10);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff59d });
  [-0.52, 0.52].forEach((lx) => {
    const hl = new THREE.Mesh(lightGeo, lightMat);
    hl.position.set(lx, 0.68, 1.72);
    chassisGroup.add(hl);
  });

  // Rear Wing Spoiler with struts
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.14, 0.45), accentMat);
  spoiler.position.set(0, 1.38, -1.35);
  chassisGroup.add(spoiler);
  [-0.55, 0.55].forEach((sx) => {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.2), chromeMat);
    strut.position.set(sx, 1.08, -1.35);
    chassisGroup.add(strut);
  });

  // Chunky Go-Kart Wheels with Hubcaps + Front Steering Pivots
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.85, metalness: 0.05 });
  const wheelSpecs = [
    { x: -1.15, y: 0.42, z: 1.05, r: 0.42, front: true },
    { x: 1.15, y: 0.42, z: 1.05, r: 0.42, front: true },
    { x: -1.2, y: 0.52, z: -1.0, r: 0.52, front: false },
    { x: 1.2, y: 0.52, z: -1.0, r: 0.52, front: false },
  ];
  const wheels = [];
  const frontWheelPivots = [];
  wheelSpecs.forEach(({ x, y, z, r, front }) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);

    const wGroup = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.46, 14), wheelMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.48, 10), chromeMat);
    hub.rotation.z = Math.PI / 2;
    wGroup.add(tire, hub);

    pivot.add(wGroup);
    chassisGroup.add(pivot);
    wheels.push(wGroup);
    if (front) frontWheelPivots.push(pivot);
  });

  // Cute Driver Head
  const headGeo = new THREE.SphereGeometry(0.65, 14, 14);
  const headMat = new THREE.MeshStandardMaterial({ color: cfg.driverColor, roughness: 0.65, metalness: 0.05 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 1.55, -0.1);
  head.castShadow = true;
  chassisGroup.add(head);

  // Blush cheeks
  const cheekGeo = new THREE.SphereGeometry(0.14, 8, 8);
  const cheekMat = new THREE.MeshBasicMaterial({ color: 0xff8a80 });
  [-0.36, 0.36].forEach((cx) => {
    const cheek = new THREE.Mesh(cheekGeo, cheekMat);
    cheek.position.set(cx, 1.48, 0.45);
    chassisGroup.add(cheek);
  });

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  [-0.22, 0.22].forEach((ex) => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(ex, 1.65, 0.48);
    chassisGroup.add(eye);
  });

  // Ears / Spikes
  if (cfg.earType === 'round') {
    const earGeo = new THREE.SphereGeometry(0.24, 10, 10);
    [-0.5, 0.5].forEach((ex) => {
      const ear = new THREE.Mesh(earGeo, headMat);
      ear.position.set(ex, 2.08, -0.1);
      chassisGroup.add(ear);
    });
  } else if (cfg.earType === 'long') {
    const earGeo = new THREE.CapsuleGeometry(0.14, 0.55, 6, 8);
    [-0.28, 0.28].forEach((ex) => {
      const ear = new THREE.Mesh(earGeo, headMat);
      ear.position.set(ex, 2.35, -0.1);
      chassisGroup.add(ear);
    });
  } else {
    const spikeGeo = new THREE.ConeGeometry(0.2, 0.45, 6);
    const spikeMat = new THREE.MeshStandardMaterial({ color: cfg.accentColor, roughness: 0.5 });
    [0.2, -0.1, -0.4].forEach((ez, idx) => {
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(0, 2.25 - idx * 0.1, ez);
      spike.rotation.x = -0.3;
      chassisGroup.add(spike);
    });
  }

  // Bubble shield (hidden by default)
  const bubbleGeo = new THREE.SphereGeometry(2.2, 18, 18);
  const bubbleMat = new THREE.MeshBasicMaterial({
    color: 0x80deea,
    transparent: true,
    opacity: 0.35,
    wireframe: false,
  });
  const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
  bubble.position.y = 1.1;
  bubble.visible = false;
  chassisGroup.add(bubble);

  // Hero Photo Driver Badge (if uploaded)
  if (heroPhotoUrl) {
    const tex = new THREE.TextureLoader().load(heroPhotoUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    sprite.position.set(0, 2.7, -0.1);
    sprite.scale.set(1.8, 1.8, 1);
    chassisGroup.add(sprite);
  }

  // Player Overhead Marker (floating golden pointer so player is always unmistakable)
  let playerMarker = null;
  if (isPlayer) {
    const markerGeo = new THREE.ConeGeometry(0.32, 0.55, 6);
    markerGeo.rotateX(Math.PI);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd54f });
    playerMarker = new THREE.Mesh(markerGeo, markerMat);
    const baseMarkerY = heroPhotoUrl ? 3.85 : 2.95;
    playerMarker.position.set(0, baseMarkerY, -0.1);
    playerMarker.userData = { baseY: baseMarkerY };
    group.add(playerMarker);
  }

  group.traverse((obj) => {
    obj.frustumCulled = false;
  });
  group.userData = {
    chassisGroup,
    wheels,
    frontWheelPivots,
    exhaustFlames,
    body: tub,
    bodyMat,
    baseColor: bodyColor,
    bubble,
    playerMarker,
  };
  return group;
}
