"use strict";

const TRACE_TOLERANCE = 0.035;
const TRACE_SEGMENTS = 56;
const CARVING_ROWS = 6;
const CARVING_INNER_ROWS = 4;
const MIN_TRACE_RATIO = 0.8;
const MIN_TRACE_ACCURACY = 0.65;
// 길이는 유지하고 대나무와 상목의 두 단면 축만 이전 크기의 절반으로 줄입니다.
const BAMBOO_CROSS_SECTION_SCALE = 0.5;
const WOOD_CROSS_SECTION_SCALE = 0.5;
const BAMBOO_THICKNESS = 0.18 * BAMBOO_CROSS_SECTION_SCALE;
// 건조한 대나무의 몸통과 측면 음영 색상입니다.
const BAMBOO_IVORY_OCHRE_COLOR = 0xd8b888;
const BAMBOO_OCHRE_ACCENT = 0xb68b52;
const WOOD_THICKNESS = 0.18 * WOOD_CROSS_SECTION_SCALE;
const WORKPIECE_BASE_Y = 1.08;

// 3D 무대와 카메라 연출만 담당합니다. 게임 상태는 game-state.js에서 관리합니다.
class WorkshopScene {
  constructor(container, reducedMotion) {
    this.container = container;
    this.reducedMotion = reducedMotion;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#e9d8bd");
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    container.appendChild(this.renderer.domElement);

    this.cameraTarget = new THREE.Vector3(0, 1.55, 0);
    this.introPosition = new THREE.Vector3(1.45, 5.52, 10.03);
    this.introTarget = new THREE.Vector3(1.45, 1.42, -1.77);
    this.cameraTarget.copy(this.introTarget);
    this.workPosition = new THREE.Vector3(1.45, 3.8, 2.5);
    this.workTarget = new THREE.Vector3(1.45, 1.15, 0.25);
    this.camera.position.copy(this.introPosition);
    this.camera.lookAt(this.cameraTarget);
    this.transition = null;
    this.clock = new THREE.Clock();
    this.bamboo = [];
    this.makeWorld();
    this.world = new THREE.Group();
    for (const object of [...this.scene.children]) {
      if (!object.isLight) this.world.add(object);
    }
    this.scene.add(this.world);
    this.roomOffset = new THREE.Vector3(1.45, -0.279, -1.77);
    this.room = createWorkshop(this.scene);
    this.room.position.copy(this.roomOffset);
    this.hwarang = new Hwarang();
    this.hwarang.group.position.add(this.roomOffset);
    this.scene.add(this.hwarang.group);
    this.character = this.hwarang.group;
    this.setupCarving();
    this.resize();
    // 캔버스의 실제 크기 변경을 감지해 모바일 회전과 레이아웃 변화에 대응합니다.
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    window.addEventListener("resize", () => this.resize());
    this.renderer.setAnimationLoop(() => this.render());
  }

  material(color, roughness = 0.85) { return new THREE.MeshStandardMaterial({ color, roughness }); }

  bambooOchreMaterial() {
    const material = this.material(BAMBOO_IVORY_OCHRE_COLOR, 0.7);
    material.vertexColors = true;
    return material;
  }

