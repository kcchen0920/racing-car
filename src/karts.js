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

export function createKartMesh(typeId) {
  const cfg = KART_TYPES.find((k) => k.id === typeId) || KART_TYPES[0];
  const group = new THREE.Group();

  // Kart chassis
  const bodyGeo = new THREE.BoxGeometry(2.0, 0.7, 3.2);
  const bodyMat = new THREE.MeshLambertMaterial({ color: cfg.bodyColor });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.7;
  body.castShadow = true;
  group.add(body);

  // Front bumper / accent
  const bumperGeo = new THREE.BoxGeometry(2.1, 0.35, 0.5);
  const accentMat = new THREE.MeshLambertMaterial({ color: cfg.accentColor });
  const bumper = new THREE.Mesh(bumperGeo, accentMat);
  bumper.position.set(0, 0.55, 1.55);
  group.add(bumper);

  // Spoiler
  const spoilerGeo = new THREE.BoxGeometry(1.8, 0.15, 0.4);
  const spoiler = new THREE.Mesh(spoilerGeo, accentMat);
  spoiler.position.set(0, 1.3, -1.4);
  group.add(spoiler);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const wheelPositions = [
    [-1.1, 0.45, 1.0],
    [1.1, 0.45, 1.0],
    [-1.1, 0.45, -1.0],
    [1.1, 0.45, -1.0],
  ];
  const wheels = [];
  wheelPositions.forEach(([x, y, z]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, y, z);
    w.castShadow = true;
    group.add(w);
    wheels.push(w);
  });

  // Cute Driver Head
  const headGeo = new THREE.SphereGeometry(0.65, 14, 14);
  const headMat = new THREE.MeshLambertMaterial({ color: cfg.driverColor });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 1.55, -0.1);
  head.castShadow = true;
  group.add(head);

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  [-0.22, 0.22].forEach((ex) => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(ex, 1.65, 0.48);
    group.add(eye);
  });

  // Ears / Spikes
  if (cfg.earType === 'round') {
    const earGeo = new THREE.SphereGeometry(0.24, 10, 10);
    [-0.5, 0.5].forEach((ex) => {
      const ear = new THREE.Mesh(earGeo, headMat);
      ear.position.set(ex, 2.08, -0.1);
      group.add(ear);
    });
  } else if (cfg.earType === 'long') {
    const earGeo = new THREE.CapsuleGeometry(0.14, 0.55, 6, 8);
    [-0.28, 0.28].forEach((ex) => {
      const ear = new THREE.Mesh(earGeo, headMat);
      ear.position.set(ex, 2.35, -0.1);
      group.add(ear);
    });
  } else {
    const spikeGeo = new THREE.ConeGeometry(0.2, 0.45, 6);
    const spikeMat = new THREE.MeshLambertMaterial({ color: cfg.accentColor });
    [0.2, -0.1, -0.4].forEach((ez, idx) => {
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(0, 2.25 - idx * 0.1, ez);
      spike.rotation.x = -0.3;
      group.add(spike);
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
  group.add(bubble);

  group.userData = { wheels, body, bodyMat, baseColor: cfg.bodyColor, bubble };
  return group;
}
