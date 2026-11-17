import * as THREE from 'three';

export const TRACK_THEMES = [
  {
    id: 'zoo',
    name: '歡樂動物園',
    emoji: '🦁',
    skyColor: 0x81d4fa,
    groundColor: 0x8bc34a,
    roadColor: 0x78909c,
    curbColorA: 0xff5252,
    curbColorB: 0xffeb3b,
  },
  {
    id: 'dino',
    name: '恐龍世界',
    emoji: '🦕',
    skyColor: 0xffcc80,
    groundColor: 0x558b2f,
    roadColor: 0x8d6e63,
    curbColorA: 0xff7043,
    curbColorB: 0xaed581,
  },
  {
    id: 'desert',
    name: '沙漠金字塔',
    emoji: '🐪',
    skyColor: 0x4fc3f7,
    groundColor: 0xffd54f,
    roadColor: 0xd7ccc8,
    curbColorA: 0xffa726,
    curbColorB: 0xffffff,
  },
  {
    id: 'underwater',
    name: '水中世界',
    emoji: '🐠',
    skyColor: 0x00acc1,
    groundColor: 0x26c6da,
    roadColor: 0x80deea,
    curbColorA: 0xff4081,
    curbColorB: 0xffeb3b,
  },
];

export function buildTrack(scene, themeId) {
  const theme = TRACK_THEMES.find((t) => t.id === themeId) || TRACK_THEMES[0];
  scene.background = new THREE.Color(theme.skyColor);
  scene.fog = new THREE.Fog(theme.skyColor, 140, 380);

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

  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(800, 800);
  const groundMat = new THREE.MeshLambertMaterial({ color: theme.groundColor });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.25;
  ground.receiveShadow = true;
  scene.add(ground);

  // Road segments
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

    const mat = new THREE.MeshLambertMaterial({ color: theme.roadColor, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    trackGroup.add(mesh);

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

  const animatedProps = addRichScenery(scene, curve, theme, roadWidth);
  return { curve, roadWidth, itemBoxes, theme, animatedProps };
}

function addRichScenery(scene, curve, theme, roadWidth) {
  const animatedProps = [];

  for (let i = 0; i < 48; i++) {
    const t = i / 48;
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const norm = new THREE.Vector3(-tan.z, 0, tan.x);
    const side = i % 2 === 0 ? 1 : -1;
    const dist = roadWidth / 2 + 8 + (i % 4) * 6;
    const pos = pt.clone().addScaledVector(norm, side * dist);

    if (theme.id === 'zoo') {
      if (i % 4 === 0) {
        // Cute Giraffe
        const giraffe = createGiraffe();
        giraffe.position.set(pos.x, 0, pos.z);
        giraffe.lookAt(pt);
        scene.add(giraffe);
        animatedProps.push({ mesh: giraffe, type: 'bob', baseY: 0, phase: i });
      } else if (i % 4 === 1) {
        // Cute Elephant
        const elephant = createElephant();
        elephant.position.set(pos.x, 0, pos.z);
        elephant.lookAt(pt);
        scene.add(elephant);
        animatedProps.push({ mesh: elephant, type: 'bob', baseY: 0, phase: i });
      } else if (i % 4 === 2) {
        // Floating Balloon
        const balloon = createBalloon(i);
        balloon.position.set(pos.x, 6, pos.z);
        scene.add(balloon);
        animatedProps.push({ mesh: balloon, type: 'float', baseY: 6, phase: i });
      } else {
        // Lush Tree
        const tree = createTree(0x4caf50);
        tree.position.set(pos.x, 0, pos.z);
        scene.add(tree);
      }
    } else if (theme.id === 'dino') {
      if (i % 4 === 0) {
        // Tall Brontosaurus
        const dino = createDino();
        dino.position.set(pos.x, 0, pos.z);
        dino.lookAt(pt);
        scene.add(dino);
        animatedProps.push({ mesh: dino, type: 'bob', baseY: 0, phase: i });
      } else if (i % 6 === 1) {
        // Volcano
        const volcano = createVolcano();
        volcano.position.set(pos.x * 1.15, 0, pos.z * 1.15);
        scene.add(volcano);
      } else if (i % 4 === 2) {
        // Giant Dino Egg
        const egg = new THREE.Mesh(
          new THREE.SphereGeometry(1.6, 12, 12),
          new THREE.MeshLambertMaterial({ color: 0xfff8e1 })
        );
        egg.scale.set(1, 1.35, 1);
        egg.position.set(pos.x, 1.8, pos.z);
        scene.add(egg);
      } else {
        const palm = createPalmTree();
        palm.position.set(pos.x, 0, pos.z);
        scene.add(palm);
      }
    } else if (theme.id === 'desert') {
      if (i % 5 === 0) {
        // Giant Pyramid
        const pyr = new THREE.Mesh(
          new THREE.ConeGeometry(12, 16, 4),
          new THREE.MeshLambertMaterial({ color: 0xfbc02d })
        );
        pyr.position.set(pos.x, 8, pos.z);
        pyr.rotation.y = Math.PI / 4;
        scene.add(pyr);
      } else if (i % 4 === 1) {
        // Cute Camel
        const camel = createCamel();
        camel.position.set(pos.x, 0, pos.z);
        camel.lookAt(pt);
        scene.add(camel);
        animatedProps.push({ mesh: camel, type: 'bob', baseY: 0, phase: i });
      } else if (i % 3 === 2) {
        // Cactus
        const cactus = createCactus();
        cactus.position.set(pos.x, 0, pos.z);
        scene.add(cactus);
      } else {
        const palm = createPalmTree();
        palm.position.set(pos.x, 0, pos.z);
        scene.add(palm);
      }
    } else {
      // Underwater World
      if (i % 3 === 0) {
        // Swimming Fish
        const fish = createFish(i);
        fish.position.set(pos.x, 4 + (i % 3) * 2, pos.z);
        scene.add(fish);
        animatedProps.push({ mesh: fish, type: 'swim', baseY: fish.position.y, phase: i });
      } else if (i % 3 === 1) {
        // Jellyfish
        const jelly = createJellyfish(i);
        jelly.position.set(pos.x, 6 + (i % 3) * 2, pos.z);
        scene.add(jelly);
        animatedProps.push({ mesh: jelly, type: 'float', baseY: jelly.position.y, phase: i });
      } else {
        // Coral Reef
        const coral = createCoral(i);
        coral.position.set(pos.x, 0, pos.z);
        scene.add(coral);
      }
    }
  }
  return animatedProps;
}

function createTree(leafColor) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.9, 3.5, 8),
    new THREE.MeshLambertMaterial({ color: 0x8d6e63 })
  );
  trunk.position.y = 1.75;
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 10, 10),
    new THREE.MeshLambertMaterial({ color: leafColor })
  );
  top.position.y = 4.5;
  g.add(trunk, top);
  return g;
}

function createPalmTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.8, 6, 8),
    new THREE.MeshLambertMaterial({ color: 0x8d6e63 })
  );
  trunk.position.y = 3;
  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 2.2, 7),
    new THREE.MeshLambertMaterial({ color: 0x66bb6a })
  );
  leaves.position.y = 6.5;
  g.add(trunk, leaves);
  return g;
}

function createGiraffe() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffca28 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 2.8), mat);
  body.position.y = 2.2;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 4.2, 8), mat);
  neck.position.set(0, 4.5, 1.0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 1.3), mat);
  head.position.set(0, 6.7, 1.2);
  g.add(body, neck, head);
  return g;
}

function createElephant() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x90a4ae });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 3.4), mat);
  body.position.y = 1.8;
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 10), mat);
  head.position.set(0, 2.6, 1.8);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.8, 8), mat);
  trunk.position.set(0, 1.9, 2.8);
  trunk.rotation.x = 0.5;
  g.add(body, head, trunk);
  return g;
}

function createBalloon(i) {
  const colors = [0xff5252, 0xffeb3b, 0x40c4ff, 0xff4081];
  const g = new THREE.Group();
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 12, 12),
    new THREE.MeshLambertMaterial({ color: colors[i % colors.length] })
  );
  g.add(ball);
  return g;
}

function createDino() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x66bb6a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 4.2), mat);
  body.position.y = 2.2;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 5.0, 8), mat);
  neck.position.set(0, 4.8, 1.6);
  neck.rotation.x = 0.25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 10), mat);
  head.position.set(0, 7.2, 2.3);
  g.add(body, neck, head);
  return g;
}

function createVolcano() {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(10, 14, 10),
    new THREE.MeshLambertMaterial({ color: 0x5d4037 })
  );
  cone.position.y = 7;
  const lava = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff5722 })
  );
  lava.position.y = 13.5;
  g.add(cone, lava);
  return g;
}

function createCamel() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xd7a86e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 2.8), mat);
  body.position.y = 2.0;
  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 10), mat);
  hump.position.set(0, 3.0, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 1.1), mat);
  head.position.set(0, 3.4, 1.6);
  g.add(body, hump, head);
  return g;
}

function createCactus() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x43a047 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 4.0, 8), mat);
  stem.position.y = 2.0;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.8, 8), mat);
  arm.position.set(0.9, 2.6, 0);
  arm.rotation.z = Math.PI / 3;
  g.add(stem, arm);
  return g;
}

function createFish(i) {
  const colors = [0xff7043, 0xffeb3b, 0xff4081, 0x7c4dff];
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: colors[i % colors.length] });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 10), mat);
  body.scale.set(1, 0.8, 1.5);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.2, 4), mat);
  tail.position.z = -1.6;
  tail.rotation.x = Math.PI / 2;
  g.add(body, tail);
  return g;
}

function createJellyfish(i) {
  const colors = [0xf48fb1, 0xce93d8, 0x80cbc4];
  const g = new THREE.Group();
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.85 })
  );
  g.add(cap);
  return g;
}

function createCoral(i) {
  const colors = [0xff4081, 0xffab40, 0xab47bc];
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: colors[i % colors.length] });
  for (let j = 0; j < 3; j++) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 2.5 + j * 0.6, 6), mat);
    branch.position.set((j - 1) * 0.8, 1.2, 0);
    branch.rotation.z = (j - 1) * 0.3;
    g.add(branch);
  }
  return g;
}
