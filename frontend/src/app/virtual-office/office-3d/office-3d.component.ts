import { AfterViewInit, Component, ElementRef, OnDestroy, OnChanges, SimpleChanges, input, output, viewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface Office3DAgent { slug:string; nombre:string; rol:string; sala:string; descripcion:string; habilitado:number|string; avatar:string; orden:number; }
@Component({ selector:'app-office-3d', standalone:true, templateUrl:'./office-3d.component.html', styleUrl:'./office-3d.component.scss' })
export class Office3DComponent implements AfterViewInit, OnDestroy, OnChanges {
  agents=input<Office3DAgent[]>([]); workingSlugs=input<string[]>([]); founderActionRequest=input<{person:'nico'|'ara';destination:string;nonce:number}|null>(null); agentSelected=output<string>(); canvas=viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private renderer?:THREE.WebGLRenderer; private scene?:THREE.Scene; private camera?:THREE.PerspectiveCamera; private controls?:OrbitControls; private raf=0;
  private raycaster=new THREE.Raycaster(); private pointer=new THREE.Vector2(); private dogObjects:THREE.Group[]=[]; private founders=new Map<'nico'|'ara',THREE.Group>(); private founderTargets=new Map<'nico'|'ara',{x:number,z:number,state:string}>(); private founderPaths=new Map<'nico'|'ara',THREE.Vector2[]>(); private founderMotionParts=new Map<'nico'|'ara',{arms:THREE.Object3D[];legs:THREE.Object3D}>(); private clickable=new Map<THREE.Object3D,string>(); private resizeObserver?:ResizeObserver; private clock=new THREE.Clock(); private agentSignature='';
  ngAfterViewInit():void{this.initScene();}
  ngOnChanges(changes:SimpleChanges):void{if(changes['agents']&&this.scene&&this.renderer){const signature=this.agents().map(a=>`${a.slug}|${a.nombre}|${a.rol}|${a.habilitado}|${a.orden}`).join(';');if(signature!==this.agentSignature){this.agentSignature=signature;this.rebuildOffice();}}if(changes['founderActionRequest']){const req=this.founderActionRequest();if(req&&req.nonce){this.moveFounder(req.person,req.destination);}}}
  ngOnDestroy():void{cancelAnimationFrame(this.raf);this.resizeObserver?.disconnect();this.controls?.dispose();this.renderer?.dispose();this.scene?.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)m.geometry.dispose();if(m.material){const mats=Array.isArray(m.material)?m.material:[m.material];mats.forEach(x=>x.dispose());}});}
  private initScene():void{const host=this.canvas().nativeElement,w=host.clientWidth||900,h=host.clientHeight||540;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#d7e4f2');this.scene.fog=new THREE.Fog('#d7e4f2',42,82);this.camera=new THREE.PerspectiveCamera(38,w/h,.1,120);this.camera.position.set(17,22,24);this.renderer=new THREE.WebGLRenderer({canvas:host,antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setSize(w,h,false);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.controls=new OrbitControls(this.camera,host);this.controls.target.set(0,0,0);this.controls.enableDamping=true;this.controls.dampingFactor=.06;this.controls.maxPolarAngle=Math.PI*.47;this.controls.minDistance=10;this.controls.maxDistance=38;this.addLights();this.buildOffice();this.buildDogs();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);host.addEventListener('pointerdown',this.onPointerDown);this.animate();}
  private addLights():void{const hemi=new THREE.HemisphereLight(0xf5f9ff,0x718096,2.25);this.scene!.add(hemi);const light=new THREE.DirectionalLight(0xfff3df,3.0);light.position.set(-11,20,13);light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.left=-24;light.shadow.camera.right=24;light.shadow.camera.top=24;light.shadow.camera.bottom=-24;light.shadow.bias=-.00025;this.scene!.add(light);const fill=new THREE.DirectionalLight(0xd8e9ff,.8);fill.position.set(13,9,-10);this.scene!.add(fill);}
  private rebuildOffice():void{if(!this.scene)return;const prior=new Map<'nico'|'ara',{x:number;z:number;target:{x:number;z:number;state:string}}>();this.founders.forEach((g,person)=>prior.set(person,{x:g.position.x,z:g.position.z,target:this.founderTargets.get(person)||{x:g.position.x,z:g.position.z,state:'Disponible'}}));this.scene.clear();this.dogObjects=[];this.clickable.clear();this.founders.clear();this.founderTargets.clear();this.founderPaths.clear();this.founderMotionParts.clear();this.addLights();this.buildOffice();this.buildDogs();prior.forEach((saved,person)=>{const g=this.founders.get(person);if(g){g.position.x=saved.x;g.position.z=saved.z;this.founderTargets.set(person,saved.target);}});}
  private box(w:number,h:number,d:number,color:string,x:number,y:number,z:number,mat?:THREE.Material):THREE.Mesh{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat||new THREE.MeshStandardMaterial({color,roughness:.78}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;this.scene!.add(m);return m;}
  private wall(w:number,h:number,d:number,x:number,z:number,color='#9eafc2'):void{this.box(w,h,d,color,x,h/2,z);}
  private label(text:string,x:number,z:number,color='#30435e',width=3.5):void{const c=document.createElement('canvas');c.width=768;c.height=220;const ctx=c.getContext('2d')!;ctx.fillStyle='rgba(255,255,255,.97)';ctx.roundRect(8,8,752,204,26);ctx.fill();ctx.strokeStyle='#cbd6e4';ctx.lineWidth=4;ctx.stroke();ctx.fillStyle=color;const lines=text.split('\n');let fs=lines.length>1?38:44;ctx.font=`bold ${fs}px Arial`;while(lines.some(line=>ctx.measureText(line).width>700)&&fs>22){fs-=2;ctx.font=`bold ${fs}px Arial`;}ctx.textAlign='center';ctx.textBaseline='middle';if(lines.length===1)ctx.fillText(lines[0],384,110,700);else{ctx.fillText(lines[0],384,78,700);ctx.font=`bold ${Math.max(22,fs-5)}px Arial`;ctx.fillText(lines.slice(1).join(' '),384,148,700);}const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,1.25),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.18,z);this.scene!.add(mesh);}
  private makeWallTag(text:string,x:number,z:number,color:string):void{const c=document.createElement('canvas');c.width=768;c.height=220;const ctx=c.getContext('2d')!;ctx.fillStyle='rgba(31,43,62,.96)';ctx.roundRect(8,8,752,204,28);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=7;ctx.stroke();ctx.fillStyle='#ffffff';let fs=48;ctx.font=`bold ${fs}px Arial`;while(ctx.measureText(text).width>690&&fs>24){fs-=2;ctx.font=`bold ${fs}px Arial`;}ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,384,112,690);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(3.5,.85),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide}));mesh.position.set(x,1.35,z);mesh.rotation.y=0;this.scene!.add(mesh);}
  private buildOffice():void{
    // MASTER PLAN APROBADO. Coordenadas: norte = z negativo, sur = z positivo.
    // Perímetro 27 x 21. Habitaciones del borde comparten el contorno exterior.
    this.box(27,.35,21,'#9faec1',0,-.22,0);
    // Decorative perimeter base trim and brand accents for a finished HQ presentation.
    this.box(26.8,.08,.18,'#647b98',0,.02,-10.38);this.box(26.8,.08,.18,'#647b98',0,.02,10.38);this.box(.18,.08,20.8,'#647b98',-13.38,.02,0);this.box(.18,.08,20.8,'#647b98',13.38,.02,0);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(26.6,20.6),new THREE.MeshStandardMaterial({color:'#eadfce',roughness:.92}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;floor.receiveShadow=true;this.scene!.add(floor);
    for(let x=-12;x<=12;x+=2)for(let z=-9;z<=9;z+=2)this.box(1.94,.018,1.94,((x+z)%4===0)?'#e9dfd2':'#f2eadf',x,.004,z);
    // Perimeter walls; broad south entrance, all rooms use the exterior boundary as one wall.
    this.wall(27,1.5,.22,0,-10.5,'#8f9fb4');this.wall(8.6,1.5,.22,-9.2,10.5,'#8f9fb4');this.wall(8.6,1.5,.22,9.2,10.5,'#8f9fb4');this.wall(.22,1.5,21,-13.5,0,'#8f9fb4');this.wall(.22,1.5,21,13.5,0,'#8f9fb4');
    // Executive suites: full-height side partitions aligned to perimeter and front wall; clear inward doors.
    for(const x of [-4.5,4.5])this.wall(.16,1.35,6.8,x,-7.1,'#8e9db0');
    // Front wall segments and door gaps for each executive office.
    for(const cx of [-9,0,9]){this.wall(3.75,1.15,.16,cx-2.5,-3.7,'#8e9db0');this.wall(3.75,1.15,.16,cx+2.5,-3.7,'#8e9db0');this.makeDoor(cx,-3.7,'front');}
    this.makeExecutiveOffice(-9,-7.0,'#4775ad');this.makeExecutiveOffice(0,-7.0,'#765ca6');this.makeExecutiveOffice(9,-7.0,'#b46b9a');
    this.founders.set('nico',this.makePerson('founder:nico','Nico',-9,-6.8,'#4775ad','#4a3b32',0));this.founderTargets.set('nico',{x:-9,z:-6.8,state:'Disponible'});
    const coordinator=this.agents().find(a=>['coordinador','nora'].includes((a.slug||'').toLowerCase())||/nora/i.test(a.nombre));this.makePerson(coordinator?.slug||'nora','Nora',0,-6.8,'#765ca6','#4a3b32',0);
    this.founders.set('ara',this.makePerson('founder:ara','Ara',9,-6.8,'#b46b9a','#513c4b',0));this.founderTargets.set('ara',{x:9,z:-6.8,state:'Disponible'});
    // Rango físico sobre la pared frontal, al costado (no encima) de cada puerta.
    this.makeWallTag('SOCIO FUNDADOR',-11.15,-3.68,'#3d6597');this.makeWallTag('COORDINADORA',-2.15,-3.68,'#765ca6');this.makeWallTag('SOCIA FUNDADORA',6.85,-3.68,'#b46b9a');
    // Operational floor: four wider bays with low dividers, clear circulation on both sides.
    this.label('EQUIPO OPERATIVO',0,-2.75,'#6550a6',4.5);
    const coreAgents=this.resolveCoreAgents();const spots:[number,number][]=[[-5.7,.15],[-1.9,.15],[1.9,.15],[5.7,.15]];
    coreAgents.forEach((a,i)=>this.makeAgent(a,spots[i]));
    // Bay width ~3.6; dividers low, front label panel readable, openings at the aisle ends.
    for(const x of [-3.8,0,3.8])this.box(.1,.72,2.25,'#b5c2d1',x,.36,.1);
    for(const x of [-7.65,-3.8,0,3.8,7.65])this.box(.1,.72,1.7,'#b5c2d1',x,.36,.1);
    // Meeting room: southwest corner uses outer west/south walls. Door faces the central area.
    this.wall(6.8,1.35,.16,-10.1,4.85,'#a0aec0'); // north partition
    this.wall(.16,1.35,2.35,-6.7,5.7,'#a0aec0');this.wall(.16,1.35,2.35,-6.7,9.15,'#a0aec0');this.makeDoor(-6.7,7.45,'side');this.makeMeetingRoom(-10.1,7.6);this.label('SALA DE REUNIONES',-10.1,5.35,'#477b98',4.6);
    // RIGHT-SIDE ROOMS: three equal-size rooms aligned along the exterior east wall.
    // A clear circulation buffer separates Ara's suite/door from the kitchen.
    // Each room is 5.14 x 3.50; shared walls avoid double-wall appearance.
    const roomWest=8.25, roomCenterX=10.82;
    // Exterior east wall is already the building perimeter. The south wall of the lounge
    // also reuses the perimeter wall. North/south partitions are shared between rooms.
    for(const z of [0,3.5,7]) this.wall(5.14,1.35,.16,roomCenterX,z,'#a0aec0');
    // West walls with centered door openings, all facing the common central office.
    for(const centerZ of [1.75,5.25,8.75]){
      this.wall(.16,1.35,1.32,roomWest,centerZ-1.09,'#a0aec0');
      this.wall(.16,1.35,1.32,roomWest,centerZ+1.09,'#a0aec0');
      this.makeDoor(roomWest,centerZ,'side');
    }
    // Keep the first room well south of Ara's front wall/door (z=-3.7).
    this.makeKitchen(roomCenterX,1.35);this.label('COCINA',roomCenterX,2.65,'#bc8a56',2.8);
    this.makeBathroom(roomCenterX,5.15);this.label('BAÑO',roomCenterX,6.15,'#48899a',2.2);
    this.makeSofa(roomCenterX,8.65);this.makePlant(9.15,7.75);this.makePlant(12.15,9.35);
    this.box(1.2,.22,.8,'#8a684e',roomCenterX,1.0,9.55);this.label('LIVING / DESCANSO',roomCenterX,7.65,'#548c76',3.5);
    // Reception and open circulation zone.
    this.box(3.3,.16,1.1,'#8a684e',0,.72,8.5);this.box(.65,.55,.08,'#26364d',0,1.0,8.15);this.box(.55,.4,.02,'#65b9cf',0,1.03,8.105);this.label('NIARSALES HQ',0,9.55,'#2855b8',3.2);this.box(2.6,.08,.18,'#2c58a6',0,1.22,8.05);this.makePlant(-1.9,8.8);this.makePlant(1.9,8.8);
    this.makeSofa(-4.3,7.5);this.makePlant(-2.2,8.5);this.makePlant(-12,7.7);this.makePlant(-12,2.8);this.makePlant(-5.4,3.1);this.makePlant(5.9,3.3);this.makePlant(-11,-8.7);this.makePlant(12,-8.7);
  }
  private moveFounder(person:'nico'|'ara',destination:string):void{
    const home=person==='nico'?{x:-9,z:-6.8}:{x:9,z:-6.8};
    const east={x:8.0,z:4.0};
    const routes:Record<string,{target:{x:number;z:number};path:{x:number;z:number}[]}>={
      work:{target:home,path:[{x:home.x,z:-3.45},{x:home.x,z:-6.8}]},
      kitchen:{target:{x:10.8,z:1.35},path:[{x:person==='nico'?-9:9,z:-3.45},{x:person==='nico'?-9:9,z:4},{x:8.0,z:1.75},{x:10.8,z:1.35}]},
      bathroom:{target:{x:10.8,z:5.15},path:[{x:person==='nico'?-9:9,z:-3.45},{x:person==='nico'?-9:9,z:4},{x:8.0,z:5.25},{x:10.8,z:5.15}]},
      rest:{target:{x:10.8,z:8.65},path:[{x:person==='nico'?-9:9,z:-3.45},{x:person==='nico'?-9:9,z:4},{x:8.0,z:8.75},{x:10.8,z:8.65}]},
      meeting:{target:{x:-10.1,z:7.6},path:[{x:person==='nico'?-9:9,z:-3.45},{x:person==='nico'?-9:9,z:4},{x:-6.7,z:4},{x:-6.7,z:7.45},{x:-10.1,z:7.6}]}
    };
    const route=routes[destination]||routes['work'];const g=this.founders.get(person);if(!g)return;
    this.founderTargets.set(person,{...route.target,state:destination});
    this.founderPaths.set(person,route.path.map(p=>new THREE.Vector2(p.x,p.z)));
  }
  private makeDoor(x:number,z:number,side:'front'|'side'):void{
    // Visible open passage with a leaf hinged to one side; never place a solid wall across the doorway.
    if(side==='side'){
      const leaf=this.box(.07,1.02,.72,'#9a704d',x-.34,.52,z);leaf.rotation.y=0.15;
      this.box(.12,1.18,.08,'#8e9db0',x,.59,z-.42);this.box(.12,1.18,.08,'#8e9db0',x,.59,z+.42);
    }else{
      const leaf=this.box(.72,1.02,.07,'#9a704d',x-.34,.52,z);leaf.rotation.y=0.0;
      this.box(.08,1.18,.12,'#8e9db0',x-.42,.59,z);this.box(.08,1.18,.12,'#8e9db0',x+.42,.59,z);
    }
  }
  private resolveCoreAgents():Office3DAgent[]{
    const source=this.agents().filter(a=>!['coordinador','nora'].includes((a.slug||'').toLowerCase())&&!/nora/i.test(a.nombre||''));
    const defs=[
      {slug:'investigador',nombre:'Ivo',rol:'Investigador Comercial',keys:['investigador','ivo']},
      {slug:'analista',nombre:'Ada',rol:'Analista de Oportunidades',keys:['analista','ada']},
      {slug:'ventas',nombre:'Leo',rol:'Comercial',keys:['ventas','leo','comercial']},
      {slug:'seguimiento',nombre:'Mia',rol:'Agente de Seguimiento',keys:['seguimiento','mia']}
    ];const used=new Set<string>();
    return defs.map((d,i)=>{
      const found=source.find(a=>!used.has(a.slug)&&d.keys.some(key=>{const slug=(a.slug||'').toLowerCase().trim(),name=(a.nombre||'').toLowerCase().trim(),role=(a.rol||'').toLowerCase().trim();return slug===key||name===key||role.includes(key);}));
      if(found)used.add(found.slug);
      return found||{slug:d.slug,nombre:d.nombre,rol:d.rol,sala:'operativo',descripcion:'Agente del equipo NiarSales',habilitado:1,avatar:'',orden:i};
    });
  }
  private makeExecutiveOffice(x:number,z:number,color:string):void{
    // Premium suite: rug, desk facing the inward side, sofa/library against back wall, plants flanking sofa.
    const rug=new THREE.Mesh(new THREE.BoxGeometry(6.7,.035,3.25),new THREE.MeshStandardMaterial({color:'#d8c6b4',roughness:1}));rug.position.set(x,.02,z);this.scene!.add(rug);
    // Desk near the front of suite; executive sits on its north/back side and faces toward center.
    this.box(3.1,.18,1.35,'#79583f',x,.78,z+1.0);for(const dx of [-1.25,1.25])for(const dz of [.55,1.45])this.box(.15,.72,.15,'#59432f',x+dx,.35,z+dz);
    this.box(1.05,.65,.08,'#26364d',x,.99,z+1.2);this.box(.9,.48,.025,color,x,1.02,z+1.15);
    // Sofa is tight to north/back wall; bookcase sits against side wall; foliage flanks the sofa.
    this.makeSofa(x,z-2.15);this.makePlant(x-2.35,z-2.15);this.makePlant(x+2.35,z-2.15);
    const shelfX=x-2.85;this.box(.65,1.65,.42,'#7d6047',shelfX,.82,z-2.15);for(let y=.42;y<1.5;y+=.35)this.box(.58,.05,.36,'#d1b18b',shelfX,y,z-2.15);
    this.box(.55,.6,.05,'#7d6047',x+2.85,.5,z-2.15);this.box(.48,.42,.02,'#b7d0df',x+2.85,.52,z-2.12);
  }
  private makePerson(slug:string,name:string,x:number,z:number,color:string,hair:string,rotation=0):THREE.Group{const g=new THREE.Group();g.position.set(x,.0,z);g.rotation.y=rotation;const body=new THREE.Mesh(new THREE.CylinderGeometry(.28,.35,.65,12),new THREE.MeshStandardMaterial({color}));body.position.y=.65;body.castShadow=true;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.26,16,12),new THREE.MeshStandardMaterial({color:'#e7b48f'}));head.position.y=1.12;head.castShadow=true;g.add(head);const eyeMat=new THREE.MeshStandardMaterial({color:'#27313d'});for(const ex of [-.085,.085]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.035,8,8),eyeMat);eye.position.set(ex,1.13,.235);g.add(eye);}const nose=new THREE.Mesh(new THREE.SphereGeometry(.045,8,8),new THREE.MeshStandardMaterial({color:'#6f463b'}));nose.position.set(0,1.06,.255);g.add(nose);const cap=new THREE.Mesh(new THREE.SphereGeometry(.27,16,8,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:hair}));cap.position.y=1.2;g.add(cap);const legs=new THREE.Mesh(new THREE.BoxGeometry(.4,.42,.25),new THREE.MeshStandardMaterial({color:'#34445e',roughness:.82}));legs.position.y=.22;g.add(legs);const armMat=new THREE.MeshStandardMaterial({color});const arms:THREE.Object3D[]=[];for(const ax of [-.31,.31]){const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.095,.36,4,8),armMat);arm.position.set(ax,.66,.015);arm.rotation.z=ax<0?.12:-.12;g.add(arm);arms.push(arm);}if(slug.startsWith('founder:')){const person=slug.split(':')[1] as 'nico'|'ara';this.founderMotionParts.set(person,{arms,legs});}const hairBack=new THREE.Mesh(new THREE.SphereGeometry(.24,12,8),new THREE.MeshStandardMaterial({color:hair}));hairBack.scale.set(1,.85,.9);hairBack.position.set(0,1.1,-.08);g.add(hairBack);const tag=this.makeTag(name);tag.position.set(0,1.65,0);g.add(tag);this.scene!.add(g);if(slug)this.clickable.set(g,slug);return g;}
  private makeTag(text:string):THREE.Sprite{const c=document.createElement('canvas');c.width=640;c.height=160;const ctx=c.getContext('2d')!;ctx.fillStyle='#ffffff';ctx.roundRect(8,8,624,144,24);ctx.fill();ctx.strokeStyle='#cbd6e4';ctx.lineWidth=5;ctx.stroke();ctx.fillStyle='#273951';let size=44;ctx.font=`bold ${size}px Arial`;while(ctx.measureText(text).width>580&&size>22){size-=2;ctx.font=`bold ${size}px Arial`;}ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,320,82,580);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true}));s.scale.set(2.05,.52,1);return s;}
  private makeAgent(a:Office3DAgent,spot:[number,number]):void{const slug=(a.slug||'').toLowerCase();const palette:Record<string,[string,string]>={investigador:['#8129bd','#3e3449'],ivo:['#8129bd','#3e3449'],analista:['#278c83','#273c43'],ada:['#278c83','#273c43'],ventas:['#bd7850','#70442f'],leo:['#bd7850','#70442f'],seguimiento:['#9b679c','#593e68'],mia:['#9b679c','#593e68']};const fallbackPalettes:[string,string][]=[['#547eac','#4b3d4f'],['#629b8c','#3e4a44'],['#ba845d','#594238'],['#9279b4','#493e52']];const colors:[string,string]=palette[slug]||fallbackPalettes[(a.orden||0)%4];this.makeCompactDesk(spot[0],spot[1],a.orden||0);const g=this.makePerson(a.slug,a.nombre,spot[0],spot[1]-.65,colors[0],colors[1],0);this.label(`${a.nombre.toUpperCase()}\n${(a.rol||'AGENTE').toUpperCase()}`,spot[0],spot[1]+1.5,colors[0],3.7);const glow=new THREE.Mesh(new THREE.CircleGeometry(.42,24),new THREE.MeshBasicMaterial({color:'#77d8b5',transparent:true,opacity:.16}));glow.rotation.x=-Math.PI/2;glow.position.y=.02;g.add(glow);}
  private makeCompactDesk(x:number,z:number,i:number):void{const wood=['#a77d5d','#9e7658','#b38b67'][i%3];this.box(1.35,.12,.72,wood,x,.68,z+.35);for(const dx of [-.52,.52])for(const dz of [-.62,-.08])this.box(.08,.58,.08,'#715844',x+dx,.32,z+dz+.7);this.box(.5,.4,.06,'#26364d',x,.92,z+.48);this.box(.42,.3,.02,'#6ad2ba',x,.95,z+.445);this.box(.45,.1,.45,'#53657c',x,.32,z-.45);this.box(.12,.18,.12,'#c68d5a',x-.48,.83,z+.12);this.box(.1,.16,.1,'#d8e5ee',x+.45,.83,z+.05);this.box(.18,.04,.18,'#d8e5ee',x+.45,.93,z+.05);this.box(.1,.4,.1,'#53657c',x,.15,z-.45);}
  private makeMeetingRoom(x:number,z:number):void{this.box(4.4,.16,2.1,'#9e7658',x,.72,z);for(let i=0;i<4;i++){const chairX=x-1.55+i*1.03;this.box(.55,.42,.55,'#607b96',chairX,.32,z-1.25);this.box(.55,.55,.12,'#607b96',chairX,.6,z-1.48);this.box(.55,.42,.55,'#607b96',chairX,.32,z+1.25);this.box(.55,.55,.12,'#607b96',chairX,.6,z+1.48);}this.box(2.5,1.3,.08,'#31465e',x,.9,z-1.8);this.box(2.2,1.05,.02,'#6ab6c8',x,.9,z-1.74);}
  private makeBathroom(x:number,z:number):void{this.box(1.4,.8,.55,'#e4e9ef',x-.5,.4,z);this.box(.55,.45,.5,'#f7fafc',x+.5,.5,z-.05);this.box(.7,.08,.55,'#a8b7c8',x+.5,.78,z-.05);this.box(.5,.75,.5,'#dce5ed',x+.5,.35,z+.55);}
  private makeSofa(x:number,z:number):void{this.box(2.2,.5,.7,'#8fa9c4',x,.35,z);this.box(2.2,.8,.18,'#7895b3',x,.65,z-.28);this.box(.18,.65,.7,'#7895b3',x-1,.4,z);this.box(.18,.65,.7,'#7895b3',x+1,.4,z);}
  private makeKitchen(x:number,z:number):void{this.box(2.5,.85,.6,'#d5dce5',x,.45,z);this.box(2.5,.12,.65,'#a8b7c8',x,.9,z);this.box(.5,.35,.4,'#8db8c9',x-.65,1.08,z);this.box(.3,.25,.3,'#bf8a55',x+.55,1.05,z);this.box(1.7,.8,.5,'#7e6049',x+1.1,.45,z+.9);this.box(1.7,.12,.55,'#c9b08c',x+1.1,.9,z+.9);}
  private makePlant(x:number,z:number):void{const pot=new THREE.Mesh(new THREE.CylinderGeometry(.2,.26,.35,12),new THREE.MeshStandardMaterial({color:'#bc8767'}));pot.position.set(x,.17,z);this.scene!.add(pot);for(let i=0;i<5;i++){const leaf=new THREE.Mesh(new THREE.SphereGeometry(.25,10,8),new THREE.MeshStandardMaterial({color:'#5a9b7d'}));leaf.position.set(x+Math.cos(i*1.25)*.22,.55+Math.sin(i)*.1,z+Math.sin(i*1.25)*.22);leaf.scale.set(.65,1.3,.65);this.scene!.add(leaf);}}
  private buildDogs():void{this.dogObjects=[this.makeDog('Mapu','#f7f5ef',-6,6),this.makeDog('Puchu','#9a6446',6,6)];}
  private makeDog(name:string,color:string,x:number,z:number):THREE.Group{const g=new THREE.Group();g.position.set(x,.1,z);const mat=new THREE.MeshStandardMaterial({color,roughness:.85});const body=new THREE.Mesh(new THREE.SphereGeometry(.36,14,10),mat);body.scale.set(1.3,.85,.85);body.position.y=.35;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.3,14,10),mat);head.position.set(.38,.62,0);g.add(head);for(let i=0;i<4;i++){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.08,.09,.28,8),mat);leg.position.set((i<2?-.2:.3),.15,(i%2?-.2:.2));g.add(leg);}const tail=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),mat);tail.position.set(-.48,.55,0);g.add(tail);const tag=this.makeTag(name);tag.position.set(0,1.05,0);g.add(tag);this.scene!.add(g);return g;}
  private onPointerDown=(e:PointerEvent):void=>{const r=this.canvas().nativeElement.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);this.raycaster.setFromCamera(this.pointer,this.camera!);const hits=this.raycaster.intersectObjects([...this.clickable.keys()],true);if(hits.length){let o:THREE.Object3D|null=hits[0].object;while(o&&!this.clickable.has(o))o=o.parent;if(o){const slug=this.clickable.get(o);if(slug)this.agentSelected.emit(slug);}}};
  private resize():void{const host=this.canvas().nativeElement;if(!this.camera||!this.renderer)return;const w=host.clientWidth,h=host.clientHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
  private animate=():void=>{this.raf=requestAnimationFrame(this.animate);const t=this.clock.getElapsedTime();this.dogObjects.forEach((d,i)=>{const phase=t*.13+i*2.1;d.position.x=(i===0?-1:1)*10.2*Math.sin(phase);d.position.z=(i===0?7.7:6.9)*Math.cos(phase*.83+i*.35);d.rotation.y=Math.atan2(Math.cos(phase),Math.sin(phase))+(i?Math.PI:0);});this.founderTargets.forEach((target,person)=>{const g=this.founders.get(person);if(!g)return;const path=this.founderPaths.get(person);const waypoint=path?.[0];const dest=waypoint||new THREE.Vector2(target.x,target.z);const dx=dest.x-g.position.x,dz=dest.y-g.position.z,dist=Math.hypot(dx,dz);const moving=dist>.07;if(moving){const step=Math.min(dist,.055);g.position.x+=dx/dist*step;g.position.z+=dz/dist*step;g.rotation.y=Math.atan2(dx,dz);g.position.y=.035+Math.abs(Math.sin(t*9))*.045;const parts=this.founderMotionParts.get(person);if(parts){parts.arms[0].rotation.x=Math.sin(t*9)*.48;parts.arms[1].rotation.x=-Math.sin(t*9)*.48;parts.legs.rotation.x=Math.sin(t*9)*.15;}}else{if(path?.length){path.shift();if(!path.length)this.founderPaths.delete(person);}g.position.y=target.state==='work'?.02+Math.sin(t*2.4)*.015:0;const parts=this.founderMotionParts.get(person);if(parts){parts.arms.forEach((a:THREE.Object3D)=>a.rotation.x=0);parts.legs.rotation.x=0;}}});this.controls?.update();this.renderer?.render(this.scene!,this.camera!);};
}
