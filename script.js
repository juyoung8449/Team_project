"use strict";

const introPanel = document.getElementById("intro-panel");
const stagePanel = document.getElementById("stage-panel");
const startButton = document.getElementById("start-button");
const backButton = document.getElementById("back-button");
const retryButton = document.getElementById("retry-button");
const finishButton = document.getElementById("finish-button");
const stageTitle = document.getElementById("stage-title");
const stageDescription = document.getElementById("stage-description");
const speech = document.getElementById("speech");
const errorMessage = document.getElementById("loading-error");
const resultDialog = document.getElementById("result-dialog");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const helpButton = document.getElementById("help-button");
const helpPanel = document.getElementById("help-panel");
const tutorialHand = document.getElementById("tutorial-hand");
const stageProgressItems = document.querySelectorAll(".stage-progress-item");
const rotationSlider = document.getElementById("rotation-slider");
const rotationValue = document.getElementById("rotation-value");
const rotationName = document.getElementById("rotation-name");
const bendingControls = document.getElementById("bending-controls");
const bendingActions = document.getElementById("bending-actions");
const bendingRetry = document.getElementById("bending-retry");
const heatFinish = document.getElementById("heat-finish");
const bendingFinish = document.getElementById("bending-finish");
const woodActions = document.getElementById("wood-actions");
const woodRetry = document.getElementById("wood-retry");
const woodFinish = document.getElementById("wood-finish");
const resultButton = document.getElementById("result-button");
const assemblyInfo = document.getElementById("assembly-info");
const assemblyActions = document.getElementById("assembly-actions");
const assemblyRetry = document.getElementById("assembly-retry");
const assemblyStart = document.getElementById("assembly-start");
const glueInfo = document.getElementById("glue-info");
const glueChoices = document.getElementById("glue-choices");
const glueActions = document.getElementById("glue-actions");
const glueFinish = document.getElementById("glue-finish");
const windingInfo = document.getElementById("winding-info");
const windingPad = document.getElementById("winding-pad");
const windingActions = document.getElementById("winding-actions");
const windingRetry = document.getElementById("winding-retry");
const windingFinish = document.getElementById("winding-finish");

let workshop;
let bending;
let woodwork;
let assembly;
let glue;
let winding;
const game = new GameSession(updateStatus);
let pendingBendingRetry = false;
let pendingAssemblySuccess = false;
let pendingWindingSuccess = false;
let nextButtonPressed = false;
let tutorialKey = null;
let tutorialDismissed = false;
let tutorialStart = 0;