  colorBambooOchre(geometry) {
    const normals = geometry.getAttribute("normal");
    const base = new THREE.Color(BAMBOO_IVORY_OCHRE_COLOR);
    const accent = new THREE.Color(BAMBOO_OCHRE_ACCENT);
    const colors = [];
    for (let i = 0; i < normals.count; i++) {
      if (normals.getY(i) > 0.5) colors.push(1, 1, 1);
      else colors.push(accent.r / base.r, accent.g / base.g, accent.b / base.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  }

  bambooInteriorMaterial() {
    const material = this.material(0xffffff);
    material.vertexColors = true;
    return material;
  }

  colorBambooInterior(geometry) {
    const normals = geometry.getAttribute("normal");
    const top = new THREE.Color(0xe8d6b7);
    const side = new THREE.Color(0xb89571);
    const colors = [];
    for (let i = 0; i < normals.count; i++) {
      const color = normals.getY(i) > 0.5 ? top : side;
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  }

  mesh(geometry, material, parent, x, y, z) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  box(parent, size, pos, material) {
    return this.mesh(new THREE.BoxGeometry(...size), material, parent, ...pos);
  }

  sphere(parent, size, pos, material) {
    const object = this.mesh(new THREE.SphereGeometry(1, 24, 16), material, parent, ...pos);
    object.scale.set(...size);
    return object;
  }

  cylinder(parent, radiusTop, radiusBottom, height, pos, material, sides = 16) {
    return this.mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, sides), material, parent, ...pos);
  }

  surfaceTexture(kind) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("재질 텍스처를 만들 수 없습니다.");
    context.fillStyle = "#f4f1eb";
    context.fillRect(0, 0, 256, 256);
    if (kind === "wood") {
      for (let i = 0; i < 36; i++) {
        const x = i * 8;
        context.strokeStyle = i % 4 === 0 ? "rgba(90,60,37,.16)" : "rgba(110,78,50,.08)";
        context.lineWidth = i % 4 === 0 ? 1.4 : 0.7;
        context.beginPath();
        context.moveTo(x, 0);
        context.bezierCurveTo(x + 5, 65, x - 5, 185, x + 2, 256);
        context.stroke();
      }
    } else {
      context.lineWidth = 0.7;
      for (let i = 0; i < 256; i += 4) {
        context.strokeStyle = i % 8 ? "rgba(90,100,110,.07)" : "rgba(255,255,255,.25)";
        context.beginPath();
        context.moveTo(i, 0);
        context.lineTo(i, 256);
        context.moveTo(0, i);
        context.lineTo(256, i);
        context.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  loft(parent, rings, material, segments = 48) {
    const positions = [];
    const uvs = [];
    const indices = [];
    rings.forEach((ring, row) => {
      for (let i = 0; i <= segments; i++) {
        const angle = i * Math.PI * 2 / segments;
        const fold = 1 + (ring.fold || 0) * Math.cos(angle * 8);
        positions.push(Math.cos(angle) * ring.x * fold, ring.y, (ring.zOffset || 0) + Math.sin(angle) * ring.z * fold);
        uvs.push(i / segments, row / (rings.length - 1));
      }
    });
    for (let row = 0; row < rings.length - 1; row++) {
      for (let i = 0; i < segments; i++) {
        const a = row * (segments + 1) + i;
        const b = a + segments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return this.mesh(geometry, material, parent, 0, 0, 0);
  }

  makeWorld() {
    const scene = this.scene;
    scene.add(new THREE.AmbientLight("#fff0d9", 1.6));
    scene.add(new THREE.HemisphereLight("#fff6de", "#a9795b", 0.8));
    const light = new THREE.DirectionalLight("#fff2d6", 3.2);
    light.position.set(-4, 9, 6);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = -8;
    light.shadow.camera.right = 8;
    light.shadow.camera.top = 8;
    light.shadow.camera.bottom = -8;
    light.shadow.bias = -0.0004;
    scene.add(light);
    this.woodTexture = this.surfaceTexture("wood");
    this.clothTexture = this.surfaceTexture("cloth");
    const green = this.material(0x85a986);
    const bambooGreen = this.material(0x91b477);
    const table = new THREE.Group();
    table.position.set(1.45, 0, 0.25);
    scene.add(table);
    this.table = table;
    this.wholeBamboo = new THREE.Group();
    table.add(this.wholeBamboo);
    const bambooCenterY = WORKPIECE_BASE_Y + 0.3 * BAMBOO_CROSS_SECTION_SCALE;
    const bambooPiece = this.cylinder(this.wholeBamboo, 0.3 * BAMBOO_CROSS_SECTION_SCALE, 0.3 * BAMBOO_CROSS_SECTION_SCALE, 1.65, [0, bambooCenterY, 0], bambooGreen, 32);
    bambooPiece.rotation.z = Math.PI / 2;
    for (const x of [-0.48, 0.1, 0.65]) {
      const joint = this.cylinder(this.wholeBamboo, 0.31 * BAMBOO_CROSS_SECTION_SCALE, 0.31 * BAMBOO_CROSS_SECTION_SCALE, 0.045, [x, bambooCenterY, 0], green, 32);
      joint.rotation.z = Math.PI / 2;
    }

  }

  curve(parent, points, radius, material) {
    const path = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    return this.mesh(new THREE.TubeGeometry(path, 24, radius, 6, false), material, parent, 0, 0, 0);
  }

  makeRoof(scene, roof, timber) {
    const roofGroup = new THREE.Group();
    roofGroup.position.y = -0.2;
    scene.add(roofGroup);
    const roofHeight = (x) => 4.55 - 0.27 * Math.abs(x) + 0.035 * x * x;
    const shape = new THREE.Shape();
    shape.moveTo(-4.2, roofHeight(-4.2));
    for (let i = 0; i <= 32; i++) {
      const x = -4.2 + i * 8.4 / 32;
      shape.lineTo(x, roofHeight(x));
    }
    shape.lineTo(4.2, roofHeight(4.2) - 0.15);
    shape.lineTo(-4.2, roofHeight(-4.2) - 0.15);
    shape.closePath();
    const roofMesh = this.mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.65, bevelEnabled: false }), roof, roofGroup, 0, 0, -2.95);
    roofMesh.receiveShadow = true;
    const tileEdge = this.material(0x687d79);
    for (let x = -4.08; x <= 4.08; x += 0.25) {
      const y = roofHeight(x);
      this.curve(roofGroup, [[x, y + 0.025, -2.95], [x, y + 0.07, -2.1], [x, y + 0.025, -1.3]], 0.035, tileEdge);
      const endTile = this.cylinder(roofGroup, 0.085, 0.085, 0.045, [x, y - 0.015, -1.27], tileEdge, 16);
      endTile.rotation.x = Math.PI / 2;
    }
    for (const z of [-2.7, -2.3, -1.9, -1.5]) {
      const seam = [];
      for (let i = 0; i <= 24; i++) {
        const x = -4.15 + i * 8.3 / 24;
        seam.push([x, roofHeight(x) + 0.045, z]);
      }
      this.curve(roofGroup, seam, 0.012, tileEdge);
    }
    const eave = [];
    for (let i = 0; i <= 24; i++) {
      const x = -4.2 + i * 8.4 / 24;
      eave.push([x, roofHeight(x) - 0.08, -1.28]);
    }
    this.curve(roofGroup, eave, 0.09, timber);
    for (let x = -3.8; x <= 3.8; x += 0.45) {
      this.cylinder(roofGroup, 0.055, 0.055, 1.15, [x, roofHeight(x) - 0.2, -1.9], timber, 10).rotation.x = Math.PI / 2;
    }
  }

  makeBambooGrove(plant) {
    const stalks = [0x6f985d, 0x86a96b, 0x779c60].map((color) => this.material(color));
    stalks.forEach((material) => { material.map = this.woodTexture; });
    const node = this.material(0x527a4c);
    const leaves = [this.material(0x4f8053), this.material(0x78a367)];
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.23, 0.13, 0.55, 0.04);
    leafShape.quadraticCurveTo(0.29, -0.07, 0, 0);
    const leafGeometry = new THREE.ShapeGeometry(leafShape, 12);
    for (let i = 0; i < 4; i++) {
      const px = (i - 1.5) * 0.32;
      const height = 2.4 + (i % 3) * 0.4;
      const radius = 0.075 - i * 0.006;
      this.cylinder(plant, radius * 0.65, radius, height, [px, height / 2, i % 2 * 0.2], stalks[i % 3], 12);
      for (let y = 0.45; y < height; y += 0.5) {
        this.cylinder(plant, radius * 1.05, radius * 1.05, 0.045, [px, y, i % 2 * 0.2], node, 12);
      }
      for (let j = 0; j < 5; j++) {
        const side = j % 2 ? -1 : 1;
        const y = height - 0.25 - j * 0.32;
        this.curve(plant, [[px, y, i % 2 * 0.2], [px + side * 0.22, y + 0.13, i % 2 * 0.2], [px + side * 0.46, y + 0.1, i % 2 * 0.2]], 0.012, node);
        const leaf = this.mesh(leafGeometry, leaves[j % 2], plant, px + side * 0.2, y + 0.12, i % 2 * 0.2 + 0.02);
        leaf.material.side = THREE.DoubleSide;
        leaf.scale.x = side;
        leaf.rotation.z = side * (0.25 + j * 0.05);
      }
    }
  }

  makeCharacter() {
    const c = this.character = new THREE.Group();
    c.position.set(-1.35, 0.12, 0.4);
    this.scene.add(c);
    const skin = this.material(0xf3b995, 0.8);
    const hair = this.material(0x3c2924);
    const navy = this.material(0x274d83);
    const blue = this.material(0x4471a5);
    const pale = this.material(0xc9dce6);
    const dark = this.material(0x29354a);
    const brown = this.material(0x635044);
    const gold = this.material(0xc99d54, 0.55);
    const white = this.material(0xfff8ec);
    const eye = this.material(0x422a24, 0.3);
    for (const fabric of [navy, blue, pale, dark]) fabric.map = this.clothTexture;

    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.27, 0, 0);
      c.add(leg);
      this.loft(leg, [
        { y: 0.22, x: 0.16, z: 0.17 }, { y: 0.3, x: 0.19, z: 0.19 },
        { y: 0.42, x: 0.24, z: 0.23, fold: 0.04 }, { y: 0.62, x: 0.25, z: 0.23, fold: 0.035 },
        { y: 0.79, x: 0.2, z: 0.19 }, { y: 0.84, x: 0.12, z: 0.12 }
      ], dark);
      const shoe = this.sphere(c, [0.25, 0.13, 0.31], [side * 0.27, 0.13, 0.07], dark);
      shoe.rotation.x = -0.1;
      this.cylinder(c, 0.2, 0.2, 0.065, [side * 0.27, 0.28, 0], blue, 20);
      const sleeve = new THREE.Group();
      sleeve.position.set(side * 0.57, 1.16, 0);
      sleeve.rotation.z = side * 0.55;
      c.add(sleeve);
      this.loft(sleeve, [
        { y: -0.31, x: 0.17, z: 0.17 }, { y: -0.24, x: 0.21, z: 0.2 },
        { y: -0.08, x: 0.23, z: 0.22, fold: 0.025 }, { y: 0.13, x: 0.22, z: 0.21 },
        { y: 0.3, x: 0.16, z: 0.16 }, { y: 0.34, x: 0.08, z: 0.08 }
      ], pale);
      const cuff = this.mesh(new THREE.TorusGeometry(0.18, 0.012, 8, 24), blue, sleeve, 0, -0.27, 0);
      cuff.rotation.x = Math.PI / 2;
      this.sphere(c, [0.16, 0.16, 0.16], [side * 0.72, 0.91, 0.04], skin);
    }
    this.loft(c, [
      { y: 0.65, x: 0.54, z: 0.42, fold: 0.025 }, { y: 0.72, x: 0.56, z: 0.43, fold: 0.025 },
      { y: 0.85, x: 0.52, z: 0.41 }, { y: 1.05, x: 0.48, z: 0.39 },
      { y: 1.24, x: 0.47, z: 0.37 }, { y: 1.4, x: 0.42, z: 0.33 },
      { y: 1.49, x: 0.31, z: 0.25 }, { y: 1.53, x: 0.18, z: 0.16 }
    ], blue);
    this.cylinder(c, 0.49, 0.51, 0.16, [0, 0.9, 0], navy, 32).scale.z = 0.8;
    this.curve(c, [[-0.42, 0.7, 0.22], [-0.2, 0.68, 0.36], [0, 0.68, 0.39], [0.2, 0.68, 0.36], [0.42, 0.7, 0.22]], 0.015, gold);
    const stitches = [];
    for (let x = -0.38; x <= 0.36; x += 0.055) {
      const z = 0.43 * Math.sqrt(1 - (x / 0.56) ** 2) + 0.012;
      stitches.push(x, 0.73, z, x + 0.025, 0.73, z);
    }
    const stitchGeometry = new THREE.BufferGeometry();
    stitchGeometry.setAttribute("position", new THREE.Float32BufferAttribute(stitches, 3));
    const stitchLine = new THREE.LineSegments(stitchGeometry, new THREE.LineBasicMaterial({ color: 0xb9a37e }));
    c.add(stitchLine);
    this.curve(c, [[-0.44, 1.46, 0.3], [0, 1.14, 0.48], [0.31, 1.49, 0.29]], 0.065, pale);
    this.curve(c, [[-0.39, 1.44, 0.32], [0.02, 1.08, 0.44], [0.36, 1.4, 0.29]], 0.035, navy);
    this.curve(c, [[-0.05, 0.95, 0.42], [0.02, 0.83, 0.45], [0.08, 0.58, 0.43]], 0.045, navy);
    this.sphere(c, [0.15, 0.09, 0.06], [0, 0.94, 0.45], dark);
    this.curve(c, [[-0.39, 1.48, 0.02], [0.05, 1.12, 0.45], [0.42, 0.84, 0.23]], 0.045, brown);
    this.sphere(c, [0.05, 0.05, 0.03], [0.25, 0.96, 0.37], gold);
    const quiver = this.cylinder(c, 0.17, 0.12, 0.6, [-0.5, 1.35, -0.26], brown, 20);
    quiver.rotation.z = -0.45;
    for (let i = 0; i < 4; i++) {
      const x = -0.72 + i * 0.08;
      this.curve(c, [[x + 0.15, 1.32, -0.24], [x, 1.93, -0.25]], 0.012, brown);
      this.curve(c, [[x, 1.85, -0.25], [x - 0.08, 1.99, -0.25]], 0.018, pale);
    }

