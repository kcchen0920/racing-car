import * as THREE from 'three';

export const TRACK_THEMES = [
  {
    id: 'meadow',
    name: '陽光大草原',
    emoji: '🍄',
    skyColor: 0x81d4fa,
    groundColor: 0x7cb342,
    roadColor: 0x607d8b,
    curbColorA: 0xff5252,
    curbColorB: 0xffffff,
  },
  {
    id: 'beach',
    name: '椰林沙灘',
    emoji: '🌴',
    skyColor: 0x4fc3f7,
    groundColor: 0xffe082,
    roadColor: 0xd7ccc8,
    curbColorA: 0x29b6f6,
    curbColorB: 0xfff59d,
  },
  {
    id: 'rainbow',
    name: '夢幻彩虹橋',
    emoji: '🌈',
    skyColor: 0x1a237e,
    groundColor: 0x121858,
    roadColor: 0xffffff,
    curbColorA: 0xff4081,
    curbColorB: 0x00e5ff,
    isRainbow: true,
  },
];

export function buildTrack(scene, themeId) {
  const theme = TRACK_THEMES.find((t) => t.id === themeId) || TRACK_THEMES[0];
  scene.background = new THREE.Color(theme.skyColor);
  scene.fog = new THREE.Fog(theme.skyColor, 140, 380);

  // Control points for a wide, kid-friendly closed loop
  const points = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 70),
    new THREE.Vector3(45, 0, 120),
    new THREE.Vector3(110, 0, 110),
    new THREE.Vector3(140, 0, 50),
    new THREE.Vector3(115, 0, -20),
    new THREE.Vector3(145, 0, -85),
    new THREE.Vector3(95, 0, -135),
    new THREE.Vector3(20, -0, -110),
    new THREE.Vector3(-10, 0, -60),
  ];

  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
  const roadWidth = 18;
  const segments = 240;

  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(800, 800);
  const groundMat = new THREE.MeshLambertMaterial({ color: theme.groundColor });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.25;
  ground.receiveShadow = true;
  scene.add(ground);

  // Road segments
  const rainbowColors = [0xff5252, 0xffa726, 0xffeb3b, 0x66bb6a, 0x29b6f6, 0xab47bc];
  const trackGroup = new THREE.Group();

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

    const color = theme.isRainbow
      ? rainbowColors[Math.floor(i / 4) % rainbowColors.length]
      : theme.roadColor;
    const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    trackGroup.add(mesh);

    // Curb markers every 3 segments
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
  const bannerGeo = new THREE.BoxGeometry(roadWidth + 2, 2.2, 1.0);
  const bannerMat = new THREE.MeshLambertMaterial({ color: 0xff5252 });
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(0, 7.5, 0);
  archGroup.add(banner);
  archGroup.position.copy(startPt);
  archGroup.lookAt(startPt.clone().add(startTan));
  scene.add(archGroup);

  // Item Boxes (?)
  const itemBoxes = [];
  const boxGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
  const boxMat = new THREE.MeshLambertMaterial({ color: 0xffd54f });
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

  // Scenery decorations
  addScenery(scene, curve, theme, roadWidth);

  return { curve, roadWidth, itemBoxes, theme };
}

function addScenery(scene, curve, theme, roadWidth) {
  for (let i = 0; i < 45; i++) {
    const t = i / 45;
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const norm = new THREE.Vector3(-tan.z, 0, tan.x);
    const side = i % 2 === 0 ? 1 : -1;
    const dist = roadWidth / 2 + 8 + (i % 4) * 5;
    const pos = pt.clone().addScaledVector(norm, side * dist);

    if (theme.id === 'meadow') {
      // Cute mushroom / tree
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 1.0, 3.5, 8),
        new THREE.MeshLambertMaterial({ color: 0xffe0b2 })
      );
      trunk.position.set(pos.x, 1.75, pos.z);
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(2.6, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: i % 3 === 0 ? 0xff5252 : 0x4caf50 })
      );
      cap.position.set(pos.x, 3.5, pos.z);
      scene.add(trunk, cap);
    } else if (theme.id === 'beach') {
      // Palm tree
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.8, 6, 8),
        new THREE.MeshLambertMaterial({ color: 0x8d6e63 })
      );
      trunk.position.set(pos.x, 3, pos.z);
      const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(3.2, 2.2, 7),
        new THREE.MeshLambertMaterial({ color: 0x66bb6a })
      );
      leaves.position.set(pos.x, 6.5, pos.z);
      scene.add(trunk, leaves);
    } else {
      // Floating glowing stars
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.8, 0),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xffeb3b : 0x00e5ff })
      );
      star.position.set(pos.x, 4 + (i % 3) * 2, pos.z);
      scene.add(star);
    }
  }
}
