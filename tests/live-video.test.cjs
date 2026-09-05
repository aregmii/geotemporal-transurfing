// Regressions execute the app's actual binding and live-card functions. Only browser/Three.js I/O is stubbed.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const source = fs.readFileSync(process.env.GT_APP_PATH || path.join(__dirname, '../site/app.js'), 'utf8');
function fixture(){
  const callbacks = [], created = [];
  let texture = 0;
  const noop = () => {};
  const ctx = {
    console, JSON, Number, Math, Object, Array, playDir:1,SPEEDS:[1],speedIx:0,lastPlayDir:1,nowT: Date.parse('2011-01-29'), MEDIA:{}, MEDIA_DIR:'media/', PHOTO_INDEX:{},
    window:{GTTime:{parseISO:Date.parse},GTEventPhotos:{photosFor:e=>e.photos || []},GTEventSelection:require('../site/event-selection.js'),GTMediaTransport:{advance:require('../site/media-transport.js').advance,createSeeker:(video,options)=>({seek:(position)=>{video.pause();video.currentTime=position;options.onFrame(video);},cancel:()=>video.pause(),pending:()=>false,settle:()=>Promise.resolve(),error:()=>null})}},
    document:{createElement:tag=>{
      if(tag==='canvas') return {frames:0};
      assert.equal(tag,'video');
      const v={paused:true,readyState:2,currentTime:0,setAttribute:noop,addEventListener:noop,play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;}};
      created.push(v);return v;
    }},
    THREE:{CanvasTexture:function(canvas){this.image=canvas;this.needsUpdate=false;}},
    shown:[],prevShown:[],monthCands:[],lastBindT:NaN,densityStats:{},windowTotal:0,
    PHOTOS_ONLY:false,densityLevel:1,camDist:3.9,wi:0,WINDOWS:[{era:0}],ERAS:[{slider:true}],off:{},selected:null,
    POOL:Array.from({length:20},()=>({visible:true,userData:{card:{material:{}},badge:{material:{}},beam:{material:{color:{set:noop}}}},position:{copy:noop},quaternion:{copy:noop}})),MAX_SHOWN:20,
    syncObserver:noop,inView:()=>true,prominence:()=>1,visibleNormal:()=>1,eventOnScreen:()=>true,shownCap:()=>20,contextFor:()=>[],catColor:()=>0,
    BADGE_LIVE:{live:{tex:{}}},liveKey:()=> 'live',liveFor2:()=>({tex:{}}),render:noop,
    cardTexture:(e,ready)=>{
      if(ready==='painter') return (video,canvas)=>{canvas.frames++;};
      if(typeof ready==='function') callbacks.push({event:e,callback:ready});
      return {fallback:++texture};
    }
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('function photoFor('), source.indexOf('var LINKS =')),ctx);
  vm.runInContext(source.slice(source.indexOf('function bindNow('),source.indexOf('// ---------- hot zones')),ctx);
  vm.runInContext(source.slice(source.indexOf('var LIVE ='),source.indexOf('// ---------- sound:')),ctx);
  ctx.event=(id,extra={})=>Object.assign({id,stableId:'event-'+id,mediaKey:'record-'+id,slug:'Same_article',lat:id,lon:0,cat:'sci',w:3,t0:2011,_p:1,_px:100,_sx:100},extra);
  ctx.clip=(file='movie.webm',extra={})=>Object.assign({file,kind:'video',mediaDate:'2011-01-28',autoplayApproved:true,mediaRole:'contemporaneous'},extra);
  ctx.bind=events=>{ctx.monthCands=events;ctx.bindNow(true);ctx.shown.forEach(e=>{e._sx=100;e.holder.visible=true;});};
  ctx.callbacks=callbacks;ctx.created=created;
  return ctx;
}

