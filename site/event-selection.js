(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GTEventSelection=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  // A catalog can contain multiple source records for the same event/date/place.
  // Keep those records in the catalog; show one projection for the same identity.
  function identity(e){return e.slug ? [e.slug,e.date||e.t0,e.lat,e.lon].join('|') : e.stableId||String(e.id);}
  function cell(e){
    var band=Math.floor((e.lat+90)/8),width=8/Math.max(.2,Math.cos(e.lat*Math.PI/180));
    return band+':'+Math.floor((e.lon+180)/width);
  }
  function select(ranked,limit,featured){
    limit=Math.max(0,Math.floor(limit));featured=featured||function(){return false;};
    var seen=new Set(),features=[],buckets=new Map();
    ranked.forEach(function(e){var k=identity(e);if(seen.has(k))return;seen.add(k);
      if(featured(e)){features.push(e);return;}
      var c=cell(e);if(!buckets.has(c))buckets.set(c,[]);buckets.get(c).push(e);
    });
    var result=features.slice(0,limit),groups=Array.from(buckets.values()),depth=0;
    // One real event per occupied geographic cell per round, retaining ranking
    // within each cell. This prevents a few news-heavy cities using every slot.
    while(result.length<limit&&groups.length){
      var any=false;
      for(var i=0;i<groups.length&&result.length<limit;i++)if(groups[i][depth]){result.push(groups[i][depth]);any=true;}
      if(!any)break;depth++;
    }
    return result;
  }
  return {select:select,identity:identity,cell:cell};
});
