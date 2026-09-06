const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const monthly=require('../site/monthly-model.js');
const time=require('../site/time.js');
const transport=require('../site/media-transport.js');
const eventPlayer=require('../site/event-player.js');
const source=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8');
const date=iso=>time.parseISO(iso);
const noop=()=>{};
function forbidden(name){return ()=>assert.fail('Monthly mode reached '+name);}

// App functions close at column zero; extract their actual bodies without booting Three.js or the DOM.
function appFunction(name){
  const start=source.indexOf('function '+name+'(');assert(start>=0,'Missing app function '+name);
  const lineEnd=source.indexOf('\n',start),firstLine=source.slice(start,lineEnd);
  const end=firstLine.endsWith('}')?lineEnd:source.indexOf('\n}',lineEnd)+2;
  assert(end>start,'Unclosed app function '+name);return source.slice(start,end);
}
function load(context,names){vm.runInContext(names.map(appFunction).join('\n'),context);}
function element(tag='DIV'){
  const classes=new Set();
  return {tagName:tag.toUpperCase(),style:{},attrs:{},dataset:{},children:[],disabled:false,value:'',innerHTML:'',textContent:'',
    classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name)},
    setAttribute(name,value){this.attrs[name]=value;},
    appendChild(child){if(child.parentNode)child.parentNode.removeChild(child);this.children.push(child);child.parentNode=this;return child;},
    append(...children){children.forEach(child=>this.appendChild(child));},
    replaceChildren(...children){this.children=[];this.append(...children);},
    add(child){this.appendChild(child);},
    removeChild(child){this.children=this.children.filter(c=>c!==child);child.parentNode=null;},
    querySelectorAll(selector){return selector==='.month-tick'?this.children.filter(c=>c.className==='month-tick'):[];}};
}
class Video {
  constructor(){Object.assign(this,element('video'));this.currentTime=0;this.duration=20;this.readyState=2;this.seeking=false;this.paused=true;this.listeners={};this.playCalls=0;this.pauseCalls=0;}
  play(){this.paused=false;this.playCalls++;return Promise.resolve();}
  pause(){this.paused=true;this.pauseCalls++;}
  addEventListener(type,fn){(this.listeners[type]||(this.listeners[type]=new Set())).add(fn);}
  removeEventListener(type,fn){this.listeners[type]?.delete(fn);}
  emit(type){for(const fn of this.listeners[type]||[])fn();}
}
function fixture(){
  const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
  const video=new Video(),created=[],frames=[],skyDates=[],navigations=[],stepCalls=[];
  const event={id:1,stableId:'discovery',mediaKey:'discovery',slug:'STS-133',title:'Discovery launches',date:'2011-02-24',datePrecision:'day',t0:date('2011-02-24'),t1:date('2011-02-25'),cat:'sci',lat:28.58,lon:-80.65,place:'Kennedy Space Center',monthCountry:'United States',metadata:{},w:3,_sx:100,_px:100,holder:{visible:true}};
  const media={file:'discovery-launch-20110224.mp4',kind:'video',mediaDate:'2011-02-24',mediaRole:'contemporaneous',autoplayApproved:true,hasAudio:true,seconds:20};
  const live={key:'discovery-clip',event,video,position:0,duration:20,on:false,seeker:{cancel:noop,seek:forbidden('legacy selected-video seeker'),pending:()=>false}};
  const context={console,JSON,Math,Number,Object,Array,String,Promise,Date,MONTHLY:{...monthly,stepIndex(...args){stepCalls.push(args);return monthly.stepIndex(...args);}},
    TIME:time,MONTHS:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    nowT:date('2011-02-01'),wi:1,WINDOWS:Array.from({length:12},(_,i)=>({start:time.fromParts(2011,i+1,1),end:time.fromParts(2011,i+1,1),era:0})),ERAS:[{from:2011,to:date('2011-12-01'),slider:true}],
    selected:null,FOOTAGE:null,playDir:0,playing:false,lastPlayDir:1,playLast:0,clipFrameSeconds:0,monthElapsed:0,secondsPerMonth:1,monthLoading:false,
    navigationGeneration:0,ANIMS:[],SPEEDS:[1],speedIx:0,skyCatalogPoints:null,volume:.7,SOUND:{on:false,ctx:null,nodes:{},ambient:null},
    document:{hidden:false,body:element('body'),getElementById:get,createElement:tag=>element(tag)},
    window:{GTMonthly:monthly,GTTime:time,GTMediaTransport:transport,GTEventPlayer:{create(v,options){const player=eventPlayer.create(v,options);created.push(player);return player;}}},
    presentTime:()=>2012,clockNow:()=>0,photoFor:()=>null,mediaFor:()=>media,countryFor:()=>event.monthCountry,contextFor:()=>[],whenLabel:e=>e.date,
    monthLabel:t=>monthly.monthKey(t,time),tinyDesc:()=>'',ICON_URL:{sci:''},CATS:{sci:{label:'Science'}},IMG_DIR:'img/',MEDIA_DIR:'media/',
    syncHeader:noop,placeHandle:noop,bindWindow:noop,render:noop,renderRecommendations:noop,resetTicker:noop,writeHash:noop,resize:noop,showSpeed:noop,syncEventSound:noop,
    setSkyDate:d=>skyDates.push(d.toISOString()),setMode:forbidden('mode expansion'),windowIndexFor:forbidden('date-based reselection'),
    silenceTransportSound:forbidden('global transport sound'),setPlayDir:dir=>{context.playDir=dir;},closePanel:noop,
    liveFor:()=>live,clipIdentity:()=>live.key,paintLiveFrame:()=>frames.push(video.currentTime),
    setWindow:(index,keepNow)=>{navigations.push([index,keepNow]);context.wi=index;},
    exitFootage:forbidden('clip-to-history transition'),yearsPerSecNow:forbidden('continuous calendar advancement'),
    EVENTS:[event],LIVE:{[live.key]:live},shown:[event],liveMax:()=>4,camDist:2,track:get('track'),handle:null};
  for(const id of ['playBtn','rewBtn','ffBtn','toStartBtn','toEndBtn','playVal','returnHistory','footageSeek'])context[id]=get(id);
  vm.createContext(context);
  load(context,['viewBounds','eligibleEvent','inView','boundedTime','dateOfNow','cancelFootage','bindEventControls','enterFootage','openPanel','tickPlay']);
  return {c:context,event,media,live,video,created,frames,skyDates,navigations,stepCalls,get};
}

