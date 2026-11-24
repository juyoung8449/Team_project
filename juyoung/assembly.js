"use strict";

// 첫 터치 또는 시작 버튼을 누른 순간부터 실제 경과 시간을 잽니다.
// 10초를 다른 값으로 바꾸려면 초 단위 숫자를 수정하세요.
const ASSEMBLY_SECONDS = 10;
// 목표 터치 수입니다. 각 입력마다 전체 이동 거리의 1 / 목표 횟수만큼 전진합니다.
const ASSEMBLY_TARGET = 50;
// 결합이 끝난 뒤 노끈을 감고 매듭을 짓는 연출 시간입니다.
const TIE_DURATION = 2400;
const ASSEMBLY_SANDING_DURATION = 3000;
const SAND_BAND_WIDTH_SCALE = 0.5;
const ASSEMBLY_BAMBOO_HALF_WIDTH = 0.04;
const ASSEMBLY_FORK_ANGLE = 0.26;
const ASSEMBLY_BAMBOO_END_ANGLE = 0.22;
const ASSEMBLY_BRANCH_GAP_ANGLE = 0.16;

class AssemblyGame {
  constructor(workshop, woodwork, bending, onChange, onComplete) {
    this.workshop = workshop;
    this.board = woodwork.board;
    this.bamboo = bending.wood;
    this.canvas = workshop.renderer.domElement;
    this.onChange = onChange;
    this.onComplete = onComplete;
    this.matrix = new THREE.Matrix4();
    this.bandMatrix = new THREE.Matrix4();
    this.bandPosition = new THREE.Vector3();
    this.bandQuaternion = new THREE.Quaternion();
    this.bandScale = new THREE.Vector3();
    this.bending = bending;
    this.woodwork = woodwork;
    this.originalBoardScale = this.board.scale.clone();
    this.originalBambooScale = this.bamboo.scale.clone();
    this.originalBambooMatrices = this.bending.parts.map(({ mesh }) => mesh.instanceMatrix.array.slice());
    this.assemblyRoot = new THREE.Group();
    this.assemblyRoot.scale.x = 1.2;
    this.workshop.table.add(this.assemblyRoot);
    this.assemblyRoot.add(this.board, this.bamboo);
    this.bendBoard();
    this.makeSocket();
    this.makeGrain();
    this.makeEffects();
    this.makeSander();
    this.bindInput();
    this.reset();
  }