function updateStatus(state) {
  updateStageProgress(state);
  document.getElementById("stage-step").textContent = `STEP ${String(state.stage).padStart(2, "0")}`;
  const canPlay = state.phase === "stage" && state.stage === 1;
  const canBend = state.phase === "stage" && state.stage === 2;
  const canSaw = state.phase === "stage" && state.stage === 3;
  const canAssemble = state.phase === "stage" && state.stage === 4;
  const canGlue = state.phase === "stage" && state.stage === 5;
  const canWind = state.phase === "stage" && state.stage === 6;
  stagePanel.classList.toggle("bending", canBend);
  retryButton.disabled = !canPlay;
  finishButton.disabled = !canPlay || !workshop || !workshop.carving || !workshop.carvingResult().passed;
  rotationSlider.disabled = !canPlay && !(canSaw && woodwork && woodwork.active);
  rotationName.textContent = canSaw ? "재단물 회전" : "대나무 회전";
  rotationSlider.setAttribute("aria-label", canSaw ? "재단물 회전 각도" : "대나무 회전 각도");
  document.getElementById("stage-info").hidden = !canPlay && !(canSaw && woodwork);
  document.getElementById("carving-actions").hidden = !canPlay;
  bendingControls.hidden = !canBend || !bending;
  bendingActions.hidden = !canBend || !bending;
  woodActions.hidden = !canSaw || !woodwork;
  woodRetry.disabled = !canSaw || !woodwork || !woodwork.active;
  woodFinish.disabled = !canSaw || !woodwork || !woodwork.active || !woodwork.result().passed;
  assemblyInfo.hidden = !canAssemble || !assembly;
  assemblyActions.hidden = !canAssemble || !assembly;
  glueInfo.hidden = !canGlue || !glue || !["painting", "finishing", "done"].includes(glue.state);
  glueChoices.hidden = !canGlue || !glue || glue.state !== "choosing";
  glueActions.hidden = !canGlue;
  glueFinish.disabled = !canGlue || !glue || glue.state !== "done";
  windingInfo.hidden = !canWind || !winding;
  windingActions.hidden = !canWind || !winding;
  windingPad.hidden = !canWind || !winding || !["ready", "running"].includes(winding.state);
  document.getElementById("heat-rules").hidden = !canBend;
  document.getElementById("winding-status").hidden = !canWind;
  document.getElementById("stage-rule-text").textContent = state.stage === 1
    ? `양쪽 가이드선을 각각 ${MIN_TRACE_RATIO * 100}% 이상 따라 그리고 정확도 ${MIN_TRACE_ACCURACY * 100}% 이상을 달성하세요.`
    : state.stage === 2 ? `불 위에서 대나무를 계속 움직여 양쪽을 각각 ${HEAT_MIN_SECONDS}~${HEAT_MAX_SUCCESS_SECONDS}초 가열하세요. 멈추면 시간이 멈춥니다.`
      : state.stage === 3 ? `가이드 바깥을 넓게 잘라 ${WOOD_CUT_TARGET * 100}% 이상 제거하세요. 가이드 안쪽은 보호됩니다.`
        : state.stage === 4 ? `${ASSEMBLY_SECONDS}초 안에 ${ASSEMBLY_TARGET}번 터치하세요.`
          : state.stage === 5 ? "각궁 제작에 알맞은 접착제를 고르고 두 부품을 충분히 칠하세요."
            : `한 방향으로 ${WIND_TURNS}바퀴를 ${WIND_SECONDS}초 안에 감으세요.`;
  if (canPlay && workshop) updateCarvingStatus();
  if (canBend && bending) updateBendingStatus(bending.snapshot());
  if (canSaw && woodwork) updateWoodStatus(woodwork.result());
  if (state.phase === "gameover") {
    stageTitle.textContent = "게임 오버";
    stageDescription.textContent = "게임 오버! 처음부터 다시 도전해 보세요.";
  } else if (state.phase === "awaiting-next-stage") {
    stageTitle.textContent = "밧줄 감기 완료!";
    stageDescription.textContent = "6단계를 완료했어요. 다음 단계는 준비 중이에요.";
  } else if (state.phase === "complete") {
    stageTitle.textContent = "모든 단계 완료!";
    stageDescription.textContent = "다섯 단계를 모두 통과했어요!";
  } else if (state.stage === 2) {
    stageTitle.textContent = "대나무 열 성형";
    stageDescription.textContent = `불 위에서 대나무를 움직이다가 ${HEAT_MIN_SECONDS}~${HEAT_MAX_SUCCESS_SECONDS}초에 불에서 떼세요.`;
  } else if (state.stage === 3) {
    stageTitle.textContent = "물소뿔 다듬기";
    stageDescription.textContent = "가이드 바깥을 넓게 잘라 양끝을 뾰족하게 다듬으세요!";
  } else if (state.stage === 4) {
    stageTitle.textContent = "상목과 대나무 결합";
    stageDescription.textContent = `${ASSEMBLY_SECONDS}초 안에 화면을 ${ASSEMBLY_TARGET}번 이상 터치해서 두 부품을 단단히 끼워 맞추세요!`;
  } else if (state.stage === 5) {
    stageTitle.textContent = "사포질과 천연 풀칠";
    stageDescription.textContent = !glue || glue.state === "untying"
      ? "묶인 끈을 풀고 있어요."
      : glue.state === "sanding" ? "사포로 뿔·목재 부품을 매끄럽게 다듬고 있어요."
        : glue.state === "choosing" || glue.state === "failed"
          ? "세 가지 접착제 중 각궁 제작에 알맞은 것을 골라 보세요."
          : glue.state === "done" ? "풀칠을 마쳤어요. 완료를 눌러 다음 단계로 이동하세요."
            : glue.state === "finishing" ? "풀칠한 부품에 광택을 더하고 있어요."
              : "정답! 튼튼한 황토색 부레풀을 골랐어요! 붓을 드래그해 두 부품에 풀을 칠하세요.";
  } else if (state.stage === 6) {
    stageTitle.textContent = "적층 결합 · 밧줄 감기";
    stageDescription.textContent = "가이드 원을 따라 빙글빙글 원을 그리며 대나무와 뿔이 겹친 부분을 촘촘하게 감아주세요!";
  } else {
    stageTitle.textContent = "대나무 자르기 · 다듬기";
    stageDescription.textContent = "대나무 양쪽 가이드선을 따라 끝까지 드래그해 외곽선을 따세요.";
  }
}

