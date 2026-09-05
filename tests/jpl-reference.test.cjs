const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const A=require('../site/vendor/astronomy.browser.min.js'),O=require('../site/observer.js');
const refDir=path.join(__dirname,'references');
function parse(name){
 const text=fs.readFileSync(path.join(refDir,`upstream-${name}.txt`),'utf8');
 assert(text.includes('GEOMETRIC cartesian states')&&text.includes('Reference frame : ICRF'));
 const block=text.split('$$SOE')[1].split('$$EOE')[0];const out=new Map();
 const rx=/([\d.]+) = ([^\n]+)\n\s*X\s*=\s*([\d.Ee+\-]+)\s*Y\s*=\s*([\d.Ee+\-]+)\s*Z\s*=\s*([\d.Ee+\-]+)\n\s*VX\s*=\s*([\d.Ee+\-]+)\s*VY\s*=\s*([\d.Ee+\-]+)\s*VZ\s*=\s*([\d.Ee+\-]+)/g;let m;
 while((m=rx.exec(block)))out.set(+m[1],{x:+m[3],y:+m[4],z:+m[5],vx:+m[6],vy:+m[7],vz:+m[8],epoch:m[2].trim()});return out;
}
const refs={};for(const n of ['Earth','Moon','Sun','Venus'])refs[n]=parse(n);
const observers=[{x:0,y:0,z:0},{x:0,y:0,z:3.9},{x:20,y:-12,z:8},{x:100,y:60,z:-40}];
function minus(a,b){return {x:a.x-b.x,y:a.y-b.y,z:a.z-b.z};}
function length(v){return Math.hypot(v.x,v.y,v.z);}
function angle(a,b){const cross={x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x};return Math.atan2(length(cross),a.x*b.x+a.y*b.y+a.z*b.z)*180/Math.PI*3600;}
let results=[],summaries=[];
for(const name of ['Moon','Venus']){
 const epochs=[...refs[name].keys()].filter(jd=>refs.Earth.has(jd));assert(epochs.length>100);
 let worst=0,count=0,worstKm=0;
 const samples=new Set([epochs[0],epochs[Math.floor(epochs.length*.25)],epochs[Math.floor(epochs.length*.5)],epochs[Math.floor(epochs.length*.75)],epochs.at(-1)]);
 for(const jd of epochs){
  // JPL fixtures are TDB. Astronomy Engine uses TT; periodic TDB-TT is under 2ms.
  const time=A.AstroTime.FromTerrestrialTime(jd-2451545),geo=minus(refs[name].get(jd),refs.Earth.get(jd));
  const reference=O.eqjToFixed(A,geo,time);for(const k of ['x','y','z'])reference[k]*=O.AU_KM/O.EARTH_KM;
  const actual=O.geometricBodies(A,time,[name])[name];worstKm=Math.max(worstKm,length(minus(actual,reference))*O.EARTH_KM);
  for(let i=0;i<observers.length;i++){
   const error=angle(minus(actual,observers[i]),minus(reference,observers[i]));assert(Number.isFinite(error));worst=Math.max(worst,error);count++;
   if(samples.has(jd))results.push({body:name,epochTDB:refs[name].get(jd).epoch,observerEarthRadii:observers[i],angularErrorArcsec:error});
  }
 }
 summaries.push({body:name,commonEpochs:epochs.length,observerComparisons:count,maxAngularErrorArcsec:worst,maxGeocentricPositionErrorKm:worstKm});
 assert(worst<60,`${name} exceeded 1 arcminute geometric tolerance: ${worst}`);
}
// Sun reference samples fall on a different grid. Cubic Hermite interpolation uses
// the supplied JPL velocities; alternate-point holdouts independently quantify it.
function hermite(t,a,b){
 const h=b.jd-a.jd,u=(t-a.jd)/h,h00=2*u*u*u-3*u*u+1,h10=u*u*u-2*u*u+u,h01=-2*u*u*u+3*u*u,h11=u*u*u-u*u,out={};
 for(const k of ['x','y','z'])out[k]=h00*a[k]+h10*h*a['v'+k]+h01*b[k]+h11*h*b['v'+k];return out;
}
const sunRows=[...refs.Sun].map(([jd,r])=>({jd,...r}));let interpolationHoldoutKm=0;
for(let i=1;i<sunRows.length-1;i+=2)interpolationHoldoutKm=Math.max(interpolationHoldoutKm,length(minus(hermite(sunRows[i].jd,sunRows[i-1],sunRows[i+1]),sunRows[i]))*O.AU_KM);
assert(interpolationHoldoutKm<10,'Solar reference interpolation is too coarse');
let solarWorst=0,solarCount=0;const solarSample=[];
for(const [jd,earthRef] of refs.Earth){
 let i=Math.floor((jd-sunRows[0].jd)/20);if(i<0||i>=sunRows.length-1)continue;
 const time=A.AstroTime.FromTerrestrialTime(jd-2451545),r=O.eqjToFixed(A,minus(hermite(jd,sunRows[i],sunRows[i+1]),earthRef),time);
 for(const k of ['x','y','z'])r[k]*=O.AU_KM/O.EARTH_KM;
 const actual=O.geometricBodies(A,time,['Sun']).Sun;
 for(const observer of observers){solarWorst=Math.max(solarWorst,angle(minus(actual,observer),minus(r,observer)));solarCount++;}
}
assert(solarWorst<60);
summaries.push({body:'Sun',commonEpochs:refs.Earth.size,observerComparisons:solarCount,maxAngularErrorArcsec:solarWorst,referenceInterpolation:'Sun position cubic Hermite interpolation from 20-day JPL position/velocity samples; Earth samples exact.',solarInterpolation40DayHoldoutMaxKm:interpolationHoldoutKm});
// Separate barycentric checks cover both pieces of the solar direction; no interpolated reference values.
let bary=[];for(const name of ['Earth','Sun']){
 let maxKm=0;for(const [jd,r] of refs[name]){const t=A.AstroTime.FromTerrestrialTime(jd-2451545);maxKm=Math.max(maxKm,length(minus(A.BaryState(name,t),r))*O.AU_KM);}
 bary.push({body:name,epochs:refs[name].size,maxPositionErrorKm:maxKm});assert(Number.isFinite(maxKm));
}
const report={method:'Archived JPL Horizons DE441 geometric ICRF barycentric vectors; exact common epochs subtracted for Moon/Venus. TT is approximated by TDB (<2ms periodic difference). Earth-fixed rotation shared with rendering; independent frame sign check uses Greenwich ObserverVector test. Sun references use cubic Hermite interpolation with JPL velocities, verified against held-out samples. Earth and Sun additionally checked separately at their own reference epochs. These are geometric direction checks, not apparent sky accuracy certification.',summaries,barycentricChecks:bary,samples:results};
fs.writeFileSync(path.join(__dirname,'jpl-comparison-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({summaries,barycentricChecks:bary},null,2));