  bendBoard() {
    const surface = this.woodwork.surface;
    this.originalMatrices = surface.instanceMatrix.array.slice();
    this.originalGeometry = surface.geometry;
    this.originalCount = surface.count;
    this.originalBoardMaterial = surface.material;
    this.radius = this.woodwork.halfLength * 2 / Math.PI;
    const positions = [];
    const colors = [];
    const indices = [];
    const topColor = new THREE.Color(0xe8d6b7);
    const sideColor = new THREE.Color(0xb89571);
    const point = (angle, y, offset) => [
      (this.radius + offset) * Math.sin(angle), y, (this.radius + offset) * Math.cos(angle)
    ];
    const face = (vertices, color) => {
      const base = positions.length / 3;
      vertices.forEach((vertex) => {
        positions.push(...vertex);
        colors.push(color.r, color.g, color.b);
      });
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const band = (start, end, inner, outer) => {
      const segments = Math.ceil((end - start) * 32);
      for (let i = 0; i < segments; i++) {
        const a = THREE.MathUtils.lerp(start, end, i / segments);
        const b = THREE.MathUtils.lerp(start, end, (i + 1) / segments);
        const a0 = inner(a), a1 = outer(a), b0 = inner(b), b1 = outer(b);
        face([point(a, WOOD_THICKNESS, a0), point(a, WOOD_THICKNESS, a1), point(b, WOOD_THICKNESS, b1), point(b, WOOD_THICKNESS, b0)], topColor);
        face([point(a, 0, a1), point(a, 0, a0), point(b, 0, b0), point(b, 0, b1)], sideColor);
        face([point(a, 0, a0), point(a, WOOD_THICKNESS, a0), point(b, WOOD_THICKNESS, b0), point(b, 0, b0)], sideColor);
        face([point(b, 0, b1), point(b, WOOD_THICKNESS, b1), point(a, WOOD_THICKNESS, a1), point(a, 0, a1)], sideColor);
      }
      face([point(start, 0, outer(start)), point(start, WOOD_THICKNESS, outer(start)), point(start, WOOD_THICKNESS, inner(start)), point(start, 0, inner(start))], sideColor);
      face([point(end, 0, inner(end)), point(end, WOOD_THICKNESS, inner(end)), point(end, WOOD_THICKNESS, outer(end)), point(end, 0, outer(end))], sideColor);
    };
    const halfWidth = (angle) => 0.048 + 0.016 * THREE.MathUtils.smoothstep(Math.abs(angle), ASSEMBLY_BRANCH_GAP_ANGLE, Math.PI / 2 - ASSEMBLY_FORK_ANGLE);
    const forkInner = ASSEMBLY_BAMBOO_HALF_WIDTH + 0.003;
    for (const side of [-1, 1]) {
      const angles = [side * ASSEMBLY_BRANCH_GAP_ANGLE, side * (Math.PI / 2 - ASSEMBLY_FORK_ANGLE), side * Math.PI / 2];
      const body = [angles[0], angles[1]].sort((a, b) => a - b);
      const fork = [angles[1], angles[2]].sort((a, b) => a - b);
      band(body[0], body[1], (angle) => -halfWidth(angle), halfWidth);
      band(fork[0], fork[1], (angle) => -halfWidth(angle), () => -forkInner);
      band(fork[0], fork[1], () => forkInner, halfWidth);
    }
    this.curvedGeometry = new THREE.BufferGeometry();
    this.curvedGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    this.originalBoardPositions = this.curvedGeometry.attributes.position.array.slice();
    this.curvedGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    this.curvedGeometry.setIndex(indices);
    this.curvedGeometry.computeVertexNormals();
    this.curvedGeometry.computeBoundingSphere();
    this.boardMaterial = this.workshop.material(0xffffff);
    this.boardMaterial.vertexColors = true;
    surface.material = this.boardMaterial;
    surface.geometry = this.curvedGeometry;
    surface.count = 1;
    surface.setMatrixAt(0, this.matrix.identity());
    surface.instanceMatrix.needsUpdate = true;
  }

  makeSocket() {
    const shape = new THREE.Shape();
    const start = Math.PI - ASSEMBLY_BAMBOO_END_ANGLE;
    const end = Math.PI * 2 + ASSEMBLY_BAMBOO_END_ANGLE;
    for (let i = 0; i <= 128; i++) {
      const angle = THREE.MathUtils.lerp(start, end, i / 128);
      const radius = this.radius - ASSEMBLY_BAMBOO_HALF_WIDTH;
      if (i === 0) shape.moveTo(radius * Math.cos(angle), radius * Math.sin(angle));
      else shape.lineTo(radius * Math.cos(angle), radius * Math.sin(angle));
    }
    for (let i = 128; i >= 0; i--) {
      const angle = THREE.MathUtils.lerp(start, end, i / 128);
      const radius = this.radius + ASSEMBLY_BAMBOO_HALF_WIDTH;
      shape.lineTo(radius * Math.cos(angle), radius * Math.sin(angle));
    }
    shape.closePath();
    const jointAngle = Math.PI / 2 - ASSEMBLY_BAMBOO_END_ANGLE / 2;
    this.joints = [-1, 1].map((side) =>
      new THREE.Vector2(side * this.radius * Math.sin(jointAngle), this.radius * Math.cos(jointAngle)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: BAMBOO_THICKNESS, bevelEnabled: false });
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, BAMBOO_THICKNESS, 0);
    this.originalSocketPositions = geometry.attributes.position.array.slice();
    this.workshop.colorBambooInterior(geometry);
    this.socketMaterial = this.workshop.bambooInteriorMaterial();
    this.socket = new THREE.Mesh(geometry, this.socketMaterial);
    this.socket.castShadow = true;
    this.socket.receiveShadow = true;
    this.bending.parts.forEach((part) => { part.mesh.visible = false; });
    this.bamboo.add(this.socket);
  }