function updateStageProgress(state, currentProgress = 0, currentComplete = false) {
  stageProgressItems.forEach((item, index) => {
    const completed = index < state.completedStages;
    const current = state.phase === "stage" && index === state.stage - 1;
    const value = completed ? 100 : current ? Math.max(0, Math.min(currentComplete ? 100 : 99, Math.floor(currentProgress))) : 0;
    item.style.setProperty("--fill", `${value}%`);
    item.setAttribute("aria-valuenow", String(value));
    if (current) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
}

function updateBendingStatus(state) {
  if (game.snapshot().phase !== "stage" || game.snapshot().stage !== 2) return;
  document.getElementById("heat-zone").textContent = state.zone === 0 ? "상단 가열" : "하단 가열";
  const displayHeat = (state.heat > HEAT_MAX_SUCCESS_SECONDS ? Math.ceil(state.heat * 10) : Math.floor(state.heat * 10)) / 10;
  document.getElementById("heat-time").textContent = `${displayHeat.toFixed(1)}초`;
  const progress = document.getElementById("heat-progress");
  progress.style.setProperty("--success-start", `${HEAT_MIN_SECONDS / HEAT_LIMIT_SECONDS * 100}%`);
  progress.style.setProperty("--success-width", `${(HEAT_MAX_SUCCESS_SECONDS - HEAT_MIN_SECONDS) / HEAT_LIMIT_SECONDS * 100}%`);
  progress.style.setProperty("--heat-position", `${state.heat / HEAT_LIMIT_SECONDS * 100}%`);
  progress.setAttribute("aria-valuenow", state.heat.toFixed(3));
  progress.setAttribute("aria-valuetext", `${displayHeat.toFixed(1)}초 / ${HEAT_LIMIT_SECONDS}초, 성공 구간 ${HEAT_MIN_SECONDS}~${HEAT_MAX_SUCCESS_SECONDS}초`);
  const completedZones = state.results.filter((result) => result && result.kind === "success").length;
  const currentZone = state.results[state.zone] ? 0 : state.heat / HEAT_LIMIT_SECONDS;
  const completed = state.state === "done" && completedZones === 2;
  updateStageProgress(game.snapshot(), (completedZones + currentZone) * 50, completed);
  const status = state.heat < HEAT_MIN_SECONDS ? "가열 미달" : state.heat <= HEAT_MAX_SUCCESS_SECONDS ? "적정 가열" : "과열";
  const message = state.state === "waiting" ? "작업대를 준비하고 있어요."
    : state.state === "animating" ? "결과를 확인하고 있어요."
      : state.state === "cooling" ? "대나무를 식히고 있어요."
        : state.state === "done" ? completed ? "열 성형 완료 · 완료를 눌러 다음 단계로 이동하세요." : "다시하기를 눌러 재도전하세요."
          : `${status} · ${state.inHeat ? "불 위에서 움직이기 · 떼면 판정" : "불 가까이로 이동"}`;
  document.getElementById("heat-status").textContent = message;
  const labels = { success: "적정", under: "미달", over: "과열" };
  document.getElementById("heat-results").textContent = state.results.map((result, index) =>
    `${index === 0 ? "상단" : "하단"}: ${result ? labels[result.kind] : "대기"}`).join(" · ");
  heatFinish.disabled = state.state !== "ready";
  bendingFinish.disabled = !completed;
  bendingRetry.disabled = state.state === "waiting";
}

function startBending() {
  workshop.strip.visible = false;
  bending = new BambooBendingGame(workshop, updateBendingStatus, finishBending);
  workshop.bending = bending;
  document.getElementById("heat-rules").textContent = `${HEAT_MIN_SECONDS}초 미만 미달 · ${HEAT_MIN_SECONDS}~${HEAT_MAX_SUCCESS_SECONDS}초 성공 · ${HEAT_MAX_SUCCESS_SECONDS}초 초과 실패 (최대 ${HEAT_LIMIT_SECONDS}초)`;
  updateStatus(game.snapshot());
  focusBending();
}

function focusBending() {
  workshop.character.visible = false;
  workshop.moveCameraTo(new THREE.Vector3(1.15, 3.1, 2.3), new THREE.Vector3(1.15, 1.3, 0.25), () => {
    bending.activate();
    stageTitle.focus({ preventScroll: true });
  });
}

function finishBending(result) {
  const passed = result.results.every((item) => item && item.kind === "success");
  if (passed) {
    updateBendingStatus(result);
    return;
  }
  const labels = { success: "적정", under: "가열 미달", over: "과열" };
  const details = result.results.map((item, index) => `${index === 0 ? "상단" : "하단"} ${item ? `${labels[item.kind]} (${item.seconds.toFixed(1)}초)` : "대기"}`).join(", ");
  document.getElementById("result-title").textContent = "열 성형 실패";
  document.getElementById("result-message").textContent = `${details}. 양쪽 모두 적정 가열이 필요해요. 2단계부터 다시 도전해 주세요.`;
  pendingBendingRetry = true;
  resultButton.textContent = "2단계 다시하기";
  showResult();
}

function startWoodwork() {
  workshop.character.visible = false;
  bending.fire.visible = false;
  bending.wood.visible = false;
  rotationSlider.value = "0";
  rotationValue.textContent = "0°";
  woodwork = new WoodworkGame(workshop, bending, updateWoodStatus);
  workshop.woodwork = woodwork;
  updateStatus(game.snapshot());
  workshop.moveCamera(true, () => {
    woodwork.activate();
    updateStatus(game.snapshot());
    stageTitle.focus({ preventScroll: true });
  });
}

function updateWoodStatus(result) {
  const state = game.snapshot();
  if (state.phase !== "stage" || state.stage !== 3) return;
  updateStageProgress(state, result.progress, result.passed);
  document.getElementById("trim-progress").textContent = `바깥 재단 ${Math.floor(result.coverage * 100)}% · 목표 ${WOOD_CUT_TARGET * 100}%`;
  woodFinish.disabled = !result.passed || !woodwork || !woodwork.active;
}

function finishWoodwork() {
  if (!woodwork || !woodwork.active || !woodwork.result().passed) return;
  woodwork.stop();
  updateStatus(game.snapshot());
  woodActions.hidden = true;
  workshop.moveCameraTo(new THREE.Vector3(1.45, 3.8, 2.5), new THREE.Vector3(1.45, 1.15, -0.3), () => {
    woodwork.unfold(() => {
      game.finishStage(true);
      startAssembly();
    });
  });
}

function updateAssemblyStatus(state) {
  if (game.snapshot().phase !== "stage" || game.snapshot().stage !== 4) return;
  const remaining = Math.ceil(state.remaining * 10) / 10;
  const timeText = state.state === "sanding" ? "준비 중" : `${remaining.toFixed(1)}초`;
  const countText = state.state === "sanding" ? "사포질 중" : `${state.count} / ${ASSEMBLY_TARGET}회`;
  const time = document.getElementById("assembly-time");
  const count = document.getElementById("assembly-count");
  if (time.textContent !== timeText) time.textContent = timeText;
  if (count.textContent !== countText) count.textContent = countText;
  const progress = document.getElementById("assembly-progress");
  if (progress.max !== ASSEMBLY_TARGET) progress.max = ASSEMBLY_TARGET;
  if (progress.value !== state.count) progress.value = state.count;
  const waiting = state.state === "waiting";
  const animating = state.state === "sanding" || state.state === "tying" || state.state === "failing";
  if (assemblyStart.disabled === waiting) assemblyStart.disabled = !waiting;
  if (assemblyRetry.disabled !== animating) assemblyRetry.disabled = animating;
}

function startAssembly() {
  workshop.character.visible = false;
  game.resetAttempt();
  assembly = new AssemblyGame(workshop, woodwork, bending, updateAssemblyStatus, finishAssembly);
  workshop.assembly = assembly;
  updateStatus(game.snapshot());
  stageTitle.focus({ preventScroll: true });
}

function finishAssembly(passed) {
  if (passed) {
    pendingAssemblySuccess = true;
    document.getElementById("result-title").textContent = "부품 결합 완료!";
    document.getElementById("result-message").textContent = "두 부품을 끈으로 단단히 묶었어요. 이제 사포질과 풀칠을 시작해요.";
    resultButton.textContent = "다음 단계로";
  } else {
    game.finishStage(false);
    document.getElementById("result-title").textContent = "게임 오버";
    document.getElementById("result-message").textContent = "목표 횟수를 채우지 못했어요. 처음부터 다시 도전해 주세요.";
    resultButton.textContent = "다시 시작";
  }
  showResult();
}

function updateGlueStatus(state) {
  if (game.snapshot().phase !== "stage" || game.snapshot().stage !== 5) return;
  document.getElementById("glue-progress-label").textContent = `뿔/목재 ${state.progress[0]}% · 조립품 ${state.progress[1]}%`;
  document.getElementById("glue-progress").value = (state.progress[0] + state.progress[1]) / 2;
  updateStatus(game.snapshot());
  updateStageProgress(game.snapshot(), (state.progress[0] + state.progress[1]) / 2, state.state === "done");
}

function startGlue() {
  workshop.character.visible = false;
  game.resetAttempt();
  glue = new GlueGame(workshop, assembly, woodwork, updateGlueStatus, wrongGlue, finishGlue);
  workshop.glue = glue;
  updateStatus(game.snapshot());
  workshop.moveCameraTo(new THREE.Vector3(1.45, 3.5, 2.2), new THREE.Vector3(1.45, 1.15, 0.25), () => {
    glue.startIntro();
    stageTitle.focus({ preventScroll: true });
  });
}

function wrongGlue() {
  game.finishStage(false);
  document.getElementById("result-title").textContent = "게임 오버";
  document.getElementById("result-message").textContent = "이 풀은 잘 붙지 않아요. 처음부터 다시 도전해 주세요.";
  resultButton.textContent = "다시 시작";
  showResult();
}

function finishGlue() {
  updateGlueStatus(glue.snapshot());
}

function updateWindingStatus(state) {
  if (game.snapshot().phase !== "stage" || game.snapshot().stage !== 6) return;
  const percent = Math.floor(state.progress * 100);
  const time = `${(Math.ceil(state.remaining * 10) / 10).toFixed(1)}초`;
  const percentElement = document.getElementById("winding-percent");
  const timeElement = document.getElementById("winding-time");
  if (percentElement.textContent !== `${percent}%`) percentElement.textContent = `${percent}%`;
  if (timeElement.textContent !== time) timeElement.textContent = time;
  document.getElementById("winding-progress").value = state.progress * 100;
  document.getElementById("winding-status").textContent = state.message || (
    state.state === "stacking" ? "부품을 겹쳐 붙이고 있어요."
      : state.state === "tying" ? "마지막 매듭을 조이고 있어요."
        : state.state === "failed" ? "다시하기를 눌러 재도전하세요."
          : `한 방향으로 ${WIND_TURNS}바퀴 · 첫 드래그부터 ${WIND_SECONDS}초`);
  windingPad.hidden = !["ready", "running"].includes(state.state);
  windingRetry.disabled = !["ready", "running", "failed"].includes(state.state);
  windingFinish.disabled = !["ready", "running"].includes(state.state);
}

function startWinding() {
  workshop.character.visible = false;
  game.resetAttempt();
  winding = new WindingGame(workshop, assembly, glue, windingPad, updateWindingStatus, finishWinding);
  workshop.winding = winding;
  updateStatus(game.snapshot());
  updateWindingStatus(winding.snapshot());
  workshop.moveCameraTo(new THREE.Vector3(1.45, 3.5, 2.2), new THREE.Vector3(1.45, 1.15, 0.25), () => {
    stageTitle.focus({ preventScroll: true });
  });
}

function finishWinding(passed, reason) {
  if (passed) {
    pendingWindingSuccess = true;
    document.getElementById("result-title").textContent = "밧줄 감기 완료!";
    document.getElementById("result-message").textContent = "대나무와 뿔을 끝까지 감고 매듭을 단단히 묶었어요.";
    resultButton.textContent = "다음 단계로";
  } else {
    game.finishStage(false);
    document.getElementById("result-title").textContent = "게임 오버";
    const cause = reason === "time" ? "제한 시간 안에 끝까지 감지 못했어요." : "밧줄을 충분히 감지 못했어요.";
    document.getElementById("result-message").textContent = `${cause} 처음부터 다시 도전해 주세요.`;
    resultButton.textContent = "다시 시작";
  }
  showResult();
}

function showResult() {
  setHelpOpen(false);
  tutorialHand.hidden = true;
  workshop.character.visible = true;
  workshop.moveCamera(false);
  resultDialog.showModal();
}

function updateCarvingStatus() {
  if (!workshop || game.snapshot().phase !== "stage" || game.snapshot().stage !== 1) return;
  const result = workshop.carvingResult();
  updateStageProgress(game.snapshot(), result.passed ? 100 : result.progress, result.passed);
  finishButton.disabled = !workshop.carving || !result.passed;
  document.getElementById("trim-progress").textContent = `외곽선 ${result.progress}% · 정확도 ${Math.floor(result.accuracy * 100)}%`;
}

function resetCarving() {
  rotationSlider.value = "0";
  rotationValue.textContent = "0°";
  workshop.rotateBamboo(0, true);
  workshop.resetCarving();
  resetTutorial();
  game.resetAttempt();
}

function setHelpOpen(open) {
  helpPanel.hidden = !open;
  helpButton.setAttribute("aria-expanded", String(open));
}

helpButton.addEventListener("click", () => setHelpOpen(helpPanel.hidden));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !helpPanel.hidden && !resultDialog.open) {
    setHelpOpen(false);
    helpButton.focus();
  }
  if (event.code === "Space" && game.snapshot().stage === 4 &&
      !(event.target instanceof Element && event.target.closest("button, input, select, textarea, dialog"))) {
    dismissTutorial();
  }
});

