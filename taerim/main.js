import * as THREE from 'three';
import { createWorkshop } from './workshop.js';
import { Hwarang } from './hwarang.js';
import { GestureGuide } from './gestureGuide.js';
import { BowManager } from './bowManager.js?v=3';
import { Outro, startOutro as beginOutro } from './outro.js?v=10';

export const GameState = Object.freeze({ STEP_1:'STEP_1', STEP_2:'STEP_2', STEP_3:'STEP_3', STEP_4:'STEP_4', STEP_5:'STEP_5', STEP_6:'STEP_6', STEP_7:'STEP_7', STEP_8:'STEP_8', OUTRO:'OUTRO' });
const steps = [
  { state:GameState.STEP_1, title:'활 몸체 다듬기 (궁체 자귀질)', gesture:'wipe_lr', text:'자귀로 활 몸체를 좌우로 문질러 매끄럽게 다듬어 봐!', expression:'default' },
  { state:GameState.STEP_2, title:'소힘줄에 풀 먹이기 (우근 어교질 및 빗질)', gesture:'comb_down', text:'어교를 먹인 소힘줄을 위에서 아래로 쭉쭉 빗어 내려줘!', expression:'default' },
  { state:GameState.STEP_3, title:'소힘줄 붙이기 (궁체에 심 놓기)', gesture:'curve_drag', text:'풀 먹인 소힘줄을 활 안쪽 면을 따라 길게 붙여보자!', expression:'happy' },
  { state:GameState.STEP_4, title:'활 양끝 다듬기 (시위 걸이 홈 깎기)', gesture:'cut_tip', text:'점선을 따라 활 양끝에 시위를 걸 홈을 파줘!', expression:'default' },
  { state:GameState.STEP_5, title:'활 뒤집어 펴기 (지지대 끈 감고 해궁하기)', gesture:'spiral_wrap', text:'지지대 끝을 15번 연속 톡톡 터치해 끈을 감고 활을 펴줘!', expression:'happy' },
  { state:GameState.STEP_6, title:'활시위 걸기 (양끝에 시위 당겨 걸기)', gesture:'pull_string', text:'한쪽에 걸린 시위를 반대편 끝까지 천천히 당겨 걸어봐!', expression:'default' },
  { state:GameState.STEP_7, title:'활 전체 다듬기 (표면 정리 및 최종 마감)', gesture:'wipe_lr', text:'거친 표면을 좌우로 문질러 윤기가 나게 마감하자!', expression:'happy' },
  { state:GameState.STEP_8, title:'활시위 당겨보기 (탄성 및 균형 최종 점검)', gesture:'draw_bow', text:'마지막이야! 시위를 뒤로 쭉 당겨 게이지를 채워봐!', expression:'happy' },
  { state:GameState.OUTRO, title:'각궁 완성!', gesture:null, text:'멋진 각궁이 완성됐어! 함께해 줘서 고마워.', expression:'happy' }
];
const container = document.getElementById('scene-container');
const loading = document.getElementById('loading');
let stateIndex = 0;
let gameState = GameState.STEP_1;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9d8bd');
scene.fog = new THREE.Fog('#e9d8bd', 12, 27);
const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 70);
camera.position.set(0, 5.4, 9.5); camera.lookAt(0, 1.7, 0);
const clock = new THREE.Clock();
const longShot = { position: new THREE.Vector3(0, 5.8, 11.8), target: new THREE.Vector3(0, 1.7, 0), fov: 52 };
const dryingShot = { position: new THREE.Vector3(2.35, 7, 5.1), target: new THREE.Vector3(2.35, 1.85, 1.55), fov: 52 };
const closeShot = {
  STEP_1: { position: new THREE.Vector3(0, 8.8, 7.3), target: new THREE.Vector3(0, 2.5, .25), fov: 50 },
  STEP_2: { position: new THREE.Vector3(0, 8.7, 7.3), target: new THREE.Vector3(0, 2.45, .2), fov: 50 },
  STEP_3: { position: new THREE.Vector3(0, 8.8, 7.3), target: new THREE.Vector3(0, 2.5, .25), fov: 50 },
  STEP_4: { position: new THREE.Vector3(0, 9.3, 7.8), target: new THREE.Vector3(0, 2.4, .2), fov: 53 },
  STEP_5: { position: new THREE.Vector3(0, 9.3, 7.8), target: new THREE.Vector3(0, 2.4, .2), fov: 53 },
  STEP_6: { position: new THREE.Vector3(0, 8.8, 7.4), target: new THREE.Vector3(0, 2.45, .2), fov: 50 },
  STEP_7: { position: new THREE.Vector3(0, 8.8, 7.3), target: new THREE.Vector3(0, 2.5, .25), fov: 50 },
  STEP_8: { position: new THREE.Vector3(0, 8.8, 7.4), target: new THREE.Vector3(0, 2.45, .2), fov: 50 }
};
let cameraMove = null;
let cameraIntro = null;
let cameraView = 'long';
function moveCamera(position, target, fov, duration, onComplete) {
  cameraMove = {
    start: clock.elapsedTime, duration,
    fromPosition: camera.position.clone(), toPosition: position.clone(),
    fromTarget: cameraTarget.clone(), toTarget: target.clone(),
    fromFov: camera.fov, toFov: fov, onComplete
  };
}
const cameraTarget = new THREE.Vector3(0, 1.7, 0);
function goLongShot(after) {
  cameraView = 'long'; cameraIntro = null;
  moveCamera(longShot.position, longShot.target, longShot.fov, .55, after);
}
function goDryingShot() {
  cameraView = 'drying'; cameraIntro = null;
  moveCamera(dryingShot.position, dryingShot.target, dryingShot.fov, .8);
}
function beginStepCamera(state) {
  cameraView = 'long'; cameraIntro = { state, phase: 'return', started: clock.elapsedTime };
  moveCamera(longShot.position, longShot.target, longShot.fov, .45, () => {
    if (cameraIntro?.state === state) { cameraIntro.phase = 'hold'; cameraIntro.started = clock.elapsedTime; }
  });
}
function zoomToStep(state) {
  const view = closeShot[state];
  if (!view) return;
  cameraIntro = null; cameraView = 'close';
  moveCamera(view.position, view.target, view.fov, .65);
}
function updateCamera(elapsed) {
  if (cameraIntro?.phase === 'hold' && elapsed - cameraIntro.started >= 1) zoomToStep(cameraIntro.state);
  if (!cameraMove) return;
  const progress = THREE.MathUtils.clamp((elapsed - cameraMove.start) / cameraMove.duration, 0, 1);
  const eased = 1 - Math.pow(1 - progress, 3);
  camera.position.lerpVectors(cameraMove.fromPosition, cameraMove.toPosition, eased);
  cameraTarget.lerpVectors(cameraMove.fromTarget, cameraMove.toTarget, eased);
  camera.fov = THREE.MathUtils.lerp(cameraMove.fromFov, cameraMove.toFov, eased);
  camera.lookAt(cameraTarget); camera.updateProjectionMatrix();
  if (progress === 1) { const finished = cameraMove.onComplete; cameraMove = null; finished?.(); }
}
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
renderer.domElement.setAttribute('aria-label', '3D 각궁 제작 공방'); container.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight('#fff0d9', 1.6));
const sunlight = new THREE.DirectionalLight('#fff2d6', 3.2);
sunlight.position.set(-4, 9, 6); sunlight.castShadow = true; sunlight.shadow.mapSize.set(2048, 2048);
sunlight.shadow.camera.left = -8; sunlight.shadow.camera.right = 8; sunlight.shadow.camera.top = 8; sunlight.shadow.camera.bottom = -8; sunlight.shadow.bias = -0.0004;
scene.add(sunlight); scene.add(new THREE.HemisphereLight('#fff6de', '#a9795b', 0.8));
const workshop = createWorkshop(scene);
const hwarang = new Hwarang(); scene.add(hwarang.group);
const bow = new BowManager(); scene.add(bow.group);
const guide = new GestureGuide(); scene.add(guide.group);
const outro = new Outro({ scene, camera, canvas:renderer.domElement, hwarang, bow, workshop, guide, ui:{
  setMode(mode) {
    document.getElementById('archery-ui').hidden = mode !== 'archery';
    document.getElementById('outro-actions').hidden = mode !== 'result';
    document.getElementById('final-actions').hidden = mode !== 'finished';
    document.querySelector('.bottom-bar').hidden = mode !== 'craft';
    document.querySelector('.scene-label').hidden = mode !== 'craft';
    document.querySelector('.dialogue').hidden = mode === 'archery';
    if (mode !== 'craft') {
      document.getElementById('step-number').textContent = mode === 'archery' ? 'ARCHERY' : 'COMPLETE';
      document.getElementById('step-title').textContent = mode === 'archery' ? '활쏘기 체험' : mode === 'result' ? '활쏘기 결과' : '화랑 입단식';
    }
  },
  setShots(count) { document.getElementById('arrows-left').textContent = count; },
  setPower(value) { const percent=Math.round(value*100); document.getElementById('power-value').textContent=`${percent}%`; document.getElementById('power-fill').style.width=`${percent}%`; },
  setDialogue(text) { document.getElementById('dialogue-text').textContent=text; }
}});
document.getElementById('retry-archery').addEventListener('click', () => outro.restart());
document.getElementById('next-ceremony').addEventListener('click', () => outro.startCeremony());
document.getElementById('replay-game').addEventListener('click', () => window.location.reload());
document.getElementById('back-to-gallery').addEventListener('click', () => {
  if (document.referrer && window.history.length > 1) window.history.back();
  else window.location.href = '../index.html';
});
document.getElementById('landscape-start').addEventListener('click', async () => {
  try {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    if (screen.orientation?.lock) await screen.orientation.lock('landscape');
  } catch {
    document.getElementById('rotate-prompt').querySelector('span').textContent = '기기 자동 회전 잠금을 해제하고 화면을 가로로 돌려주세요.';
  }
});
const stepDots = document.getElementById('step-dots');
for (let index = 0; index < 8; index++) { const dot = document.createElement('span'); dot.className = 'step-dot'; stepDots.appendChild(dot); }
function setStep(index) {
  stateIndex = index; const step = steps[index]; gameState = step.state; const number = Math.min(index + 1, 8);
  pointerDown = false;
  guide.setInteracting(false);
  document.getElementById('step-number').textContent = index === 8 ? 'COMPLETE' : `STEP ${String(number).padStart(2, '0')} / 08`;
  document.getElementById('step-title').textContent = step.title;
  document.getElementById('bottom-number').textContent = String(number).padStart(2, '0');
  document.getElementById('bottom-title').textContent = step.title;
  document.getElementById('dialogue-text').textContent = step.text;
  document.getElementById('next-step').firstChild.textContent = index === 8 ? '처음부터 ' : '다음 스텝 ';
  document.getElementById('elasticity').hidden = gameState !== GameState.STEP_8;
  document.getElementById('craft-progress').hidden = index >= 7;
  document.querySelector('#craft-progress .meter-label span').textContent = gameState === GameState.STEP_5 ? '끈 감기' : '제작 진행도';
  updateProgress(0);
  document.getElementById('elasticity-fill').style.width = '0%'; document.getElementById('elasticity-value').textContent = '0%';
  [...stepDots.children].forEach((dot, dotIndex) => { dot.classList.toggle('active', index < 8 && dotIndex === index); dot.classList.toggle('done', dotIndex < index); });
  hwarang.setExpression(step.expression); guide.playGesture(step.gesture, gameState); bow.setStep(gameState);
  beginStepCamera(gameState);
}
document.getElementById('next-step').addEventListener('click', () => { if (stateIndex === 7) { guide.playGesture(null); startOutro(); } else setStep((stateIndex + 1) % steps.length); });
let pointerDown = false;
function updateProgress(progress) {
  const percent = Math.round(progress * 100);
  document.getElementById('craft-value').textContent = `${percent}%`;
  document.getElementById('craft-fill').style.width = `${percent}%`;
  document.getElementById('craft-progress').setAttribute('aria-valuenow', String(percent));
  document.getElementById('elasticity-value').textContent = `${percent}%`;
  document.getElementById('elasticity-fill').style.width = `${percent}%`;
  document.getElementById('elasticity').setAttribute('aria-valuenow', String(percent));
}
function finishCraftInteraction() {
  pointerDown = false;
  guide.playGesture(null);
  if (gameState === GameState.STEP_8) startOutro();
  else {
    if (gameState === GameState.STEP_3) goDryingShot();
    else goLongShot();
    bow.startCutscene();
  }
  hwarang.setExpression('happy');
}
function startOutro() {
  document.getElementById('dialogue-text').textContent = '탄성과 균형 점검 완료! 멋진 각궁이 완성됐어!';
  goLongShot();
  bow.startCutscene();
}
renderer.domElement.addEventListener('pointerdown', event => {
  if (outro.phase !== 'idle') { outro.pointerMove(event); outro.pointerDown(event); return; }
  if (bow.cutscene) return;
  if (cameraMove) return;
  if (cameraIntro) { zoomToStep(cameraIntro.state); return; }
  guide.setInteracting(true);
  const point = bow.pick(event, camera, renderer.domElement);
  if (gameState === GameState.STEP_5) {
    const completed = bow.startInteraction(point);
    updateProgress(bow.progress);
    if (completed) finishCraftInteraction();
    return;
  }
  pointerDown = true;
  renderer.domElement.setPointerCapture(event.pointerId);
  bow.startInteraction(point);
});
renderer.domElement.addEventListener('pointermove', event => {
  if (outro.phase !== 'idle') { outro.pointerMove(event); return; }
  if (!pointerDown || bow.cutscene) return;
  const completed = bow.moveInteraction(bow.pick(event, camera, renderer.domElement));
  updateProgress(bow.progress);
  if (completed) finishCraftInteraction();
});
function releasePointer() { pointerDown = false; bow.endInteraction(); updateProgress(bow.progress); if (!bow.cutscene) guide.setInteracting(false); }
renderer.domElement.addEventListener('pointerup', event => { if (outro.phase !== 'idle') { outro.pointerMove(event); outro.pointerUp(); } else releasePointer(); });
renderer.domElement.addEventListener('pointercancel', () => { if (outro.phase === 'charging') outro.cancelCharge(); else if (outro.phase === 'idle') releasePointer(); });
renderer.domElement.addEventListener('lostpointercapture', () => { if (outro.phase === 'idle') releasePointer(); }); window.addEventListener('blur', () => { if (outro.phase === 'idle') releasePointer(); else if (outro.phase === 'charging') outro.cancelCharge(); });
function resize() {
  const width = container.clientWidth; const height = container.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix(); renderer.setSize(width, height);
}
window.addEventListener('resize', resize); new ResizeObserver(resize).observe(container); resize(); setStep(0); loading.hidden = true;
function animate() { requestAnimationFrame(animate); const delta = clock.getDelta(); const elapsed = clock.elapsedTime; hwarang.update(elapsed); if (outro.phase === 'idle') { updateCamera(elapsed); guide.update(elapsed); if (bow.update(elapsed, delta)) { if (gameState === GameState.STEP_8) { gameState = GameState.OUTRO; stateIndex = 8; document.getElementById('elasticity').hidden = true; beginOutro(outro); } else setStep(stateIndex + 1); } } else outro.update(elapsed, delta); renderer.render(scene, camera); }
animate();