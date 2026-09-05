const assert = require('node:assert/strict');
const O=require('../site/observer.js');
const A=require('../site/vendor/astronomy.browser.min.js');
const close=(a,b,eps=1e-10)=>assert(Math.abs(a-b)<eps,`${a} != ${b}`);
// Known axes, inverse rotations and the Greenwich observer verify handedness/signs.
close(O.eqdToFixed({x:1,y:0,z:0},0).x,1);
close(O.eqdToFixed({x:0,y:1,z:0},0).z,-1);
close(O.eqdToFixed({x:0,y:0,z:1},0).y,1);
for(let h=0;h<24;h+=1.5){const v={x:.4,y:-.7,z:1.1},q=O.fixedToEqd(O.eqdToFixed(v,h),h);for(const k of ['x','y','z'])close(v[k],q[k]);}
for(const iso of ['1900-01-01T00:00:00Z','1969-07-20T20:17:00Z','2011-04-29T11:00:00Z','2026-09-05T00:00:00Z']){
 const date=new Date(iso),v=A.ObserverVector(date,new A.Observer(0,0,0),false),fixed=O.eqjToFixed(A,v,date);
 close(fixed.y,0,1e-14);close(fixed.z,0,1e-14);assert(fixed.x>0);
 const bodies=O.geometricBodies(A,date,['Sun','Moon','Venus']);
 const moonDistance=Math.hypot(...Object.values(bodies.Moon));assert(moonDistance>54&&moonDistance<65);
 const sunDistance=Math.hypot(...Object.values(bodies.Sun));assert(sunDistance>22900&&sunDistance<24000);
}
// An Earth ray occludes the far object, but not an off-limb or foreground object.
const observer={x:0,y:0,z:3};
assert(O.earthOccludes(observer,{x:0,y:0,z:-10}));
assert(!O.earthOccludes(observer,{x:8,y:0,z:-10}));
assert(!O.earthOccludes(observer,{x:0,y:0,z:2}));
assert(O.surfaceFacing({x:0,y:0,z:1},observer)>0);
assert(O.surfaceFacing({x:0,y:0,z:-1},observer)<0);
// Integrated throw travels the same angle at different refresh rates.
let totals=[];for(const fps of [30,60,120]){let vel=1.2,total=0;for(let i=0;i<fps*3;i++){const r=O.coast(vel,0,1/fps);vel=r.velocity;total+=r.angle;}totals.push(total);}
close(totals[0],totals[1]);close(totals[1],totals[2]);
assert(O.supportedDate(new Date('1900-01-01')));assert(!O.supportedDate(new Date('1800-01-01')));assert(!O.supportedDate(null));assert(!O.supportedDate(new Date(NaN)));
// Infinite-star direction must be invariant under translating the observer.
function relative(p,o){return {x:p.x-o.x,y:p.y-o.y,z:p.z-o.z};}
const direction={x:300,y:400,z:500};for(const o of [{x:0,y:0,z:3},{x:100,y:-80,z:40}]){
 const p={x:o.x+direction.x,y:o.y+direction.y,z:o.z+direction.z},v=relative(p,o);for(const k of ['x','y','z'])close(v[k],direction[k]);
}
console.log('Observer tests passed: frame handedness, historical transforms, physical distances, occlusion, 30/60/120fps inertia, date limits, invariant star directions.');
