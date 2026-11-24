"use strict";

// 두 부품 각각 이 비율 이상 칠하면 남은 부분을 마무리하고 성공합니다. 1이면 100%가 필요합니다.
const GLUE_COVERAGE_TARGET = 0.9;
// 붓 판정 반경은 월드 단위입니다. 시각적 붓보다 넉넉하게 유지할 수 있습니다.
const GLUE_BRUSH_RADIUS = 0.065;
// 끈 해제, 사포질과 광택 연출 시간은 밀리초 단위입니다.
const UNTIE_DURATION = 1800;
const SANDING_DURATION = 2600;
const GLOSS_DURATION = 1600;
// 완성 후 거칠기와 투명 광택층의 세기입니다. 거칠기가 낮을수록 더 반짝입니다.
const GLUE_GLOSS_ROUGHNESS = 0.14;
const GLUE_CLEARCOAT = 1;
const GLUE_PAINT_SIZE = 512;
const GLUE_PAINT_EXTENT = 1.4;

class GlueGame {
  constructor(workshop, assembly, woodwork, onChange, onWrong, onComplete) {
    this.workshop = workshop;
    this.assembly = assembly;
    this.woodwork = woodwork;
    this.canvas = workshop.renderer.domElement;
    this.onChange = onChange;
    this.onWrong = onWrong;
    this.onComplete = onComplete;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(WORKPIECE_BASE_Y + WOOD_THICKNESS));
    this.originalAssemblyPosition = assembly.assemblyRoot.position.clone();
    this.originalBindings = assembly.bindings.map(({ geometry, rope, knot }) => ({
      start: geometry.drawRange.start, count: geometry.drawRange.count,
      ropeVisible: rope.visible, knotVisible: knot.visible,
      knotPosition: knot.position.clone(), knotScale: knot.scale.clone()
    }));
    assembly.assemblyRoot.position.x = -0.48;
    this.root = new THREE.Group();
    workshop.table.add(this.root);
    this.makeHorn();
    this.makePots();
    this.makeBrush();
    this.makeCoverage();
    this.makePaintLayers();
    this.bindInput();
    this.sandpaper.visible = false;
    this.dust.count = 0;
    this.state = "untying";
    this.animationStart = null;
    this.emit();
  }

  startIntro() {
    if (this.state === "untying" && this.animationStart === null) this.animationStart = performance.now();
  }

  makeHorn() {
    const w = this.workshop;
    this.horn = new THREE.Group();
    this.horn.position.set(0.65, WORKPIECE_BASE_Y, 0);
    this.horn.rotation.y = Math.PI / 2;
    this.root.add(this.horn);
    const shape = new THREE.Shape();
    const length = this.woodwork.halfLength;
    shape.moveTo(-length, 0);
    for (let i = 1; i <= 80; i++) {
      const x = -length + i * length * 2 / 80;
      shape.lineTo(x, this.woodwork.guideWidth(x));
    }
    for (let i = 79; i >= 0; i--) {
      const x = -length + i * length * 2 / 80;
      shape.lineTo(x, -this.woodwork.guideWidth(x));
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: WOOD_THICKNESS, bevelEnabled: false });
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, WOOD_THICKNESS, 0);
    this.hornMaterial = new THREE.MeshPhysicalMaterial({ color: 0x39251d, roughness: 1, clearcoat: 0 });
    this.hornMesh = new THREE.Mesh(geometry, this.hornMaterial);
    this.hornMesh.castShadow = true;
    this.hornMesh.receiveShadow = true;
    this.horn.add(this.hornMesh);

    const scratches = [];
    for (let i = 0; i < 48; i++) {
      const x = -0.7 + (i % 16) * 0.09;
      const z = ((Math.floor(i / 16) - 1) * 0.55) * this.woodwork.guideWidth(x);
      scratches.push(x - 0.025, WOOD_THICKNESS + 0.002, z, x + 0.025, WOOD_THICKNESS + 0.002, z + 0.008);
    }
    const scratchGeometry = new THREE.BufferGeometry();
    scratchGeometry.setAttribute("position", new THREE.Float32BufferAttribute(scratches, 3));
    this.scratchMaterial = new THREE.LineBasicMaterial({ color: 0xa5846b, transparent: true, opacity: 0.7 });
    this.scratches = new THREE.LineSegments(scratchGeometry, this.scratchMaterial);
    this.horn.add(this.scratches);

    this.sandpaper = new THREE.Group();
    w.box(this.sandpaper, [0.2, 0.07, 0.15], [0, 0.035, 0], w.material(0x9a6547));
    w.box(this.sandpaper, [0.2, 0.012, 0.15], [0, 0.006, 0], w.material(0xc29a72));
    this.horn.add(this.sandpaper);
    this.dust = new THREE.InstancedMesh(new THREE.SphereGeometry(0.009, 5, 4), new THREE.MeshBasicMaterial({ color: 0xcbb49c }), 20);
    this.dust.frustumCulled = false;
    this.horn.add(this.dust);
    this.sparkles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe6a1 }), 24);
    this.sparkles.count = 0;
    this.sparkles.frustumCulled = false;
    this.root.add(this.sparkles);
    this.matrix = new THREE.Matrix4();
  }

  makePots() {
    const w = this.workshop;
    this.pots = new THREE.Group();
    this.root.add(this.pots);
    const bowlMaterial = w.material(0x9a6949);
    const colors = [0xf8f4e8, 0xc18a42, 0xe9a4ac];
    this.potGroups = colors.map((color, index) => {
      const pot = new THREE.Group();
      pot.position.set((index - 1) * 0.42, WORKPIECE_BASE_Y, 0.76);
      w.cylinder(pot, 0.15, 0.11, 0.13, [0, 0.065, 0], bowlMaterial, 24);
      w.cylinder(pot, 0.13, 0.13, 0.008, [0, 0.135, 0], w.material(color), 24);
      this.pots.add(pot);
      return pot;
    });
    this.pots.visible = false;
  }

  makeBrush() {
    const w = this.workshop;
    this.brush = new THREE.Group();
    w.box(this.brush, [0.045, 0.045, 0.3], [0, 0.09, 0.12], w.material(0x8c5c37));
    w.box(this.brush, [0.07, 0.06, 0.1], [0, 0.06, -0.07], w.material(0xc5934a));
    this.brush.rotation.x = -0.35;
    this.brush.visible = false;
    this.root.add(this.brush);
  }

  makeCoverage() {
    const table = this.workshop.table;
    table.updateWorldMatrix(true, true);
    const cells = [[], []];
    const worldToTable = (point) => table.worldToLocal(point.clone());
    for (let i = 0; i < 36; i++) {
      const x = -this.woodwork.halfLength + (i + 0.5) * this.woodwork.halfLength * 2 / 36;
      const width = this.woodwork.guideWidth(x);
      for (const fraction of [-0.7, 0, 0.7]) {
        const point = this.horn.localToWorld(new THREE.Vector3(x, WOOD_THICKNESS + 0.004, width * fraction));
        cells[0].push(worldToTable(point));
      }
    }

    // 조립품의 실제 메시 위에만 칠할 지점을 두므로 가운데 빈 공간은 진행률에 포함되지 않습니다.
    const ring = this.assembly.assemblyRoot;
    const targets = [this.assembly.socket, this.woodwork.surface];
    for (let i = 0; i < 96; i++) {
      const angle = (i + 0.5) * Math.PI * 2 / 96;
      for (const offset of [-0.08, -0.04, 0, 0.04, 0.08]) {
        const radius = this.assembly.radius + offset;
        const origin = ring.localToWorld(new THREE.Vector3(radius * Math.cos(angle), WORKPIECE_BASE_Y + 1, radius * Math.sin(angle)));
        this.raycaster.set(origin, new THREE.Vector3(0, -1, 0));
        const hits = this.raycaster.intersectObjects(targets, false);
        if (hits.length) {
          const point = worldToTable(hits[0].point);
          point.y += 0.004;
          cells[1].push(point);
        }
      }
    }
    if (!cells[0].length || !cells[1].length) throw new Error("풀칠할 부품 표면을 찾지 못했습니다.");
    this.targets = cells.map((points) => {
      const geometry = new THREE.CircleGeometry(0.029, 12);
      geometry.rotateX(-Math.PI / 2);
      const material = new THREE.MeshStandardMaterial({ color: 0xc89642, roughness: 0.35, transparent: true, opacity: 0.55, depthWrite: false });
      const layer = new THREE.InstancedMesh(geometry, material, points.length);
      layer.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      layer.count = 0;
      layer.visible = false;
      layer.frustumCulled = false;
      layer.renderOrder = 2;
      this.root.add(layer);
      return { points, painted: new Uint8Array(points.length), count: 0, layer };
    });
  }

  makePaintLayers() {
    this.paintCanvas = document.createElement("canvas");
    this.paintCanvas.width = this.paintCanvas.height = GLUE_PAINT_SIZE;
    this.paintBase = document.createElement("canvas");
    this.paintBase.width = this.paintBase.height = GLUE_PAINT_SIZE;
    this.paintContext = this.paintCanvas.getContext("2d");
    this.paintBaseContext = this.paintBase.getContext("2d");
    if (!this.paintContext || !this.paintBaseContext) throw new Error("풀칠 텍스처를 만들 수 없습니다.");
    this.paintTexture = new THREE.CanvasTexture(this.paintCanvas);
    this.paintTexture.colorSpace = THREE.SRGBColorSpace;
    this.paintMaterial = new THREE.MeshBasicMaterial({
      map: this.paintTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1
    });
    const table = this.workshop.table;
    table.updateWorldMatrix(true, true);
    this.paintMeshes = [this.hornMesh, this.assembly.socket, this.woodwork.surface].map((source) => {
      const sourceGeometry = source.geometry;
      const positions = sourceGeometry.getAttribute("position");
      const index = sourceGeometry.getIndex();
      const vertices = [];
      const uvs = [];
      const point = new THREE.Vector3();
      const count = index ? index.count : positions.count;
      for (let i = 0; i < count; i += 3) {
        const triangle = [0, 1, 2].map((offset) => index ? index.getX(i + offset) : i + offset);
        if (triangle.some((vertex) => positions.getY(vertex) < WOOD_THICKNESS - 0.0001)) continue;
        for (const vertex of triangle) {
          point.fromBufferAttribute(positions, vertex);
          vertices.push(point.x, point.y, point.z);
          table.worldToLocal(source.localToWorld(point));
          uvs.push((point.x + GLUE_PAINT_EXTENT) / (2 * GLUE_PAINT_EXTENT),
            1 - (point.z + GLUE_PAINT_EXTENT) / (2 * GLUE_PAINT_EXTENT));
        }
      }
      if (!vertices.length) throw new Error("풀칠할 표면을 만들 수 없습니다.");
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      const layer = new THREE.Mesh(geometry, this.paintMaterial);
      layer.position.y = 0.003;
      layer.renderOrder = 2;
      source.add(layer);
      return layer;
    });
    this.strokePath = null;
    this.strokeHasMoved = false;
  }

  paintCoordinates(point) {
    const scale = GLUE_PAINT_SIZE / (2 * GLUE_PAINT_EXTENT);
    return [(point.x + GLUE_PAINT_EXTENT) * scale, (point.z + GLUE_PAINT_EXTENT) * scale];
  }

  drawStroke(context) {
    context.lineCap = "round";
    context.lineJoin = "round";
    const width = GLUE_BRUSH_RADIUS * GLUE_PAINT_SIZE / GLUE_PAINT_EXTENT;
    for (const [scale, alpha] of [[1, 0.05], [0.82, 0.07], [0.64, 0.09], [0.46, 0.16]]) {
      context.lineWidth = width * scale;
      context.strokeStyle = `rgba(200, 150, 66, ${alpha})`;
      context.stroke(this.strokePath);
    }
  }

  updatePaintTexture() {
    this.paintContext.clearRect(0, 0, GLUE_PAINT_SIZE, GLUE_PAINT_SIZE);
    this.paintContext.drawImage(this.paintBase, 0, 0);
    if (this.strokePath && this.strokeHasMoved) this.drawStroke(this.paintContext);
    this.paintTexture.needsUpdate = true;
  }

  addGlossHighlights() {
    const table = this.workshop.table;
    table.updateWorldMatrix(true, true);
    const path = new Path2D();
    const addLine = (points) => {
      points.forEach((point, index) => {
        const [x, y] = this.paintCoordinates(point);
        if (index === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      });
    };
    addLine([-0.5, 0.5].map((x) =>
      table.worldToLocal(this.horn.localToWorld(new THREE.Vector3(x, WOOD_THICKNESS, -0.025)))));
    const shoulder = Math.PI / 2 - ASSEMBLY_FORK_ANGLE;
    const ranges = [
      [-shoulder, -ASSEMBLY_BRANCH_GAP_ANGLE],
      [ASSEMBLY_BRANCH_GAP_ANGLE, shoulder],
      [-3 * Math.PI / 2 - ASSEMBLY_BAMBOO_END_ANGLE, -Math.PI / 2 + ASSEMBLY_BAMBOO_END_ANGLE]
    ];
    for (const [start, end] of ranges) {
      const points = [];
      for (let i = 0; i <= 80; i++) {
        const angle = THREE.MathUtils.lerp(start, end, i / 80);
        const radius = this.assembly.radius - 0.015;
        const point = new THREE.Vector3(radius * Math.sin(angle), WORKPIECE_BASE_Y + WOOD_THICKNESS, radius * Math.cos(angle));
        points.push(table.worldToLocal(this.assembly.assemblyRoot.localToWorld(point)));
      }
      addLine(points);
    }
    const context = this.paintBaseContext;
    context.lineCap = "round";
    context.lineJoin = "round";
    const scale = GLUE_PAINT_SIZE / (2 * GLUE_PAINT_EXTENT);
    context.lineWidth = 0.025 * scale;
    context.strokeStyle = "rgba(255, 248, 226, 0.12)";
    context.stroke(path);
    context.lineWidth = 0.006 * scale;
    context.strokeStyle = "rgba(255, 255, 245, 0.38)";
    context.stroke(path);
    this.updatePaintTexture();
  }

  bindInput() {
    this.onDown = (event) => {
      if (!event.isPrimary || event.button !== 0 || this.dragging) return;
      if (this.state === "choosing") {
        this.setRay(event);
        const hits = this.raycaster.intersectObjects(this.potGroups, true);
        if (hits.length) {
          const index = this.potGroups.findIndex((pot) => {
            let object = hits[0].object;
            while (object && object !== pot) object = object.parent;
            return object === pot;
          });
          if (index >= 0) this.choose(index + 1);
        }
        return;
      }
      if (this.state !== "painting") return;
      event.preventDefault();
      this.dragging = true;
      this.pointerId = event.pointerId;
      this.lastPoint = null;
      this.canvas.setPointerCapture(event.pointerId);
      this.moveBrush(event, false);
    };
    this.onMove = (event) => {
      if (this.state !== "painting" || !event.isPrimary || (this.dragging && event.pointerId !== this.pointerId)) return;
      this.moveBrush(event, this.dragging);
    };
    this.onUp = (event) => {
      if (event.pointerId === this.pointerId) this.stopDrag();
    };
    this.onLeave = () => { if (!this.dragging) this.brush.visible = false; };
    this.canvas.addEventListener("pointerdown", this.onDown);
    this.canvas.addEventListener("pointermove", this.onMove);
    this.canvas.addEventListener("pointerup", this.onUp);
    this.canvas.addEventListener("pointercancel", this.onUp);
    this.canvas.addEventListener("lostpointercapture", this.onUp);
    this.canvas.addEventListener("pointerleave", this.onLeave);
    this.canvas.parentElement.classList.add("gluing");
  }

  setRay(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.workshop.camera);
  }

  stopDrag() {
    const id = this.pointerId;
    if (this.strokePath && this.strokeHasMoved) {
      this.drawStroke(this.paintBaseContext);
      this.strokePath = null;
      this.strokeHasMoved = false;
      this.updatePaintTexture();
    } else {
      this.strokePath = null;
    }
    this.pointerId = null;
    this.dragging = false;
    this.lastPoint = null;
    if (id !== null && id !== undefined && this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
  }

  moveBrush(event, painting) {
    this.setRay(event);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.plane, hit)) return;
    const point = this.workshop.table.worldToLocal(hit);
    this.brush.position.copy(point);
    this.brush.visible = true;
    if (!painting) {
      if (this.dragging) {
        this.lastPoint = point;
        this.strokePath = new Path2D();
        this.strokePath.moveTo(...this.paintCoordinates(point));
        this.strokeHasMoved = false;
      }
      return;
    }
    if (!this.lastPoint) {
      this.lastPoint = point;
      this.strokePath = new Path2D();
      this.strokePath.moveTo(...this.paintCoordinates(point));
      return;
    }
    const start = this.lastPoint;
    if (start.distanceTo(point) < 0.003) return;
    this.strokePath.lineTo(...this.paintCoordinates(point));
    this.strokeHasMoved = true;
    this.updatePaintTexture();
    const steps = Math.max(1, Math.ceil(start.distanceTo(point) / (GLUE_BRUSH_RADIUS / 4)));
    let changed = false;
    for (let i = 0; i <= steps; i++) {
      const sample = start.clone().lerp(point, i / steps);
      for (const target of this.targets) {
        target.points.forEach((cell, index) => {
          if (target.painted[index]) return;
          if (Math.hypot(cell.x - sample.x, cell.z - sample.z) > GLUE_BRUSH_RADIUS) return;
          this.paintCell(target, index);
          changed = true;
        });
      }
    }
    this.lastPoint = point;
    if (!changed) return;
    this.targets.forEach((target) => { target.layer.instanceMatrix.needsUpdate = true; });
    if (this.targets.every((target) => target.count / target.points.length >= GLUE_COVERAGE_TARGET)) {
      this.stopDrag();
      this.brush.visible = false;
      this.state = "finishing";
      this.animationStart = performance.now();
      // 기준을 통과한 뒤 남은 표면은 마무리 코팅 연출로 채웁니다.
      for (const target of this.targets) {
        target.points.forEach((_, index) => { if (!target.painted[index]) this.paintCell(target, index); });
        target.layer.instanceMatrix.needsUpdate = true;
      }
      this.prepareGloss();
    }
    this.emit();
  }

  paintCell(target, index) {
    target.painted[index] = 1;
    const point = target.points[index];
    this.matrix.makeTranslation(point.x, point.y, point.z);
    target.layer.setMatrixAt(target.count, this.matrix);
    target.count++;
    target.layer.count = target.count;
  }

  choose(number) {
    if (this.state !== "choosing") return;
    if (number !== 2) {
      this.state = "failed";
      this.emit();
      this.onWrong();
      return;
    }
    this.state = "painting";
    this.potGroups.forEach((pot, index) => { pot.visible = index === 1; });
    this.emit();
  }

  retrySelection() {
    if (this.state !== "failed") return;
    this.state = "choosing";
    this.potGroups.forEach((pot) => { pot.visible = true; });
    this.emit();
  }

  prepareGloss() {
    this.originalMaterials = [this.assembly.socket.material, this.woodwork.surface.material];
    this.glossMaterials = this.originalMaterials.map((material) => new THREE.MeshPhysicalMaterial({
      color: material.color.clone(), roughness: material.roughness, metalness: material.metalness,
      vertexColors: material.vertexColors, clearcoat: 0
    }));
    this.assembly.socket.material = this.glossMaterials[0];
    this.woodwork.surface.material = this.glossMaterials[1];
    this.initialRoughness = [this.hornMaterial, ...this.glossMaterials].map((material) => material.roughness);
  }

  snapshot() {
    return { state: this.state, progress: this.targets.map((target) => Math.floor(target.count * 100 / target.points.length)) };
  }

  emit() { this.onChange(this.snapshot()); }

  update(now) {
    if (this.state === "untying" && this.animationStart !== null) {
      const t = this.workshop.reducedMotion.matches ? 1 : Math.min((now - this.animationStart) / UNTIE_DURATION, 1);
      const knotProgress = Math.min(t / 0.3, 1);
      const unwind = Math.max(0, (t - 0.2) / 0.8);
      this.assembly.bindings.forEach(({ geometry, rope, knot }, index) => {
        const original = this.originalBindings[index];
        knot.scale.copy(original.knotScale).multiplyScalar(1 - knotProgress);
        knot.position.copy(original.knotPosition);
        knot.position.y += knotProgress * 0.1;
        knot.visible = original.knotVisible && knotProgress < 1;
        geometry.setDrawRange(original.start, Math.floor(original.count * (1 - unwind) / 42) * 42);
        rope.visible = original.ropeVisible && unwind < 1;
      });
      if (t === 1) {
        this.state = "sanding";
        this.animationStart = now;
        this.sandpaper.visible = true;
        this.emit();
      }
    } else if (this.state === "sanding") {
      const t = this.workshop.reducedMotion.matches ? 1 : Math.min((now - this.animationStart) / SANDING_DURATION, 1);
      const x = -0.62 + 1.24 * (0.5 - 0.5 * Math.cos(t * Math.PI * 6));
      this.sandpaper.position.set(x, WOOD_THICKNESS + 0.01, 0);
      this.scratchMaterial.opacity = 0.7 * (1 - t);
      this.hornMaterial.roughness = 1 - 0.45 * t;
      this.dust.count = this.workshop.reducedMotion.matches ? 0 : 20;
      for (let i = 0; i < this.dust.count; i++) {
        const phase = (now / 700 + i * 0.17) % 1;
        this.matrix.makeTranslation(x + Math.sin(i * 2.4) * phase * 0.1, WOOD_THICKNESS + 0.04 + phase * 0.15, Math.cos(i * 2.4) * phase * 0.08);
        this.dust.setMatrixAt(i, this.matrix);
      }
      this.dust.instanceMatrix.needsUpdate = true;
      if (t === 1) {
        this.sandpaper.visible = false;
        this.scratches.visible = false;
        this.dust.count = 0;
        this.pots.visible = true;
        this.state = "choosing";
        this.emit();
      }
    } else if (this.state === "finishing") {
      const t = this.workshop.reducedMotion.matches ? 1 : Math.min((now - this.animationStart) / GLOSS_DURATION, 1);
      [this.hornMaterial, ...this.glossMaterials].forEach((material, index) => {
        material.roughness = THREE.MathUtils.lerp(this.initialRoughness[index], GLUE_GLOSS_ROUGHNESS, t);
        material.clearcoat = GLUE_CLEARCOAT * t;
        material.clearcoatRoughness = 0.08;
      });
      this.sparkles.count = this.workshop.reducedMotion.matches ? 0 : 24;
      for (let i = 0; i < this.sparkles.count; i++) {
        const phase = (now / 800 + i * 0.19) % 1;
        const target = this.targets[i % 2];
        const point = target.points[Math.floor((i / 2) * target.points.length / 12)];
        this.matrix.makeTranslation(point.x, point.y + 0.03 + phase * 0.12, point.z);
        this.sparkles.setMatrixAt(i, this.matrix);
      }
      this.sparkles.instanceMatrix.needsUpdate = true;
      if (t === 1) {
        this.sparkles.count = 0;
        this.addGlossHighlights();
        this.state = "done";
        this.emit();
        this.onComplete();
      }
    }
  }

  dispose() {
    this.stopDrag();
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointercancel", this.onUp);
    this.canvas.removeEventListener("lostpointercapture", this.onUp);
    this.canvas.removeEventListener("pointerleave", this.onLeave);
    this.canvas.parentElement.classList.remove("gluing");
    if (this.originalMaterials) {
      this.assembly.socket.material = this.originalMaterials[0];
      this.woodwork.surface.material = this.originalMaterials[1];
      this.glossMaterials.forEach((material) => material.dispose());
    }
    this.paintMeshes.forEach((mesh) => { mesh.removeFromParent(); mesh.geometry.dispose(); });
    this.paintMaterial.dispose();
    this.paintTexture.dispose();
    this.assembly.assemblyRoot.position.copy(this.originalAssemblyPosition);
    this.assembly.bindings.forEach(({ geometry, rope, knot }, index) => {
      const original = this.originalBindings[index];
      geometry.setDrawRange(original.start, original.count);
      rope.visible = original.ropeVisible;
      knot.visible = original.knotVisible;
      knot.position.copy(original.knotPosition);
      knot.scale.copy(original.knotScale);
    });
    this.workshop.table.remove(this.root);
    const geometries = new Set();
    const materials = new Set();
    this.root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.isInstancedMesh) object.dispose();
      if (object.material) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }
}
