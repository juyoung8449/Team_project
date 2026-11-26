import * as THREE from 'three';

export class GestureGuide {

class GestureGuide {
  constructor() {
    this.group=new THREE.Group(); this.group.name='3D 제스처 안내'; this.hand=new THREE.Group(); this.group.add(this.hand);
    this.material=new THREE.MeshStandardMaterial({color:'#fff8df',transparent:true,opacity:.8,roughness:.6,depthWrite:false});
    const palm=new THREE.Mesh(new THREE.SphereGeometry(.21,20,16),this.material); palm.scale.set(1,.62,1.15); this.hand.add(palm);
    const finger=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.38,6,14),this.material); finger.rotation.x=Math.PI/2; finger.position.set(-.08,0,-.28); this.hand.add(finger);
    for(let index=0;index<3;index++) { const knuckle=new THREE.Mesh(new THREE.SphereGeometry(.082,14,10),this.material); knuckle.position.set(.02+index*.1,-.005,-.12); this.hand.add(knuckle); }
    const thumb=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.13,6,12),this.material); thumb.rotation.y=-.8; thumb.rotation.x=Math.PI/2; thumb.position.set(-.2,0,.03); this.hand.add(thumb);
    const halo=new THREE.Mesh(new THREE.TorusGeometry(.13,.015,8,32),new THREE.MeshBasicMaterial({color:'#fff4bd',transparent:true,opacity:.7,depthWrite:false})); halo.rotation.x=Math.PI/2; halo.position.set(-.08,-.04,-.57); this.hand.add(halo);
    this.cutMarkers=new THREE.Group(); this.cutMarkers.name='양끝 절단 점선'; this.group.add(this.cutMarkers);
    const markerMaterial=new THREE.MeshBasicMaterial({color:'#d66b4b',transparent:true,opacity:.85});
    for(const x of [-1.8,1.8]) for(let index=0;index<7;index++) {
      const marker=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),markerMaterial);
      marker.position.set(x,1.49,1.43+index*.1); this.cutMarkers.add(marker);
    }
    this.type=null; this.interacting=false;
  }
  playGesture(type, state) { this.type=type; this.state=state; this.cutMarkers.visible=type==='cut_tip'; this.group.visible=Boolean(type)&&!this.interacting; }
  setInteracting(value) { this.interacting=value; this.group.visible=Boolean(this.type)&&!value; }
  prepareScreenGuide(camera) {
    camera.add(this.group);
    this.cutMarkers.visible = false;
    this.hand.rotation.x = Math.PI / 2;
    this.group.traverse(object => {
      if (!object.isMesh) return;
      object.renderOrder = 10000;
      object.material.depthTest = false;
      object.userData.guideOpacity = object.material.opacity;
    });
    this.group.visible = false;
  }
  showScreenGuide(x, y, canvas, camera, opacity, pointingDown = false) {
    const rect = canvas.getBoundingClientRect();
    const depth = 3;
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * depth;
    const scale = halfHeight * 2 * 80 / rect.height;
    this.hand.rotation.x = pointingDown ? -Math.PI / 2 : Math.PI / 2;
    this.group.position.set(
      ((x - rect.left) / rect.width * 2 - 1) * halfHeight * camera.aspect,
      (1 - (y - rect.top) / rect.height * 2) * halfHeight + (pointingDown ? .55 : -.55) * scale,
      -depth
    );
    this.group.scale.setScalar(scale);
    this.group.traverse(object => {
      if (object.isMesh) object.material.opacity = object.userData.guideOpacity * opacity;
    });
    this.group.visible = opacity > 0;
  }
  update(time) {
    if(!this.type)return; const phase=(time*.45)%1; let x=0,z=2,y=1.72;
    switch(this.type) {
      case 'wipe_lr': x=Math.sin(time*2)*1.4; z=this.state==='STEP_7'?2.35-.62*Math.sqrt(Math.max(0,1-x*x/3.24)):1.65+.62*Math.sqrt(Math.max(0,1-x*x/3.24)); break;
      case 'comb_down': z=1.5+phase; break;
      case 'curve_drag': { const side=phase<.5?-1:1; x=side*(.15+(phase*2%1)*1.5); z=1.65+.62*Math.sqrt(Math.max(0,1-x*x/3.24)); break; }
      case 'cut_tip': x=phase<.5?-1.8:1.8; z=1.45+(phase*2%1)*.55; break;
      case 'spiral_wrap': x=1.48; z=1.8; y+=Math.max(0,Math.sin(time*8))*.18; break;
      case 'pull_string': x=-1.7+phase*3.4; z=2.35; break;
      case 'draw_bow': z=2.35+phase*.8; break;
    }
    this.hand.position.set(x+.08,y+Math.sin(time*3)*.04,z+.57);
  }
}