function resetTutorial() {
  tutorialKey = null;
  tutorialDismissed = false;
  tutorialHand.hidden = true;
}

function dismissTutorial(event) {
  if (event && (!event.isPrimary || event.button !== 0)) return;
  if (tutorialHand.hidden) return;
  tutorialDismissed = true;
  tutorialHand.classList.add("dismissed");
}

windingPad.addEventListener("pointerdown", dismissTutorial);

function updateTutorial(now) {
  const state = game.snapshot();
  if (stagePanel.hidden || resultDialog.open || state.phase !== "stage" || workshop.transition) {
    tutorialHand.hidden = true;
    return;
  }
  let key = null;
  if (state.stage === 1 && workshop.carving) key = "carving";
  else if (state.stage === 2 && bending && bending.state === "ready") key = "bending";
  else if (state.stage === 3 && woodwork && woodwork.active) key = "woodwork";
  else if (state.stage === 4 && assembly && ["waiting", "running"].includes(assembly.state)) key = "assembly";
  else if (state.stage === 5 && glue && glue.state === "painting") key = "glue-painting";
  else if (state.stage === 6 && winding && ["ready", "running"].includes(winding.state)) key = "winding";
  if (!key) {
    tutorialHand.hidden = true;
    return;
  }
  if (key !== tutorialKey) {
    tutorialKey = key;
    tutorialDismissed = false;
    tutorialStart = now;
  }
  tutorialHand.hidden = false;
  tutorialHand.classList.toggle("dismissed", tutorialDismissed);
  if (tutorialDismissed) return;

  const cycleDuration = key.startsWith("glue-") ? 9000 : 3000;
  const elapsed = reducedMotion.matches ? cycleDuration / 4 : now - tutorialStart;
  const cycle = (elapsed % cycleDuration) / cycleDuration;
  let x;
  let y;
  let point;
  if (key === "winding") {
    const rect = windingPad.getBoundingClientRect();
    const angle = cycle * Math.PI * 2 - Math.PI / 2;
    x = rect.left + rect.width * (0.5 + 0.38 * Math.cos(angle));
    y = rect.top + rect.height * (0.5 + 0.38 * Math.sin(angle));
  } else {
    if (key === "carving" || key === "woodwork") {
      const object = key === "carving" ? workshop.strip : woodwork.board;
      const gameObject = key === "carving" ? workshop : woodwork;
      const along = -gameObject.halfLength + gameObject.halfLength * 2 * cycle;
      const side = Math.floor(elapsed / cycleDuration) % 2 ? -1 : 1;
      const height = key === "carving" ? BAMBOO_THICKNESS : WOOD_THICKNESS;
      const offset = key === "woodwork" ? SAW_RADIUS * 0.5 : 0;
      point = object.localToWorld(new THREE.Vector3(along, height, side * (gameObject.guideWidth(along) + offset)));
    } else if (key === "bending") {
      const start = bending.marker.getWorldPosition(new THREE.Vector3());
      const end = bending.fire.getWorldPosition(new THREE.Vector3());
      end.y = start.y;
      point = start.lerp(end, Math.min(1, cycle * 3));
      if (cycle >= 1 / 3) point.x += Math.sin((cycle - 1 / 3) * Math.PI * 6) * 0.1;
    } else if (key === "assembly") {
      point = assembly.assemblyRoot.getWorldPosition(new THREE.Vector3());
      point.y = WORKPIECE_BASE_Y + 0.15;
    } else {
      const target = glue.targets[Math.floor(elapsed / cycleDuration) % 2];
      const index = Math.min(target.points.length - 1, Math.floor(cycle * target.points.length));
      point = workshop.table.localToWorld(target.points[index].clone());
    }
    point.project(workshop.camera);
    const rect = workshop.renderer.domElement.getBoundingClientRect();
    x = rect.left + (point.x + 1) * rect.width / 2;
    y = rect.top + (1 - point.y) * rect.height / 2;
  }
  if (key === "assembly" && !reducedMotion.matches) {
    y += 7 * (1 - Math.cos(elapsed * Math.PI / 450)) / 2;
  }
  tutorialHand.style.transform = `translate3d(${x - 20}px, ${y - 2}px, 0)`;
}

