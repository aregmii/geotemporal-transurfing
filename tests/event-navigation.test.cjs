const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../site/app.js'),'utf8');
function appFunction(name){
  const start=source.indexOf('function '+name+'('),lineEnd=source.indexOf('\n',start);
  assert(start>=0,'Missing '+name);
  return source.slice(start,source.indexOf('\n}',lineEnd)+2);
}
function fixture(){
  const events=[{id:12,stableId:'south-sudan',lat:4.85,lon:31.6},{id:700,stableId:'electoral-fraud-protest',lat:41.33,lon:19.82}];
  const calls=[],c={EVENTS:events,Number,Array,selected:null,ANIMS:[],now:0,focusCount:0,document:{getElementById(){return {focus(){c.focusCount++;}};}},clockNow(){return c.now;},
    openPanel(e){c.selected=e;c.ANIMS.length=0;calls.push(['open',e.stableId]);return true;},
    flyTo(e){calls.push(['fly',e.stableId]);c.ANIMS.push(()=>true);}};
  vm.createContext(c);vm.runInContext(appFunction('selectEvent')+'\n'+appFunction('runAnims'),c);
  return {c,events,calls};
}
test('selecting another event updates the detail before flying, independent of array index',()=>{
  const {c,events,calls}=fixture();
  assert.equal(c.selectEvent(events[0]),true);assert.equal(c.selected,events[0]);
  assert.equal(c.selectEvent(events[1].stableId),true);assert.equal(c.selected,events[1]);
  assert.equal(c.focusCount,2,'Each explicit selection transfers keyboard focus into the event panel');
  assert.deepEqual(calls,[['open','south-sudan'],['fly','south-sudan'],['open','electoral-fraud-protest'],['fly','electoral-fraud-protest']]);
  c.ANIMS.length=0;assert.equal(c.selected,events[1],'Interrupting camera movement must not discard the clicked event');
});
test('unknown, unmappable, or out-of-month selection does not fly away',()=>{
  const {c,calls,events}=fixture();
  assert.equal(c.selectEvent('missing'),false);assert.equal(c.selectEvent(null),false);
  assert.equal(c.selectEvent({...events[0],lat:NaN}),false);assert.equal(calls.length,0);
  c.openPanel=()=>false;assert.equal(c.selectEvent(events[0]),false);assert.equal(calls.length,0);
});
test('animation completion cannot delete a replacement flight or run cancelled animations',()=>{
  const {c}=fixture(),calls=[];
  const replacement=()=>{calls.push('replacement');return true;};
  c.ANIMS=[()=>{calls.push('cancelled');return true;},()=>{calls.push('completed');c.ANIMS.length=0;c.ANIMS.push(replacement);return true;}];
  c.runAnims();assert.deepEqual(calls,['completed']);assert.equal(c.ANIMS[0],replacement);
  c.runAnims();assert.deepEqual(calls,['completed','replacement']);assert.equal(c.ANIMS.length,0);
});
test('monthly fly-to restores a context-sized view and newer navigation replaces the old flight',()=>{
  const {c,events}=fixture();
  function quat(){return {clone:quat,copy(value){this.target=value;return this;},slerp(value){this.target=value;return this;}};}
  Object.assign(c,{MONTHLY:{},navigationGeneration:0,Math,orbitQuat:quat(),camDist:1.05,minCamDist:1.01,FLY_HEIGHT:1.62,
    setPlayDir(){},setObserverMode(){c.ANIMS.length=0;},targetQuat:(lat,lon)=>({lat,lon}),syncObserver(){},bindNow(){},render(){},bumpIdle(){}});
  vm.runInContext(appFunction('flyTo'),c);
  const completed=[];c.flyTo(events[0],()=>completed.push('old'));c.now=100;c.flyTo(events[1],()=>completed.push('new'));
  c.now=1700;c.runAnims();assert.deepEqual(completed,['new']);assert.equal(c.camDist,2.05);
  assert.deepEqual(c.orbitQuat.target,{lat:events[1].lat,lon:events[1].lon});
});