  makeGrain() {
    this.grainMaterial = new THREE.LineBasicMaterial({ color: 0x9a7957, transparent: true, opacity: 0.32, depthWrite: false });
    const makeLines = (parent, ranges) => {
      const positions = [];
      for (const [start, end] of ranges) {
        for (const offset of [-0.022, -0.011, 0, 0.011, 0.022]) {
          const point = (angle) => {
            const radius = this.radius + offset + 0.0015 * Math.sin(angle * 19 + offset * 120);
            return [radius * Math.sin(angle), WOOD_THICKNESS + 0.002, radius * Math.cos(angle)];
          };
          for (let i = 0; i < 80; i++) {
            positions.push(...point(THREE.MathUtils.lerp(start, end, i / 80)));
            positions.push(...point(THREE.MathUtils.lerp(start, end, (i + 1) / 80)));
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      const lines = new THREE.LineSegments(geometry, this.grainMaterial);
      parent.add(lines);
      return lines;
    };
    const shoulder = Math.PI / 2 - ASSEMBLY_FORK_ANGLE;
    this.grain = [
      makeLines(this.board, [[-shoulder, -ASSEMBLY_BRANCH_GAP_ANGLE], [ASSEMBLY_BRANCH_GAP_ANGLE, shoulder]]),
      makeLines(this.bamboo, [[-3 * Math.PI / 2 - ASSEMBLY_BAMBOO_END_ANGLE, -Math.PI / 2 + ASSEMBLY_BAMBOO_END_ANGLE]])
    ];
    this.originalGrainPositions = this.grain.map((lines) => lines.geometry.attributes.position.array.slice());
  }

  setBandWidthScale(scale) {
    const updateRadialGeometry = (geometry, originalPositions, updateNormals = false) => {
      const positions = geometry.attributes.position.array;
      for (let i = 0; i < originalPositions.length; i += 3) {
        const x = originalPositions[i];
        const z = originalPositions[i + 2];
        const radius = Math.hypot(x, z);
        const radialScale = radius > 1e-8 ? (this.radius + (radius - this.radius) * scale) / radius : 1;
        positions[i] = x * radialScale;
        positions[i + 1] = originalPositions[i + 1];
        positions[i + 2] = z * radialScale;
      }
      geometry.attributes.position.needsUpdate = true;
      if (updateNormals) geometry.computeVertexNormals();
    };

    updateRadialGeometry(this.curvedGeometry, this.originalBoardPositions, true);
    updateRadialGeometry(this.socket.geometry, this.originalSocketPositions, true);
    this.grain.forEach((lines, index) => {
      updateRadialGeometry(lines.geometry, this.originalGrainPositions[index]);
    });

    this.bending.parts.forEach(({ chips, mesh }, partIndex) => {
      mesh.instanceMatrix.array.set(this.originalBambooMatrices[partIndex]);
      for (let i = 0; i < chips.length; i++) {
        mesh.getMatrixAt(i, this.bandMatrix);
        this.bandMatrix.decompose(this.bandPosition, this.bandQuaternion, this.bandScale);
        const curve = this.bending.curveAt(chips[i].x);
        this.bandPosition.x = curve.x + (this.bandPosition.x - curve.x) * scale;
        this.bandPosition.z = curve.z + (this.bandPosition.z - curve.z) * scale;
        this.bandScale.x *= scale;
        this.bandMatrix.compose(this.bandPosition, this.bandQuaternion, this.bandScale);
        mesh.setMatrixAt(i, this.bandMatrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  makeEffects() {
    const w = this.workshop;
    this.effects = new THREE.Group();
    this.assemblyRoot.add(this.effects);
    const iron = w.material(0x788681, 0.4);
    this.clamps = [];
    for (const x of [-0.24, 0.24]) {
      const z = -Math.sqrt((this.radius + ASSEMBLY_BAMBOO_HALF_WIDTH) ** 2 - x ** 2);
      this.clamps.push(w.box(this.effects, [0.16, 0.06, 0.18], [x, 1.07, z - 0.015], iron));
      this.clamps.push(w.box(this.effects, [0.08, BAMBOO_THICKNESS + 0.04, 0.08], [x, WORKPIECE_BASE_Y + BAMBOO_THICKNESS / 2, z], iron));
    }
    this.ropeMaterial = w.material(0xdac28b);
    const knotLoop = new THREE.TorusGeometry(0.055, 0.012, 8, 24);
    this.bindings = this.joints.map((joint) => {
      const points = [];
      for (let i = 0; i <= 160; i++) {
        const t = i / 160;
        const angle = t * Math.PI * 8;
        points.push(new THREE.Vector3(joint.x + 0.082 * Math.sin(angle), WORKPIECE_BASE_Y + BAMBOO_THICKNESS / 2 + (BAMBOO_THICKNESS / 2 + 0.03) * Math.cos(angle), joint.y - 0.07 + 0.14 * t));
      }
      const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 200, 0.014, 7, false);
      const rope = new THREE.Mesh(geometry, this.ropeMaterial);
      this.effects.add(rope);
      const knot = new THREE.Group();
      for (const x of [-0.04, 0.04]) {
        const loop = new THREE.Mesh(knotLoop, this.ropeMaterial);
        loop.rotation.x = Math.PI / 2;
        loop.position.z = x;
        knot.add(loop);
      }
      w.sphere(knot, [0.035, 0.035, 0.035], [0, 0, 0], this.ropeMaterial);
      knot.position.set(joint.x, WORKPIECE_BASE_Y + BAMBOO_THICKNESS + 0.05, joint.y + 0.07);
      this.effects.add(knot);
      return { geometry, rope, knot };
    });
    this.sparkGeometry = new THREE.SphereGeometry(0.015, 6, 4);
    this.sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffd68c });
    this.sparks = new THREE.InstancedMesh(this.sparkGeometry, this.sparkMaterial, 24);
    this.sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.effects.add(this.sparks);
  }

  makeSander() {
    const pad = this.workshop.material(0xc9a66b);
    const handle = this.workshop.material(0x865439);
    this.sander = new THREE.Group();
    this.workshop.box(this.sander, [0.24, 0.035, 0.15], [0, 0, 0], pad);
    this.workshop.box(this.sander, [0.13, 0.07, 0.07], [0, 0.05, 0], handle);
    this.effects.add(this.sander);
    this.sander.visible = false;
  }

  bindInput() {
    this.onPointer = (event) => {
      if (event.button !== 0 || event.target !== this.canvas) return;
      event.preventDefault();
      this.tap();
    };
    this.onKey = (event) => {
      if (event.code !== "Space" || event.repeat || (event.target instanceof Element && event.target.closest("button, input, select, textarea, dialog"))) return;
      if (this.state !== "waiting" && this.state !== "running") return;
      event.preventDefault();
      this.tap();
    };
    this.canvas.addEventListener("pointerdown", this.onPointer);
    window.addEventListener("keydown", this.onKey);
    this.canvas.parentElement.classList.add("assembling");
  }

  clearTimer() {
    if (this.timer !== null && this.timer !== undefined) clearTimeout(this.timer);
    this.timer = null;
  }

  reset() {
    this.clearTimer();
    this.state = "sanding";
    this.count = 0;
    this.remaining = ASSEMBLY_SECONDS;
    this.deadline = null;
    this.animation = null;
    this.hitAt = 0;
    this.board.scale.copy(this.originalBoardScale);
    this.bamboo.scale.copy(this.originalBambooScale);
    this.setBandWidthScale(1);
    this.board.position.set(0, WORKPIECE_BASE_Y + WOOD_THICKNESS + 0.02, 0.3);
    this.board.rotation.set(0, 0, 0);
    this.bamboo.position.set(0, WORKPIECE_BASE_Y, 0);
    this.clamps.forEach((clamp) => { clamp.visible = true; });
    this.bindings.forEach(({ geometry, rope, knot }) => {
      rope.visible = false;
      geometry.setDrawRange(0, 0);
      knot.visible = false;
    });
    this.sparks.count = 0;
    this.sander.visible = true;
    this.animation = { start: performance.now(), kind: "sanding" };
    this.emit();
  }

  setProgress(progress) {
    // 몸통 옆의 두 끝 홈 위로 이동한 뒤 수직으로 내려 양끝을 동시에 끼웁니다.
    // 경로 길이 전체를 목표 횟수로 나누므로 어느 구간에서도 한 번당 이동 거리는 같습니다.
    const across = 0.3;
    const lift = BAMBOO_THICKNESS + 0.02;
    const distance = THREE.MathUtils.clamp(progress, 0, 1) * (across + lift);
    this.board.position.set(0, WORKPIECE_BASE_Y + lift - Math.max(0, distance - across), Math.max(0, across - distance));
  }

  start() {
    if (this.state !== "waiting") return;
    this.state = "running";
    this.deadline = performance.now() + ASSEMBLY_SECONDS * 1000;
    this.scheduleTimeout();
    this.emit();
  }

  scheduleTimeout() {
    this.clearTimer();
    const delay = Math.max(0, this.deadline - performance.now());
    this.timer = setTimeout(() => {
      if (this.state !== "running") return;
      if (performance.now() < this.deadline) this.scheduleTimeout();
      else this.fail();
    }, delay);
  }

  tap() {
    if (this.state === "waiting") this.start();
    if (this.state !== "running") return;
    const now = performance.now();
    // 정확히 제한 시간에 도달한 입력은 성공으로 처리하지 않습니다.
    if (now >= this.deadline) {
      this.fail();
      return;
    }
    this.count++;
    this.remaining = (this.deadline - now) / 1000;
    this.setProgress(this.count / ASSEMBLY_TARGET);
    this.hitAt = now;
    if (this.count >= ASSEMBLY_TARGET) {
      this.clearTimer();
      this.board.rotation.y = 0;
      this.state = "tying";
      this.bindings.forEach(({ rope }) => { rope.visible = true; });
      this.animation = { start: now, kind: "tying" };
    }
    this.emit();
  }

  fail() {
    if (this.state !== "running") return;
    this.clearTimer();
    this.remaining = 0;
    this.state = "done";
    this.emit();
    this.onComplete(false);
  }

  snapshot() {
    return { state: this.state, count: this.count, remaining: this.remaining };
  }

  emit() { this.onChange(this.snapshot()); }

  update(now) {
    if (this.state === "running") {
      if (now >= this.deadline) this.fail();
      else {
        this.remaining = (this.deadline - now) / 1000;
        this.emit();
      }
    }
    const elapsedHit = now - this.hitAt;
    if (this.state === "running" && !this.workshop.reducedMotion.matches && this.hitAt && elapsedHit < 180) {
      const t = elapsedHit / 180;
      this.board.rotation.y = this.board.position.y >= WORKPIECE_BASE_Y + BAMBOO_THICKNESS
        ? Math.sin(t * Math.PI * 4) * (1 - t) * 0.035 : 0;
      this.sparks.count = 12;
      for (let i = 0; i < this.sparks.count; i++) {
        const angle = i * Math.PI * 2 / this.sparks.count;
        const joint = this.joints[i % 2];
        this.matrix.makeTranslation(joint.x + Math.cos(angle) * t * 0.15, 1.2 + t * 0.2, joint.y + Math.sin(angle) * t * 0.15);
        this.sparks.setMatrixAt(i, this.matrix);
      }
      this.sparks.instanceMatrix.needsUpdate = true;
    } else {
      this.board.rotation.y = 0;
      this.sparks.count = 0;
    }
    if (!this.animation) return;
    const duration = this.animation.kind === "tying" ? TIE_DURATION : this.animation.kind === "sanding" ? ASSEMBLY_SANDING_DURATION : 700;
    const t = this.workshop.reducedMotion.matches ? 1 : Math.min((now - this.animation.start) / duration, 1);
    if (this.animation.kind === "sanding") {
      const eased = t * t * (3 - 2 * t);
      const bandWidthScale = THREE.MathUtils.lerp(1, SAND_BAND_WIDTH_SCALE, eased);
      this.board.scale.copy(this.originalBoardScale);
      this.bamboo.scale.copy(this.originalBambooScale);
      this.board.position.y = WORKPIECE_BASE_Y + WOOD_THICKNESS + 0.02;
      this.setBandWidthScale(bandWidthScale);
      const phase = Math.min(t / 0.5, 1);
      if (t < 0.5) {
        const angle = Math.sin(phase * Math.PI * 4) * (Math.PI / 2 - ASSEMBLY_FORK_ANGLE);
        this.sander.position.set(
          this.radius * Math.sin(angle),
          this.board.position.y + WOOD_THICKNESS + 0.02,
          this.board.position.z + this.radius * Math.cos(angle)
        );
        this.sander.rotation.y = angle;
      } else {
        const along = Math.sin((t - 0.5) * Math.PI * 8) * this.workshop.halfLength;
        const curve = this.bending.curveAt(along);
        this.sander.position.set(
          curve.x,
          this.bamboo.position.y + BAMBOO_THICKNESS + 0.02,
          curve.z
        );
        this.sander.rotation.y = curve.angle;
      }
      this.sander.rotation.z = Math.sin(now / 70) * 0.12;
      if (t < 1) return;
      this.sander.visible = false;
      this.animation = null;
      this.state = "waiting";
      this.setProgress(0);
      this.emit();
      return;
    }
    if (this.animation.kind === "failing") {
      const eased = t * t * (3 - 2 * t);
      this.setProgress(this.animation.fromProgress * (1 - eased));
    } else {
      const wind = Math.min(t / 0.8, 1);
      // TubeGeometry는 인덱스가 둘레 7분할 × 삼각형 2개이므로 완성된 구간만 순서대로 그립니다.
      this.bindings.forEach(({ geometry, knot }) => {
        geometry.setDrawRange(0, Math.floor(wind * 200) * 7 * 6);
        knot.visible = t >= 0.8;
        if (knot.visible) knot.scale.setScalar(Math.min((t - 0.8) / 0.2, 1));
      });
      if (t >= 0.8 && !this.workshop.reducedMotion.matches) {
        this.sparks.count = 12;
        for (let i = 0; i < this.sparks.count; i++) {
          const angle = i * Math.PI * 2 / this.sparks.count;
          const radius = 0.2 + (t - 0.8) * 1.5;
          const joint = this.joints[i % 2];
          this.matrix.makeTranslation(joint.x + Math.cos(angle) * radius, 1.4, joint.y + Math.sin(angle) * radius);
          this.sparks.setMatrixAt(i, this.matrix);
        }
        this.sparks.instanceMatrix.needsUpdate = true;
      }
    }
    if (t === 1) {
      const passed = this.animation.kind === "tying";
      this.animation = null;
      this.state = "done";
      if (passed) this.clamps.forEach((clamp) => { clamp.visible = false; });
      this.sparks.count = 0;
      this.emit();
      this.onComplete(passed);
    }
  }

  dispose() {
    this.clearTimer();
    this.setBandWidthScale(1);
    this.canvas.removeEventListener("pointerdown", this.onPointer);
    window.removeEventListener("keydown", this.onKey);
    this.canvas.parentElement.classList.remove("assembling");
    this.assemblyRoot.remove(this.effects);
    this.grain.forEach((lines) => { lines.removeFromParent(); lines.geometry.dispose(); });
    this.grainMaterial.dispose();
    this.bamboo.remove(this.socket);
    this.socket.geometry.dispose();
    this.socketMaterial.dispose();
    this.woodwork.surface.material = this.originalBoardMaterial;
    this.boardMaterial.dispose();
    this.woodwork.surface.geometry = this.originalGeometry;
    this.woodwork.surface.count = this.originalCount;
    this.curvedGeometry.dispose();
    this.woodwork.surface.instanceMatrix.array.set(this.originalMatrices);
    this.woodwork.surface.instanceMatrix.needsUpdate = true;
    this.bending.parts.forEach((part) => { part.mesh.visible = true; });
    this.workshop.table.add(this.board, this.bamboo);
    this.board.scale.copy(this.originalBoardScale);
    this.bamboo.scale.copy(this.originalBambooScale);
    this.workshop.table.remove(this.assemblyRoot);
    const geometries = new Set();
    const materials = new Set();
    this.effects.traverse((object) => {
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
