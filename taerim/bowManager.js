
import * as THREE from 'three';
const clamp = THREE.MathUtils.clamp;
const bowZ = x => 0.62 * Math.sqrt(Math.max(0, 1 - (x * x) / (1.8 * 1.8))) - 0.35;

export class BowManager {
class BowManager {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = '제작 중인 각궁';
    this.group.position.set(0, 1.43, 2);
    this.wood = new THREE.MeshStandardMaterial({ color: '#97613c', roughness: 1 });

    this.bambooMaterial = new THREE.MeshStandardMaterial({ color: BAMBOO_IVORY_OCHRE_COLOR, roughness: .7 });
    this.bambooAccent = new THREE.MeshStandardMaterial({ color: BAMBOO_OCHRE_ACCENT, roughness: .7 });
    this.fiberMaterial = new THREE.MeshStandardMaterial({ color: '#eee8d7', roughness: 1 });
    this.wrap = new THREE.MeshStandardMaterial({ color: '#f1d7a5', roughness: .9 });
    this.dark = new THREE.MeshStandardMaterial({ color: '#503625', roughness: .85 });
    this.metal = new THREE.MeshStandardMaterial({ color: '#8a9690', metalness: .55, roughness: .4 });
    this.bowGroup = new THREE.Group();
    this.group.add(this.bowGroup);
    const points = [];
    for (let index = 0; index <= 40; index++) {
      const x = -1.8 + index * 3.6 / 40;
      points.push(new THREE.Vector3(x, 0, bowZ(x)));
    }
    this.bowCurve = new THREE.CatmullRomCurve3(points);
    this.bow = new THREE.Mesh(new THREE.TubeGeometry(this.bowCurve, 80, .105, 10, false), this.wood);
    const bowGeometry = new THREE.TubeGeometry(this.bowCurve, 80, .105, 10, false);
    // 하나의 활 메시에서 아랫면만 대나무 층으로 분리해 갈색 몸체를 유지합니다.
    const indices = [[], [], []];
    const normals = bowGeometry.getAttribute('normal');
    const sourceIndex = bowGeometry.getIndex();
    for (let segment = 0; segment < 80; segment++) {
      for (let side = 0; side < 10; side++) {
        const normalY = (normals.getY(side) + normals.getY(side + 1)) / 2;
        const material = normalY < -.65 ? 1 : normalY < -.2 ? 2 : 0;
        for (let i = 0; i < 6; i++) indices[material].push(sourceIndex.getX((segment * 10 + side) * 6 + i));
      }
    }
    bowGeometry.setIndex(indices.flat());
    let start = 0;
    indices.forEach((group, material) => {
      bowGeometry.addGroup(start, group.length, material);
      start += group.length;
    });
    this.bow = new THREE.Mesh(bowGeometry, [this.wood, this.bambooMaterial, this.bambooAccent]);
    this.bowBasePositions = this.bow.geometry.attributes.position.array.slice();
    this.bow.name = '거친 활 몸체'; this.bow.castShadow = true; this.bowGroup.add(this.bow);
    this.grip = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .38, 16), this.wrap);
    this.grip.rotation.z = Math.PI / 2; this.grip.position.z = bowZ(0); this.bowGroup.add(this.grip);
    this.string = this.makeTube([new THREE.Vector3(-1.8, 0, bowZ(-1.8)), new THREE.Vector3(1.8, 0, bowZ(1.8))], .012, this.wrap);
    this.bowGroup.add(this.string);
    this.stringLoop = new THREE.Mesh(new THREE.TorusGeometry(.1, .025, 8, 24), this.wrap);
    this.stringLoop.rotation.x = Math.PI / 2; this.stringLoop.position.set(-1.72, .12, .35); this.bowGroup.add(this.stringLoop);
    this.layers = [-1, 1].map(side => {
      const layerPoints = [];
      for (let index = 0; index <= 30; index++) {
        const x = side * (0.08 + index * 1.65 / 30);
        layerPoints.push(new THREE.Vector3(x, .1, bowZ(x) + .025));
      }
      const mesh = this.makeTube(layerPoints, .045, this.fiberMaterial);
      mesh.userData.basePositions = mesh.geometry.attributes.position.array.slice();
      mesh.geometry.setDrawRange(0, 0); this.bowGroup.add(mesh); return mesh;
    });
    this.notches = [-1, 1].map(side => {
      const notch = new THREE.Mesh(new THREE.TorusGeometry(.11, .018, 8, 24), this.dark);
      notch.rotation.y = Math.PI / 2; notch.position.set(side * 1.7, 0, bowZ(1.7)); this.bowGroup.add(notch); return notch;
    });
    this.support = new THREE.Group(); this.group.add(this.support);
    this.addBox(this.support, [3.15, .12, .14], [0, .03, -.2], this.dark);
    for (const x of [-1.4, 1.4]) this.addBox(this.support, [.15, .15, .45], [x, .04, -.12], this.dark);
    this.supportRopes = [-1, 1].map(side => {
      const points = [];
      for (let index = 0; index <= 120; index++) {
        const phase = index / 120;
        const angle = phase * Math.PI * 8;
        points.push(new THREE.Vector3(side * 1.4 - .16 + phase * .32, .06 + Math.cos(angle) * .14, -.2 + Math.sin(angle) * .14));
      }
      const rope = this.makeTube(points, .028, this.wrap, 120);
      rope.name = side < 0 ? '감긴 지지대 끈' : '감을 지지대 끈';
      this.support.add(rope); return rope;
    });
    this.looseRope = this.makeTube([
      new THREE.Vector3(1.48, .09, -.2), new THREE.Vector3(1.7, .07, -.5),
      new THREE.Vector3(2.02, .06, -.46), new THREE.Vector3(2.05, .06, -.2),
      new THREE.Vector3(1.83, .06, -.08)
    ], .025, this.wrap);
    this.looseRope.name = '대기 중인 끈'; this.support.add(this.looseRope);
    this.board = new THREE.Group(); this.group.add(this.board);
    this.addBox(this.board, [3.7, .07, 1.25], [0, -.01, 0], new THREE.MeshStandardMaterial({ color: '#bc8659', roughness: .92 }));
    this.fibers = [];
    for (let index = 0; index < 19; index++) {
      const fiber = this.makeTube(this.fiberPoints(index, 0), .025, this.fiberMaterial, 32);
      fiber.position.y = .08 + (index % 3) * .012; this.board.add(fiber); this.fibers.push(fiber);
    }
    this.tools = { adze: this.createTool('adze'), comb: this.createTool('comb'), knife: this.createTool('knife') };
    for (const tool of Object.values(this.tools)) this.group.add(tool);
    this.brazier = new THREE.Group(); this.brazier.position.set(2.35, 0, -.45); this.group.add(this.brazier);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.43, .28, .3, 24), this.dark); bowl.position.y = .18; bowl.castShadow = true; this.brazier.add(bowl);
    const coal = new THREE.Mesh(new THREE.SphereGeometry(.31, 16, 10), new THREE.MeshStandardMaterial({ color: '#c74e18', emissive: '#ff3b0a', emissiveIntensity: 1.8 })); coal.scale.y = .3; coal.position.y = .32; this.brazier.add(coal);
    const light = new THREE.PointLight('#ff6526', 8, 3); light.position.y = .65; this.brazier.add(light);
    this.particles = [];
    this.pickSurface = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.2), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    this.pickSurface.rotation.x = -Math.PI / 2; this.pickSurface.position.set(0, .16, .4); this.group.add(this.pickSurface);
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.state = null; this.progress = 0; this.sideProgress = [0, 0]; this.cutscene = null; this.tool = null;
  }
  addBox(parent, size, position, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material); mesh.position.set(...position); mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  makeTube(points, radius, material, segments = 48) {
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 6, false), material);
  }
  fiberPoints(index, progress) {
    const points = [];
    for (let segment = 0; segment <= 16; segment++) {
      const z = -.51 + segment / 16 * 1.02;
      const x = (index - 9) * .13 + Math.sin(segment * 1.1 + index * 1.9) * .1 * (1 - progress);
      points.push(new THREE.Vector3(x, Math.sin(segment * 1.3 + index) * .035 * (1 - progress), z));
    }
    return points;
  }
  createTool(type) {
    const group = new THREE.Group(); group.name = type; group.visible = false;
    if (type === 'comb') {
      this.addBox(group, [.55, .1, .14], [0, .1, 0], this.wood);
      for (let index = 0; index < 7; index++) this.addBox(group, [.04, .08, .2], [-.24 + index * .08, .08, .14], this.wood);
      const handle = new THREE.MeshStandardMaterial({ color: '#97613c', roughness: 1 });
      this.addBox(group, [.55, .1, .14], [0, .1, 0], handle);
      for (let index = 0; index < 7; index++) this.addBox(group, [.04, .08, .2], [-.24 + index * .08, .08, .14], handle);
    } else {
      const handle = this.addBox(group, [.12, .12, .62], [0, .12, .2], this.dark); handle.rotation.x = -.3;
      this.addBox(group, type === 'adze' ? [.42, .08, .15] : [.1, .07, .27], [0, .08, -.12], this.metal);
    }
    return group;
  }
  setStep(state) {
    this.state = state; this.progress = 0; this.sideProgress = [0, 0]; this.sideRanges = [null, null]; this.cutscene = null; this.lastPoint = null; this.activeSide = null;
    this.bowGroup.position.set(0, 0, 0); this.bowGroup.rotation.set(0, 0, 0); this.bowGroup.scale.set(1, 1, 1);
    this.board.position.set(0, 0, 0); this.board.rotation.set(0, 0, 0);
    this.bow.visible = state !== 'STEP_2'; this.bowGroup.visible = state !== 'STEP_2'; this.board.visible = state === 'STEP_2';
    this.grip.visible = ['STEP_5', 'STEP_6', 'STEP_7', 'STEP_8', 'OUTRO'].includes(state);
    this.string.visible = ['STEP_6', 'STEP_7', 'STEP_8', 'OUTRO'].includes(state);
    this.stringLoop.visible = state === 'STEP_6';
    this.support.visible = ['STEP_4', 'STEP_5', 'STEP_6'].includes(state); this.brazier.visible = false;
    this.support.position.set(0, 0, 0); this.support.scale.set(1, 1, 1);
    this.supportRopes[0].visible = state === 'STEP_5' || state === 'STEP_6';
    this.supportRopes[1].visible = state === 'STEP_5' || state === 'STEP_6';
    this.supportRopes[0].geometry.setDrawRange(0, Infinity);
    this.supportRopes[1].geometry.setDrawRange(0, state === 'STEP_5' ? 0 : Infinity);
    this.flip = ['STEP_6', 'STEP_7', 'STEP_8', 'OUTRO'].includes(state) ? 1 : 0;
    this.drawAmount = 0;
    this.stringEnd = state === 'STEP_6' ? -1.72 : 1.8;
    this.stringLoop.position.x = this.stringEnd;
    this.setString(this.stringEnd, 0);
    this.windingAngle = 0;
    this.windingTaps = 0;
    this.looseRope.visible = state === 'STEP_5';
    this.wood.roughness = state === 'STEP_1' ? 1 : ['STEP_8', 'OUTRO'].includes(state) ? .18 : .55;
    this.wood.color.set(state === 'STEP_1' ? '#97613c' : ['STEP_8', 'OUTRO'].includes(state) ? '#87472c' : '#c18a57');
    this.fiberMaterial.roughness = state === 'STEP_2' ? 1 : .35;
    for (const [index, layer] of this.layers.entries()) { layer.visible = !['STEP_1', 'STEP_2'].includes(state); layer.geometry.setDrawRange(0, state === 'STEP_3' ? 0 : Infinity); }
    for (const notch of this.notches) notch.visible = ['STEP_5', 'STEP_6', 'STEP_7', 'STEP_8', 'OUTRO'].includes(state);
    for (const tool of Object.values(this.tools)) tool.visible = false;
    this.tool = state === 'STEP_1' ? this.tools.adze : state === 'STEP_2' ? this.tools.comb : state === 'STEP_4' ? this.tools.knife : null;
    this.updateFibers(0);
    this.updateWood(); this.updateLayers();
    this.clearParticles();
  }
  pick(event, camera, canvas) {
    const rect = canvas.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, camera);
    const hit = this.raycaster.intersectObject(this.pickSurface, false)[0];
    return hit ? this.group.worldToLocal(hit.point.clone()) : null;
  }
  validPoint(point) {
    if (!point) return false;
    if (this.state === 'STEP_2') return Math.abs(point.x) < 1.75 && Math.abs(point.z) < .68;
    if (this.state === 'STEP_4') return Math.abs(point.x) > 1.35 && Math.abs(point.x) < 2.05 && point.z >= -.65 && point.z <= .1;
    if (this.state === 'STEP_5') { const radius = Math.hypot(point.x - 1.4, point.z + .2); return radius > .12 && radius < .55; }
    if (this.state === 'STEP_6') return Math.abs(point.x) < 2 && Math.abs(point.z - .35) < .48;
    if (this.state === 'STEP_8') return Math.abs(point.x) < .45 && point.z >= .15 && point.z <= 1.55;
    if (this.state === 'STEP_7') return Math.abs(point.x) < 1.95 && Math.abs(point.z + bowZ(point.x)) < .36;
    return Math.abs(point.x) < 1.95 && Math.abs(point.z - bowZ(point.x)) < .36;
  }
  startInteraction(point) {
    if (this.cutscene || !['STEP_1', 'STEP_2', 'STEP_3', 'STEP_4', 'STEP_5', 'STEP_6', 'STEP_7', 'STEP_8'].includes(this.state)) return false;
    if (this.state === 'STEP_5' && !this.validPoint(point)) { this.resetWinding(); return false; }
    if (!this.validPoint(point)) return false;
    if (this.state === 'STEP_6' && Math.hypot(point.x - this.stringEnd, point.z - .35) > .35) return false;
    if (this.state === 'STEP_8' && (Math.abs(point.x) > .3 || Math.abs(point.z - .35) > .3)) return false;
    this.lastPoint = point.clone(); this.activeSide = point.x < 0 ? 0 : 1;
    if (this.state === 'STEP_5') return this.tapWinding(point);
    if (this.state === 'STEP_3' || this.state === 'STEP_4') {
      const coordinate = this.state === 'STEP_3' ? Math.abs(point.x) : point.z;
      const range = this.sideRanges[this.activeSide];
      this.sideRanges[this.activeSide] = range ? [Math.min(range[0], coordinate), Math.max(range[1], coordinate)] : [coordinate, coordinate];
    }
    if (this.tool) { this.tool.visible = true; this.tool.position.copy(point); }
    return true;
  }
  tapWinding(point) {
    this.windingTaps = Math.min(this.windingTaps + 1, 15);
    this.progress = this.windingTaps / 15;
    this.windingAngle = this.progress * Math.PI * 4;
    this.flip = this.progress;
    this.looseRope.visible = this.progress < 1;
    const rope = this.supportRopes[1];
    rope.geometry.setDrawRange(0, Math.floor(rope.geometry.index.count * this.progress / 3) * 3);
    if (this.tool) { this.tool.visible = true; this.tool.position.copy(point); }
    this.emit(point, '#d6b17a', 5, false);
    this.updateWood(); this.updateLayers();
    return this.progress >= 1;
  }
  resetWinding() {
    this.windingTaps = 0; this.windingAngle = 0; this.progress = 0; this.flip = 0;
    this.looseRope.visible = true;
    this.supportRopes[1].geometry.setDrawRange(0, 0);
    this.updateWood(); this.updateLayers();
  }
  moveInteraction(point) {
    if (!this.lastPoint || this.cutscene) return false;
    if (!this.validPoint(point)) { this.lastPoint = null; if (this.tool) this.tool.visible = false; return false; }
    const dx = point.x - this.lastPoint.x; const dz = point.z - this.lastPoint.z;
    const distance = Math.min(Math.hypot(dx, dz), .22);
    if (this.tool) { this.tool.position.copy(point); this.tool.rotation.y = Math.atan2(dx, dz); }
    if (this.state === 'STEP_1') {
      this.progress = clamp(this.progress + Math.min(Math.abs(dx), .2) / 5, 0, 1);
      this.wood.roughness = 1 - this.progress * .56; this.wood.color.set('#97613c').lerp(new THREE.Color('#d7a16b'), this.progress);
      this.updateWood();
      if (distance > .025) this.emit(point, '#c99763', 2, false);
    } else if (this.state === 'STEP_2') {
      this.progress = clamp(this.progress + Math.max(0, Math.min(dz, .2)) / 2.4, 0, 1);
      this.fiberMaterial.roughness = 1 - this.progress * .75; this.updateFibers(this.progress);
    } else if (this.state === 'STEP_5') {
      this.lastPoint.copy(point);
      return false;
    } else if (this.state === 'STEP_6') {
      this.stringEnd = clamp(point.x, -1.72, 1.8);
      this.progress = clamp((this.stringEnd + 1.72) / 3.42, 0, 1);
      this.stringLoop.position.x = this.stringEnd;
      this.setString(this.stringEnd, 0);
    } else if (this.state === 'STEP_7') {
      this.progress = clamp(this.progress + Math.min(Math.abs(dx), .2) / 5, 0, 1);
      this.wood.roughness = .55 - this.progress * .37;
      this.wood.color.set('#c18a57').lerp(new THREE.Color('#87472c'), this.progress);
      if (distance > .025) this.emit(point, '#fff3a1', 2, false, true);
    } else if (this.state === 'STEP_8') {
      this.progress = clamp((point.z - .35) / .79, 0, 1);
      this.drawAmount = this.progress;
      this.setString(1.8, this.drawAmount);
      this.updateWood(); this.updateLayers();
    } else {
      const side = point.x < 0 ? 0 : 1;
      if (side === this.activeSide) {
        const coordinate = this.state === 'STEP_3' ? Math.abs(point.x) : point.z;
        const range = this.sideRanges[side];
        range[0] = Math.min(range[0], coordinate); range[1] = Math.max(range[1], coordinate);
        this.sideProgress[side] = clamp((range[1] - range[0]) / (this.state === 'STEP_3' ? 1.4 : .5), 0, 1);
        this.progress = (this.sideProgress[0] + this.sideProgress[1]) / 2;
        if (this.state === 'STEP_3') {
          const layer = this.layers[side]; layer.geometry.setDrawRange(0, Math.floor(layer.geometry.index.count * this.sideProgress[side] / 3) * 3);
        } else {
          this.notches[side].visible = this.sideProgress[side] > .25;
          this.notches[side].scale.setScalar(.3 + this.sideProgress[side] * .7);
          this.updateWood();
          if (distance > .025) this.emit(point, '#c99763', 2, false);
        }
      }
    }
    this.lastPoint.copy(point);
    return this.progress >= 1;
  }
  endInteraction() {
    this.lastPoint = null; if (this.tool) this.tool.visible = false;
    if (this.state === 'STEP_6' && this.progress < 1) { this.progress = 0; this.stringEnd = -1.72; this.stringLoop.position.x = this.stringEnd; this.setString(this.stringEnd, 0); }
    if (this.state === 'STEP_8' && this.progress < 1) { this.progress = 0; this.drawAmount = 0; this.setString(1.8, 0); this.updateWood(); this.updateLayers(); }
  }
  setString(endX, draw) {
    const tipZ = .35 + draw * .2;
    const points = [new THREE.Vector3(-1.8, .03, tipZ)];
    if (draw > 0) points.push(new THREE.Vector3(0, .03, .35 + draw * .8));
    points.push(new THREE.Vector3(endX, .03, tipZ));
    const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'centripetal'), 48, .016, 6, false);
    this.string.geometry.dispose(); this.string.geometry = geometry;
  }
  updateWood() {
    const position = this.bow.geometry.attributes.position;
    const roughness = this.state === 'STEP_1' ? 1 - this.progress : 0;
    for (let index = 0; index < position.count; index++) {
      const offset = index * 3;
      const x = this.bowBasePositions[offset], y = this.bowBasePositions[offset + 1], z = this.bowBasePositions[offset + 2];
      const centerZ = bowZ(clamp(x, -1.8, 1.8));
      const side = x < 0 ? 0 : 1;
      const groove = this.state === 'STEP_4' ? this.sideProgress[side] : (['STEP_5', 'STEP_6', 'STEP_7', 'STEP_8', 'OUTRO'].includes(this.state) ? 1 : 0);
      const indentation = groove * .42 * Math.exp(-Math.pow((Math.abs(x) - 1.7) / .055, 2));
      const grain = roughness * .15 * Math.sin(x * 37 + y * 31 + z * 29);
      const scale = 1 + grain - indentation;
      const flex = this.drawAmount * .2 * Math.pow(Math.abs(x) / 1.8, 2);
      position.setXYZ(index, x, y * scale, centerZ * (1 - 2 * this.flip) + (z - centerZ) * scale + flex);
    }
    position.needsUpdate = true;
    this.bow.geometry.computeVertexNormals();
    this.grip.position.z = bowZ(0) * (1 - 2 * this.flip);
    for (const notch of this.notches) notch.position.z = bowZ(1.7) * (1 - 2 * this.flip) + this.drawAmount * .18;
  }
  updateLayers() {
    for (const layer of this.layers) {
      const position = layer.geometry.attributes.position;
      const base = layer.userData.basePositions;
      for (let index = 0; index < position.count; index++) {
        const offset = index * 3;
        const x = base[offset];
        const flex = this.drawAmount * .2 * Math.pow(Math.abs(x) / 1.8, 2);
        position.setXYZ(index, x, base[offset + 1], base[offset + 2] - 2 * this.flip * bowZ(clamp(x, -1.8, 1.8)) + flex);
      }
      position.needsUpdate = true; layer.geometry.computeVertexNormals();
    }
  }
  updateFibers(progress) {
    for (const [index, fiber] of this.fibers.entries()) {
      const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(this.fiberPoints(index, progress)), 32, .025, 6, false);
      fiber.geometry.dispose(); fiber.geometry = geometry;
    }
  }
  startCutscene() {
    this.endInteraction(); this.cutscene = { elapsed: 0, duration: this.state === 'STEP_1' ? 3.4 : this.state === 'STEP_3' ? 4.5 : this.state === 'STEP_6' ? 3 : 1.3 };
    if (this.state === 'STEP_6') { this.stringEnd = 1.8; this.stringLoop.visible = false; this.setString(1.8, 0); }
    if (this.state === 'STEP_3') this.brazier.visible = true;
  }
  emit(point, color, count, steam, sparkle = false) {
    for (let index = 0; index < count && this.particles.length < 90; index++) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: steam ? .55 : 1, depthWrite: false });
      const mesh = new THREE.Mesh(steam ? new THREE.SphereGeometry(.07, 8, 6) : sparkle ? new THREE.OctahedronGeometry(.065) : new THREE.BoxGeometry(.045, .025, .08), material);
      mesh.position.copy(point); this.group.add(mesh);
      this.particles.push({ mesh, life: 0, duration: steam ? 1.6 : .8, velocity: new THREE.Vector3((Math.random() - .5) * .65, steam ? .5 : .8 + Math.random() * .5, (Math.random() - .5) * .65), steam });
    }
  }
  clearParticles() { for (const particle of this.particles) { this.group.remove(particle.mesh); particle.mesh.geometry.dispose(); particle.mesh.material.dispose(); } this.particles = []; }
  update(elapsed, delta = 0) {
    if (this.cutscene) {
      this.cutscene.elapsed += delta;
      const t = clamp(this.cutscene.elapsed / this.cutscene.duration, 0, 1);
      if (this.state === 'STEP_1') { this.bowGroup.position.y = Math.sin(Math.PI * t) * .85; this.bowGroup.rotation.y = Math.sin(Math.PI * t) * .8; }
      if (this.state === 'STEP_2') { this.board.position.y = Math.sin(Math.PI * t) * .28; this.board.rotation.z = Math.sin(Math.PI * t) * .04; }
      if (this.state === 'STEP_4') { this.bowGroup.position.y = Math.sin(Math.PI * t) * .3; this.bowGroup.rotation.y = Math.sin(Math.PI * t) * .16; }
      if (this.state === 'STEP_5' || this.state === 'STEP_7') this.bowGroup.position.y = Math.sin(Math.PI * t) * .25;
      if (this.state === 'STEP_6') {
        const remaining = Math.max(0, 1 - t * 1.7);
        for (const rope of this.supportRopes) rope.geometry.setDrawRange(0, Math.floor(rope.geometry.index.count * remaining / 3) * 3);
        const separation = Math.max(0, (t - .45) / .55);
        this.support.position.y = -separation * .4; this.support.scale.setScalar(Math.max(.001, 1 - separation));
      }
      if (this.state === 'STEP_8') this.bowGroup.position.y = Math.sin(Math.PI * t) * .3;
      if (this.state === 'STEP_3') {
        const lift = Math.min(t * 3, 1); this.bowGroup.position.set(2.35 * lift, .72 * lift, -.45 * lift);
        if (t > .3 && t < .92 && Math.random() < delta * 20) this.emit(new THREE.Vector3(2.35 + (Math.random() - .5) * .5, .5, -.45), '#ffffff', 1, true);
      }
      if (t >= 1) { this.cutscene = null; return true; }
    }
    for (let index = this.particles.length - 1; index >= 0; index--) {
      const particle = this.particles[index]; particle.life += delta; particle.mesh.position.addScaledVector(particle.velocity, delta);
      if (!particle.steam) particle.velocity.y -= delta * 2.5;
      particle.mesh.material.opacity = Math.max(0, 1 - particle.life / particle.duration) * (particle.steam ? .55 : 1);
      if (particle.steam) particle.mesh.scale.setScalar(1 + particle.life);
      if (particle.life >= particle.duration) { this.group.remove(particle.mesh); particle.mesh.geometry.dispose(); particle.mesh.material.dispose(); this.particles.splice(index, 1); }
    }
    return false;
  }
}