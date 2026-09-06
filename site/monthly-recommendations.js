(function(root, factory){
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GTMonthlyRecommendations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';
  function select(events, options){
    options = options || {};
    var current = options.selected, seen = new Set(), limit = options.limit == null ? 4 : options.limit;
    var candidates = events.filter(function(e){
      var id = e.stableId;
      if (!id || seen.has(id) || !e.monthCountry || String(e.date).slice(0,7) !== options.month) return false;
      if (!Number.isFinite(e.lat) || !Number.isFinite(e.lon)) return false;
      if (current && (id === current.stableId || e.monthCountry === current.monthCountry)) return false;
      seen.add(id);
      return true;
    });
    function score(e){
      var reviewed = e.metadata && e.metadata.monthlyReview && e.metadata.monthlyReview.source;
      return (reviewed ? 100 : 0) + (options.hasMedia && options.hasMedia(e) ? 40 : 0) + (Number(e.w) || 0) * 3;
    }
    candidates.sort(function(a,b){return score(b)-score(a) || a.stableId.localeCompare(b.stableId);});
    var result = [], countries = new Set();
    candidates.forEach(function(e){
      if (result.length < limit && !countries.has(e.monthCountry)){
        countries.add(e.monthCountry); result.push(e);
      }
    });
    candidates.forEach(function(e){if(result.length < limit && result.indexOf(e)<0) result.push(e);});
    return result;
  }
  return {select:select};
});