try {
  if (typeof THREE === "undefined") throw new Error("Three.js CDN을 불러오지 못했습니다.");
  if (typeof BambooBendingGame !== "function") throw new Error("열 성형 게임 파일을 불러오지 못했습니다.");
  if (typeof WoodworkGame !== "function") throw new Error("목재 재단 게임 파일을 불러오지 못했습니다.");
  if (typeof AssemblyGame !== "function") throw new Error("부품 결합 게임 파일을 불러오지 못했습니다.");
  if (typeof GlueGame !== "function") throw new Error("풀칠 게임 파일을 불러오지 못했습니다.");
  if (typeof WindingGame !== "function") throw new Error("밧줄 감기 게임 파일을 불러오지 못했습니다.");
  workshop = new WorkshopScene(document.getElementById("scene-container"), reducedMotion);
  workshop.onCarve = () => {
    updateCarvingStatus();
  };
  workshop.onFrame = updateTutorial;
  workshop.renderer.domElement.addEventListener("pointerdown", dismissTutorial);
  startButton.disabled = false;
} catch (error) {
  console.error("3D 무대 초기화 실패:", error);
  errorMessage.hidden = false;
  startButton.textContent = "3D 화면을 불러올 수 없어요";
}

startButton.addEventListener("click", () => {
  game.start();
  startButton.disabled = true;
  speech.hidden = true;
  introPanel.hidden = true;
  workshop.character.visible = false;
  workshop.moveCamera(true, () => {
    workshop.splitBamboo(() => {
      game.enterStage();
      introPanel.hidden = true;
      stagePanel.hidden = false;
      workshop.setCarving(true);
      updateStatus(game.snapshot());
      stageTitle.focus({ preventScroll: true });
    });
  });
});

