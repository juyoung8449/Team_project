"use strict";

class ContinuationGame {
  constructor(workshop, onComplete) {
    this.workshop = workshop;
    this.onComplete = onComplete;
    this.panel = document.getElementById("continuation-panel");
    this.camera = workshop.camera;
    this.canvas = workshop.renderer.domElement;
    this.scene = workshop.scene;
    this.steps = [
      ["활 몸체 다듬기", "자귀로 활 몸체를 좌우로 문질러 매끄럽게 다듬어 봐!", "wipe_lr"],
      ["소힘줄에 풀 먹이기", "소힘줄을 위에서 아래로 쭉쭉 빗어 내려줘!", "comb_down"],
      ["소힘줄 붙이기", "풀 먹인 소힘줄을 활 안쪽 면을 따라 길게 붙여보자!", "curve_drag"],
      ["활 양끝 다듬기", "점선을 따라 활 양끝에 시위를 걸 홈을 파줘!", "cut_tip"],
      ["활 뒤집어 펴기", "지지대 끝을 15번 연속 톡톡 터치해 끈을 감아줘!", "spiral_wrap"],
      ["활시위 걸기", "한쪽에 걸린 시위를 반대편 끝까지 천천히 당겨 걸어봐!", "pull_string"],
      ["활 전체 다듬기", "거친 표면을 좌우로 문질러 윤기가 나게 마감하자!", "wipe_lr"],
      ["활시위 당겨보기", "마지막이야! 시위를 뒤로 쭉 당겨 탄성을 확인해 봐!", "draw_bow"]
    ];
    this.room = workshop.room;
    this.hwarang = workshop.hwarang;
    this.bow = new BowManager();
    this.bow.group.position.add(workshop.roomOffset);
    this.scene.add(this.bow.group);
    this.bow.group.visible = false;
    this.guide = new GestureGuide();
    this.guide.group.position.copy(workshop.roomOffset);
    this.scene.add(this.guide.group);
    this.guide.group.visible = false;
    this.outro = new Outro({
      scene: this.scene, camera: this.camera, canvas: this.canvas, hwarang: this.hwarang,
      bow: this.bow, workshop: this.room, guide: this.guide,
      ui: {
        setMode: (mode) => this.setMode(mode),
        setShots: (count) => { document.getElementById("arrows-left").textContent = count; },
        setPower: (value) => {
          const percent = Math.round(value * 100);
          document.getElementById("power-value").textContent = `${percent}%`;
          document.getElementById("power-meter").value = percent;
        },
        setDialogue: (text) => { document.getElementById("continuation-text").textContent = text; }
      }
    });
    document.getElementById("continuation-home").addEventListener("click", () => location.reload());
    document.getElementById("replay-game").addEventListener("click", () => location.reload());
    document.getElementById("retry-archery").addEventListener("click", () => this.outro.restart());
    document.getElementById("next-ceremony").addEventListener("click", () => this.outro.startCeremony());
    this.canvas.addEventListener("pointerdown", (event) => this.pointerStart(event));
    this.canvas.addEventListener("pointermove", (event) => this.pointerMove(event));
    this.canvas.addEventListener("pointerup", (event) => this.pointerEnd(event));
    this.canvas.addEventListener("pointercancel", () => this.cancelPointer());
    this.canvas.addEventListener("lostpointercapture", () => this.cancelPointer());
    window.addEventListener("blur", () => this.cancelPointer());
  }

  start() {
    this.active = true;
    this.workshop.continuationActive = true;
    this.workshop.transition = null;
    this.workshop.world.visible = false;
    this.bow.group.visible = true;
    this.scene.background = new THREE.Color("#e9d8bd");
    this.panel.hidden = false;
    this.workshop.onContinuationFrame = (time, delta) => this.update(time, delta);
    this.setStep(0);
  }

  setStep(index) {
    this.index = index;
    this.state = `STEP_${index + 1}`;
    this.pointerDown = false;
    this.awaitingIntro = true;
    this.guide.setInteracting(false);
    this.guide.playGesture(null);
    const [title, text, gesture] = this.steps[index];
    document.getElementById("continuation-step").textContent = `STEP ${String(index + 7).padStart(2, "0")} / 14`;
    document.getElementById("continuation-title").textContent = title;
    document.getElementById("continuation-text").textContent = text;
    document.getElementById("continuation-meter-label").textContent = index === 7 ? "활의 탄성" : index === 4 ? "끈 감기" : "제작 진행도";
    this.setProgress(0);
    stageUI.showIntro(index + 7, title, text, "", document.getElementById("continuation-dialogue"), () => {
      this.awaitingIntro = false;
      this.hwarang.setExpression(index === 2 || index === 4 || index >= 6 ? "happy" : "default");
      this.bow.setStep(this.state);
      this.guide.playGesture(gesture, this.state);
      this.moveCamera(new THREE.Vector3(0, 5.8, 11.8).add(this.workshop.roomOffset), new THREE.Vector3(0, 1.7, 0).add(this.workshop.roomOffset), 52, () => {
        this.cameraHold = this.workshop.clock.elapsedTime + 1;
      });
    });
  }

