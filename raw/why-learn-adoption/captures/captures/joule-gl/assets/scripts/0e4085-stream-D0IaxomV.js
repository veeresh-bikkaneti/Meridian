import{ak as O,x as C,H as _,C as b,q as F,k as R,a6 as G,aE as V,au as I,aF as N,a3 as D,J as E,$ as z,as as q}from"./three-PaSYbO4s.js";import{S}from"./colors-DgX8emcA.js";import{M as j,n as L}from"./cutaway-Dhzn16cq.js";const f={},g={};function A(s,e){const t=Math.max(s.r,s.g,s.b),a=Math.min(s.r,s.g,s.b),i=t-a;let r=0;return i>1e-9&&(r=t===s.r?((s.g-s.b)/i+6)%6:t===s.g?(s.b-s.r)/i+2:(s.r-s.g)/i+4),e.h=r/6,e.s=t>0?i/t:0,e.v=t,e}function H(s,e){A(s,f),A(e,g);let t=g.h-f.h;return t-=Math.floor(t+.5),.36+(.05-.36)*Math.min(1,Math.abs(t)*3.5)}function P(s,e,t,a){A(s,f),A(e,g);let i=g.h-f.h;i-=Math.floor(i+.5);const r=((f.h+i*t)%1+1)%1,p=f.s+(g.s-f.s)*t,m=f.v+(g.v-f.v)*t,o=n=>{const d=(n+r*6)%6;return m-m*p*Math.max(0,Math.min(d,4-d,1))};return a.setRGB(o(5),o(3),o(1))}const K=`
attribute vec3 aOff; attribute float aU;
uniform float uRadius; uniform float uTime; uniform int uMode;
varying float vU; varying vec3 vN; varying vec3 vView; varying float vAround;
void main() {
  vU = aU;
  float taper = smoothstep(0.0, 0.06, aU) * smoothstep(1.0, 0.94, aU) * 0.55 + 0.45;
  float r = uRadius * taper;
  if (uMode == 2) r *= 1.0 + 0.18 * sin(aU * 40.0 - uTime * 1.6 + aOff.x * 3.0);   // heating: a soft wavering
  vec3 p = position + aOff * r;
  vN = normalize(normalMatrix * aOff);
  vec4 mv = modelViewMatrix * vec4(p, 1.0); vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`,W=`
uniform vec3 uA; uniform vec3 uB; uniform float uGlow; uniform float uTime; uniform float uLen; uniform int uMode; uniform float uSpeed; uniform float uDir;
varying float vU; varying vec3 vN; varying vec3 vView;
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}
vec3 hsv2rgb(vec3 c) { vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0); return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y); }
void main() {
  float u = uDir < 0.0 ? 1.0 - vU : vU;               // u runs from the source store to the destination
  // blend the two store colours round the hue circle (the short way) at full saturation: a straight RGB mix of
  // complementary colours goes pale grey half way. Neighbouring hues blend over most of the flow; distant ones
  // change quickly at the middle, so the stream never sweeps through a rainbow of stores that are not in play.
  vec3 a = rgb2hsv(uA), b = rgb2hsv(uB);
  float dh = b.x - a.x; dh -= floor(dh + 0.5);
  float hw = mix(0.36, 0.05, clamp(abs(dh) * 3.5, 0.0, 1.0));
  float bt = smoothstep(0.5 - hw, 0.5 + hw, u);
  vec3 c = hsv2rgb(vec3(fract(a.x + dh * bt), mix(a.y, b.y, bt), mix(a.z, b.z, bt)));
  float facing = abs(dot(normalize(vN), normalize(vView)));
  float body = 0.55 + 0.45 * facing;                 // a round tube: brighter core, softer edge
  float s = u * uLen;                                // mm along the flow
  float f = 1.0;
  if (uMode == 0) f = 0.82 + 0.18 * sin((s - uTime * uSpeed) * 0.45);                         // steady stream
  if (uMode == 1) { float k = fract((s - uTime * uSpeed * 3.0) / 18.0); f = 0.35 + 1.4 * smoothstep(0.75, 0.97, k) * smoothstep(1.0, 0.97, k); }   // pulses
  if (uMode == 2) f = 0.78 + 0.22 * sin((s - uTime * uSpeed * 0.4) * 0.22 + sin(s * 0.07 + uTime));                 // shimmer
  if (uMode == 3) { float k = fract((s - uTime * uSpeed * 1.6) / 9.0); f = 0.25 + 1.1 * step(0.45, k); }            // rays
  gl_FragColor = vec4(c * uGlow * body * f, 1.0);
}`,J={mechanical:0,electrical:1,heating:2,radiation:3},$={value:1};class Z{constructor(e,{from:t,to:a,pathway:i="mechanical",beads:r=11,segments:p=96,radial:m=10}={}){this.curve=new O(e,!1,"centripetal"),this.len=this.curve.getLength(),this.pathway=i,this.power=0,this.maxPower=1,this.glow=0;const o=p,n=m,d=[],y=[],x=[],u=[],w=this.curve.computeFrenetFrames(o,!1);for(let l=0;l<=o;l++){const c=l/o,v=this.curve.getPointAt(c),M=w.normals[l],k=w.binormals[l];for(let B=0;B<=n;B++){const U=B/n*Math.PI*2,T=M.clone().multiplyScalar(Math.cos(U)).addScaledVector(k,Math.sin(U));d.push(v.x,v.y,v.z),y.push(T.x,T.y,T.z),x.push(c)}}for(let l=0;l<o;l++)for(let c=0;c<n;c++){const v=l*(n+1)+c,M=v+n+1;u.push(v,M,v+1,v+1,M,M+1)}const h=new C;h.setAttribute("position",new _(d,3)),h.setAttribute("aOff",new _(y,3)),h.setAttribute("aU",new _(x,1)),h.setIndex(u),this.uniforms={uA:{value:new b(S[t].hex)},uB:{value:new b(S[a].hex)},uGlow:{value:0},uTime:{value:0},uLen:{value:this.len},uMode:{value:J[i]},uSpeed:{value:40},uRadius:{value:1},uDir:{value:1}},this.colFrom=new b(S[t].hex),this.colTo=new b(S[a].hex),this.tube=new F(h,new R({uniforms:this.uniforms,vertexShader:K,fragmentShader:W})),this.tube.frustumCulled=!1,this.nBeads=r,this.beadMat=new G({color:16777215}),this.beads=new V(new I(1,12,8),this.beadMat,r),this.beads.instanceColor=new N(new Float32Array(r*3),3),this.beads.frustumCulled=!1,this.group=new D,this.group.add(this.tube,this.beads),this.phase=0,this._m=new E,this._c=new b,this._lc=new b,this._p=new z}get glowObjects(){return[this.tube,this.beads]}setPower(e,t=this.maxPower){Math.abs(e)>1e-9&&(this.dir=Math.sign(e)),this.power=Math.abs(e),this.maxPower=t,this.uniforms.uDir.value=this.dir??1;const a=(this.dir??1)<0;this.uniforms.uA.value.copy(a?this.colTo:this.colFrom),this.uniforms.uB.value.copy(a?this.colFrom:this.colTo)}lightInfo(e=new z){return this.tube.localToWorld(e.copy(this.curve.getPointAt(.5))),{pos:e,color:P(this.uniforms.uA.value,this.uniforms.uB.value,.5,this._lc),strength:this.glow*Math.min(1,.3+this.level)}}update(e,t){const a=Math.min(1,this.power/Math.max(1e-9,this.maxPower));this.level=a;const r=t&&this.power>1e-9?1:0;this.glow=j.still?r:this.glow+(r-this.glow)*(1-Math.exp(-e*8));const p=L()?0:e;this.group.visible=this.glow>.01;const m=q.smoothstep(this.glow,.01,.9),o=(.4+1.35*Math.sqrt(a))*m,n=this.pathway==="electrical"?140:this.pathway==="heating"?18:this.pathway==="radiation"?160:30+50*a;this.uniforms.uRadius.value=this.pathway==="electrical"?Math.min(o,.9*m):o,this.uniforms.uSpeed.value=n,this.uniforms.uTime.value+=p,this.uniforms.uGlow.value=1.6,this.phase=((this.phase+p*n/this.len)%1+1)%1;const d=Math.ceil((this.pathway==="heating"?this.nBeads*.4:this.nBeads)*$.value),y=(this.pathway==="electrical"?1.1:o*1.12+.35)*m,x=H(this.uniforms.uA.value,this.uniforms.uB.value);for(let u=0;u<this.nBeads;u++){const w=(u/this.nBeads+this.phase)%1,h=(this.dir??1)<0?1-w:w,c=u<d&&h>.04&&h<.96?y*(.75+.25*Math.sin(u*1.7))*Math.min(1,h/.12,(1-h)/.12):0;this.curve.getPointAt(h,this._p),this._m.makeScale(c,c,c).setPosition(this._p),this.beads.setMatrixAt(u,this._m),P(this.uniforms.uA.value,this.uniforms.uB.value,q.smoothstep(w,.5-x,.5+x),this._c).multiplyScalar(1.9),this.beads.setColorAt(u,this._c)}this.beads.instanceMatrix.needsUpdate=!0,this.beads.instanceColor.needsUpdate=!0}}export{$ as B,Z as S,P as a,H as b};