retryButton.addEventListener("click", () => {
  resetCarving();
});

rotationSlider.addEventListener("input", () => {
  const degrees = Number(rotationSlider.value);
  rotationValue.textContent = `${degrees}°`;
  if (game.snapshot().stage === 3 && woodwork && woodwork.active) woodwork.rotate(degrees);
  else workshop.rotateBamboo(degrees);
});

function finishCarving() {
  if (!workshop.carving || game.snapshot().phase !== "stage" || game.snapshot().stage !== 1) return;
  const result = workshop.carvingResult();
  if (!result.passed) return;
  workshop.setCarving(false);
  game.finishStage(true);
  startBending();
}
finishButton.addEventListener("click", finishCarving);

resultButton.addEventListener("click", () => {
  nextButtonPressed = pendingAssemblySuccess || pendingWindingSuccess;
  resultDialog.close();
});
resultDialog.addEventListener("cancel", (event) => {
  if (game.snapshot().phase === "gameover" || pendingAssemblySuccess || pendingWindingSuccess) event.preventDefault();
});
resultDialog.addEventListener("close", () => {
  if (game.snapshot().phase === "gameover") {
    resetToIntro();
    startButton.click();
  } else if (pendingBendingRetry) {
    pendingBendingRetry = false;
    resetBending();
    focusBending();
  } else if (pendingAssemblySuccess && nextButtonPressed) {
    pendingAssemblySuccess = false;
    game.finishStage(true);
    startGlue();
  } else if (pendingWindingSuccess && nextButtonPressed) {
    pendingWindingSuccess = false;
    game.finishStage(true);
  }
  nextButtonPressed = false;
  resultButton.textContent = "확인";
});

