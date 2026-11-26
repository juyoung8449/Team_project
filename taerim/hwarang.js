import * as THREE from 'three';

export class Hwarang {

class Hwarang {
  constructor() {
    this.group=new THREE.Group(); this.group.name='화랑'; this.group.position.set(1.05,0,-1.35);
    const skin=new THREE.MeshStandardMaterial({color:'#ffc9a4',roughness:.75}); const hair=new THREE.MeshStandardMaterial({color:'#67402e',roughness:.74});
    const ivory=new THREE.MeshStandardMaterial({color:'#f8e9ce',roughness:.9}); const teal=new THREE.MeshStandardMaterial({color:'#e4d7bf',roughness:.88});
    const brown=new THREE.MeshStandardMaterial({color:'#563a30',roughness:.85}); const coral=new THREE.MeshStandardMaterial({color:'#9b6151',roughness:.85});
    const dark=new THREE.MeshStandardMaterial({color:'#2d211b',roughness:.65}); const pink=new THREE.MeshStandardMaterial({color:'#ec9283',roughness:.9});
    const eyeWhite=new THREE.MeshStandardMaterial({color:'#fffaf3',roughness:.4});
    const iris=new THREE.MeshStandardMaterial({color:'#3c251a',roughness:.35});
    const pupil=new THREE.MeshStandardMaterial({color:'#100b09',roughness:.25});
    const highlight=new THREE.MeshBasicMaterial({color:'#ffffff'});
    const add=(parent,geometry,material,pos,name)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...pos);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
    this.body=new THREE.Group(); this.body.position.y=.8; this.group.add(this.body);
    for(const x of [-.22,.22]) {
      const leg=add(this.body,new THREE.SphereGeometry(.32,24,16),brown,[x,.42,0],'밤색 한복 바지'); leg.scale.set(.72,1.35,.8);
      const shoe=add(this.body,new THREE.SphereGeometry(.2,20,12),dark,[x,.07,.12],'전통 신발'); shoe.scale.set(1,.65,1.35);
      const cuff=add(this.body,new THREE.CylinderGeometry(.14,.14,.08,16),ivory,[x,.19,.02],'바지 대님'); cuff.scale.z=.9;
    }
    const torso=add(this.body,new THREE.CapsuleGeometry(.4,.42,8,20),ivory,[0,1.18,0],'저고리'); torso.scale.set(1,1,.78);
    const collarLeft=add(this.body,new THREE.BoxGeometry(.12,.58,.08),teal,[-.11,1.37,.33],'깃'); collarLeft.rotation.z=-.45;
    const collarRight=add(this.body,new THREE.BoxGeometry(.12,.58,.08),teal,[.11,1.37,.33],'깃'); collarRight.rotation.z=.45;
    add(this.body,new THREE.SphereGeometry(.09,12,10),coral,[.13,1.13,.37],'고름 매듭'); const ribbon=add(this.body,new THREE.BoxGeometry(.09,.48,.05),coral,[.18,.92,.37],'고름'); ribbon.rotation.z=.18;
    const strap=add(this.body,new THREE.BoxGeometry(.09,1.35,.045),brown,[0,1.25,.36],'가죽 어깨끈'); strap.rotation.z=.72;
    this.leftArm=new THREE.Group(); this.leftArm.position.set(-.42,1.43,0); this.body.add(this.leftArm);
    const sleeveLeft=add(this.leftArm,new THREE.CapsuleGeometry(.16,.38,6,16),ivory,[-.12,-.23,0],'왼쪽 소매'); sleeveLeft.rotation.z=-.4;
    add(this.leftArm,new THREE.SphereGeometry(.15,16,12),skin,[-.23,-.46,.02],'왼손');
    this.rightArm=new THREE.Group(); this.rightArm.position.set(.42,1.43,0); this.body.add(this.rightArm);
    const sleeveRight=add(this.rightArm,new THREE.CapsuleGeometry(.16,.38,6,16),ivory,[.12,-.2,0],'오른쪽 소매'); sleeveRight.rotation.z=.45;
    add(this.rightArm,new THREE.SphereGeometry(.15,16,12),skin,[.23,-.42,.02],'오른손');
    this.head=new THREE.Group(); this.head.position.set(0,2.04,0); this.body.add(this.head);
    const head=add(this.head,new THREE.SphereGeometry(.72,32,24),skin,[0,0,0],'얼굴'); head.scale.set(1,.92,.9);
    const hairCap=add(this.head,new THREE.SphereGeometry(.73,32,20,0,Math.PI*2,0,Math.PI*.48),hair,[0,.04,-.02],'갈색 머리'); hairCap.scale.z=.91;
    add(this.head,new THREE.SphereGeometry(.16,18,12),skin,[-.69,-.08,0],'왼쪽 귀'); add(this.head,new THREE.SphereGeometry(.16,18,12),skin,[.69,-.08,0],'오른쪽 귀');
    for(const [x,y,z,angle] of [[-.43,.39,.45,-.35],[-.2,.47,.56,-.18],[.06,.48,.59,.12],[.32,.42,.49,.35]]) {
      const fringe=add(this.head,new THREE.ConeGeometry(.19,.42,16),hair,[x,y,z],'뾰족한 갈색 앞머리'); fringe.rotation.z=Math.PI+angle; fringe.scale.z=.55;
    }
    const nose=add(this.head,new THREE.SphereGeometry(.075,16,12),skin,[0,-.12,.65],'동그란 코'); nose.scale.set(.85,1,.65);
    for(const x of [-.4,.4]) { const cheek=add(this.head,new THREE.SphereGeometry(.095,16,12),pink,[x,-.24,.52],'볼'); cheek.scale.set(1,.65,.25); }
    this.faces={};
    const line=(parent,points,radius,material)=>add(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point=>new THREE.Vector3(...point))),20,radius,6,false),material,[0,0,0],'표정');
    for(const expression of ['default','happy','sad']) {
      const face=new THREE.Group(); face.name=expression; this.head.add(face); this.faces[expression]=face;
      for(const x of [-.25,.25]) {
        if(expression==='happy') line(face,[[x-.11,.02,.6],[x,.13,.64],[x+.11,.02,.6]],.022,dark);
        else {
          const white=add(face,new THREE.SphereGeometry(.15,20,16),eyeWhite,[x,.03,.56],'눈 흰자'); white.scale.set(.9,1.25,.38);
          const eye=add(face,new THREE.SphereGeometry(.095,20,16),iris,[x,.03,.615],'짙은 갈색 눈동자'); eye.scale.set(.9,1.2,.35);
          const center=add(face,new THREE.SphereGeometry(.052,16,12),pupil,[x,.03,.648],'검은 동공'); center.scale.z=.3;
          const glint=add(face,new THREE.SphereGeometry(.027,12,8),highlight,[x-.025,.075,.665],'눈 하이라이트'); glint.scale.z=.35;
        }
        if(expression==='sad') line(face,[[x-.1,.24,.56],[x+.1,.24+(x<0?.06:-.06),.57]],.018,dark);
      }
      if(expression==='happy') { const mouth=add(face,new THREE.SphereGeometry(.12,18,12),dark,[0,-.29,.605],'웃는 입'); mouth.scale.set(1.25,.65,.2); }
      else if(expression==='sad') line(face,[[-.12,-.33,.59],[0,-.27,.64],[.12,-.33,.59]],.02,dark);
      else line(face,[[-.13,-.26,.59],[0,-.31,.64],[.13,-.26,.59]],.02,dark);
    }
    const quiver=add(this.body,new THREE.CylinderGeometry(.19,.15,.8,16),brown,[-.48,1.48,-.35],'가죽 화살통'); quiver.rotation.z=-.35;
    for(let index=0;index<4;index++) { const arrow=add(this.body,new THREE.CylinderGeometry(.018,.018,1.1,8),dark,[-.65+index*.09,1.78,-.35],'화살'); arrow.rotation.z=-.35; const feather=add(this.body,new THREE.ConeGeometry(.065,.18,6),ivory,[-.83+index*.09,2.28,-.35],'화살 깃'); feather.rotation.z=-.35; }
    const backCurve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.6,.65,-.4),new THREE.Vector3(-1.35,1.55,-.4),new THREE.Vector3(-.5,2.4,-.4));
    add(this.body,new THREE.TubeGeometry(backCurve,32,.045,8,false),dark,[0,0,0],'검은 물소뿔 각궁'); line(this.body,[[-.6,.65,-.4],[-.5,2.4,-.4]],.012,ivory);
    this.setExpression('default');
  }
  setExpression(type) { const selected=this.faces[type]?type:'default'; for(const [name,face] of Object.entries(this.faces)) face.visible=name===selected; }
  update(time) { this.head.rotation.z=Math.sin(time*1.6)*.035; this.head.rotation.x=Math.sin(time*2.1)*.06; this.rightArm.rotation.z=1.65+Math.sin(time*2.5)*.18; this.body.position.y=.8+Math.sin(time*1.8)*.018; }
}