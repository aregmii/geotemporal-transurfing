const test=require('node:test');
const assert=require('node:assert/strict');
const {advance,createSeeker}=require('../site/media-transport.js');
class Video {
  constructor(){this._time=0;this.readyState=2;this.duration=30;this.seeking=false;this.paused=false;this.listeners={};this.requests=[];}
  pause(){this.paused=true;}
  get currentTime(){return this._time;}
  set currentTime(value){this.requests.push(value);this.next=value;this.seeking=true;}
  addEventListener(type,fn){(this.listeners[type]||(this.listeners[type]=new Set())).add(fn);}
  removeEventListener(type,fn){if(this.listeners[type])this.listeners[type].delete(fn);}
  emit(type){for(const fn of this.listeners[type]||[])fn();}
  complete(){this._time=this.next;this.seeking=false;this.emit('seeked');}
}
test('pause holds the clip; reversal is continuous and independent of calendar time',()=>{
  let p=advance(0,30,9,1,1,false).position;assert.equal(p,9);
  assert.equal(advance(p,30,1.5,0,1,false).position,p);
  p=advance(p,30,3,-1,1,false).position;assert.equal(p,6);
  assert.equal(advance(p,30,2,-1,.1,false).position,5.8);
});
test('accelerated reverse returns unused elapsed time at the clip boundary; forward end clamps',()=>{
  const result=advance(3.5,30,.25,-1,16,false);
  assert.equal(result.position,0);assert.equal(result.boundary,'start');assert.equal(result.remaining,.03125);
  const end=advance(29.9,30,.2,1,1,false);assert.equal(end.position,30);assert.equal(end.boundary,'end');
  assert.equal(advance(0,30,.1,-1,1,false).position,0);
});
test('queued seeks coalesce but every decoded reverse frame is painted under continuous requests',async()=>{
  const v=new Video(),frames=[],s=createSeeker(v,{onFrame:video=>frames.push(video.currentTime)});
  s.seek(10);s.seek(9.8);s.seek(9.5);assert.deepEqual(v.requests,[10]);
  v.complete();assert.deepEqual(frames,[10]);assert.deepEqual(v.requests,[10,9.5]);
  s.seek(9.3);s.seek(9);v.complete();assert.deepEqual(frames,[10,9.5]);assert.deepEqual(v.requests,[10,9.5,9]);
  const done=s.settle();v.complete();assert.deepEqual(frames,[10,9.5,9]);assert.equal((await done).position,9);assert.equal(s.pending(),false);assert(v.paused&&v.muted&&!v.loop);
});
test('settle waits for metadata and the final requested decode without advancing the target',async()=>{
  const v=new Video();v.readyState=0;const frames=[],s=createSeeker(v,{onFrame:video=>frames.push(video.currentTime)});
  s.seek(5);let finished=false;const promise=s.settle().then(()=>{finished=true;});await Promise.resolve();assert.equal(finished,false);assert.deepEqual(v.requests,[]);
  v.readyState=1;v.emit('loadedmetadata');assert.deepEqual(v.requests,[5]);v.readyState=2;v.complete();await promise;assert.deepEqual(frames,[5]);assert.equal(s.target(),5);
});
test('cancellation resolves pending waits and blocks stale decode callbacks',async()=>{
  const v=new Video(),frames=[],s=createSeeker(v,{onFrame:video=>frames.push(video.currentTime)});
  s.seek(10);const promise=s.settle();s.cancel();assert.equal((await promise).cancelled,true);v.complete();assert.deepEqual(frames,[]);
  s.seek(2);v.complete();await s.settle();assert.equal(frames.at(-1),2);
  s.seek(1);s.dispose();v.complete();assert.equal(frames.at(-1),2);
});
test('decoder errors reject settlement once and are not reset by the next animation frame',async()=>{
  const v=new Video(),errors=[],s=createSeeker(v,{onError:e=>errors.push(e.message)});
  s.seek(8);const done=s.settle();v.emit('error');await assert.rejects(done,/could not be decoded/);s.seek(9);s.seek(10);assert.deepEqual(v.requests,[8]);assert.equal(errors.length,1);assert(s.error());
});
test('unchanged paused frames do not request repeated decoding or painting',async()=>{
  const v=new Video();let paints=0;const s=createSeeker(v,{onFrame:()=>paints++});s.seek(5);v.complete();await s.settle();const before=paints;
  for(let i=0;i<120;i++)s.seek(5);assert.equal(paints,before);assert.deepEqual(v.requests,[5]);assert.equal(v.paused,true);
});
test('clip slider captures the requested position before pause refreshes the controls',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const app=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8');
  const handler=/footageSeek\.oninput=(function\(\)\{[^\n]+\});/.exec(app);assert(handler,'Missing clip position input handler');
  const slider={value:'10'},positions=[],context={FOOTAGE:{live:{duration:20,position:2,seeker:{seek:t=>positions.push(t)}}},Math,showSpeed(){},setPlayDir(){slider.value='2';}};
  vm.createContext(context);vm.runInContext('input='+handler[1],context);context.input.call(slider);
  assert.equal(context.FOOTAGE.live.position,10);assert.deepEqual(positions,[10]);
});
test('settlement recovers a completed native seek whose event was lost during reparenting',async()=>{
  const v=new Video(),s=createSeeker(v);s.seek(7);
  v._time=7;v.seeking=false; // Native decoder completed, but no seeked callback reached the detached element.
  await s.settle();assert.equal(s.pending(),false);assert.equal(s.target(),7);
});
function pendingLinkFixture(){
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const app=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8'),noop=()=>{},loads=[],opened=[];
  const element={classList:{remove:noop},style:{}};
  const c={URLSearchParams,Object,Number,Math,String,encodeURIComponent,mode:'recent',nowT:2014,temporalView:'period',periodDays:1825,viewSelect:{value:'1825'},
    selected:null,FOOTAGE:null,navigationGeneration:0,ANIMS:[],EVENTS:[],ERA_SETS:{recent:{}},ERAS:[{slider:true}],WINDOWS:[{start:2010,end:2011,era:0}],wi:0,
    location:{hash:'#mode=recent&y=2011.1479452054793&view=1825&event=evt-1ouxa88-1i8lkjy'},window:{addEventListener:noop},document:{getElementById:()=>element},canvas:element,
    boundedTime:t=>t,eligibleEvent:()=>true,inView:()=>true,dateOfNow:()=>new Date(0),setSkyDate:noop,bindWindow:noop,syncHeader:noop,placeHandle:noop,render:noop,resetTicker:noop,showSpeed:noop,
    ensureYears:(start,end,done)=>loads.push(done),flyTo:(e,done)=>done(),openPanel:e=>{c.selected=e;opened.push(e.stableId);c.writeHash();},closePanel:()=>{c.selected=null;c.pendingEventHash=null;},setMode:noop};
  c.history={replaceState:(state,title,url)=>{c.location.hash=url;}};
  vm.createContext(c);
  vm.runInContext(app.slice(app.indexOf('function setWindow('),app.indexOf('function syncHeader(')),c);
  vm.runInContext(app.slice(app.indexOf('function windowIndexFor('),app.indexOf("window.addEventListener('hashchange'")),c);
  const initialStart=app.lastIndexOf('ensureYears(WINDOWS[wi].start, WINDOWS[wi].end, function(added)');
  const initial=app.slice(initialStart,app.indexOf('\nfunction refreshPresentBounds',initialStart));
  return {c,opened,initial:()=>vm.runInContext(initial,c),deliver:async event=>{await Promise.resolve();if(event)c.EVENTS.push(event);const ready=loads.splice(0);ready.forEach(done=>done(!!event));}};
}
test('initial shared event survives asynchronous shards and URL rewrites without reparsing the URL',async()=>{
  const f=pendingLinkFixture(),event={stableId:'evt-1ouxa88-1i8lkjy',slug:'STS-133',t0:2011.1479452054793};
  f.c.readHash();f.initial();
  assert.equal(f.c.pendingEventHash,event.stableId);assert(f.c.location.hash.includes('event='+event.stableId));assert.equal(f.opened.length,0);
  // A UI rewrite must not change the identity retained for the in-flight data request.
  f.c.location.hash='#mode=recent&y=2011.1479452054793&view=1825';
  await f.deliver(event);assert.deepEqual(f.opened,[event.stableId]);assert.equal(f.c.selected,event);assert(f.c.location.hash.includes('event='+event.stableId));
  await f.deliver();assert.equal(f.opened.length,1);
});
test('explicit calendar navigation cancels a pending shared event before its shard arrives',async()=>{
  const f=pendingLinkFixture();f.c.readHash();f.initial();f.c.goToMoment(2012);
  assert.equal(f.c.pendingEventHash,null);
  await f.deliver({stableId:'evt-1ouxa88-1i8lkjy',slug:'STS-133',t0:2011.1479452054793});
  assert.equal(f.opened.length,0);assert.equal(f.c.selected,null);assert.equal(f.c.nowT,2012);assert(!f.c.location.hash.includes('event='));
});
test('60× selection keeps reverse direction and advances six clip seconds in 100 ms',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const app=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8');
  const rates=/var SPEEDS = \[[^\n]+\];/.exec(app)[0];
  const setter=/function setSpeed\(rate\)\{[^\n]+\}/.exec(app)[0];
  const tick=app.slice(app.indexOf('function tickPlay(now){'),app.indexOf('function dateOfNow(){'));
  const positions=[],context={window:{GTMediaTransport:require('../site/media-transport.js')},Math,speedIx:3,playDir:-1,playLast:0,nowT:2011,
    FOOTAGE:{live:{position:20,duration:30,seeker:{seek:t=>positions.push(t)}}},showSpeed(){}};
  vm.createContext(context);vm.runInContext(rates+'\n'+setter+'\n'+tick,context);
  context.setSpeed('60');context.tickPlay(100);
  assert.equal(context.SPEEDS[context.speedIx],60);assert.equal(context.playDir,-1);
  assert.equal(context.FOOTAGE.live.position,14);assert.deepEqual(positions,[14]);assert.equal(context.nowT,2011);
});