function resetBending() {
  resetTutorial();
  bending.reset();
  game.resetAttempt();
}

bendingRetry.addEventListener("click", () => {
  resetBending();
  bending.activate();
});

heatFinish.addEventListener("click", () => bending.finishHeating());
bendingFinish.addEventListener("click", () => {
  if (game.snapshot().stage !== 2 || !bending || bending.state !== "done" || !bending.results.every((result) => result && result.kind === "success")) return;
  game.finishStage(true);
  startWoodwork();
});

woodRetry.addEventListener("click", () => {
  resetTutorial();
  rotationSlider.value = "0";
  rotationValue.textContent = "0°";
  woodwork.reset();
  game.resetAttempt();
  woodwork.activate();
  updateStatus(game.snapshot());
});

woodFinish.addEventListener("click", () => {
  if (woodwork.result().passed) finishWoodwork();
});

glueFinish.addEventListener("click", () => {
  if (game.snapshot().stage !== 5 || !glue || glue.state !== "done") return;
  game.finishStage(true);
  startWinding();
});

assemblyStart.addEventListener("click", () => {
  dismissTutorial();
  assembly.start();
});
windingRetry.addEventListener("click", () => {
  resetTutorial();
  winding.reset();
  game.resetAttempt();
  updateStatus(game.snapshot());
});
windingFinish.addEventListener("click", () => winding.finish());
glueChoices.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-glue]");
  if (button && glue) {
    dismissTutorial();
    glue.choose(Number(button.dataset.glue));
  }
});
assemblyRetry.addEventListener("click", () => {
  resetTutorial();
  assembly.reset();
  game.resetAttempt();
  updateStatus(game.snapshot());
});

function resetToIntro() {
  if (winding) {
    winding.dispose();
    workshop.winding = null;
    winding = null;
  }
  if (glue) {
    glue.dispose();
    workshop.glue = null;
    glue = null;
  }
  if (assembly) {
    assembly.dispose();
    workshop.assembly = null;
    assembly = null;
  }
  if (woodwork) {
    woodwork.dispose();
    workshop.woodwork = null;
    woodwork = null;
  }
  if (bending) {
    bending.dispose();
    workshop.bending = null;
    bending = null;
  }
  pendingBendingRetry = false;
  pendingAssemblySuccess = false;
  pendingWindingSuccess = false;
  nextButtonPressed = false;
  setHelpOpen(false);
  resetTutorial();
  game.reset();
  workshop.showIntro();
  rotationSlider.value = "0";
  rotationValue.textContent = "0°";
  stagePanel.hidden = true;
  introPanel.hidden = false;
  speech.hidden = false;
  workshop.moveCamera(false);
  startButton.disabled = false;
  startButton.focus({ preventScroll: true });
}

backButton.addEventListener("click", resetToIntro);