test('same article does not share a live element across events or replacement files',()=>{
  const f=fixture(),a=f.event(1),b=f.event(2);
  f.MEDIA[a.mediaKey]=f.clip('first.webm');f.MEDIA[b.mediaKey]=f.clip('second.webm');f.bind([a,b]);f.updateLive();
  assert.equal(Object.keys(f.LIVE).length,2);assert.deepEqual(f.created.map(v=>v.src).sort(),['media/first.webm','media/second.webm']);
  assert(f.created.every(v=>v.muted&&!v.loop&&v.playsInline&&v.paused));
  f.MEDIA[a.mediaKey]=f.clip('replacement.webm');f.bind([a,b]);f.updateLive();
  assert.equal(Object.keys(f.LIVE).length,3);assert.equal(Object.values(f.LIVE)[0].on,false);assert.equal(f.created[0].paused,true);assert.equal(f.created[2].src,'media/replacement.webm');
});

test('rewinding before the recording pauses it and replaces its texture even when a photo remains',()=>{
  const f=fixture(),e=f.event(1,{photos:[{file:'still.jpg',photoDate:'2011-01-25',photoRole:'contemporaneous'}]});
  f.MEDIA[e.mediaKey]=f.clip();f.bind([e]);const stamp=e.holder.userData.mediaStamp;const oldReady=f.callbacks.at(-1).callback;f.updateLive();
  const live=Object.values(f.LIVE)[0];assert.equal(e.holder.userData.card.material.map,live.tex);
  f.nowT=Date.parse('2011-01-27');f.bind([e]);f.updateLive();
  const u=e.holder.userData;assert.notEqual(u.mediaStamp,stamp);assert.equal(live.video.paused,true);assert.equal(u.card.material.map,u.fallbackMap);assert.notEqual(u.card.material.map,live.tex);
  const current=u.card.material.map;oldReady({stale:true});assert.equal(u.card.material.map,current);
});

test('late photo completion updates the fallback without replacing a running video',()=>{
  const f=fixture(),e=f.event(1,{photos:[{file:'still.jpg',photoDate:'2011-01-25',photoRole:'contemporaneous'}]});
  f.MEDIA[e.mediaKey]=f.clip();f.bind([e]);f.updateLive();const live=Object.values(f.LIVE)[0],image={loaded:true};
  f.callbacks.at(-1).callback(image);assert.equal(e.holder.userData.fallbackMap,image);assert.equal(e.holder.userData.card.material.map,live.tex);
  e._sx=null;f.updateLive();assert.equal(e.holder.userData.card.material.map,image);assert(live.video.paused);
});

test('visual-only selection includes vetted video but excludes audio and future recordings',()=>{
  const f=fixture(),video=f.event(1),audio=f.event(2),future=f.event(3),unapproved=f.event(4),context=f.event(5);
  f.PHOTOS_ONLY=true;f.MEDIA[video.mediaKey]=f.clip();f.MEDIA[audio.mediaKey]=f.clip('beep.opus',{kind:'audio'});
  f.MEDIA[future.mediaKey]=f.clip('future.webm',{mediaDate:'2011-02-01'});
  f.MEDIA[unapproved.mediaKey]=f.clip('review.webm',{autoplayApproved:false});f.MEDIA[context.mediaKey]=f.clip('context.webm',{mediaRole:'context'});
  f.bind([video,audio,future,unapproved,context]);assert.equal(f.shown.length,1);assert.equal(f.shown[0],video);
  f.updateLive();assert.equal(f.created.length,1);assert.equal(video.holder.userData.card.material.map,Object.values(f.LIVE)[0].tex);
  f.nowT=Date.parse('2011-01-27');f.bind([video]);f.updateLive();assert.equal(f.shown.length,0);assert(f.created[0].paused);
});

test('lazy playback respects visibility and cap; cleanup cannot overwrite another event in a reused holder',()=>{
  const f=fixture(),events=Array.from({length:10},(_,i)=>f.event(i));events.forEach(e=>{f.MEDIA[e.mediaKey]=f.clip(e.id+'.webm');});f.bind(events);
  events[0].holder.visible=false;f.updateLive();assert.equal(f.created.length,4);assert(!Object.values(f.LIVE).some(L=>L.event===events[0]));
  const retired=Object.values(f.LIVE)[0],h=retired.event.holder,replacement=f.event(99),safe={other:true};
  h.userData.bound=replacement;h.userData.card.material.map=safe;f.shown=[];f.updateLive();
  assert.equal(h.userData.card.material.map,safe);assert(f.created.every(v=>v.paused));assert(Object.values(f.LIVE).every(L=>!L.on));
});
