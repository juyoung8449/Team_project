"use strict";

// 미니게임과 화면 연출이 공유하는 상태입니다. Three.js나 화면 요소에 의존하지 않습니다.
class GameSession {
  constructor(onChange = () => {}) {
    this.onChange = onChange;
    this.reset();
  }

  reset() {
    this.phase = "intro";
    this.stage = 1;
    this.completedStages = 0;
    this.notify();
  }

  start() {
    if (this.phase !== "intro") throw new Error("인트로에서만 게임을 시작할 수 있습니다.");
    this.stage = 1;
    this.completedStages = 0;
    this.phase = "transition";
    this.notify();
  }

  enterStage() {
    if (this.phase !== "transition") throw new Error("화면 전환 중에만 단계에 들어갈 수 있습니다.");
    this.phase = "stage";
    this.notify();
  }

  resetAttempt() {
    if (this.phase !== "stage") throw new Error("플레이 중에만 다시 도전할 수 있습니다.");
    this.notify();
  }

  finishStage(passed) {
    if (this.phase !== "stage") throw new Error("플레이 중에만 단계를 완료할 수 있습니다.");
    if (typeof passed !== "boolean") throw new TypeError("단계 통과 여부는 불리언이어야 합니다.");
    if (!passed) {
      this.phase = "gameover";
    } else {
      this.completedStages = this.stage;
      // 아직 구현되지 않은 7단계로 넘어가지 않고 6단계 완료 화면에 머뭅니다.
      if (this.stage === 6) this.phase = "awaiting-next-stage";
      else this.stage += 1;
    }
    this.notify();
  }

  snapshot() {
    return { phase: this.phase, stage: this.stage, completedStages: this.completedStages };
  }

  notify() { this.onChange(this.snapshot()); }
}
