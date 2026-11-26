import * as THREE from 'three';

const targetCenter = new THREE.Vector3(0, 2.45, -14);
const targetRadius = .55;

export class Outro {
class Outro {
  constructor({ scene, camera, canvas, hwarang, bow, workshop, guide, ui }) {
    Object.assign(this, { scene, camera, canvas, hwarang, bow, workshop, guide, ui });
    this.group = new THREE.Group(); this.group.name = '야외 활터'; scene.add(this.group); this.group.visible = false;
    this.cameraRig = new THREE.Group(); camera.add(this.cameraRig); scene.add(camera); this.cameraRig.visible = false;
    this.aim = new THREE.Vector3(); this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.shots = []; this.particles = []; this.phase = 'idle'; this.hitCount = 0; this.shotsLeft = 3;
    this.baseFov = camera.fov; this.aimFov = 34; this.aimZoom = 0; this.aimZoomTarget = 0;
    this.initialCharacterPosition = hwarang.group.position.clone(); this.initialCharacterRotation = hwarang.group.rotation.clone();
    this.buildRange(); this.buildEquipment(); this.buildBadges();
  }
  material(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: .8, ...extra }); }
  box(parent, size, position, color) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), this.material(color));
    mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  buildRange() {
    this.box(this.group, [60, .2, 60], [0, -.12, -12], '#8eaf72');
    this.box(this.group, [2.8, .03, 18], [0, .01, -6], '#cbb68b');
    for (const x of [-1.4, 1.4]) this.box(this.group, [.1, 4.3, .14], [x, 2.15, -14.2], '#744d35');
    const whiteBacking = new THREE.Mesh(new THREE.BoxGeometry(3.35, 4.35, .1), this.material('#f7f5ef', { roughness: .88 }));
    whiteBacking.position.set(0, 2.9, -14.16); whiteBacking.name = '과녁 흰색 배경판'; whiteBacking.castShadow = true; this.group.add(whiteBacking);
    const targetBoard = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.8, .12), this.material('#050505', { roughness: .95 }));
    targetBoard.position.set(0, targetCenter.y, -14); targetBoard.name = '검은 사각 과녁판'; targetBoard.castShadow = true; this.group.add(targetBoard);
    const redCenter = new THREE.Mesh(new THREE.CircleGeometry(targetRadius, 64), new THREE.MeshStandardMaterial({ color: '#f20b16', roughness: .72, side: THREE.DoubleSide }));
    redCenter.position.set(targetCenter.x, targetCenter.y, -13.93); redCenter.name = '과녁 빨간 중심'; this.group.add(redCenter);
    const topMarker = new THREE.Mesh(new THREE.BoxGeometry(2.8, .62, .12), this.material('#050505', { roughness: .95 }));
    topMarker.position.set(0, 4.55, -14); topMarker.name = '과녁 상단 검은 표식'; topMarker.castShadow = true; this.group.add(topMarker);
    for (let index = 0; index < 12; index++) {
      const side = index % 2 ? 1 : -1;
      const x = side * (4 + index % 3 * 1.7), z = -5 - index * 2.4;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.17, .24, 2, 8), this.material('#846044'));
      trunk.position.set(x, 1, z); trunk.castShadow = true; this.group.add(trunk);
      for (let layer = 0; layer < 3; layer++) {
        const crown = new THREE.Mesh(new THREE.SphereGeometry(.9 - layer * .12, 12, 9), this.material(layer === 1 ? '#749c69' : '#668c5d'));
        crown.position.set(x + (layer - 1) * .38, 2.2 + layer * .35, z); crown.castShadow = true; this.group.add(crown);
      }
    }
    const hills = new THREE.Mesh(new THREE.SphereGeometry(12, 32, 16), this.material('#adc599'));
    hills.scale.set(2.4, .18, .35); hills.position.set(0, -1.6, -29); this.group.add(hills);
  }
  buildEquipment() {
    this.equipment = new THREE.Group(); this.cameraRig.add(this.equipment); this.equipment.position.set(.56, -.5, -1.7); this.equipment.scale.setScalar(.27);
    this.playerBow = this.bow.bowGroup.clone(true); this.playerBow.position.set(0, 0, 0); this.playerBow.rotation.set(Math.PI / 2, 0, Math.PI / 2); this.equipment.add(this.playerBow);
    this.playerString = this.playerBow.children[2]; this.playerString.geometry = this.playerString.geometry.clone();
    this.loadedArrow = this.createArrow(); this.loadedArrow.scale.setScalar(.9); this.loadedArrow.position.set(-.3, .15, -.4); this.loadedArrow.rotation.x = .16; this.equipment.add(this.loadedArrow);
    const crossMaterial = new THREE.MeshBasicMaterial({ color: '#fff9e8', depthTest: false });
    this.reticle = new THREE.Group(); this.reticle.position.set(0, 0, -3); this.cameraRig.add(this.reticle);
    for (const rotation of [0, Math.PI / 2]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(.075, .006, .004), crossMaterial); bar.rotation.z = rotation; this.reticle.add(bar); }
    const centerRing = new THREE.Mesh(new THREE.TorusGeometry(.025, .004, 6, 20), crossMaterial);
    centerRing.position.z = -.003; this.reticle.add(centerRing);
    const centerDot = new THREE.Mesh(new THREE.CircleGeometry(.007, 12), crossMaterial);
    centerDot.position.z = -.005; this.reticle.add(centerDot);
    this.reticleMaterial = crossMaterial;
    this.reticle.visible = false;
    this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 14);
    this.aimPoint = new THREE.Vector3();
    this.reticleNdc = new THREE.Vector2();
    this.aimCentered = false;
  }
  createArrow() {
    const arrow = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.2, 8), this.material('#aa764b'));
    shaft.rotation.x = Math.PI / 2; arrow.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.055, .18, 8), this.material('#606b68', { metalness: .55 }));
    tip.rotation.x = -Math.PI / 2; tip.position.z = -.68; arrow.add(tip);
    for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
      const feather = new THREE.Mesh(new THREE.BoxGeometry(.15, .015, .27), this.material('#f0e2c6'));
      feather.position.z = .48; feather.rotation.z = angle; arrow.add(feather);
    }
    arrow.name = '화살'; return arrow;
  }
  updateString(draw) {
    const points = [new THREE.Vector3(-1.8, .03, .35), new THREE.Vector3(0, .03, .35 + draw * .8), new THREE.Vector3(1.8, .03, .35)];
    const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, .016, 6, false);
    this.playerString.geometry.dispose(); this.playerString.geometry = geometry;
  }
  buildBadges() {
    this.badges = new THREE.Group(); this.cameraRig.add(this.badges); this.badges.visible = false;
    this.medals = ['각궁 만들기', '활쏘기'].map((label, index) => {
      const group = new THREE.Group(); group.name = label + ' 훈장'; group.position.set(index === 0 ? -.53 : .53, -.27, -3); this.badges.add(group);
      const gold = this.material('#d5a545', { metalness: .65, roughness: .3 });
      const goldLight = this.material('#f2d783', { metalness: .55, roughness: .32 });
      const nameplate = new THREE.Mesh(new THREE.BoxGeometry(.78, .18, .07), gold); nameplate.position.y = .58; group.add(nameplate);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(.70, .12, .012), goldLight); panel.position.set(0, .58, .043); group.add(panel);
      const ribbonColor = index === 0 ? '#2f875b' : '#e6803c';
      const ribbonShape = new THREE.Shape(); ribbonShape.moveTo(-.31,.48); ribbonShape.lineTo(.31,.48); ribbonShape.lineTo(.31,-.02); ribbonShape.lineTo(0,-.22); ribbonShape.lineTo(-.31,-.02); ribbonShape.closePath();
      const ribbon = new THREE.Mesh(new THREE.ExtrudeGeometry(ribbonShape,{depth:.035,bevelEnabled:false}), this.material(ribbonColor)); ribbon.position.z = -.02; group.add(ribbon);
      for (const x of [-.18, -.03, .12]) {
        const stripeShape = new THREE.Shape(); const left = x, right = x + .06;
        const bottom = value => -.22 + Math.abs(value) * (.2 / .31);
        stripeShape.moveTo(left,.48); stripeShape.lineTo(right,.48); stripeShape.lineTo(right,bottom(right));
        if (left < 0 && right > 0) stripeShape.lineTo(0,-.22);
        stripeShape.lineTo(left,bottom(left)); stripeShape.closePath();
        const stripe = new THREE.Mesh(new THREE.ShapeGeometry(stripeShape), this.material('#fff9ec')); stripe.position.z = .017; group.add(stripe);
      }
      const loop = new THREE.Mesh(new THREE.TorusGeometry(.085,.02,8,24),gold); loop.position.set(0,-.25,.04); group.add(loop);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.075,48),gold); rim.rotation.x = Math.PI/2; rim.position.y = -.55; group.add(rim);
      const face = new THREE.Mesh(new THREE.CircleGeometry(.225,48),goldLight); face.position.set(0,-.55,.041); group.add(face);
      const emboss = new THREE.Mesh(new THREE.TorusGeometry(.19,.012,8,48),gold); emboss.position.set(0,-.55,.052); group.add(emboss);
      const symbol = new THREE.Mesh(new THREE.TorusGeometry(.11,.018,8,24,Math.PI),gold); symbol.rotation.z = Math.PI/2; symbol.position.set(0,-.55,.057); group.add(symbol);
      const string = new THREE.Mesh(new THREE.BoxGeometry(.008,.20,.01),gold); string.position.set(.03,-.55,.06); group.add(string);
      const labelCanvas = document.createElement('canvas'); labelCanvas.width = 512; labelCanvas.height = 128;
      const context = labelCanvas.getContext('2d'); context.fillStyle = '#533b2a'; context.font = 'bold 52px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(label, 256, 64);
      const texture = new THREE.CanvasTexture(labelCanvas); texture.colorSpace = THREE.SRGBColorSpace;
      const text = new THREE.Mesh(new THREE.PlaneGeometry(.68, .14), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })); text.position.set(0, .58, .052); group.add(text);
      group.scale.setScalar(.001); return group;
    });
  }
  start() {
    this.workshop.visible = false; this.bow.group.visible = false; this.guide.group.visible = false;
    this.baseFov = this.camera.fov;
    this.aimFov = Math.min(26, this.baseFov * .52);
    this.scene.background = new THREE.Color('#b7d8df'); this.scene.fog = new THREE.Fog('#b7d8df', 28, 55);
    this.group.visible = true; this.cameraRig.visible = true; this.ui.setMode('archery'); this.restart();
  }
  restart() {
    this.phase = 'aim'; this.hitCount = 0; this.shotsLeft = 3; this.charge = 0; this.flight = null; this.aim.set(0, 0, 0);
    for (const arrow of this.shots) {
      this.group.remove(arrow);
      arrow.traverse(object => { if (object.isMesh) { object.geometry.dispose(); object.material.dispose(); } });
    }
    this.shots = []; this.pointer.set(0, 0); this.reticle.position.set(0, 0, -3); this.loadedArrow.position.z = -.4; this.updateString(0);
    this.badges.visible = false; this.equipment.visible = true; this.reticle.visible = false; this.loadedArrow.visible = true;
    this.equipment.rotation.set(0, 0, 0); this.equipment.scale.setScalar(.27);
    this.aimZoom = 0; this.aimZoomTarget = 0; this.camera.fov = this.baseFov; this.camera.updateProjectionMatrix();
    this.pointerDownAt = 0;
    this.hwarang.group.visible = false; this.hwarang.leftArm.rotation.z = 0; this.camera.position.set(0, 2.2, 7); this.camera.lookAt(targetCenter); this.camera.updateMatrixWorld();
    this.ui.setMode('archery'); this.ui.setShots(this.shotsLeft); this.ui.setPower(0); this.ui.setDialogue('과녁을 조준하고 알맞은 힘으로 시위를 놓아봐!');
  }
  pointerMove(event) {
    if (this.phase !== 'aim' && this.phase !== 'charging') return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.aim.set(this.pointer.x, this.pointer.y, 0);
    this.placeReticleAtPointer();
    const yaw = THREE.MathUtils.clamp(this.pointer.x * .22, -.22, .22);
    const pitch = THREE.MathUtils.clamp(-this.pointer.y * .16, -.16, .16);
    this.equipment.rotation.y = yaw;
    this.equipment.rotation.x = pitch;
  }
  placeReticleAtPointer() {
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 3;
    this.reticle.position.set(this.pointer.x * this.camera.aspect * halfHeight, this.pointer.y * halfHeight, -3);
    this.reticleBase = this.reticle.position.clone();
  }
  pointerDown(event) {
    if (this.phase !== 'aim' || event.button !== 0) return;
    this.pointerMove(event);
    this.phase = 'charging'; this.charge = 0; this.pointerDownAt = performance.now();
    this.aimZoomTarget = 1; this.reticle.visible = true; this.canvas.setPointerCapture(event.pointerId);
  }
  pointerUp() {
    if (this.phase !== 'charging') return;
    this.updateAimPoint();
    const destination = this.aimPoint.clone();
    const validPower = this.charge >= .55 && this.charge <= .85;
    const arrow = this.createArrow();
    const start = new THREE.Vector3(); this.loadedArrow.getWorldPosition(start); this.group.add(arrow); arrow.position.copy(start);
    let duration = .85;
    if (this.charge < .55) {
      destination.set(start.x + this.pointer.x * .35, .08, start.z - 2.2);
      duration = .62;
    } else if (this.charge > .85) {
      const direction = this.shotsLeft % 2 === 0 ? 1 : -1;
      destination.x += direction * 1.9;
      destination.y += 1.35;
      duration = .72;
    }
    this.flight = { arrow, start, destination, elapsed: 0, duration, validPower };
    this.shots.push(arrow); this.shotsLeft--; this.ui.setShots(this.shotsLeft); this.loadedArrow.visible = false; this.phase = 'flight';
    this.reticle.visible = false;
    if (!validPower) this.ui.setPower(this.charge);
  }
  updateAimPoint() {
    this.camera.updateMatrixWorld(true);
    const worldPosition = new THREE.Vector3();
    this.reticle.getWorldPosition(worldPosition);
    worldPosition.project(this.camera);
    this.reticleNdc.set(worldPosition.x, worldPosition.y);
    this.raycaster.setFromCamera(this.reticleNdc, this.camera);
    return this.raycaster.ray.intersectPlane(this.aimPlane, this.aimPoint);
  }
  cancelCharge() {
    if (this.phase !== 'charging') return;
    this.phase = 'aim'; this.charge = 0; this.aimZoomTarget = 0; this.reticle.visible = false;
    this.loadedArrow.position.z = -.4; this.updateString(0); this.ui.setPower(0);
  }
  showResult() {
    this.phase = 'result'; this.equipment.visible = false; this.reticle.visible = false;
    this.hwarang.group.visible = true; this.hwarang.leftArm.rotation.z = 0; this.hwarang.group.position.set(0, 0, -7); this.hwarang.group.rotation.set(0, 0, 0);
    this.camera.position.set(0, 2.7, -1.2); this.camera.lookAt(0, 2.5, -7); this.camera.updateMatrixWorld();
    const results = [
      ['sad', '다시 한번 더?'],
      ['default', '80점! 조금만 더 연습하면 명궁이 되겠어!'],
      ['happy', '90점! 정말 훌륭한 솜씨야!'],
      ['happy', '100점! 축하해!!!']
    ];
    this.hwarang.setExpression(results[this.hitCount][0]); this.ui.setDialogue(results[this.hitCount][1]); this.ui.setMode('result');
  }
  startCeremony() {
    this.phase = 'ceremony'; this.ceremonyTime = 0; this.hwarang.setExpression('happy');
    this.ceremonyFinished = false;
    this.medalSoundPlayed = [false, false];
    try { const AudioContext = window.AudioContext || window.webkitAudioContext; if (AudioContext) { this.audioContext = this.audioContext || new AudioContext(); this.audioContext.resume().catch(() => {}); } } catch { this.audioContext = null; }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioContext = this.audioContext || new AudioContext();
        this.audioContext.resume().catch(error => console.warn('입단식 효과음을 재생할 수 없습니다:', error));
      }
    } catch (error) {
      console.warn('입단식 효과음을 준비할 수 없습니다:', error);
      this.audioContext = null;
    }
    this.badges.visible = true; for (const medal of this.medals) medal.scale.setScalar(.001);
    this.ui.setMode('ceremony'); this.ui.setDialogue('너 오늘 정말 멋졌어. 각궁 만들기를 마스터 하다니 대단해. 이제부터 너를 우리의 화랑에 입단시켜주겠다 하하하 축하한다!');
  }
  playMedalSound() {
    if (!this.audioContext || this.audioContext.state !== 'running') return;
    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator(); const volume = this.audioContext.createGain();
    oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(740, now); oscillator.frequency.exponentialRampToValueAtTime(260, now + .16);
    volume.gain.setValueAtTime(.12, now); volume.gain.exponentialRampToValueAtTime(.001, now + .24);
    oscillator.connect(volume); volume.connect(this.audioContext.destination); oscillator.start(now); oscillator.stop(now + .25);
  }
  update(time, delta) {
    if (this.phase === 'idle') return;
    if (this.phase === 'aim' || this.phase === 'charging') {
      this.aimZoom += (this.aimZoomTarget - this.aimZoom) * Math.min(1, delta * 5.5);
      const zoom = this.aimZoom;
      this.equipment.position.set(
        THREE.MathUtils.lerp(.56, .12, zoom) + Math.sin(time * 1.4) * .015,
        THREE.MathUtils.lerp(-.5, -.08, zoom) + Math.sin(time * 1.9) * .012,
        THREE.MathUtils.lerp(-1.7, -1.4, zoom)
      );
      this.equipment.scale.setScalar(THREE.MathUtils.lerp(.27, .48, zoom));
      this.loadedArrow.position.x = THREE.MathUtils.lerp(-.3, -.285, zoom);
      this.loadedArrow.position.y = THREE.MathUtils.lerp(.15, .12, zoom);
      this.loadedArrow.scale.setScalar(THREE.MathUtils.lerp(.9, 1.4, zoom));
      this.camera.fov = THREE.MathUtils.lerp(this.baseFov, this.aimFov, zoom);
      this.camera.updateProjectionMatrix();
      if (this.phase === 'charging') {
        this.placeReticleAtPointer();
        this.charge = Math.min(1, this.charge + delta * .42); this.ui.setPower(this.charge);
        this.loadedArrow.position.z = -.4 + this.charge * .6; this.updateString(this.charge);
        const swayX = Math.sin(time * 2.1) * .006;
        const swayY = Math.sin(time * 1.6) * .009;
        this.reticle.position.set(this.reticleBase.x + swayX, this.reticleBase.y + swayY, -3);
        if (this.updateAimPoint()) {
          this.aimCentered = Math.hypot(this.aimPoint.x - targetCenter.x, this.aimPoint.y - targetCenter.y) <= targetRadius;
          this.reticleMaterial.color.set(this.aimCentered ? '#8fe0a1' : '#fff9e8');
        }
      }
    }
    if (this.phase === 'flight') {
      const flight = this.flight; flight.elapsed += delta; const t = Math.min(1, flight.elapsed / flight.duration);
      flight.arrow.position.lerpVectors(flight.start, flight.destination, t); flight.arrow.position.y += Math.sin(Math.PI * t) * 1.3;
      const direction = flight.destination.clone().sub(flight.start); direction.y += Math.cos(Math.PI * t) * 1.3 * Math.PI; flight.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction.normalize());
      if (t >= 1) {
        if (flight.validPower && Math.hypot(flight.destination.x - targetCenter.x, flight.destination.y - targetCenter.y) <= targetRadius) this.hitCount++;
        this.flight = null; this.charge = 0; this.aimZoomTarget = 0; this.ui.setPower(0); this.updateString(0); this.loadedArrow.position.z = -.4;
        if (this.shotsLeft === 0) this.showResult(); else { this.phase = 'aim'; this.loadedArrow.visible = true; }
      }
    }
    if (this.phase === 'result') {
      if (this.hitCount === 3) { this.hwarang.body.position.y = .8 + Math.max(0, Math.sin(time * 5)) * .2; this.hwarang.leftArm.rotation.z = 2.5; this.hwarang.rightArm.rotation.z = -2.5; }
      if (this.hitCount === 0) this.hwarang.head.rotation.x = .28;
    }
    if (this.phase === 'ceremony') {
      this.ceremonyTime += delta; this.hwarang.rightArm.rotation.z = -2.2 + Math.sin(time * 6) * .3;
      const badgeScale = Math.min(1, this.camera.aspect / .8);
      this.badges.scale.set(badgeScale, badgeScale, 1);
      this.medals.forEach((medal, index) => {
        const t = this.ceremonyTime - .5 - index * .85;
        if (t > 0) { if (!this.medalSoundPlayed[index]) { this.medalSoundPlayed[index] = true; this.playMedalSound(); } const scale = Math.min(1, t * 5) * (1 + Math.exp(-t * 5) * Math.sin(t * 18) * .45); medal.scale.setScalar(scale); }
      });
      if (this.ceremonyTime >= 4 && !this.ceremonyFinished) { this.ceremonyFinished = true; this.ui.setMode('finished'); }
      if (this.ceremonyTime < 4 && Math.random() < delta * 30) {
        const particle = new THREE.Mesh(new THREE.OctahedronGeometry(.025), new THREE.MeshBasicMaterial({ color: ['#f3c65e', '#e77d60', '#b6d59c'][Math.floor(Math.random() * 3)] }));
        particle.position.set((Math.random() - .5) * 2, .7, -3); this.cameraRig.add(particle); this.particles.push({ mesh: particle, life: 0, speed: .3 + Math.random() * .5 });
      }
      for (let index = this.particles.length - 1; index >= 0; index--) { const particle = this.particles[index]; particle.life += delta; particle.mesh.position.y -= particle.speed * delta; particle.mesh.rotation.z += delta * 2; if (particle.life > 2.5) { this.cameraRig.remove(particle.mesh); particle.mesh.geometry.dispose(); particle.mesh.material.dispose(); this.particles.splice(index, 1); } }
    }
  }
  stop() {
    this.phase = 'idle'; this.group.visible = false; this.cameraRig.visible = false; this.workshop.visible = true; this.bow.group.visible = true; this.hwarang.group.visible = true;
    this.hwarang.group.position.copy(this.initialCharacterPosition); this.hwarang.group.rotation.copy(this.initialCharacterRotation); this.hwarang.leftArm.rotation.z = 0;
    this.aimZoom = 0; this.aimZoomTarget = 0; this.camera.fov = this.baseFov; this.camera.updateProjectionMatrix();
    this.scene.background = new THREE.Color('#e9d8bd'); this.scene.fog = new THREE.Fog('#e9d8bd', 12, 27); this.ui.setMode('craft');
  }
}

export function startOutro(outro) { outro.start(); }
}
