(function(root,factory){
  var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GTEventPlayer=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function create(video,options){
    options=options||{};
    var transport=options.transport;
    if(!transport||!transport.createSeeker||!transport.advance)throw new Error('Event player requires a media transport');
    var position=0,duration=Math.max(0,Number(options.duration)||0),direction=0,rate=1;
    var soundEnabled=false,volume=1,disposed=false,generation=0,playPending=false,error=null,decodeFailed=false;
    var seeker=null,lastState='';
    video.pause();video.muted=true;video.loop=false;video.playsInline=true;video.playbackRate=1;
    function nativeMode(){return !disposed&&direction===1&&rate===1;}
    function clamp(value){return Math.max(0,Math.min(duration,Number(value)||0));}
    function readPosition(){
      if(nativeMode()&&!video.seeking&&Number.isFinite(video.currentTime))position=clamp(video.currentTime);
    }
    function audioAvailable(){return !disposed&&!error&&options.hasAudio===true&&direction>=0&&rate===1;}
    function audioReason(){
      if(disposed)return 'Player closed';
      if(error)return error;
      if(options.hasAudio===false)return 'Silent recording · no audio track';
      if(options.hasAudio!==true)return 'Audio availability is unverified';
      if(direction<0)return 'Reverse playback is silent';
      if(rate!==1)return 'Sound is available at 1× forward speed';
      if(!soundEnabled)return 'Sound off';
      if(volume===0)return 'Volume is zero';
      if(!direction)return 'Paused · press Play to hear this recording';
      if(playPending)return 'Starting recording audio';
      return 'Original recording audio';
    }
    function state(){
      readPosition();
      return {position:position,duration:duration,direction:direction,rate:rate,soundEnabled:soundEnabled,
        audioAvailable:audioAvailable(),audioReason:audioReason(),error:error,
        pending:!disposed&&(playPending||!!(seeker&&seeker.pending())||(nativeMode()&&(video.seeking||video.readyState<2)))};
    }
    function notify(){
      var current=state(),stamp=JSON.stringify(current);
      if(stamp===lastState)return;
      lastState=stamp;if(options.onState)options.onState(current);
    }
    function paint(){if(!disposed&&video.readyState>=2&&!video.seeking&&options.onFrame)options.onFrame(video);}
    function applyAudio(){video.volume=volume;video.muted=!(nativeMode()&&options.hasAudio===true&&soundEnabled&&volume>0&&!error);}
    function stop(){
      readPosition();direction=0;generation++;playPending=false;
      if(seeker)seeker.cancel();video.pause();video.muted=true;
    }
    function failDecode(){
      if(disposed)return;
      stop();decodeFailed=true;error='This recording could not be decoded.';notify();
    }
    seeker=transport.createSeeker(video,{onFrame:function(){
      paint();
      // The seeker marks its target painted after this callback returns.
      Promise.resolve().then(function(){if(!disposed)notify();});
    },onError:failDecode});
    function playFailure(failure,request){
      if(disposed||request!==generation)return;
      stop();
      error=failure&&failure.name==='NotAllowedError'?'Playback was blocked. Click Play to try again.':'Playback could not start. Click Play to try again.';
      notify();
    }
    function startNative(reposition){
      var request=++generation;playPending=true;
      if(reposition){
        seeker.cancel();
        try{if(Math.abs(video.currentTime-position)>1/120)video.currentTime=position;}
        catch(failure){playFailure(failure,request);return;}
      }
      video.playbackRate=1;applyAudio();
      // Keep this call synchronous with the Play/Sound gesture; only its result is asynchronous.
      var result;
      try{result=video.play();}catch(failure){playFailure(failure,request);return;}
      if(result&&typeof result.then==='function')result.then(function(){
        if(disposed||request!==generation)return;
        playPending=false;readPosition();notify();
      },function(failure){playFailure(failure,request);});
      else playPending=false;
      notify();
    }
    function setDirection(next){
      if(disposed)return state();
      next=next<0?-1:next>0?1:0;
      if(!next)return pause();
      if(decodeFailed)return state();
      readPosition();
      if((next<0&&position<=0)||(next>0&&duration>0&&position>=duration)){stop();notify();return state();}
      if(next===direction&&!error){
        if(nativeMode()&&video.paused&&!playPending)startNative(true);else notify();
        return state();
      }
      generation++;playPending=false;error=null;direction=next;
      if(nativeMode())startNative(true);
      else{video.pause();video.muted=true;seeker.seek(position);notify();}
      return state();
    }
    function setRate(next){
      next=Number(next);
      if(disposed||!Number.isFinite(next)||next<=0||next===rate)return state();
      readPosition();generation++;playPending=false;rate=next;
      if(nativeMode()&&!error)startNative(true);
      else{video.pause();video.muted=true;if(!decodeFailed)seeker.seek(position);notify();}
      return state();
    }
    function setSound(on){
      if(disposed)return state();
      var changed=soundEnabled!==!!on;
      soundEnabled=!!on&&options.hasAudio===true;applyAudio();
      if(changed&&soundEnabled&&nativeMode()&&!error)startNative(false);
      else notify();
      return state();
    }
    function setVolume(next){
      next=Number(next);if(disposed||!Number.isFinite(next))return state();
      volume=Math.max(0,Math.min(1,next));applyAudio();notify();return state();
    }
    function seek(next){
      if(disposed||decodeFailed)return state();
      stop();error=null;position=clamp(next);seeker.seek(position);notify();return state();
    }
    function pause(){
      if(!disposed){stop();if(!decodeFailed)seeker.seek(position);notify();}
      return state();
    }
    function tick(seconds){
      if(disposed||!direction||error)return state();
      if(nativeMode()){
        if(video.paused&&!playPending){stop();notify();return state();}
        readPosition();paint();
        if(video.ended||(duration>0&&position>=duration)){position=duration;stop();}
      }else{
        var step=transport.advance(position,duration,seconds,direction,rate,false);
        position=step.position;seeker.seek(position);
        if(step.boundary){direction=0;generation++;playPending=false;video.pause();video.muted=true;}
      }
      notify();return state();
    }
    function metadata(){
      if(disposed)return;
      if(Number.isFinite(video.duration)&&video.duration>0)duration=video.duration;
      position=clamp(position);notify();
    }
    function ended(){if(nativeMode()){position=duration;stop();notify();}}
    function nativePaused(){if(nativeMode()&&video.paused&&!playPending){stop();notify();}}
    video.addEventListener('loadedmetadata',metadata);video.addEventListener('ended',ended);video.addEventListener('pause',nativePaused);
    metadata();seeker.seek(0);notify();
    function dispose(){
      if(disposed)return;
      stop();disposed=true;seeker.dispose();
      video.removeEventListener('loadedmetadata',metadata);video.removeEventListener('ended',ended);video.removeEventListener('pause',nativePaused);notify();
    }
    return {setDirection:setDirection,setRate:setRate,setSound:setSound,setVolume:setVolume,seek:seek,tick:tick,pause:pause,dispose:dispose,state:state};
  }
  return {create:create};
});
