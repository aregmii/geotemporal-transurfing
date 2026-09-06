const test=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../site/event-player.js');
const transport=require('../site/media-transport.js');

class Video {
  constructor(){this._time=0;this.duration=20;this.readyState=2;this.seeking=false;this.paused=true;this.ended=false;this.listeners={};this.playCalls=0;this.seekCalls=[];}
  get currentTime(){return this._time;}
  set currentTime(value){this._time=value;this.next=value;this.seeking=true;this.seekCalls.push(value);}
  pause(){this.paused=true;}
  play(){this.playCalls++;this.paused=false;return this.playResult?this.playResult():Promise.resolve();}
  addEventListener(type,fn){(this.listeners[type]||(this.listeners[type]=new Set())).add(fn);}
  removeEventListener(type,fn){this.listeners[type]?.delete(fn);}
  emit(type){for(const fn of this.listeners[type]||[])fn();}
  complete(){this.seeking=false;this.readyState=2;this.emit('seeked');}
  advance(seconds){this._time+=seconds;}
}
function fixture(extra={}){
  const video=new Video(),frames=[],states=[];
  const player=create(video,{transport,hasAudio:true,duration:20,onFrame:v=>frames.push(v.currentTime),onState:s=>states.push(s),...extra});
  return {video,player,frames,states};
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

test('initial player holds the first frame, with audio available but not enabled',()=>{
  const {video,player,frames}=fixture();
  assert.deepEqual(player.state(),{position:0,duration:20,direction:0,rate:1,soundEnabled:false,audioAvailable:true,audioReason:'Sound off',error:null,pending:false});
  assert(video.paused&&video.muted&&!video.loop&&video.playsInline);assert.equal(video.playCalls,0);assert.deepEqual(frames,[0]);
});
test('forward 1× calls native play synchronously and uses the decoded video clock',async()=>{
  const {video,player,frames}=fixture();player.setSound(true);player.setDirection(1);
  assert.equal(video.playCalls,1);assert.equal(video.muted,false);assert.equal(player.state().pending,true);
  await Promise.resolve();video.advance(3.25);player.tick(15);
  assert.equal(player.state().position,3.25);assert.equal(player.state().pending,false);assert.equal(frames.at(-1),3.25);
  assert.deepEqual(video.seekCalls,[]);assert.equal(video.playCalls,1);
});
test('pause and reverse preserve the last native position; forward resumes at the seek target',async()=>{
  const {video,player}=fixture();player.setSound(true);player.setDirection(1);await Promise.resolve();video.advance(8);player.pause();
  assert.equal(player.state().position,8);assert.equal(player.state().direction,0);assert(video.paused&&video.muted);
  player.setDirection(-1);player.tick(2);video.complete();
  assert.equal(player.state().position,6);assert.equal(player.state().audioAvailable,false);assert.match(player.state().audioReason,/Reverse/);
  player.setDirection(1);assert.equal(video.playCalls,2);assert.equal(video.currentTime,6);assert.equal(video.muted,false);
});
test('muted frame seeking owns every non-1× rate, including accelerated forward',()=>{
  const {video,player}=fixture();player.seek(10);video.complete();player.setSound(true);player.setRate(60);player.setDirection(-1);player.tick(.1);video.complete();
  assert.equal(player.state().position,4);assert(video.paused&&video.muted);assert.equal(video.playCalls,0);
  player.setDirection(1);player.tick(.1);video.complete();assert.equal(player.state().position,10);
  assert.equal(player.state().audioAvailable,false);assert.match(player.state().audioReason,/1×/);
  player.setRate(1);assert.equal(video.playCalls,1);assert.equal(video.muted,false);
});
test('both seek-mode boundaries clamp and pause without another phase or a loop',()=>{
  const {video,player}=fixture();player.setRate(60);player.setDirection(1);player.tick(5);video.complete();
  assert.equal(player.state().position,20);assert.equal(player.state().direction,0);assert.equal(video.loop,false);
  player.setDirection(-1);player.tick(5);video.complete();assert.equal(player.state().position,0);assert.equal(player.state().direction,0);
  player.tick(500);assert.equal(player.state().position,0);assert.equal(video.playCalls,0);
});
test('native end pauses at the clip duration and an explicit seek enables replay',async()=>{
  const {video,player}=fixture();player.setDirection(1);await Promise.resolve();video.advance(20);video.ended=true;video.emit('ended');
  assert.equal(player.state().direction,0);assert.equal(player.state().position,20);assert(video.paused&&video.muted);
  player.setDirection(1);assert.equal(video.playCalls,1);
  video.ended=false;player.seek(0);video.complete();player.setDirection(1);assert.equal(video.playCalls,2);
});
test('silent and unverified tracks never become unmuted',()=>{
  for(const hasAudio of [false,undefined,null,'true']){
    const {video,player}=fixture({hasAudio});player.setSound(true);player.setDirection(1);
    assert.equal(player.state().soundEnabled,false);assert.equal(player.state().audioAvailable,false);assert.equal(video.muted,true);
    assert.match(player.state().audioReason,hasAudio===false?/Silent recording/:/unverified/);
  }
});
test('Sound click invokes native playback directly; volume and mute affect the selected element',async()=>{
  const {video,player}=fixture();player.setDirection(1);await Promise.resolve();player.setSound(true);
  assert.equal(video.playCalls,2);assert.equal(video.muted,false);player.setSound(true);assert.equal(video.playCalls,2);
  player.setVolume(.3);assert.equal(video.volume,.3);player.setVolume(0);assert.equal(video.muted,true);assert.equal(player.state().audioReason,'Volume is zero');
  player.setVolume(2);assert.equal(video.volume,1);assert.equal(video.muted,false);
  player.setSound(false);assert.equal(video.muted,true);assert.equal(player.state().soundEnabled,false);assert.equal(video.playCalls,2);
});
test('rejected native playback stops and explains the block without animation-frame retry storms',async()=>{
  const {video,player}=fixture();video.playResult=()=>Promise.reject(Object.assign(new Error('Denied'),{name:'NotAllowedError'}));player.setDirection(1);
  await Promise.resolve();assert.equal(player.state().direction,0);assert.equal(player.state().pending,false);assert.match(player.state().error,/blocked/);
  for(let i=0;i<100;i++)player.tick(.016);assert.equal(video.playCalls,1);assert(video.paused&&video.muted);
  video.playResult=()=>Promise.resolve();player.setDirection(1);await Promise.resolve();assert.equal(video.playCalls,2);assert.equal(player.state().error,null);
});
test('synchronous play failure produces the same recoverable stopped state',()=>{
  const {video,player}=fixture();video.playResult=()=>{throw new Error('Unsupported');};player.setDirection(1);
  assert.equal(player.state().direction,0);assert.equal(player.state().pending,false);assert.match(player.state().error,/could not start/);
});
test('a stale play rejection cannot stop a later user-started generation',async()=>{
  const {video,player}=fixture(),old=deferred();video.playResult=()=>old.promise;player.setDirection(1);player.pause();
  video.playResult=()=>Promise.resolve();player.setDirection(1);await Promise.resolve();old.reject(new Error('Old rejection'));await Promise.resolve();
  assert.equal(player.state().direction,1);assert.equal(player.state().error,null);assert.equal(video.paused,false);
});
test('browser-initiated pauses stop the UI state and do not auto-retry',async()=>{
  for(const sendEvent of [true,false]){
    const {video,player}=fixture();player.setDirection(1);await Promise.resolve();video.advance(4);video.pause();
    if(sendEvent)video.emit('pause');else player.tick(.01);
    assert.equal(player.state().direction,0);assert.equal(player.state().position,4);assert.equal(player.state().error,null);
    player.tick(1);assert.equal(video.playCalls,1);player.setDirection(1);assert.equal(video.playCalls,2);
  }
});
test('an old queued pause event cannot stop newly resumed native playback',async()=>{
  const {video,player}=fixture();player.setDirection(1);await Promise.resolve();player.pause();player.setDirection(1);await Promise.resolve();
  video.emit('pause');assert.equal(player.state().direction,1);assert.equal(video.paused,false);
});
test('late native resolution cannot revive a paused or disposed player',async()=>{
  for(const finish of ['pause','dispose']){
    const {video,player}=fixture(),old=deferred();video.playResult=()=>old.promise;player.setDirection(1);player[finish]();
    old.resolve();await Promise.resolve();assert.equal(player.state().direction,0);assert.equal(player.state().pending,false);assert(video.paused&&video.muted);
  }
});
test('scrubbing pauses, clamps, decodes the requested frame, and never auto-resumes',()=>{
  const {video,player,frames}=fixture();player.setDirection(1);video.advance(2);player.seek(7);video.complete();
  assert.equal(player.state().direction,0);assert.equal(player.state().position,7);assert.equal(frames.at(-1),7);assert(video.paused&&video.muted);
  player.seek(200);video.complete();assert.equal(player.state().position,20);player.seek(-10);video.complete();assert.equal(player.state().position,0);
});
test('pausing a queued reverse seek still decodes the final held position',()=>{
  const {video,player,frames}=fixture();player.seek(10);video.complete();player.setDirection(-1);
  player.tick(2);player.tick(2);assert.equal(player.state().position,6);assert.equal(video.currentTime,8);
  player.setDirection(0);assert.equal(player.state().pending,true);video.complete();video.complete();
  assert.equal(player.state().position,6);assert.equal(frames.at(-1),6);assert.equal(player.state().pending,false);assert.equal(player.state().direction,0);
});
test('a completed paused scrub emits its settled state without requiring a playback tick',async()=>{
  const {video,player,states}=fixture();player.seek(7);assert.equal(states.at(-1).pending,true);
  video.complete();await Promise.resolve();assert.equal(states.at(-1).pending,false);assert.equal(states.at(-1).position,7);
  assert.equal(states.at(-1).direction,0);
});
test('metadata updates duration and pending state without starting playback',()=>{
  const video=new Video();video.duration=NaN;video.readyState=0;
  const player=create(video,{transport,hasAudio:true,duration:18});assert.equal(player.state().duration,18);assert.equal(player.state().pending,true);
  video.duration=17.5;video.readyState=2;video.emit('loadedmetadata');video.emit('loadeddata');
  assert.equal(player.state().duration,17.5);assert.equal(player.state().pending,false);assert.equal(video.playCalls,0);
});
test('decoder failure stops permanently and disposal removes callbacks and listeners',()=>{
  const {video,player,frames,states}=fixture();player.seek(5);video.emit('error');assert.match(player.state().error,/decoded/);assert.equal(player.state().direction,0);
  player.setDirection(1);assert.equal(video.playCalls,0);player.dispose();const beforeFrames=frames.length,beforeStates=states.length;
  video.complete();video.emit('loadedmetadata');video.emit('ended');player.tick(1);player.seek(2);player.setSound(true);
  assert.equal(frames.length,beforeFrames);assert.equal(states.length,beforeStates);assert.equal(player.state().audioAvailable,false);
  assert.equal(Object.values(video.listeners).reduce((n,set)=>n+set.size,0),0);
});
