/* Earth-fixed observer coordinates: X = 0°E equator, Y = north, Z = 90°W equator. */
(function(root, factory){
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GTObserver = api;
})(typeof window === 'undefined' ? globalThis : window, function(){
  'use strict';
  var EARTH_KM = 6371, AU_KM = 149597870.7;
  function supportedDate(date){ return date instanceof Date && Number.isFinite(+date) && date.getUTCFullYear() >= 1900 && date.getUTCFullYear() <= 2100; }
  function eqdToFixed(v, gastHours){
    var a = gastHours * Math.PI / 12, c = Math.cos(a), s = Math.sin(a);
    return {x:c*v.x+s*v.y, y:v.z, z:s*v.x-c*v.y};
  }
  function fixedToEqd(v, gastHours){
    var a = gastHours * Math.PI / 12, c = Math.cos(a), s = Math.sin(a);
    return {x:c*v.x+s*v.z, y:s*v.x-c*v.z, z:v.y};
  }
  function eqjToFixed(astronomy, v, date){
    var q = astronomy.RotateVector(astronomy.Rotation_EQJ_EQD(date), new astronomy.Vector(v.x,v.y,v.z,date));
    return eqdToFixed(q, astronomy.SiderealTime(date));
  }
  function geometricBodies(astronomy, date, names){
    var earth = astronomy.BaryState('Earth',date), out = {}, factor = AU_KM / EARTH_KM;
    names.forEach(function(name){
      var b = astronomy.BaryState(name,date);
      var p = eqjToFixed(astronomy,{x:b.x-earth.x,y:b.y-earth.y,z:b.z-earth.z},date);
      out[name] = {x:p.x*factor,y:p.y*factor,z:p.z*factor};
    });
    return out;
  }
  function earthOccludes(observer, point, radius){
    radius = radius == null ? 1 : radius;
    var dx=point.x-observer.x,dy=point.y-observer.y,dz=point.z-observer.z;
    var len=Math.hypot(dx,dy,dz); if (!len) return false;
    dx/=len;dy/=len;dz/=len;
    var b=observer.x*dx+observer.y*dy+observer.z*dz;
    var c=observer.x*observer.x+observer.y*observer.y+observer.z*observer.z-radius*radius;
    var disc=b*b-c; if(disc<0) return false;
    var near=-b-Math.sqrt(disc),far=-b+Math.sqrt(disc);
    return far>1e-6 && near<len-1e-6;
  }
  // Integrates v(t) = target + (v0-target) exp(-drag*t), independent of frame rate.
  function coast(velocity,target,seconds,drag){
    drag=drag==null ? 2.7626 : drag;
    var decay=Math.exp(-drag*seconds);
    return {velocity:target+(velocity-target)*decay, angle:target*seconds+(velocity-target)*(1-decay)/drag};
  }
  function surfaceFacing(normal,observer){
    return normal.x*observer.x+normal.y*observer.y+normal.z*observer.z-1;
  }
  return {EARTH_KM:EARTH_KM,AU_KM:AU_KM,supportedDate:supportedDate,eqdToFixed:eqdToFixed,fixedToEqd:fixedToEqd,eqjToFixed:eqjToFixed,geometricBodies:geometricBodies,earthOccludes:earthOccludes,coast:coast,surfaceFacing:surfaceFacing};
});