test('opening an in-month event and its recording preserves the displayed month',()=>{
  const f=fixture(),before=f.c.nowT;f.c.playDir=1;f.c.openPanel(f.event);
  assert.equal(f.c.nowT,before);assert.equal(f.c.wi,1);assert.equal(f.c.selected,f.event);assert.equal(f.c.FOOTAGE.event,f.event);
  assert.equal(f.c.playDir,0);assert.equal(f.created.length,1);assert.equal(f.c.FOOTAGE.recordingDate,'2011-02-24');
  assert(f.skyDates.every(d=>d==='2011-02-01T00:00:00.000Z'));assert.equal(f.navigations.length,0);
});
test('the panel rejects an event that started outside the displayed month',()=>{
  const f=fixture();f.c.openPanel({...f.event,date:'2011-03-01',t0:date('2011-03-01')});
  assert.equal(f.c.selected,null);assert.equal(f.c.FOOTAGE,null);assert.equal(f.created.length,0);assert.equal(f.c.wi,1);
});
test('monthly ticks hold a discrete month and use stepIndex rather than advancing calendar days',()=>{
  const f=fixture(),before=f.c.nowT;f.c.playDir=1;
  for(let i=1;i<=3;i++)f.c.tickPlay(i*250);
  assert.equal(f.c.nowT,before);assert.equal(f.c.wi,1);assert.equal(f.c.monthElapsed,.75);assert.equal(f.navigations.length,0);
  f.c.tickPlay(1000);assert.equal(f.c.nowT,date('2011-03-01'));assert.equal(f.c.wi,2);assert.equal(f.c.monthElapsed,0);
  assert.deepEqual(f.navigations,[[2,true]]);assert.equal(f.stepCalls.length,4);assert.deepEqual(f.stepCalls[0],[1,0,.25,1,1,12]);
});
test('paused, selected, loading, and hidden states hold the calendar without accumulating steps',()=>{
  for(const mode of ['paused','selected','loading','hidden']){
    const f=fixture(),before=f.c.nowT;f.c.playDir=mode==='paused'?0:1;f.c.monthElapsed=.5;
    if(mode==='selected')f.c.selected=f.event;if(mode==='loading')f.c.monthLoading=true;if(mode==='hidden')f.c.document.hidden=true;
    f.c.tickPlay(10000);assert.equal(f.c.nowT,before);assert.equal(f.c.monthElapsed,.5);assert.equal(f.stepCalls.length,0);assert.equal(f.navigations.length,0);
  }
});
test('selected event reverse clamps at zero without exiting into world history',()=>{
  const f=fixture(),before=f.c.nowT;f.c.openPanel(f.event);load(f.c,['setPlayDir']);
  const held=f.c.FOOTAGE;held.player.seek(.1);f.video.emit('seeked');f.c.setPlayDir(-1);f.c.tickPlay(250);f.video.emit('seeked');
  assert.equal(held.player.state().position,0);assert.equal(held.player.state().direction,0);assert.equal(f.c.playDir,0);
  assert.equal(f.c.FOOTAGE,held);assert.equal(f.c.selected,f.event);assert.equal(f.c.nowT,before);assert.equal(f.c.wi,1);assert.equal(f.stepCalls.length,0);
});
test('live-card refresh never seeks or pauses the selected native player',async()=>{
  const f=fixture();f.c.openPanel(f.event);load(f.c,['setPlayDir','updateLive']);
  f.c.FOOTAGE.player.setSound(true);f.c.setPlayDir(1);await Promise.resolve();
  const pauses=f.video.pauseCalls;f.video.currentTime=2;f.c.tickPlay(250);f.c.updateLive();
  assert.equal(f.video.pauseCalls,pauses);assert.equal(f.video.paused,false);assert.equal(f.video.muted,false);assert.equal(f.c.FOOTAGE.player.state().position,2);
  assert.equal(f.c.nowT,date('2011-02-01'));assert.equal(f.stepCalls.length,0);
});
test('monthly Sound uses only the selected player and never creates ambience or global audio',async()=>{
  const f=fixture();load(f.c,['setSound','updateSound','syncEventSound','setPlayDir']);
  f.c.window.AudioContext=forbidden('AudioContext');f.c.scheduleMotif=forbidden('ambient motif');f.c.updateAmbient=forbidden('ambient pad');f.c.soundNode=forbidden('unselected audio');
  f.c.setSound(true);f.c.updateSound();assert.equal(f.c.SOUND.ctx,null);assert.equal(f.get('soundBtn').disabled,true);assert.equal(f.get('volRange').disabled,true);
  f.c.openPanel(f.event);f.c.setPlayDir(1);await Promise.resolve();f.c.updateSound();
  assert.equal(f.video.muted,false);assert.equal(f.video.paused,false);assert.equal(f.c.SOUND.ctx,null);assert.equal(f.get('soundBtn').disabled,false);
});
test('silent event controls stay disabled with an explicit reason',()=>{
  const f=fixture();f.media.hasAudio=false;load(f.c,['setSound','syncEventSound']);f.c.openPanel(f.event);f.c.setSound(true);
  assert.equal(f.get('soundBtn').disabled,true);assert.equal(f.get('volRange').disabled,true);assert.equal(f.get('soundBtn').attrs['aria-pressed'],'false');
  assert.match(f.get('eventAudioStatus').textContent,/Silent recording/);assert.equal(f.video.muted,true);
});
test('calendar controls and month ticks are held while an event is selected',()=>{
  const f=fixture();f.c.selected=f.event;load(f.c,['clipClock','showSpeed','buildRail','placeHandle']);f.c.buildRail();f.c.showSpeed();f.c.placeHandle();
  for(const id of ['playBtn','rewBtn','ffBtn','toStartBtn','toEndBtn','monthInput','monthDuration','previousMonth','nextMonth'])assert.equal(f.get(id).disabled,true,id+' must be held');
  assert.equal(f.get('playVal').textContent,'MONTH HELD');const buttons=f.c.track.querySelectorAll('.month-tick');assert.equal(buttons.length,12);
  assert(buttons.every(b=>b.disabled));buttons[3].onclick();assert.equal(f.navigations.length,0);assert.equal(f.c.wi,1);
  f.c.selected=null;f.c.showSpeed();f.c.placeHandle();assert.equal(f.get('monthInput').disabled,false);assert(buttons.every(b=>!b.disabled));
});
test('selected-event keyboard controls do not navigate the world month',()=>{
  const f=fixture();f.c.openPanel(f.event);let handler;
  f.c.window.addEventListener=(name,fn)=>{assert.equal(name,'keydown');handler=fn;};
  const start=source.indexOf("window.addEventListener('keydown', function(ev){"),end=source.indexOf('\nfunction setWindow(',start);
  assert(start>=0&&end>start);vm.runInContext(source.slice(start,end),f.c);
  let prevented=false;handler({key:'ArrowRight',target:f.c.document.body,preventDefault:()=>{prevented=true;}});
  assert.equal(prevented,true);assert.equal(f.c.FOOTAGE.player.state().position,1);assert.equal(f.c.nowT,date('2011-02-01'));assert.equal(f.navigations.length,0);
});
test('Earth monthly mode hides calculated sky bodies instead of implying event-time positions',()=>{
  const f=fixture();Object.assign(f.c,{sky:{visible:true},bodiesGroup:{visible:true},skyAvailable:true,skyDate:new Date(),skyDateText:'',sunLight:{position:{set:noop}},writeViewpoint:noop});
  load(f.c,['setSkyDate']);f.c.setSkyDate(new Date('2011-02-24T21:53:24Z'));
  assert.equal(f.c.sky.visible,false);assert.equal(f.c.bodiesGroup.visible,false);assert.equal(f.c.skyAvailable,false);assert.equal(f.c.skyDate,null);assert.equal(f.c.skyDateText,'EARTH · MONTHLY ARCHIVE');
});
test('reopening the same selected footage retains one player and its position',()=>{
  const f=fixture();f.c.openPanel(f.event);const player=f.c.FOOTAGE.player;player.seek(5);f.video.emit('seeked');f.c.openPanel(f.event);
  assert.equal(f.created.length,1,'An existing selected player must be reused, not duplicated');assert.equal(f.c.FOOTAGE.player,player);assert.equal(player.state().position,5);
});