  moveCamera(position, target, fov, complete) {
    this.cameraHold = null;
    this.cameraMove = {
      start: this.workshop.clock.elapsedTime,
      from: this.camera.position.clone(), to: position,
      fromTarget: this.cameraTarget ? this.cameraTarget.clone() : this.workshop.cameraTarget.clone(),
      target, fromFov: this.camera.fov, fov, complete
    };
  }

  zoomToWork() {
    this.moveCamera(new THREE.Vector3(0, this.index === 3 || this.index === 4 ? 9.3 : 8.8, 7.5).add(this.workshop.roomOffset),
      new THREE.Vector3(0, 2.45, .2).add(this.workshop.roomOffset), 52);
  }

  setProgress(value) {
    const percent = Math.round(value * 100);
    document.getElementById("continuation-value").textContent = `${percent}%`;
    document.getElementById("continuation-meter").value = percent;
    stageUI.updateProgress(this.index + 7, this.index + 6, percent);
  }

  finishInteraction() {
    stageUI.showPraise(80);
    this.pointerDown = false;
    this.guide.playGesture(null);
    this.hwarang.setExpression("happy");
    this.moveCamera(new THREE.Vector3(0, 5.8, 11.8).add(this.workshop.roomOffset), new THREE.Vector3(0, 1.7, 0).add(this.workshop.roomOffset), 52);
    this.bow.startCutscene();
  }

  pointerStart(event) {
    if (!this.active || this.awaitingIntro || event.button !== 0 || !event.isPrimary) return;
    if (this.outro.phase !== "idle") {
      this.outro.pointerDown(event);
      return;
    }
    if (this.bow.cutscene || this.cameraMove) return;
    if (this.cameraHold) { this.zoomToWork(); return; }
    this.guide.setInteracting(true);
    const point = this.bow.pick(event, this.camera, this.canvas);
    if (this.state === "STEP_5") {
      const completed = this.bow.startInteraction(point);
      this.setProgress(this.bow.progress);
      if (completed) this.finishInteraction();
      return;
    }
    this.pointerDown = true;
    this.canvas.setPointerCapture(event.pointerId);
    this.bow.startInteraction(point);
  }

  pointerMove(event) {
    if (!this.active || this.awaitingIntro) return;
    if (this.outro.phase !== "idle") { this.outro.pointerMove(event); return; }
    if (!this.pointerDown || this.bow.cutscene) return;
    const completed = this.bow.moveInteraction(this.bow.pick(event, this.camera, this.canvas));
    this.setProgress(this.bow.progress);
    if (completed) this.finishInteraction();
  }

  pointerEnd(event) {
    if (!this.active || this.awaitingIntro) return;
    if (this.outro.phase !== "idle") {
      this.outro.pointerMove(event);
      this.outro.pointerUp();
    } else this.cancelPointer();
  }

  cancelPointer() {
    if (!this.active || this.awaitingIntro) return;
    if (this.outro.phase === "charging") this.outro.cancelCharge();
    else if (this.outro.phase === "idle") {
      this.pointerDown = false;
      this.bow.endInteraction();
      this.setProgress(this.bow.progress);
      if (!this.bow.cutscene) this.guide.setInteracting(false);
    }
  }

  setMode(mode) {
    document.getElementById("archery-ui").hidden = mode !== "archery";
    document.getElementById("outro-actions").hidden = mode !== "result";
    document.getElementById("final-actions").hidden = mode !== "finished";
    document.getElementById("continuation-progress").hidden = mode !== "craft";
    document.getElementById("continuation-dialogue").hidden = mode === "archery";
    stageUI.track.hidden = mode !== "craft";
    if (mode === "result" && this.outro.hitCount > 0) {
      stageUI.showPraise(this.outro.hitCount === 3 ? 100 : this.outro.hitCount === 2 ? 90 : 80);
    }
    if (mode !== "craft") {
      document.getElementById("continuation-step").textContent = mode === "archery" ? "활쏘기 체험" : "각궁 완성";
      document.getElementById("continuation-title").textContent = mode === "archery" ? "과녁을 맞혀 보자!" : mode === "result" ? "활쏘기 결과" : "화랑 입단식";
    }
    if (mode === "finished") this.onComplete();
  }

  update(time, delta) {
    if (this.outro.phase !== "idle") { this.outro.update(time, delta); return; }
    if (this.awaitingIntro) return;
    if (this.cameraHold && time >= this.cameraHold) this.zoomToWork();
    if (this.cameraMove) {
      const move = this.cameraMove;
      const progress = Math.min((time - move.start) / (this.workshop.reducedMotion.matches ? .01 : .65), 1);
      const eased = 1 - (1 - progress) ** 3;
      this.camera.position.lerpVectors(move.from, move.to, eased);
      this.cameraTarget = move.fromTarget.clone().lerp(move.target, eased);
      this.camera.fov = THREE.MathUtils.lerp(move.fromFov, move.fov, eased);
      this.camera.lookAt(this.cameraTarget);
      this.camera.updateProjectionMatrix();
      if (progress === 1) { this.cameraMove = null; if (move.complete) move.complete(); }
    }
    this.guide.update(time);
    if (this.bow.update(time, delta)) {
      if (this.index === 7) {
        this.cameraMove = null;
        this.outro.start();
      } else this.setStep(this.index + 1);
    }
  }
}
