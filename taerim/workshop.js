import * as THREE from 'three';

export function createWorkshop(scene) {
  const workshop = new THREE.Group(); workshop.name = '전통 각궁 공방'; scene.add(workshop);
  const wood = new THREE.MeshStandardMaterial({ color:'#a66c42', roughness:.8 });
  const darkWood = new THREE.MeshStandardMaterial({ color:'#74442d', roughness:.85 });
  const lightWood = new THREE.MeshStandardMaterial({ color:'#d3a174', roughness:.82 });
  const cream = new THREE.MeshStandardMaterial({ color:'#f0d7b4', roughness:1 });
  const slate = new THREE.MeshStandardMaterial({ color:'#7c9284', roughness:.9 });
  function box(name,size,pos,material,parent=workshop) { const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material); mesh.name=name; mesh.position.set(...pos); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh; }
  box('바닥',[18,.2,15],[0,-.12,0],wood);
  for(let x=-8;x<=8;x+=1.2) box('바닥 이음새',[.025,.006,15],[x,-.014,0],darkWood);
  box('뒷벽',[15,8,.25],[0,3.9,-4.4],cream);
  for(const x of [-6.4,-3.2,0,3.2,6.4]) box('벽 나무 기둥',[.16,8,.12],[x,3.9,-4.23],darkWood);
  box('벽 가로 기둥',[15,.16,.15],[0,3.95,-4.2],darkWood); box('바닥 걸레받이',[15,.3,.2],[0,.15,-4.2],darkWood);
  for(const x of [-4.7,4.7]) {
    box('창틀',[2.4,2.4,.14],[x,4.9,-4.12],darkWood);
    box('한지 창',[2.18,2.18,.05],[x,4.9,-4.02],new THREE.MeshStandardMaterial({color:'#f8ead0',emissive:'#ddbd88',emissiveIntensity:.12}));
    for(let bar=-1;bar<=1;bar++) box('창살 세로',[.045,2.2,.06],[x+bar*.56,4.9,-3.97],wood);
    for(let bar=-1;bar<=1;bar++) box('창살 가로',[2.2,.045,.06],[x,4.9+bar*.56,-3.97],wood);
  }
  for(const x of [-3.6,3.6]) {
    box('선반 옆판',[.16,2.55,.7],[x-1.05,2.05,-3.7],darkWood); box('선반 옆판',[.16,2.55,.7],[x+1.05,2.05,-3.7],darkWood);
    for(const y of [.8,1.65,2.5,3.3]) box('선반 판',[2.25,.13,.8],[x,y,-3.7],wood);
    for(let index=0;index<3;index++) { const jar=new THREE.Mesh(new THREE.CylinderGeometry(.16,.19,.37,16),index===1?slate:cream); jar.position.set(x-.65+index*.57,1.91,-3.55); jar.castShadow=true; workshop.add(jar); const lid=new THREE.Mesh(new THREE.SphereGeometry(.16,16,8,0,Math.PI*2,0,Math.PI/2),darkWood); lid.position.set(x-.65+index*.57,2.1,-3.55); workshop.add(lid); }
    box('보관함',[.65,.5,.52],[x-.45,1.12,-3.6],lightWood); box('보관함',[.65,.5,.52],[x+.35,1.12,-3.6],wood);
  }
  const stand=new THREE.Group(); stand.position.set(-3.75,.1,-1.7); workshop.add(stand);
  box('활 거치대 기둥',[.13,2.05,.13],[0,1.08,0],darkWood,stand); box('활 거치대 발',[1.25,.15,.75],[0,.08,0],darkWood,stand);
  for(const y of [.75,1.2,1.65]) { const ring=new THREE.Mesh(new THREE.TorusGeometry(.38,.045,8,32),wood); ring.position.set(0,y,.08); ring.rotation.x=Math.PI/2; ring.castShadow=true; stand.add(ring); }
  for(const x of [-2.7,2.7]) for(const z of [1.05,3]) box('작업대 다리',[.24,1.18,.24],[x,.56,z],darkWood);
  box('작업대 상판',[6.4,.26,2.65],[0,1.21,2.02],wood); box('작업대 앞 테두리',[6.42,.15,.13],[0,1.19,3.34],darkWood);
  box('작업대 천',[4.1,.018,1.72],[0,1.35,2],new THREE.MeshStandardMaterial({color:'#d8b98b',roughness:1}));
  for(const x of [-2.6,2.6]) { const peg=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,.3,12),darkWood); peg.position.set(x,1.48,1.5); peg.castShadow=true; workshop.add(peg); }
  box('작은 나무 도구 손잡이',[.75,.1,.12],[-2.5,1.4,2.68],darkWood).rotation.y=.3;
  box('작은 나무 도구 날',[.35,.08,.2],[-2.14,1.4,2.58],slate).rotation.y=.3;
  const spool=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.27,16),new THREE.MeshStandardMaterial({color:'#e5cfa5'})); spool.position.set(2.5,1.5,2.55); spool.castShadow=true; workshop.add(spool);
  return workshop;
}