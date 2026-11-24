"use strict";

// 톱의 판정 반경은 월드 단위입니다. 키우면 드래그 주변이 넓게 잘립니다.
const SAW_RADIUS = 0.035;
const WOOD_CUT_TARGET = 0.9;
// 원형 대나무의 고정 틀 해제와 반호 펼침에 걸리는 시간입니다. 밀리초 단위로 바꿀 수 있습니다.
const BAMBOO_UNFOLD_DURATION = 3200;
// 대나무가 완전히 펼쳐진 다음 목재를 옆으로 옮기는 시간입니다.
const WOOD_ALIGN_DURATION = 1400;

class WoodworkGame {
  constructor(workshop, bending, onChange) {
    this.workshop = workshop;
    this.bending = bending;
    this.onChange = onChange;
    this.canvas = workshop.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(WORKPIECE_BASE_Y + WOOD_THICKNESS));
    this.halfLength = 0.825;
    this.halfWidth = 0.3 * WOOD_CROSS_SECTION_SCALE;
    this.chips = [];
    this.falling = [];
    this.dust = [];
    this.matrix = new THREE.Matrix4();
    this.makeBoard();
    this.makeSaw();
    this.bindInput();
    this.reset();
  }

  guideWidth(x) {
    return 0.25 * WOOD_CROSS_SECTION_SCALE * (1 - Math.pow(Math.min(1, Math.abs(x) / this.halfLength), 1.65));
  }

  makeBoard() {
    const w = this.workshop;
    this.board = new THREE.Group();
    this.board.position.y = WORKPIECE_BASE_Y;
    w.table.add(this.board);
    this.chipGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.chipMaterial = w.material(0x39251d);
    this.debrisGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.debrisMaterial = w.material(0x39251d);
    const count = 72;
    const length = this.halfLength * 2 / count;
    for (let i = 0; i < count; i++) {
      const x = -this.halfLength + (i + 0.5) * length;
      const guide = Math.max(this.guideWidth(x - length / 2), this.guideWidth(x), this.guideWidth(x + length / 2));
      for (const side of [-1, 1]) {
        for (let row = 0; row < 7; row++) {
          const inner = row < 4;
          const width = inner ? guide / 4 : (this.halfWidth - guide) / 3;
          const distance = inner ? (row + 0.5) * width : guide + (row - 4 + 0.5) * width;
          this.chips.push({ x, z: side * distance, width, length, inner, weight: width * length, removed: false });
        }
      }
    }
    this.outerArea = this.chips.reduce((total, chip) => total + (chip.inner ? 0 : chip.weight), 0);
    this.surface = new THREE.InstancedMesh(this.chipGeometry, this.chipMaterial, this.chips.length);
    this.surface.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.surface.castShadow = true;
    this.surface.receiveShadow = true;
    this.board.add(this.surface);
    this.guides = new THREE.Group();
    this.board.add(this.guides);
    const guideMaterial = new THREE.MeshBasicMaterial({ color: 0xffd700, depthTest: false });
    const dashGeometry = new THREE.CylinderGeometry(0.008, 0.008, 1, 8);
    const dashLength = 0.035;
    const dashGap = 0.018;
    const dashPattern = dashLength + dashGap;
    const guideMatrix = new THREE.Matrix4();
    const guideQuaternion = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (const side of [-1, 1]) {
      const points = [];
      for (let i = 0; i <= 100; i++) {
        const x = -this.halfLength + i * this.halfLength * 2 / 100;
        points.push(new THREE.Vector3(x, WOOD_THICKNESS + 0.01, side * this.guideWidth(x)));
      }
      const distances = [0];
      for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + points[i].distanceTo(points[i - 1]));
      const totalLength = distances[distances.length - 1];
      const sampleAt = (distance) => {
        let index = 1;
        while (index < distances.length - 1 && distances[index] < distance) index++;
        const span = distances[index] - distances[index - 1];
        return points[index - 1].clone().lerp(points[index], span ? (distance - distances[index - 1]) / span : 0);
      };
      const segments = [];
      for (let start = 0; start < totalLength; start += dashPattern) {
        const from = sampleAt(start);
        const to = sampleAt(Math.min(start + dashLength, totalLength));
        if (from.distanceToSquared(to) > 1e-8) segments.push([from, to]);
      }
      const dashes = new THREE.InstancedMesh(dashGeometry, guideMaterial, segments.length);
      dashes.frustumCulled = false;
      dashes.renderOrder = 2;
      segments.forEach(([from, to], index) => {
        const direction = to.clone().sub(from);
        guideQuaternion.setFromUnitVectors(up, direction.clone().normalize());
        guideMatrix.compose(from.add(to).multiplyScalar(0.5), guideQuaternion, new THREE.Vector3(1, direction.length(), 1));
        dashes.setMatrixAt(index, guideMatrix);
      });
      dashes.instanceMatrix.needsUpdate = true;
      this.guides.add(dashes);
    }
    this.dustGeometry = new THREE.SphereGeometry(0.012, 5, 4);
    this.dustMaterial = new THREE.MeshBasicMaterial({ color: 0xe8c384 });
    this.dustMesh = new THREE.InstancedMesh(this.dustGeometry, this.dustMaterial, 32);
    this.dustMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dustMesh.count = 0;
    this.board.add(this.dustMesh);
  }

  makeSaw() {
    const w = this.workshop;
    this.saw = new THREE.Group();
    this.blade = new THREE.Group();
    this.saw.add(this.blade);
    w.box(this.blade, [0.34, 0.12, 0.025], [0, 0.11, 0], w.material(0xb3bcb8, 0.4));
    const teeth = w.material(0x7d8c87, 0.5);
    for (let i = 0; i < 9; i++) {
      const tooth = w.box(this.blade, [0.025, 0.025, 0.025], [-0.15 + i * 0.0375, 0.04, 0], teeth);
      tooth.rotation.z = Math.PI / 4;
    }
    w.box(this.blade, [0.09, 0.17, 0.06], [0.22, 0.14, 0], w.material(0x865439));
    this.saw.visible = false;
    w.scene.add(this.saw);
  }

  bindInput() {
    this.onDown = (event) => {
      if (!this.active || this.dragging || !event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      this.dragging = true;
      this.dragStarted = false;
      this.pointerId = event.pointerId;
      this.lastPoint = null;
      this.canvas.setPointerCapture(event.pointerId);
      this.updatePointer(event, false);
    };
    this.onMove = (event) => {
      if (!this.active || !event.isPrimary || (this.dragging && event.pointerId !== this.pointerId)) return;
      this.updatePointer(event, this.dragging);
    };
    this.onStop = (event) => {
      if (event.pointerId === this.pointerId) this.stopDrag();
    };
    this.onLeave = () => { if (!this.dragging && this.saw) this.saw.visible = false; };
    this.canvas.addEventListener("pointerdown", this.onDown);
    this.canvas.addEventListener("pointermove", this.onMove);
    this.canvas.addEventListener("pointerup", this.onStop);
    this.canvas.addEventListener("pointercancel", this.onStop);
    this.canvas.addEventListener("lostpointercapture", this.onStop);
    this.canvas.addEventListener("pointerleave", this.onLeave);
  }

  stopDrag() {
    const id = this.pointerId;
    this.pointerId = null;
    this.dragging = false;
    this.lastPoint = null;
    if (id !== null && id !== undefined && this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
  }

  updatePointer(event, cutting) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.workshop.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.plane, hit)) return;
    this.saw.position.copy(hit);
    this.saw.visible = true;
    this.board.updateWorldMatrix(true, false);
    this.board.getWorldQuaternion(this.saw.quaternion);
    const point = this.board.worldToLocal(hit.clone());
    if (!cutting) {
      if (this.dragging) this.lastPoint = point;
      return;
    }
    const start = this.lastPoint || point;
    const distance = start.distanceTo(point);
    if (!this.dragStarted) {
      if (distance < 0.005) return;
      this.dragStarted = true;
    }
    const steps = Math.max(1, Math.ceil(distance / (SAW_RADIUS / 2)));
    let changed = false;
    for (let i = 0; i <= steps; i++) {
      const sample = start.clone().lerp(point, i / steps);
      if (Math.abs(sample.x) > this.halfLength + SAW_RADIUS || Math.abs(sample.z) > this.halfWidth + SAW_RADIUS) continue;
      if (Math.abs(sample.z) < this.guideWidth(sample.x)) continue;
      for (let index = 0; index < this.chips.length; index++) {
        const chip = this.chips[index];
        if (chip.removed || chip.inner || Math.sign(chip.z) !== Math.sign(sample.z)) continue;
        const dx = Math.max(0, Math.abs(sample.x - chip.x) - chip.length / 2);
        const dz = Math.max(0, Math.abs(sample.z - chip.z) - chip.width / 2);
        if (dx * dx + dz * dz > SAW_RADIUS * SAW_RADIUS) continue;
        this.removeChip(index);
        changed = true;
      }
    }
    this.lastPoint = point;
    if (changed) {
      this.surface.instanceMatrix.needsUpdate = true;
      this.addDust(point);
      this.onChange(this.result());
    }
  }

  removeChip(index) {
    const chip = this.chips[index];
    if (chip.inner || chip.removed) return;
    chip.removed = true;
    this.removedOuterArea += chip.weight;
    this.matrix.makeScale(0, 0, 0);
    this.surface.setMatrixAt(index, this.matrix);
    if (this.falling.length >= 80 || this.workshop.reducedMotion.matches) return;
    const mesh = new THREE.Mesh(this.debrisGeometry, this.debrisMaterial);
    mesh.position.set(chip.x, WOOD_THICKNESS / 2, chip.z);
    mesh.scale.set(chip.length, WOOD_THICKNESS, chip.width);
    this.board.add(mesh);
    this.falling.push({ mesh, z: chip.z, start: performance.now(), direction: Math.sign(chip.z) || 1 });
  }

  addDust(point) {
    if (this.workshop.reducedMotion.matches) return;
    for (let i = 0; i < 4; i++) {
      if (this.dust.length >= 32) this.dust.shift();
      this.dust.push({ x: point.x, z: point.z, start: performance.now(), vx: (Math.random() - 0.5) * 0.2, vz: (Math.random() - 0.5) * 0.2 });
    }
  }

  reset() {
    this.stopDrag();
    this.active = false;
    this.animation = null;
    this.saw.visible = false;
    this.board.position.z = 0;
    this.board.rotation.y = 0;
    this.rotationTarget = 0;
    this.removedOuterArea = 0;
    this.workshop.updateCarvingFov();
    this.guides.visible = true;
    for (const item of this.falling) this.board.remove(item.mesh);
    this.falling.length = 0;
    this.dust.length = 0;
    this.dustMesh.count = 0;
    this.chips.forEach((chip, index) => {
      chip.removed = false;
      this.matrix.makeScale(chip.length, WOOD_THICKNESS, chip.width);
      this.matrix.setPosition(chip.x, WOOD_THICKNESS / 2, chip.z);
      this.surface.setMatrixAt(index, this.matrix);
    });
    this.surface.instanceMatrix.needsUpdate = true;
    this.onChange(this.result());
  }

  activate() {
    this.active = true;
    this.canvas.parentElement.classList.add("playing");
    this.workshop.updateCarvingFov();
    this.onChange(this.result());
  }

  rotate(degrees) {
    this.stopDrag();
    this.saw.visible = false;
    this.rotationTarget = THREE.MathUtils.degToRad(degrees);
    if (this.workshop.reducedMotion.matches) {
      this.board.rotation.y = this.rotationTarget;
      this.workshop.updateCarvingFov();
    }
  }

  result() {
    const coverage = this.removedOuterArea / this.outerArea;
    const passed = coverage >= WOOD_CUT_TARGET;
    return { coverage, progress: passed ? 100 : Math.floor(coverage / WOOD_CUT_TARGET * 100), passed };
  }

  stop() {
    this.active = false;
    this.stopDrag();
    if (this.saw) this.saw.visible = false;
    this.board.rotation.y = 0;
    this.rotationTarget = 0;
    this.canvas.parentElement.classList.remove("playing");
    this.workshop.updateCarvingFov();
  }

  disposeGroup(group) {
    const geometries = new Set();
    const materials = new Set();
    group.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.isInstancedMesh) object.dispose();
      if (object.material) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }

  clearDebris() {
    // 떨어지는 조각은 본체와 별도 지오메트리·재질을 공유합니다.
    // 모두 씬과 배열에서 제거한 뒤 공유 자원을 한 번만 해제해야 본체가 사라지지 않습니다.
    for (const item of this.falling) this.board.remove(item.mesh);
    this.falling.length = 0;
    this.dust.length = 0;
    if (this.dustMesh) {
      this.board.remove(this.dustMesh);
      this.dustMesh.dispose();
      this.dustGeometry.dispose();
      this.dustMaterial.dispose();
      this.dustMesh = null;
    }
    if (this.debrisGeometry) {
      this.debrisGeometry.dispose();
      this.debrisMaterial.dispose();
      this.debrisGeometry = null;
      this.debrisMaterial = null;
    }
  }

  clearTools() {
    if (this.saw) {
      this.workshop.scene.remove(this.saw);
      this.disposeGroup(this.saw);
      this.saw = null;
      this.blade = null;
    }
    if (this.guides) {
      this.board.remove(this.guides);
      this.disposeGroup(this.guides);
      this.guides = null;
    }
  }

  unfold(onComplete) {
    this.stop();
    this.clearDebris();
    this.clearTools();
    // 성공 시 남아 있던 바깥 조각을 마무리 정리합니다.
    this.chips.forEach((chip) => { if (!chip.inner) chip.removed = true; });
    const remaining = this.chips.filter((chip) => chip.inner && !chip.removed);
    // 숨긴 인스턴스까지 남기지 않고 본체만 새로 구성하고 이전 인스턴스 버퍼를 해제합니다.
    this.board.remove(this.surface);
    this.surface.dispose();
    this.surface = new THREE.InstancedMesh(this.chipGeometry, this.chipMaterial, remaining.length);
    this.surface.castShadow = true;
    this.surface.receiveShadow = true;
    remaining.forEach((chip, index) => {
      this.matrix.makeScale(chip.length, WOOD_THICKNESS, chip.width);
      this.matrix.setPosition(chip.x, WOOD_THICKNESS / 2, chip.z);
      this.surface.setMatrixAt(index, this.matrix);
    });
    this.surface.instanceMatrix.needsUpdate = true;
    this.board.add(this.surface);
    const separation = this.workshop.halfLength * 2 / Math.PI
      + this.workshop.halfWidth * BENDING_WIDTH_SCALE + this.halfWidth + 0.05;
    const tableCenterOffset = 0.45;
    this.bending.wood.position.set(-0.3, WORKPIECE_BASE_Y + BAMBOO_THICKNESS / 2, tableCenterOffset - separation);
    this.bending.wood.visible = true;
    this.bending.bends = [1, 1];
    this.bending.updatePose();
    this.bending.wireStrands.forEach((wire) => { wire.visible = false; });
    const maxChipLength = this.bending.source.reduce((max, chip) => Math.max(max, chip.length), 0);
    this.animation = { start: performance.now(), onComplete, maxChipLength, tableCenterOffset, clampPositions: this.bending.clamps.map((clamp) => clamp.position.clone()) };
  }

  update(now) {
    if (this.blade) this.blade.position.x = this.dragging && !this.workshop.reducedMotion.matches ? Math.sin(now / 65) * 0.065 : 0;
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const item = this.falling[i];
      const t = (now - item.start) / 700;
      item.mesh.position.z = item.z + item.direction * t * 0.2;
      item.mesh.position.y = WOOD_THICKNESS / 2 - t * t * 1.1;
      item.mesh.rotation.x = item.direction * t * 2;
      if (t >= 1) {
        this.board.remove(item.mesh);
        this.falling.splice(i, 1);
      }
    }
    if (this.dustMesh) {
      this.dust = this.dust.filter((item) => now - item.start < 500);
      this.dust.forEach((item, index) => {
        const t = (now - item.start) / 500;
        this.matrix.makeTranslation(item.x + item.vx * t, WOOD_THICKNESS + 0.02 + t * 0.15 - t * t * 0.08, item.z + item.vz * t);
        this.dustMesh.setMatrixAt(index, this.matrix);
      });
      this.dustMesh.count = this.dust.length;
      if (this.dust.length) this.dustMesh.instanceMatrix.needsUpdate = true;
    }
    if (!this.animation) return;
    const elapsed = this.workshop.reducedMotion.matches ? BAMBOO_UNFOLD_DURATION + WOOD_ALIGN_DURATION : now - this.animation.start;
    const t = Math.min(elapsed / BAMBOO_UNFOLD_DURATION, 1);
    const release = Math.min(t / 0.25, 1);
    this.bending.clamps.forEach((clamp, index) => {
      clamp.visible = release < 1;
      clamp.position.y = this.animation.clampPositions[index].y + release * 0.5;
      clamp.position.z = this.animation.clampPositions[index].z + (index ? 1 : -1) * release * 0.35;
    });
    if (release === 1) {
      const progress = (t - 0.25) / 0.75;
      const eased = t === 1 ? 1 : 1 - Math.exp(-5 * progress) * Math.cos(8 * progress);
      const bend = 1 - 0.5 * eased;
      this.bending.bends = [bend, bend];
      this.bending.updatePose();
    }
    // 펼침 중에도 대나무의 최대 폭과 재단물 사이에 간격을 유지합니다.
    const curve = this.bending.curveAt(this.workshop.halfLength);
    const angle = curve.turnRate * this.workshop.halfLength;
    const reach = curve.turnRate > 0 ? Math.sin(Math.min(angle, Math.PI / 2)) / curve.turnRate : this.workshop.halfLength;
    const offset = this.workshop.halfWidth * BENDING_WIDTH_SCALE;
    const chipEnd = this.animation.maxChipLength * 0.51 * (1 + offset * curve.turnRate);
    const safeZ = this.board.position.z + this.animation.tableCenterOffset - this.halfWidth - reach - offset - chipEnd - 0.025;
    this.bending.wood.position.z = Math.min(this.bending.wood.position.z, safeZ);
    const align = THREE.MathUtils.clamp((elapsed - BAMBOO_UNFOLD_DURATION) / WOOD_ALIGN_DURATION, 0, 1);
    this.board.position.z = this.animation.tableCenterOffset + 0.12 * align * align * (3 - 2 * align);
    if (align === 1) {
      const callback = this.animation.onComplete;
      this.animation = null;
      callback();
    }
  }

  dispose() {
    this.stop();
    this.animation = null;
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onStop);
    this.canvas.removeEventListener("pointercancel", this.onStop);
    this.canvas.removeEventListener("lostpointercapture", this.onStop);
    this.canvas.removeEventListener("pointerleave", this.onLeave);
    this.clearDebris();
    this.clearTools();
    this.workshop.table.remove(this.board);
    this.disposeGroup(this.board);
  }
}