    this.sphere(c, [0.69, 0.63, 0.56], [0, 1.94, -0.04], hair);
    this.loft(c, [
      { y: 1.32, x: 0.06, z: 0.08, zOffset: 0.08 },
      { y: 1.37, x: 0.34, z: 0.3, zOffset: 0.1 },
      { y: 1.48, x: 0.52, z: 0.42, zOffset: 0.1 },
      { y: 1.66, x: 0.63, z: 0.48, zOffset: 0.1 },
      { y: 1.9, x: 0.66, z: 0.51, zOffset: 0.1 },
      { y: 2.13, x: 0.63, z: 0.48, zOffset: 0.1 },
      { y: 2.32, x: 0.48, z: 0.38, zOffset: 0.08 },
      { y: 2.43, x: 0.2, z: 0.2, zOffset: 0.04 },
      { y: 2.46, x: 0, z: 0 }
    ], skin);
    for (const side of [-1, 1]) {
      this.sphere(c, [0.13, 0.16, 0.1], [side * 0.62, 1.9, 0.05], skin);
      this.sphere(c, [0.175, 0.215, 0.045], [side * 0.27, 2.02, 0.56], white);
      this.sphere(c, [0.115, 0.155, 0.035], [side * 0.27, 2.01, 0.596], eye);
      this.sphere(c, [0.036, 0.046, 0.015], [side * 0.27 - 0.025, 2.08, 0.635], white);
      this.sphere(c, [0.1, 0.05, 0.014], [side * 0.43, 1.78, 0.484], this.material(0xe99888));
    }
    this.mesh(new THREE.ConeGeometry(0.065, 0.16, 5), this.material(0xe98968), c, 0, 1.85, 0.6);
    this.curve(c, [[-0.15, 1.72, 0.57], [0, 1.67, 0.61], [0.15, 1.72, 0.57]], 0.018, hair);
    const fringe = new THREE.Shape();
    fringe.moveTo(-0.56, 2.34);
    fringe.quadraticCurveTo(0, 2.49, 0.56, 2.34);
    fringe.lineTo(0.53, 2.15);
    fringe.quadraticCurveTo(0.42, 2.22, 0.34, 2.2);
    fringe.quadraticCurveTo(0.24, 2.17, 0.17, 2.22);
    fringe.quadraticCurveTo(0.055, 2.14, -0.03, 2.19);
    fringe.quadraticCurveTo(-0.156, 2.12, -0.23, 2.2);
    fringe.quadraticCurveTo(-0.396, 2.12, -0.53, 2.16);
    fringe.closePath();
    const fringeGeometry = new THREE.ExtrudeGeometry(fringe, { depth: 0.035, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 5 });
    const fringePosition = fringeGeometry.attributes.position;
    for (let i = 0; i < fringePosition.count; i++) {
      const x = fringePosition.getX(i);
      fringePosition.setZ(i, fringePosition.getZ(i) - 0.24 * (x / 0.56) ** 2);
    }
    fringePosition.needsUpdate = true;
    fringeGeometry.computeVertexNormals();
    this.mesh(fringeGeometry, hair, c, 0, 0, 0.42);
    this.sphere(c, [0.2, 0.2, 0.2], [0, 2.51, -0.22], hair);
    this.cylinder(c, 0.19, 0.19, 0.04, [0, 2.52, -0.22], gold, 20);
    this.loft(c, [
      { y: 2.3, x: 0.62, z: 0.47 }, { y: 2.43, x: 0.6, z: 0.45 },
      { y: 2.56, x: 0.49, z: 0.38 }, { y: 2.68, x: 0.28, z: 0.23 },
      { y: 2.74, x: 0, z: 0 }
    ], navy);
    this.cylinder(c, 0.64, 0.64, 0.13, [0, 2.29, 0], brown, 40).scale.z = 0.79;
    for (const side of [-1, 1]) {
      const feather = new THREE.Shape();
      feather.moveTo(side * 0.48, 2.33);
      feather.quadraticCurveTo(side * 0.45, 2.67, side * 0.84, 2.96);
      feather.quadraticCurveTo(side * 0.73, 2.58, side * 0.48, 2.33);
      const featherMaterial = this.material(0x9b7854);
      featherMaterial.side = THREE.DoubleSide;
      this.mesh(new THREE.ShapeGeometry(feather, 18), featherMaterial, c, 0, 0, 0.28);
      this.curve(c, [[side * 0.48, 2.33, 0.29], [side * 0.62, 2.67, 0.29], [side * 0.84, 2.96, 0.29]], 0.012, gold);
      for (let i = 0; i < 5; i++) {
        const x = 0.5 + i * 0.052;
        const y = 2.5 + i * 0.075;
        this.curve(c, [[side * x, y, 0.295], [side * (x + 0.075), y + 0.025, 0.295]], 0.006, gold);
      }
    }
    this.curve(c, [[0.59, 0.34, -0.56], [1.01, 1.35, -0.56], [0.59, 2.35, -0.56]], 0.04, brown);
    this.curve(c, [[0.59, 0.34, -0.6], [0.59, 2.35, -0.6]], 0.008, pale);
  }

  setupCarving() {
    this.carving = false;
    this.dragging = false;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.carvingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(WORKPIECE_BASE_Y + BAMBOO_THICKNESS));
    this.halfLength = 0.825;
    this.halfWidth = 0.3 * BAMBOO_CROSS_SECTION_SCALE;
    this.splitPieces = new THREE.Group();
    this.table.add(this.splitPieces);
    const splitMaterial = this.material(0xffffff);
    splitMaterial.vertexColors = true;
    for (const upper of [false, true]) {
      const shape = new THREE.Shape();
      const start = upper ? 0 : Math.PI;
      shape.moveTo(Math.cos(start) * this.halfWidth, 0);
      shape.absarc(0, 0, this.halfWidth, start, start + Math.PI, false);
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: this.halfLength * 2, steps: 1, bevelEnabled: false, curveSegments: 32 });
      geometry.translate(0, 0, -this.halfLength);
      geometry.rotateY(Math.PI / 2);
      const normals = geometry.getAttribute("normal");
      const skin = new THREE.Color(0x91b477);
      const cut = new THREE.Color(0xe8d6b7);
      const colors = [];
      for (let i = 0; i < normals.count; i++) {
        const color = Math.abs(normals.getY(i)) > 0.9999 ? cut : skin;
        colors.push(color.r, color.g, color.b);
      }
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      const half = this.mesh(geometry, splitMaterial, this.splitPieces, 0, WORKPIECE_BASE_Y + this.halfWidth, 0);
      half.userData.upper = upper;
    }
    this.splitTool = new THREE.Group();
    this.table.add(this.splitTool);
    this.box(this.splitTool, [0.23, 0.12, 0.025], [0, 0.06, 0], this.material(0xaab7b2, 0.4));
    this.box(this.splitTool, [0.13, 0.065, 0.065], [-0.17, 0.09, 0], this.material(0x865439));
    this.splitTool.visible = false;

    this.strip = new THREE.Group();
    this.strip.position.y = WORKPIECE_BASE_Y;
    this.rotationTarget = 0;
    this.table.add(this.strip);
    const count = TRACE_SEGMENTS;
    const segmentLength = this.halfLength * 2 / count;
    this.chipGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.colorBambooInterior(this.chipGeometry);
    this.chipMaterial = this.bambooInteriorMaterial();
    this.chips = [];
    for (let i = 0; i < count; i++) {
      const x = -this.halfLength + (i + 0.5) * segmentLength;
      const guide = this.guideWidth(x);
      for (const side of [-1, 1]) {
        for (let row = 0; row < CARVING_ROWS; row++) {
          const inner = row < CARVING_INNER_ROWS;
          const width = inner ? guide / CARVING_INNER_ROWS : (this.halfWidth - guide) / (CARVING_ROWS - CARVING_INNER_ROWS);
          const distance = inner ? (row + 0.5) * width : guide + (row - CARVING_INNER_ROWS + 0.5) * width;
          this.chips.push({ x, z: side * distance, width, length: segmentLength, inner, weight: width * segmentLength, removed: false });
        }
      }
    }
    this.surface = new THREE.InstancedMesh(this.chipGeometry, this.chipMaterial, this.chips.length);
    this.surface.castShadow = true;
    this.surface.receiveShadow = true;
    this.surface.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.strip.add(this.surface);
    this.chipMatrix = new THREE.Matrix4();
    this.fallingChips = [];
    const lineMaterial = new THREE.LineDashedMaterial({ color: 0x254d38, dashSize: 0.035, gapSize: 0.018, depthTest: false });
    for (const side of [-1, 1]) {
      const points = [];
      for (let i = 0; i <= 80; i++) {
        const x = -this.halfLength + i * this.halfLength * 2 / 80;
        points.push(new THREE.Vector3(x, BAMBOO_THICKNESS + 0.01, side * this.guideWidth(x)));
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial);
      line.computeLineDistances();
      line.renderOrder = 2;
      this.strip.add(line);
    }
    this.traceLine = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.006, 0.006, 1, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc657, depthTest: false }),
      TRACE_SEGMENTS * 2
    );
    this.traceLine.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.traceLine.frustumCulled = false;
    this.traceLine.renderOrder = 3;
    this.strip.add(this.traceLine);

    this.tool = new THREE.Group();
    this.scene.add(this.tool);
    this.box(this.tool, [0.12, 0.1, 0.07], [0, 0.06, 0], this.material(0x9ba9a1, 0.35));
    const handle = this.box(this.tool, [0.055, 0.055, 0.32], [0, 0.11, 0.19], this.material(0x8b5a3b));
    handle.rotation.x = 0.25;
    this.tool.visible = false;
    this.resetCarving();
    this.strip.visible = false;
    this.splitPieces.visible = false;

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (event) => {
      if (!this.carving || this.dragging || event.button !== 0 || !event.isPrimary) return;
      event.preventDefault();
      this.dragging = true;
      this.dragStarted = false;
      this.pointerId = event.pointerId;
      this.lastPointer = null;
      canvas.setPointerCapture(event.pointerId);
      this.updatePointer(event, false);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!this.carving || !event.isPrimary || (this.dragging && event.pointerId !== this.pointerId)) return;
      this.updatePointer(event, this.dragging);
    });
    const stopDragging = (event) => {
      if (event.pointerId !== this.pointerId) return;
      this.dragging = false;
      this.dragStarted = false;
      this.pointerId = null;
      this.lastPointer = null;
    };
    canvas.addEventListener("pointerup", stopDragging);
    canvas.addEventListener("pointercancel", stopDragging);
    canvas.addEventListener("lostpointercapture", stopDragging);
    canvas.addEventListener("pointerleave", () => { if (!this.dragging) this.tool.visible = false; });
  }

  guideWidth(x) {
    return (0.13 + 0.06 * (1 - (x / this.halfLength) ** 2)) * BAMBOO_CROSS_SECTION_SCALE;
  }

  updatePointer(event, cutting) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.carvingPlane, hit)) return;
    this.tool.position.copy(hit);
    this.tool.visible = true;
    this.strip.updateWorldMatrix(true, false);
    const localHit = this.strip.worldToLocal(hit.clone());
    if (!cutting) {
      if (this.dragging) this.lastPointer = localHit;
      return;
    }
    const start = this.lastPointer || localHit;
    const distance = start.distanceTo(localHit);
    if (!this.dragStarted) {
      if (distance < 0.005) return;
      this.dragStarted = true;
    }
    const steps = Math.max(1, Math.ceil(distance / (TRACE_TOLERANCE / 3)));
    let changed = false;
    for (let i = 1; i <= steps; i++) {
      const point = start.clone().lerp(localHit, i / steps);
      const stepLength = distance / steps;
      if (Math.abs(point.x) > this.halfLength + TRACE_TOLERANCE ||
          Math.abs(point.z) > this.halfWidth + TRACE_TOLERANCE) continue;
      this.traceDistance += stepLength;
      const x = THREE.MathUtils.clamp(point.x, -this.halfLength, this.halfLength);
      const side = point.z < 0 ? 0 : 1;
      const guide = (side === 0 ? -1 : 1) * this.guideWidth(x);
      if (Math.abs(point.x - x) <= TRACE_TOLERANCE && Math.abs(point.z - guide) <= TRACE_TOLERANCE) {
        this.traceValidDistance += stepLength;
        const segment = Math.min(TRACE_SEGMENTS - 1, Math.floor((x + this.halfLength) / (this.halfLength * 2) * TRACE_SEGMENTS));
        if (!this.traceCovered[side][segment]) {
          this.traceCovered[side][segment] = true;
          const firstChip = (segment * 2 + side) * CARVING_ROWS;
          for (let row = CARVING_INNER_ROWS; row < CARVING_ROWS; row++) {
            const index = firstChip + row;
            if (!this.chips[index].removed) this.removeChip(index);
          }
          const x0 = -this.halfLength + segment * this.halfLength * 2 / TRACE_SEGMENTS;
          const x1 = -this.halfLength + (segment + 1) * this.halfLength * 2 / TRACE_SEGMENTS;
          const sign = side === 0 ? -1 : 1;
          const a = new THREE.Vector3(x0, BAMBOO_THICKNESS + 0.016, sign * this.guideWidth(x0));
          const b = new THREE.Vector3(x1, BAMBOO_THICKNESS + 0.016, sign * this.guideWidth(x1));
          const direction = b.clone().sub(a);
          const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
          const matrix = new THREE.Matrix4().compose(a.add(b).multiplyScalar(0.5), rotation, new THREE.Vector3(1, direction.length(), 1));
          this.traceLine.setMatrixAt(side * TRACE_SEGMENTS + segment, matrix);
          changed = true;
        }
      }
    }
    this.lastPointer = localHit;
    if (changed) {
      this.traceLine.instanceMatrix.needsUpdate = true;
      this.surface.instanceMatrix.needsUpdate = true;
    }
    if (this.onCarve) this.onCarve();
  }

  removeChip(index) {
    const chip = this.chips[index];
    chip.removed = true;
    this.chipMatrix.makeScale(0, 0, 0);
    this.surface.setMatrixAt(index, this.chipMatrix);
    if (this.reducedMotion.matches || this.fallingChips.length >= 80) return;
    const falling = new THREE.Mesh(this.chipGeometry, this.chipMaterial);
    falling.position.set(chip.x, BAMBOO_THICKNESS / 2, chip.z);
    falling.scale.set(chip.length, BAMBOO_THICKNESS, chip.width);
    falling.castShadow = true;
    this.strip.add(falling);
    const tablePosition = new THREE.Vector3(chip.x, 0, chip.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.strip.rotation.y);
    const distanceX = 1.175 - Math.abs(tablePosition.x);
    const distanceZ = 0.95 - Math.abs(tablePosition.z);
    const direction = distanceX < distanceZ
      ? new THREE.Vector3(Math.sign(tablePosition.x) || 1, 0, 0)
      : new THREE.Vector3(0, 0, Math.sign(tablePosition.z) || 1);
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.strip.rotation.y);
    this.fallingChips.push({ mesh: falling, chip, direction, slideDistance: Math.min(distanceX, distanceZ) + 0.12, start: performance.now() });
  }

  resetCarving() {
    this.stopCutting();
    this.tool.visible = false;
    for (const falling of this.fallingChips) this.strip.remove(falling.mesh);
    this.fallingChips.length = 0;
    this.traceCovered = [Array(TRACE_SEGMENTS).fill(false), Array(TRACE_SEGMENTS).fill(false)];
    this.traceDistance = 0;
    this.traceValidDistance = 0;
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < TRACE_SEGMENTS * 2; i++) this.traceLine.setMatrixAt(i, hidden);
    this.traceLine.instanceMatrix.needsUpdate = true;
    for (let index = 0; index < this.chips.length; index++) {
      const chip = this.chips[index];
      chip.removed = false;
      this.chipMatrix.makeScale(chip.length, BAMBOO_THICKNESS, chip.width);
      this.chipMatrix.setPosition(chip.x, BAMBOO_THICKNESS / 2, chip.z);
      this.surface.setMatrixAt(index, this.chipMatrix);
    }
    this.surface.instanceMatrix.needsUpdate = true;
    if (this.onCarve) this.onCarve();
  }

  stopCutting() {
    const canvas = this.renderer.domElement;
    if (this.pointerId !== null && this.pointerId !== undefined && canvas.hasPointerCapture(this.pointerId)) canvas.releasePointerCapture(this.pointerId);
    this.dragging = false;
    this.dragStarted = false;
    this.pointerId = null;
    this.lastPointer = null;
  }

  setCarving(enabled) {
    this.carving = enabled;
    this.container.classList.toggle("playing", enabled);
    if (!enabled) {
      this.stopCutting();
      this.tool.visible = false;
    }
    this.resize();
  }

  rotateBamboo(degrees, immediate = false) {
    this.stopCutting();
    this.tool.visible = false;
    this.rotationTarget = THREE.MathUtils.degToRad(degrees);
    if (immediate || this.reducedMotion.matches) {
      this.strip.rotation.y = this.rotationTarget;
      this.updateCarvingFov();
    }
  }

  carvingResult() {
    const sides = this.traceCovered.map((segments) => segments.filter(Boolean).length / TRACE_SEGMENTS);
    const coverage = (sides[0] + sides[1]) / 2;
    const accuracy = this.traceDistance > 0 ? this.traceValidDistance / this.traceDistance : 0;
    const passed = sides.every((ratio) => ratio >= MIN_TRACE_RATIO) && accuracy >= MIN_TRACE_ACCURACY;
    return { progress: Math.floor(coverage * 100), sides, accuracy, passed };
  }

  splitBamboo(onComplete) {
    this.wholeBamboo.visible = false;
    this.splitPieces.visible = true;
    this.strip.visible = false;
    this.splitTool.visible = !this.reducedMotion.matches;
    this.splitPieces.children.forEach((piece) => { piece.position.set(0, WORKPIECE_BASE_Y + this.halfWidth, 0); piece.rotation.set(0, 0, 0); });
    this.splitAnimation = { start: performance.now(), duration: this.reducedMotion.matches ? 1 : 2400, onComplete };
  }

  showIntro() {
    this.setCarving(false);
    this.splitAnimation = null;
    this.splitTool.visible = false;
    this.strip.visible = false;
    this.splitPieces.visible = false;
    this.wholeBamboo.visible = true;
    this.rotateBamboo(0, true);
    this.resetCarving();
  }

  resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    if (!this.continuationActive) this.updateCarvingFov();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
  }

  updateCarvingFov() {
    // 세로 화면에서도 가로 화각을 유지해 작업물이 화면 양옆에서 잘리지 않게 합니다.
    const baseFov = THREE.MathUtils.degToRad(38);
    const angle = this.carving ? this.strip.rotation.y : this.woodwork && this.woodwork.active ? this.woodwork.board.rotation.y : 0;
    const rotationScale = 1 + 2.5 * Math.abs(Math.sin(angle));
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(baseFov / 2) * rotationScale / Math.min(this.camera.aspect, 1)));
    this.camera.updateProjectionMatrix();
  }

  updateWorkpieceRotation(object, target, delta) {
    const current = object.rotation.y;
    if (current === target) return;
    const next = this.reducedMotion.matches ? target : THREE.MathUtils.damp(current, target, 12, delta);
    object.rotation.y = Math.abs(next - target) < 0.0001 ? target : next;
    this.updateCarvingFov();
  }

  // 완료 콜백에서 상태를 전환합니다. 취소 시 콜백을 실행하지 않습니다.
  moveCamera(toWork, onComplete = () => {}) {
    const endPosition = toWork ? this.workPosition : this.introPosition;
    const endTarget = toWork ? this.workTarget : this.introTarget;
    this.moveCameraTo(endPosition, endTarget, onComplete);
  }

  moveCameraTo(endPosition, endTarget, onComplete = () => {}) {
    if (this.reducedMotion.matches) {
      this.camera.position.copy(endPosition);
      this.cameraTarget.copy(endTarget);
      this.camera.lookAt(this.cameraTarget);
      this.transition = null;
      onComplete();
      return;
    }
    this.transition = {
      start: performance.now(), duration: 1200,
      fromPosition: this.camera.position.clone(), toPosition: endPosition.clone(),
      fromTarget: this.cameraTarget.clone(), toTarget: endTarget.clone(), onComplete
    };
  }

  render() {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;
    const now = performance.now();
    if (this.carving && !this.dragging) this.updateWorkpieceRotation(this.strip, this.rotationTarget, delta);
    if (this.woodwork && this.woodwork.active && !this.woodwork.dragging) {
      this.updateWorkpieceRotation(this.woodwork.board, this.woodwork.rotationTarget, delta);
    }
    if (this.bending) this.bending.update(now);
    if (this.woodwork) this.woodwork.update(now);
    if (this.assembly) this.assembly.update(now);
    if (this.glue) this.glue.update(now);
    if (this.winding) this.winding.update(now);
    if (this.splitAnimation) {
      const animation = this.splitAnimation;
      const progress = Math.min((now - animation.start) / animation.duration, 1);
      const separation = THREE.MathUtils.clamp((progress - 0.55) / 0.45, 0, 1);
      const eased = separation * separation * (3 - 2 * separation);
      this.splitTool.visible = !this.reducedMotion.matches && progress < 0.55;
      this.splitTool.position.set(
        THREE.MathUtils.lerp(-this.halfLength, this.halfLength, Math.min(progress / 0.55, 1)),
        WORKPIECE_BASE_Y + this.halfWidth + 0.1,
        0
      );
      this.splitPieces.children.forEach((piece) => {
        if (piece.userData.upper) {
          piece.position.z = eased * 0.45;
          piece.position.y = WORKPIECE_BASE_Y + this.halfWidth - eased * eased * 0.35 * BAMBOO_CROSS_SECTION_SCALE;
          piece.rotation.x = eased * 0.35;
        } else {
          piece.position.y = WORKPIECE_BASE_Y + this.halfWidth;
        }
      });
      if (progress === 1) {
        this.splitPieces.visible = false;
        this.splitTool.visible = false;
        this.strip.visible = true;
        this.splitAnimation = null;
        animation.onComplete();
      }
    }
    for (let i = this.fallingChips.length - 1; i >= 0; i--) {
      const falling = this.fallingChips[i];
      const elapsed = this.reducedMotion.matches ? 1 : (now - falling.start) / 650;
      const fall = Math.max(0, (elapsed - 0.5) / 0.5);
      const slide = Math.min(1, elapsed / 0.5) * falling.slideDistance;
      falling.mesh.position.y = BAMBOO_THICKNESS / 2 - Math.min(elapsed * 0.04, 0.02) - fall * fall * 1.5;
      falling.mesh.position.x = falling.chip.x + falling.direction.x * slide;
      falling.mesh.position.z = falling.chip.z + falling.direction.z * slide;
      falling.mesh.rotation.x = elapsed * 1.5;
      if (elapsed >= 1) {
        this.strip.remove(falling.mesh);
        this.fallingChips.splice(i, 1);
      }
    }
    this.hwarang.update(this.reducedMotion.matches ? 0 : time);
    if (this.transition) {
      const transition = this.transition;
      const progress = Math.min((performance.now() - transition.start) / transition.duration, 1);
      const eased = progress * progress * (3 - 2 * progress);
      this.camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
      this.cameraTarget.lerpVectors(transition.fromTarget, transition.toTarget, eased);
      if (progress === 1) {
        this.transition = null;
        transition.onComplete();
      }
    }
    if (!this.continuationActive) this.camera.lookAt(this.cameraTarget);
    if (this.onContinuationFrame) this.onContinuationFrame(time, delta);
    this.renderer.render(this.scene, this.camera);
    if (this.onFrame) this.onFrame(now);
  }
}