test('switching from footage to another monthly event disposes the old player before flying',async()=>{
  const f=fixture(),other={...f.event,id:900,stableId:'different-event',slug:'Different_event',title:'Another country’s event',lat:41.33,lon:19.82};
  f.c.EVENTS.push(other);f.c.mediaFor=e=>e===f.event?f.media:null;
  f.c.flyTo=e=>f.navigations.push(e.stableId);load(f.c,['selectEvent']);
  f.c.selectEvent(f.event);f.c.FOOTAGE.player.setDirection(1);await Promise.resolve();
  assert.equal(f.video.paused,false);
  f.c.selectEvent(other.stableId);
  assert.equal(f.c.selected,other);assert.equal(f.c.FOOTAGE,null);assert.equal(f.video.paused,true);
  assert(f.get('panel').innerHTML.includes(other.title));assert.equal(f.c.nowT,date('2011-02-01'));
  assert.deepEqual(f.navigations,[f.event.stableId,other.stableId]);
});

test('country coverage floors never trim events or hide empty countries; filters do not rewrite coverage',()=>{
  const f=fixture();
  f.c.EVENTS=Array.from({length:15},(_,i)=>({...f.event,id:i,stableId:'us-'+i,slug:'us-'+i}));
  Object.assign(f.c,{off:{},PHOTOS_ONLY:false,MONTHLY_POLICY:{countries:[{id:'USA',name:'United States',minimum:12,highIncome:true},{id:'NPL',name:'Nepal',minimum:3}]},
    Option:function(text,value){return {...element('option'),textContent:text,value};},
    inWindow:()=>true,visualFor:()=>null,bindNow:noop});
  load(f.c,['bindWindow','renderMonthList']);f.c.bindWindow();
  assert.equal(f.c.monthCands.length,15);
  assert.equal(f.c.monthSelection.coverage.countries.find(c=>c.name==='United States').available,15);
  assert.equal(f.get('monthEvents').children.length,15);
  const options=f.get('monthCountry').children;
  assert(options.some(o=>o.value==='Nepal'&&o.textContent.includes('0 records / 3+ target')));
  f.c.off.sci=true;f.c.bindWindow();
  assert.equal(f.c.monthCands.length,0);
  assert.equal(f.c.monthSelection.coverage.countries.find(c=>c.name==='United States').available,15);
  f.get('monthCountry').value='Nepal';f.c.renderMonthList();
  assert.match(f.get('monthEvents').children[0].textContent,/Coverage gap.*Nepal.*at least 3/);
});
