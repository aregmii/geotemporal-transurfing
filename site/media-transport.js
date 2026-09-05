(function(root,factory){
  var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GTMediaTransport=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function advance(position,duration,seconds,direction,rate,loop){
    duration=Math.max(0,Number(duration)||0);position=Math.max(0,Math.min(duration,Number(position)||0));
    var delta=Math.max(0,Number(seconds)||0)*(Number(rate)||1)*(direction<0?-1:direction>0?1:0),next=position+delta;
    if(!duration||!delta)return {position:position,boundary:null,remaining:0};
    if(loop)return {position:((next%duration)+duration)%duration,boundary:null,remaining:0};
    var boundary=next<=0&&direction<0?'start':next>=duration&&direction>0?'end':null;
    return {position:Math.max(0,Math.min(duration,next)),boundary:boundary,remaining:boundary?Math.abs(next-(boundary==='start'?0:duration))/rate:0};
  }
  // Keep one decode in flight; a newer request replaces the queued target. Both directions use decoded frames.
  function createSeeker(video,options){
    options=options||{};
    var target=0,inFlight=false,active=false,disposed=false,waiters=[],failure=null,painted=NaN;
    video.pause();video.muted=true;video.loop=false;
    function pending(){return active&&!failure&&(inFlight||video.seeking||video.readyState<2||Math.abs(video.currentTime-target)>1/120||painted!==target);}
    function finish(){if(pending())return;var batch=waiters.splice(0);batch.forEach(function(w){failure?w.reject(failure):w.resolve({cancelled:!active,position:video.currentTime});});}
    function paint(){
      if(!active||disposed||video.readyState<2)return;
      if(options.onFrame)options.onFrame(video);
      painted=Math.abs(video.currentTime-target)<=1/120?target:video.currentTime;
    }
    function pump(){
      if(disposed||!active||failure){finish();return;}
      video.pause();video.muted=true;
      if(inFlight&&!video.seeking&&video.readyState>=2)inFlight=false;
      if(inFlight||video.seeking||video.readyState<1)return;
      var end=Number.isFinite(video.duration)?video.duration:target;
      target=Math.max(0,Math.min(end,target));
      if(Math.abs(video.currentTime-target)<=1/120&&video.readyState>=2){if(painted!==target)paint();finish();return;}
      inFlight=true;
      try{video.currentTime=target;}catch(error){inFlight=false;fail(error);}
    }
    function decoded(){
      inFlight=false;
      if(active&&!disposed&&video.readyState>=2)paint();
      pump();finish();
    }
    function fail(error){failure=error instanceof Error?error:new Error('Event footage could not be decoded');inFlight=false;if(options.onError)options.onError(failure);finish();}
    function mediaError(){fail(new Error('Event footage could not be decoded'));}
    video.addEventListener('seeked',decoded);video.addEventListener('loadeddata',decoded);video.addEventListener('loadedmetadata',pump);video.addEventListener('progress',pump);video.addEventListener('canplay',decoded);video.addEventListener('error',mediaError);
    return {
      seek:function(position){if(disposed)return;if(failure)return;var next=Math.max(0,Number(position)||0);if(active&&next===target&&!pending())return;target=next;active=true;painted=NaN;pump();},
      settle:function(){return new Promise(function(resolve,reject){waiters.push({resolve:resolve,reject:reject});pump();finish();});},
      cancel:function(){active=false;painted=NaN;video.pause();finish();},
      state:function(){return {target:target,currentTime:video.currentTime,inFlight:inFlight,seeking:video.seeking,readyState:video.readyState,active:active,painted:painted,waiters:waiters.length,error:failure&&failure.message};},
      pending:pending,
      error:function(){return failure;},
      target:function(){return target;},
      dispose:function(){disposed=true;active=false;video.pause();video.removeEventListener('seeked',decoded);video.removeEventListener('loadeddata',decoded);video.removeEventListener('loadedmetadata',pump);video.removeEventListener('progress',pump);video.removeEventListener('canplay',decoded);video.removeEventListener('error',mediaError);finish();}
    };
  }
  return {advance:advance,createSeeker:createSeeker};
});
