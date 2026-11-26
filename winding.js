"use strict";

// 대나무와 뿔이 겹친 구간을 감는 회전 수입니다. 늘리면 코일이 촘촘해집니다.
// 휘어진 고리의 안쪽과 바깥쪽 간격이 다르므로 코일의 접선 방향 폭은 자동 보정합니다.
const WIND_TURNS = 48;
const WIND_INPUT_TURNS = 4.5;
const WIND_SECONDS = 60;
// 80% 미만에서 완료를 누르면 실패합니다. 80~99%는 계속 감도록 안내합니다.
const WIND_MIN_FINISH = 0.8;
const WIND_ROPE_RADIUS = 0.009;
const WIND_STACK_DURATION = 2400;
const WIND_KNOT_DURATION = 1300;
const WIND_SAMPLES_PER_TURN = 64;

class WindingGame {
  constructor(workshop, assembly, glue, pad, onChange, onComplete) {
    this.workshop = workshop;
    this.assembly = assembly;
    this.glue = glue;
    this.pad = pad;
    this.onChange = onChange;
    this.onComplete = onComplete;
    this.radius = assembly.radius;
    this.sectionWidth = ASSEMBLY_BAMBOO_HALF_WIDTH;
    this.sectionHeight = (BAMBOO_THICKNESS + WOOD_THICKNESS) / 2;
    this.sectionY = WORKPIECE_BASE_Y + this.sectionHeight;
    this.arcStart = Math.PI - ASSEMBLY_BAMBOO_END_ANGLE;
    this.arcSpan = Math.PI + ASSEMBLY_BAMBOO_END_ANGLE * 2;
    this.makeSectionPath();
    this.originalAssemblyPosition = assembly.assemblyRoot.position.clone();
    this.originalHornGeometry = glue.hornMesh.geometry;
    this.originalHornPosition = glue.horn.position.clone();
    this.originalHornRotation = glue.horn.rotation.clone();
    this.originalPotsVisible = glue.pots.visible;
    this.originalHornLayerVisible = glue.targets[0].layer.visible;
    this.originalHornPaintVisible = glue.paintMeshes[0].visible;
    this.originalClampVisibility = assembly.clamps.map((clamp) => clamp.visible);
    this.assemblyLayer = glue.targets[1].layer;
    this.originalLayerPosition = this.assemblyLayer.position.clone();
    this.originalLayerQuaternion = this.assemblyLayer.quaternion.clone();
    this.originalLayerScale = this.assemblyLayer.scale.clone();

    this.preparePieces();
    this.makeRope();
    this.bindInput();
    this.state = "stacking";
    this.animationStart = performance.now();
    this.remaining = WIND_SECONDS;
    this.progressAngle = 0;
    this.signedAngle = 0;
    this.direction = 0;
    this.hintVisible = true;
    this.emit();
  }

  preparePieces() {
    const root = this.assembly.assemblyRoot;
    const horn = this.glue.horn;
    const table = this.workshop.table;
    table.updateWorldMatrix(true, true);
    this.hornPoints = this.glue.targets[0].points.map((point) =>
      horn.worldToLocal(table.localToWorld(point.clone())));
    root.attach(this.assemblyLayer);
    root.position.x = 0;
    root.add(horn);
    horn.rotation.set(0, 0, 0);
    horn.position.set(0, this.sectionY + 1.15, 0);
    this.glue.pots.visible = false;
    this.glue.targets[0].layer.visible = false;
    this.glue.paintMeshes[0].visible = false;
    this.assembly.clamps.forEach((clamp) => { clamp.visible = false; });

    // 뿔의 양끝과 양옆을 대나무 소켓의 곡선과 폭에 맞춰 보간합니다.
    const vertices = [];
    const bentVertices = [];
    const indices = [];
    const addFace = (points) => {
      const base = vertices.length / 3;
      points.forEach(([x, y, z, side]) => {
        vertices.push(x, y, z);
        const bent = this.bendPoint(x, z, 1, side);
        bentVertices.push(bent.x, y, bent.z);
      });
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const halfLength = this.glue.woodwork.halfLength;
    const segments = 96;
    for (let i = 0; i < segments; i++) {
      const x0 = -halfLength + i * 2 * halfLength / segments;
      const x1 = -halfLength + (i + 1) * 2 * halfLength / segments;
      const w0 = this.glue.woodwork.guideWidth(x0);
      const w1 = this.glue.woodwork.guideWidth(x1);
      const y = WOOD_THICKNESS;
      addFace([[x0,y,-w0,-1],[x0,y,w0,1],[x1,y,w1,1],[x1,y,-w1,-1]]);
      addFace([[x0,0,w0,1],[x0,0,-w0,-1],[x1,0,-w1,-1],[x1,0,w1,1]]);
      addFace([[x0,0,-w0,-1],[x0,y,-w0,-1],[x1,y,-w1,-1],[x1,0,-w1,-1]]);
      addFace([[x1,0,w1,1],[x1,y,w1,1],[x0,y,w0,1],[x0,0,w0,1]]);
    }
    this.straightVertices = new Float32Array(vertices);
    this.bentVertices = new Float32Array(bentVertices);
    this.bentGeometry = new THREE.BufferGeometry();
    this.bentGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3).setUsage(THREE.DynamicDrawUsage));
    this.bentGeometry.setIndex(indices);
    this.glue.hornMesh.geometry = this.bentGeometry;

