"use strict";

const HEAT_MIN_SECONDS = 8;
const HEAT_MAX_SUCCESS_SECONDS = 12;
const HEAT_LIMIT_SECONDS = 15;
const HEAT_RADIUS = 0.32;
// 긴 입력 공백은 정지 후 재개로 간주해 정지 시간을 누적하지 않습니다.
const HEAT_MOVE_GAP_MS = 200;
// 원의 안쪽이 겹치지 않도록 1단계의 잘린 모양은 유지하면서 2단계에서 너비를 축소합니다.
const BENDING_WIDTH_SCALE = 0.5;
const FORM_POSITIONS = [-0.68, 0.5];
const FORM_RADIUS = 0.07;

class BambooBendingGame {
  constructor(workshop, onChange, onComplete) {
    this.workshop = workshop;
    this.table = workshop.table;
    this.canvas = workshop.renderer.domElement;
    this.onChange = onChange;
    this.onComplete = onComplete;
    this.source = workshop.chips.filter((chip) => !chip.removed).map((chip) => ({ ...chip }));
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.5);
    this.makeFire();
    this.makeBamboo();
    this.bindInput();
    this.reset();
  }

  makeFire() {
    const w = this.workshop;
    this.fire = new THREE.Group();
    this.fire.position.set(0, 1.09, 0);
    this.table.add(this.fire);
    const iron = w.material(0x5c5a51);
    const ember = new THREE.MeshStandardMaterial({ color: 0xa64020, emissive: 0xb23208, emissiveIntensity: 0.6 });
    w.cylinder(this.fire, 0.27, 0.21, 0.12, [0, 0.06, 0], iron, 24);
    w.cylinder(this.fire, 0.21, 0.21, 0.025, [0, 0.13, 0], ember, 24);
    const logMaterial = w.material(0x68402d);
    for (const angle of [-0.8, 0.8]) {
      const log = w.cylinder(this.fire, 0.045, 0.045, 0.38, [0, 0.17, 0], logMaterial, 10);
      log.rotation.set(Math.PI / 2, angle, 0);
    }
    this.flames = [];
    const flameGeometry = new THREE.SphereGeometry(1, 8, 6);
    const flameMaterials = [
      new THREE.MeshStandardMaterial({ color: 0xffb52c, emissive: 0xff6a00, emissiveIntensity: 1.1 }),
      new THREE.MeshStandardMaterial({ color: 0xee5220, emissive: 0xc52c00, emissiveIntensity: 0.8 })
    ];
    for (let i = 0; i < 18; i++) {
      const flame = new THREE.Mesh(flameGeometry, flameMaterials[i % 2]);
      this.fire.add(flame);
      this.flames.push(flame);
    }
    this.fireLight = new THREE.PointLight(0xff7730, 3, 3.5);
    this.fireLight.position.y = 0.38;
    this.fire.add(this.fireLight);
    this.heatZone = new THREE.Group();
    this.heatZone.position.y = 0.41;
    this.fire.add(this.heatZone);
    const zoneFill = new THREE.Mesh(
      new THREE.CircleGeometry(HEAT_RADIUS, 64),
      new THREE.MeshBasicMaterial({ color: 0xff8a25, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide })
    );
    const zoneBorder = new THREE.Mesh(
      new THREE.RingGeometry(HEAT_RADIUS * 0.96, HEAT_RADIUS * 1.04, 64),
      new THREE.MeshBasicMaterial({ color: 0xff9b35, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide })
    );
    zoneFill.rotation.x = zoneBorder.rotation.x = -Math.PI / 2;
    this.heatZone.add(zoneFill, zoneBorder);
    this.heatZoneFill = zoneFill.material;
    this.heatZoneBorder = zoneBorder.material;
  }

  makeBamboo() {
    this.wood = new THREE.Group();
    this.table.add(this.wood);
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.workshop.colorBambooOchre(this.geometry);
    this.materials = [this.workshop.bambooOchreMaterial(), this.workshop.bambooOchreMaterial()];
    this.unheatedColor = new THREE.Color(BAMBOO_IVORY_OCHRE_COLOR);
    this.heatedColor = new THREE.Color(0xff4930);
    this.cooledColor = new THREE.Color(BAMBOO_IVORY_OCHRE_COLOR);
    this.parts = [0, 1].map((zone) => {
      const chips = this.source.filter((chip) => zone === 0 ? chip.x < 0 : chip.x >= 0);
      const mesh = new THREE.InstancedMesh(this.geometry, this.materials[zone], chips.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.wood.add(mesh);
      return { chips, mesh };
    });
    const metal = this.workshop.material(0x51483e, 0.5);
    const clampGeometry = new THREE.TorusGeometry(FORM_RADIUS, 0.004, 8, 32);
    this.clamps = [0, 1].map(() => {
      const clamp = new THREE.Mesh(clampGeometry, metal);
      clamp.castShadow = true;
      this.wood.add(clamp);
      return clamp;
    });
    const wireGeometry = new THREE.CylinderGeometry(0.0035, 0.0035, 1, 8);
    this.wireStrands = [-1, 1].map(() => {
      const wire = new THREE.Mesh(wireGeometry, metal);
      this.wood.add(wire);
      return wire;
    });
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffdf83, side: THREE.DoubleSide, depthTest: false });
    this.marker = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.025), markerMaterial);
    this.marker.rotation.order = "YXZ";
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.renderOrder = 3;
    this.wood.add(this.marker);
    const hitMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    this.hitbox = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.3, 2.1), hitMaterial);
    this.wood.add(this.hitbox);
    this.matrix = new THREE.Matrix4();
    this.fragments = [];
    this.charMaterial = this.workshop.material(0x302a26);
  }

  bindInput() {
    this.onDown = (event) => {
      if (this.state !== "ready" || !event.isPrimary || event.button !== 0 || this.dragging) return;
      this.setRay(event);
      this.wood.updateWorldMatrix(true, true);
      if (!this.raycaster.intersectObject(this.hitbox).length) return;
      const point = new THREE.Vector3();
      if (!this.raycaster.ray.intersectPlane(this.plane, point)) return;
      event.preventDefault();
      this.dragging = true;
      this.pointerId = event.pointerId;
      this.lastInteractionAt = performance.now();
      this.lastHeatTime = null;
      this.inHeat = this.isNearFire();
      this.dragOffset = this.wood.getWorldPosition(new THREE.Vector3()).sub(point);
      this.canvas.setPointerCapture(event.pointerId);
      this.emit();
    };
    this.onMove = (event) => {
      if (!this.dragging || event.pointerId !== this.pointerId || this.state !== "ready") return;
      this.setRay(event);
      const point = new THREE.Vector3();
      if (!this.raycaster.ray.intersectPlane(this.plane, point)) return;
      this.lastInteractionAt = performance.now();
      const position = point.clone().add(this.dragOffset);
      const x = THREE.MathUtils.clamp(position.x - this.table.position.x, -1.2, 1.2);
      const z = THREE.MathUtils.clamp(position.z - this.table.position.z, -1.15, 1.15);
      const moved = x !== this.wood.position.x || z !== this.wood.position.z;
      if (moved) this.updateHeat(this.lastInteractionAt);
      else { this.lastHeatTime = null; this.heating = false; }
      this.wood.position.x = x;
      this.wood.position.z = z;
      this.inHeat = this.isNearFire();
      if (!this.inHeat) this.heating = false;
      if (this.heat >= HEAT_LIMIT_SECONDS) {
        this.finishHeating();
      } else {
        this.emit();
      }
    };
    this.onUp = (event) => {
      if (!this.dragging || event.pointerId !== this.pointerId) return;
      this.lastInteractionAt = performance.now();
      if (this.heat >= HEAT_MIN_SECONDS) this.finishHeating();
      else {
        this.stopDrag();
        this.emit();
      }
    };
    this.onCancel = (event) => {
      if (event.pointerId !== this.pointerId) return;
      this.lastInteractionAt = performance.now();
      this.stopDrag();
      this.emit();
    };
    this.canvas.addEventListener("pointerdown", this.onDown);
    this.canvas.addEventListener("pointermove", this.onMove);
    this.canvas.addEventListener("pointerup", this.onUp);
    this.canvas.addEventListener("pointercancel", this.onCancel);
    this.canvas.addEventListener("lostpointercapture", this.onCancel);
  }

  setRay(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.workshop.camera);
  }

  stopDrag() {
    const id = this.pointerId;
    this.dragging = false;
    this.pointerId = null;
    if (id !== null && id !== undefined && this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    this.inHeat = false;
    this.heating = false;
    this.lastHeatTime = null;
  }

  reset() {
    this.stopDrag();
    for (const fragment of this.fragments) this.wood.remove(fragment.mesh);
    this.fragments.length = 0;
    this.zone = 0;
    this.heat = 0;
    this.lastInteractionAt = 0;
    this.results = [null, null];
    this.bends = [0, 0];
    this.charred = [false, false];
    this.state = "waiting";
    this.animation = null;
    this.wood.position.set(-0.55, 1.5, 0.3);
    this.clamps.forEach((clamp) => { clamp.visible = false; });
    this.wireStrands.forEach((wire) => { wire.visible = false; });
    this.marker.visible = true;
    this.materials.forEach((material) => material.color.copy(this.unheatedColor));
    this.updatePose();
    this.emit();
  }

  activate() {
    if (this.state !== "waiting") return;
    this.state = "ready";
    this.canvas.parentElement.classList.add("heating");
    this.emit();
  }

  curveAt(s) {
    const bend = this.bends[s < 0 ? 0 : 1];
    const halfLength = this.workshop.halfLength;
    const curvature = Math.PI * bend / halfLength;
    if (curvature < 1e-6) return { x: 0, z: s, angle: 0, turnRate: 0 };
    const angle = curvature * s;
    // 양쪽 반원의 접선은 중앙에서 이어지고, 완전히 구부리면 양 끝이 같은 위치에 만납니다.
    return { x: (1 - Math.cos(angle)) / curvature, z: Math.sin(angle) / curvature, angle, turnRate: curvature };
  }

  updatePose() {
    for (let zone = 0; zone < 2; zone++) {
      const part = this.parts[zone];
      part.chips.forEach((chip, index) => {
        const curve = this.curveAt(chip.x);
        const offset = chip.z * BENDING_WIDTH_SCALE;
        const position = new THREE.Vector3(curve.x + Math.cos(curve.angle) * offset, 0, curve.z - Math.sin(curve.angle) * offset);
        const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), curve.angle);
        const length = chip.length * Math.max(0.3, 1 - offset * curve.turnRate) * 1.02;
        const scale = this.charred[zone] ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(chip.width * BENDING_WIDTH_SCALE, BAMBOO_THICKNESS, length);
        this.matrix.compose(position, rotation, scale);
        part.mesh.setMatrixAt(index, this.matrix);
      });
      part.mesh.instanceMatrix.needsUpdate = true;
      const curve = this.curveAt(FORM_POSITIONS[zone]);
      this.clamps[zone].position.set(curve.x, 0, curve.z);
      this.clamps[zone].rotation.y = curve.angle;
    }
    const ends = FORM_POSITIONS.map((position) => this.curveAt(position));
    const normals = ends.map((end) => new THREE.Vector3(Math.cos(end.angle), 0, -Math.sin(end.angle)));
    if (normals[0].dot(normals[1]) < 0) normals[0].negate();
    this.wireStrands.forEach((wire, index) => {
      const side = index ? 1 : -1;
      const points = ends.map((end, i) => new THREE.Vector3(end.x, 0, end.z).addScaledVector(normals[i], side * FORM_RADIUS));
      const direction = points[1].clone().sub(points[0]);
      wire.position.copy(points[0]).add(points[1]).multiplyScalar(0.5);
      wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      wire.scale.set(1, direction.length(), 1);
    });
    const markerS = this.zone === 0 ? -0.46 : 0.46;
    const markerCurve = this.curveAt(markerS);
    this.marker.position.set(markerCurve.x, BAMBOO_THICKNESS / 2 + 0.015, markerCurve.z);
    this.marker.rotation.y = markerCurve.angle;
  }

  isNearFire() {
    const s = this.zone === 0 ? -0.46 : 0.46;
    const curve = this.curveAt(s);
    return Math.hypot(this.wood.position.x + curve.x, this.wood.position.z + curve.z) <= HEAT_RADIUS;
  }

  updateHeat(now) {
    const elapsed = this.lastHeatTime === null ? 0 : now - this.lastHeatTime;
    this.lastHeatTime = now;
    this.heating = this.inHeat && elapsed > 0 && elapsed <= HEAT_MOVE_GAP_MS;
    if (!this.heating) return;
    this.heat = Math.min(HEAT_LIMIT_SECONDS, this.heat + elapsed / 1000);
    this.materials[this.zone].color.lerpColors(this.unheatedColor, this.heatedColor,
      Math.min(this.heat / HEAT_MAX_SUCCESS_SECONDS, 1));
  }

  finishHeating() {
    if (this.state !== "ready") return;
    this.stopDrag();
    const kind = this.heat < HEAT_MIN_SECONDS ? "under" : this.heat <= HEAT_MAX_SUCCESS_SECONDS ? "success" : "over";
    this.results[this.zone] = { kind, seconds: this.heat };
    if (kind !== "success") {
      this.complete();
      return;
    }
    this.state = "animating";
    this.marker.visible = false;
    this.animation = { kind, zone: this.zone, start: performance.now(), progress: 0, baseX: this.wood.position.x };
    this.emit();
  }

  makeFragments(zone) {
    const chips = this.parts[zone].chips;
    const stride = Math.max(1, Math.ceil(chips.length / 45));
    for (let i = 0; i < chips.length; i += stride) {
      const chip = chips[i];
      const curve = this.curveAt(chip.x);
      const mesh = new THREE.Mesh(this.geometry, this.charMaterial);
      const offset = chip.z * BENDING_WIDTH_SCALE;
      mesh.position.set(curve.x + Math.cos(curve.angle) * offset, 0, curve.z - Math.sin(curve.angle) * offset);
      mesh.scale.set(chip.width * BENDING_WIDTH_SCALE * 1.4, 0.14 * BAMBOO_CROSS_SECTION_SCALE, chip.length * 2);
      this.wood.add(mesh);
      this.fragments.push({ mesh, x: mesh.position.x, z: mesh.position.z, vx: (Math.random() - 0.5) * 0.8, vz: (Math.random() - 0.5) * 0.8 });
    }
  }

  snapshot() {
    return { state: this.state, zone: this.zone, heat: this.heat, inHeat: this.inHeat, heating: this.heating, dragging: this.dragging, results: [...this.results] };
  }

  emit() { this.onChange(this.snapshot()); }

  update(now) {
    const effectTime = this.workshop.reducedMotion.matches ? 0 : now;
    this.flames.forEach((flame, i) => {
      const t = (effectTime / 750 + i * 0.23) % 1;
      const angle = i * 2.4;
      const radius = 0.13 * (1 - t);
      flame.position.set(Math.cos(angle) * radius, 0.2 + t * 0.48, Math.sin(angle) * radius);
      flame.scale.setScalar(0.075 * (1 - t) + 0.012);
    });
    this.fireLight.intensity = 2.8 + Math.sin(effectTime / 170) * 0.4;
    const nearFire = this.state === "ready" && this.isNearFire();
    this.heatZone.visible = this.state === "ready";
    this.heatZoneFill.opacity = nearFire ? 0.32 : 0.16;
    this.heatZoneBorder.opacity = nearFire ? 1 : 0.65 + Math.sin(effectTime / 400) * 0.12;
    this.heatZoneBorder.color.setHex(nearFire ? 0xffef76 : 0xff9b35);
    if (this.heating && (this.lastHeatTime === null || now - this.lastHeatTime > HEAT_MOVE_GAP_MS)) {
      this.heating = false;
      this.emit();
    }
    if (!this.animation) return;
    const animation = this.animation;
    const duration = this.workshop.reducedMotion.matches ? 1 : animation.kind === "cooling" ? 1800 : 1100;
    const progress = Math.min((now - animation.start) / duration, 1);
    animation.progress = progress * progress * (3 - 2 * progress);
    if (animation.kind === "success") {
      this.bends[animation.zone] = animation.progress;
      this.updatePose();
    } else if (animation.kind === "cooling") {
      this.materials.forEach((material, index) => material.color.lerpColors(animation.colors[index], this.cooledColor, animation.progress));
    } else if (animation.kind === "under") {
      this.wood.position.x = animation.baseX + Math.sin(progress * Math.PI * 4) * (1 - progress) * 0.15;
    } else if (animation.kind === "over") {
      for (const fragment of this.fragments) {
        fragment.mesh.position.set(fragment.x + fragment.vx * progress, -progress * progress * 0.9, fragment.z + fragment.vz * progress);
        fragment.mesh.rotation.x = progress * 3;
      }
    }
    if (progress < 1) return;
    if (animation.kind === "over") {
      for (const fragment of this.fragments) this.wood.remove(fragment.mesh);
      this.fragments.length = 0;
    }
    if (animation.kind === "cooling") {
      this.animation = null;
      this.complete();
    } else if (animation.zone === 0) {
      this.animation = null;
      this.clamps.forEach((clamp) => { clamp.visible = true; });
      this.wireStrands.forEach((wire) => { wire.visible = true; });
      this.zone = 1;
      this.heat = 0;
      this.state = "ready";
      this.marker.visible = true;
      this.updatePose();
      this.emit();
    } else if (this.results.every((result) => result.kind === "success")) {
      this.state = "cooling";
      this.animation = { kind: "cooling", start: now, progress: 0, colors: this.materials.map((material) => material.color.clone()) };
      this.emit();
    } else {
      this.animation = null;
      this.complete();
    }
  }

  complete() {
    this.state = "done";
    this.marker.visible = false;
    this.emit();
    this.onComplete(this.snapshot());
  }

  dispose() {
    this.stopDrag();
    this.canvas.parentElement.classList.remove("heating");
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointercancel", this.onCancel);
    this.canvas.removeEventListener("lostpointercapture", this.onCancel);
    this.table.remove(this.wood, this.fire);
    const geometries = new Set([this.geometry]);
    const materials = new Set([this.charMaterial]);
    for (const group of [this.wood, this.fire]) {
      group.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) {
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
        }
      });
    }
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }
}