    const source = this.glue.targets[0].layer;
    this.hornLayer = new THREE.InstancedMesh(source.geometry, source.material, this.hornPoints.length);
    this.hornLayer.count = this.hornPoints.length;
    this.hornLayer.visible = source.visible;
    this.hornLayer.frustumCulled = false;
    this.hornLayer.renderOrder = source.renderOrder;
    horn.add(this.hornLayer);
    this.matrix = new THREE.Matrix4();
    this.setShape(0);
  }

  bendPoint(x, z, t, side = null) {
    const angle = x / this.glue.woodwork.halfLength * (Math.PI / 2 + ASSEMBLY_BAMBOO_END_ANGLE);
    const width = this.glue.woodwork.guideWidth(x);
    const offset = side === null ? (width > 1e-8 ? z / width : 0) : side;
    const radius = this.radius + offset * ASSEMBLY_BAMBOO_HALF_WIDTH;
    return {
      x: THREE.MathUtils.lerp(x, -radius * Math.sin(angle), t),
      z: THREE.MathUtils.lerp(z, -radius * Math.cos(angle), t)
    };
  }

  setShape(t) {
    const position = this.bentGeometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const offset = i * 3;
      position.setXYZ(i,
        THREE.MathUtils.lerp(this.straightVertices[offset], this.bentVertices[offset], t),
        this.straightVertices[offset + 1],
        THREE.MathUtils.lerp(this.straightVertices[offset + 2], this.bentVertices[offset + 2], t));
    }
    position.needsUpdate = true;
    this.bentGeometry.computeVertexNormals();
    this.bentGeometry.computeBoundingSphere();
    this.hornPoints.forEach((point, index) => {
      const bent = this.bendPoint(point.x, point.z, t);
      this.matrix.makeTranslation(bent.x, point.y, bent.z);
      this.hornLayer.setMatrixAt(index, this.matrix);
    });
    this.hornLayer.instanceMatrix.needsUpdate = true;
  }

  makeSectionPath() {
    const w = this.sectionWidth;
    const h = this.sectionHeight;
    const r = WIND_ROPE_RADIUS + 0.001;
    const corner = Math.PI * r / 2;
    this.sectionPath = [
      { length: h, from: [w + r, 0], to: [w + r, h], normal: [1, 0] },
      { length: corner, center: [w, h], start: 0 },
      { length: 2 * w, from: [w, h + r], to: [-w, h + r], normal: [0, 1] },
      { length: corner, center: [-w, h], start: Math.PI / 2 },
      { length: 2 * h, from: [-w - r, h], to: [-w - r, -h], normal: [-1, 0] },
      { length: corner, center: [-w, -h], start: Math.PI },
      { length: 2 * w, from: [-w, -h - r], to: [w, -h - r], normal: [0, -1] },
      { length: corner, center: [w, -h], start: 3 * Math.PI / 2 },
      { length: h, from: [w + r, -h], to: [w + r, 0], normal: [1, 0] }
    ];
    this.sectionPerimeter = this.sectionPath.reduce((sum, segment) => sum + segment.length, 0);
    this.sectionCornerRadius = r;
  }

  sectionAt(angle) {
    let distance = THREE.MathUtils.euclideanModulo(angle, Math.PI * 2) / (Math.PI * 2) * this.sectionPerimeter;
    for (const segment of this.sectionPath) {
      if (distance <= segment.length) {
        const t = distance / segment.length;
        if (segment.center) {
          const a = segment.start + t * Math.PI / 2;
          const nx = Math.cos(a);
          const ny = Math.sin(a);
          return { x: segment.center[0] + nx * this.sectionCornerRadius, y: segment.center[1] + ny * this.sectionCornerRadius, nx, ny };
        }
        return {
          x: THREE.MathUtils.lerp(segment.from[0], segment.to[0], t),
          y: THREE.MathUtils.lerp(segment.from[1], segment.to[1], t),
          nx: segment.normal[0], ny: segment.normal[1]
        };
      }
      distance -= segment.length;
    }
    throw new Error("밧줄 단면 경로를 계산할 수 없습니다.");
  }

  alongAt(angle) {
    const inset = this.arcSpan / (2 * WIND_TURNS);
    return this.arcStart + inset + angle / (WIND_TURNS * Math.PI * 2) * (this.arcSpan - 2 * inset);
  }

  makeRope() {
    this.root = new THREE.Group();
    this.assembly.assemblyRoot.add(this.root);
    const guidePoints = [];
    for (let i = 0; i < 96; i++) {
      const point = this.sectionAt(i * Math.PI * 2 / 96);
      guidePoints.push(new THREE.Vector3(point.x, point.y, 0));
    }
    this.guide = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(guidePoints),
      new THREE.LineBasicMaterial({ color: 0xffdc79, transparent: true, opacity: 0.85, depthTest: false })
    );
    this.guide.renderOrder = 4;
    this.root.add(this.guide);
    this.guide.visible = false;

    // 미리 할당한 튜브에 새 단면만 추가하므로 드래그할 때 전체 지오메트리를 재생성하지 않습니다.
    this.radialSegments = 8;
    this.maxSegments = WIND_TURNS * WIND_SAMPLES_PER_TURN;
    const vertices = (this.maxSegments + 1) * this.radialSegments;
    this.ropeGeometry = new THREE.BufferGeometry();
    this.ropeGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.ropeGeometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const indices = [];
    for (let i = 0; i < this.maxSegments; i++) {
      for (let j = 0; j < this.radialSegments; j++) {
        const a = i * this.radialSegments + j;
        const b = i * this.radialSegments + (j + 1) % this.radialSegments;
        const c = a + this.radialSegments;
        const d = b + this.radialSegments;
        indices.push(a, b, d, a, d, c);
      }
    }
    this.ropeGeometry.setIndex(indices);
    this.ropeGeometry.setDrawRange(0, 0);
    this.rope = new THREE.Mesh(this.ropeGeometry, new THREE.MeshStandardMaterial({ color: 0xcda96d, roughness: 0.9 }));
    this.rope.frustumCulled = false;
    this.rope.castShadow = true;
    this.root.add(this.rope);
    this.knot = new THREE.Group();
    const knotMaterial = this.workshop.material(0xcda96d);
    this.workshop.sphere(this.knot, [0.03, 0.025, 0.03], [0, 0, 0], knotMaterial);
    this.root.add(this.knot);
    this.knot.visible = false;
  }

  centerAt(angle) {
    const along = this.alongAt(angle);
    const section = this.sectionAt(angle * this.direction);
    const radial = new THREE.Vector3(Math.cos(along), 0, Math.sin(along));
    return radial.multiplyScalar(this.radius + section.x)
      .add(new THREE.Vector3(0, this.sectionY + section.y, 0));
  }

  appendRope() {
    const count = Math.min(this.maxSegments, Math.floor(this.progressAngle / (Math.PI * 2) * WIND_SAMPLES_PER_TURN + 1e-8));
    const positions = this.ropeGeometry.attributes.position;
    const normals = this.ropeGeometry.attributes.normal;
    for (let i = this.drawnSegments; i <= count; i++) {
      const angle = i * Math.PI * 2 / WIND_SAMPLES_PER_TURN;
      const center = this.centerAt(angle);
      const tangent = this.centerAt(angle + 0.001).sub(this.centerAt(angle - 0.001)).normalize();
      const along = this.alongAt(angle);
      const section = this.sectionAt(angle * this.direction);
      const outward = new THREE.Vector3(Math.cos(along) * section.nx, section.ny, Math.sin(along) * section.nx);
      outward.addScaledVector(tangent, -outward.dot(tangent)).normalize();
      const side = new THREE.Vector3().crossVectors(tangent, outward).normalize();
      // 고리 바깥쪽은 간격이 넓고 안쪽은 좁습니다. 납작한 끈의 폭을 간격에 맞춰
      // 조절하고 2% 여유를 남겨, 인접한 코일이 겹치지 않으면서 빈틈을 최소화합니다.
      const pitch = this.arcSpan * (1 - 1 / WIND_TURNS) / WIND_TURNS;
      const halfWidth = Math.hypot(center.x, center.z) * Math.sin(pitch / 2) * 0.98;
      for (let j = 0; j < this.radialSegments; j++) {
        const a = j * Math.PI * 2 / this.radialSegments;
        const normal = outward.clone().multiplyScalar(Math.cos(a) / WIND_ROPE_RADIUS).addScaledVector(side, Math.sin(a) / halfWidth).normalize();
        const point = center.clone().addScaledVector(outward, Math.cos(a) * WIND_ROPE_RADIUS).addScaledVector(side, Math.sin(a) * halfWidth);
        const index = i * this.radialSegments + j;
        positions.setXYZ(index, point.x, point.y, point.z);
        normals.setXYZ(index, normal.x, normal.y, normal.z);
      }
    }
    this.drawnSegments = count + 1;
    positions.needsUpdate = true;
    normals.needsUpdate = true;
    this.ropeGeometry.setDrawRange(0, count * this.radialSegments * 6);
    this.placeGuide();
  }

  placeGuide() {
    const angle = this.alongAt(this.progressAngle);
    const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const up = new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    this.guide.position.set(this.radius * radial.x, this.sectionY, this.radius * radial.z);
    this.guide.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(radial, up, tangent));
  }

  bindInput() {
    this.onDown = (event) => {
      if (!event.isPrimary || event.button !== 0 || !["ready", "running"].includes(this.state) || this.dragging) return;
      const onPad = event.currentTarget === this.pad;
      const angle = onPad ? this.pointerAngle(event) : null;
      if (onPad && angle === null) return;
      event.preventDefault();
      this.dragging = true;
      this.pointerId = event.pointerId;
      this.inputTarget = event.currentTarget;
      this.lastPoint = { x: event.clientX, y: event.clientY };
      this.lastAngle = angle;
      this.signedAngle = this.progressAngle;
      this.inputTarget.setPointerCapture(event.pointerId);
    };
    this.onMove = (event) => {
      if (!this.dragging || event.pointerId !== this.pointerId) return;
      let angle;
      if (this.inputTarget === this.pad) {
        angle = this.pointerAngle(event);
      } else {
        const dx = event.clientX - this.lastPoint.x;
        const dy = event.clientY - this.lastPoint.y;
        if (Math.hypot(dx, dy) < 2) return;
        this.lastPoint = { x: event.clientX, y: event.clientY };
        angle = Math.atan2(dy, dx);
      }
      if (angle === null) { this.lastAngle = null; return; }
      if (this.lastAngle === null) { this.lastAngle = angle; return; }
      let delta = angle - this.lastAngle;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      this.lastAngle = angle;
      if (Math.abs(delta) < 0.002 || Math.abs(delta) > Math.PI * 0.9) return;
      if (this.state === "ready") this.start();
      if (this.state !== "running") return;
      if (performance.now() >= this.deadline) { this.fail("time"); return; }
      if (!this.direction) this.direction = Math.sign(delta);
      this.hintVisible = false;
      this.message = "";
      this.signedAngle = Math.max(0, this.signedAngle + delta * this.direction * WIND_TURNS / WIND_INPUT_TURNS);
      const maximum = WIND_TURNS * Math.PI * 2;
      this.progressAngle = Math.min(maximum, Math.max(this.progressAngle, this.signedAngle));
      if (maximum - this.progressAngle < 1e-6) this.progressAngle = maximum;
      this.appendRope();
      if (this.progressAngle >= maximum) {
        this.clearTimer();
        this.stopDrag();
        this.state = "tying";
        this.animationStart = performance.now();
        this.guide.visible = false;
        this.knot.position.copy(this.centerAt(this.progressAngle));
        this.knot.visible = true;
      }
      this.emit();
    };
    this.onUp = (event) => { if (event.pointerId === this.pointerId) this.stopDrag(); };
    this.inputTargets = [this.pad, this.workshop.renderer.domElement];
    for (const target of this.inputTargets) {
      target.addEventListener("pointerdown", this.onDown);
      target.addEventListener("pointermove", this.onMove);
      target.addEventListener("pointerup", this.onUp);
      target.addEventListener("pointercancel", this.onUp);
      target.addEventListener("lostpointercapture", this.onUp);
    }
  }

  pointerAngle(event) {
    const rect = this.pad.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    const distance = Math.hypot(x, y);
    if (distance < rect.width * 0.08) return null;
    return Math.atan2(y, x);
  }

  stopDrag() {
    const id = this.pointerId;
    const target = this.inputTarget;
    this.pointerId = null;
    this.dragging = false;
    this.inputTarget = null;
    this.lastAngle = null;
    if (target && id !== null && id !== undefined && target.hasPointerCapture(id)) target.releasePointerCapture(id);
  }

  start() {
    this.state = "running";
    this.deadline = performance.now() + WIND_SECONDS * 1000;
    this.scheduleTimeout();
  }

  clearTimer() {
    if (this.timer !== null && this.timer !== undefined) clearTimeout(this.timer);
    this.timer = null;
  }

  scheduleTimeout() {
    this.clearTimer();
    this.timer = setTimeout(() => {
      if (this.state !== "running") return;
      if (performance.now() < this.deadline) this.scheduleTimeout();
      else this.fail("time");
    }, Math.max(0, this.deadline - performance.now()));
  }

  finish() {
    if (!["ready", "running"].includes(this.state)) return;
    if (this.state === "running" && performance.now() >= this.deadline) { this.fail("time"); return; }
    if (this.progressAngle / (WIND_TURNS * Math.PI * 2) < WIND_MIN_FINISH) this.fail("short");
    else {
      this.message = "아직 끝까지 감지 않았어요. 100%까지 계속 감아 주세요!";
      this.emit();
    }
  }

  fail(reason) {
    if (!["ready", "running"].includes(this.state)) return;
    this.clearTimer();
    this.stopDrag();
    if (reason === "time") this.remaining = 0;
    this.state = "failed";
    this.emit();
    this.onComplete(false, reason);
  }

  reset() {
    this.clearTimer();
    this.stopDrag();
    this.progressAngle = 0;
    this.signedAngle = 0;
    this.direction = 0;
    this.drawnSegments = 0;
    this.remaining = WIND_SECONDS;
    this.message = "";
    this.hintVisible = true;
    this.knot.visible = false;
    this.ropeGeometry.setDrawRange(0, 0);
    this.guide.visible = true;
    this.placeGuide();
    this.state = "ready";
    this.emit();
  }

  snapshot() {
    return {
      state: this.state,
      progress: this.progressAngle / (WIND_TURNS * Math.PI * 2),
      remaining: this.remaining,
      hintVisible: this.hintVisible,
      message: this.message || ""
    };
  }

  emit() { this.onChange(this.snapshot()); }

  update(now) {
    if (this.state === "stacking") {
      const t = this.workshop.reducedMotion.matches ? 1 : Math.min((now - this.animationStart) / WIND_STACK_DURATION, 1);
      const eased = t * t * (3 - 2 * t);
      this.glue.horn.position.y = this.sectionY + 1.15 * (1 - eased);
      this.setShape(eased);
      if (t === 1) this.reset();
    } else if (this.state === "running") {
      if (now >= this.deadline) this.fail("time");
      else {
        this.remaining = (this.deadline - now) / 1000;
        this.emit();
      }
    } else if (this.state === "tying") {
      const t = this.workshop.reducedMotion.matches ? 1 : Math.min((now - this.animationStart) / WIND_KNOT_DURATION, 1);
      this.knot.scale.setScalar(1.6 - 0.6 * t);
      if (t === 1) {
        this.state = "done";
        this.emit();
        this.onComplete(true);
      }
    }
  }

  dispose() {
    this.clearTimer();
    this.stopDrag();
    for (const target of this.inputTargets) {
      target.removeEventListener("pointerdown", this.onDown);
      target.removeEventListener("pointermove", this.onMove);
      target.removeEventListener("pointerup", this.onUp);
      target.removeEventListener("pointercancel", this.onUp);
      target.removeEventListener("lostpointercapture", this.onUp);
    }
    this.assembly.assemblyRoot.remove(this.root);
    this.ropeGeometry.dispose();
    this.rope.material.dispose();
    this.guide.geometry.dispose();
    this.guide.material.dispose();
    this.knot.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) object.material.dispose();
    });
    this.glue.horn.remove(this.hornLayer);
    this.hornLayer.dispose();
    this.glue.hornMesh.geometry = this.originalHornGeometry;
    this.bentGeometry.dispose();
    this.glue.root.add(this.glue.horn, this.assemblyLayer);
    this.glue.horn.position.copy(this.originalHornPosition);
    this.glue.horn.rotation.copy(this.originalHornRotation);
    this.assemblyLayer.position.copy(this.originalLayerPosition);
    this.assemblyLayer.quaternion.copy(this.originalLayerQuaternion);
    this.assemblyLayer.scale.copy(this.originalLayerScale);
    this.assembly.assemblyRoot.position.copy(this.originalAssemblyPosition);
    this.assembly.clamps.forEach((clamp, index) => { clamp.visible = this.originalClampVisibility[index]; });
    this.glue.pots.visible = this.originalPotsVisible;
    this.glue.targets[0].layer.visible = this.originalHornLayerVisible;
    this.glue.paintMeshes[0].visible = this.originalHornPaintVisible;
  }
}
