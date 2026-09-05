(function(root, factory){
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GTEvents = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';
  var ISO = /^([+-]?\d{1,6})-(\d{2})-(\d{2})$/;
  function isISO(s){ return typeof s === 'string' && ISO.test(s); }
  function historicalYear(y){ return y < 0 ? y + 1 : y; }
  function hash(s){
    var a = 2166136261, b = 2246822519;
    for (var i = 0; i < s.length; i++) { a = Math.imul(a ^ s.charCodeAt(i), 16777619); b = Math.imul(b ^ s.charCodeAt(i), 3266489917); }
    return (a >>> 0).toString(36) + '-' + (b >>> 0).toString(36);
  }
  function mediaKey(r){ return encodeURIComponent(r[9] || '') + '|' + (r[10] || r[3]) + '|' + r[1] + '|' + r[2]; }
  function stableId(r, sourceIdentity){
    // The source title at column 13 is preserved when the display headline changes.
    return 'evt-' + hash(sourceIdentity || [r[9] || '', r[13] || r[0], r[10] || r[3], r[1], r[2]].join('|'));
  }
  function bound(date, precision, fallback, time, end){
    var parsed = isISO(date) ? time.parseISO(date) : NaN;
    if (!Number.isFinite(parsed)) return historicalYear(fallback) + (end ? 1 : 0);
    if (precision === 'year') return Math.floor(parsed) + (end ? 1 : 0);
    if (precision === 'month') return end ? time.nextMonth(parsed) : time.monthStart(parsed);
    if (!end) return parsed;
    var next = time.addDays(parsed, 1);
    // Canonical midnight prevents floating-point drift retaining the previous day at an exact boundary.
    if (time.parts && time.fromParts) { var p = time.parts(next); return time.fromParts(p.year, p.month, p.day); }
    return next;
  }
  function parseRow(r, i, time){
    if (!time || typeof time.parseISO !== 'function') throw new TypeError('GTEvents.parseRow requires GTTime');
    var meta = r[14] && typeof r[14] === 'object' && !Array.isArray(r[14]) ? r[14] : {};
    var sm = meta.start || {}, em = meta.end || {};
    var date = isISO(sm.iso || r[10]) ? (sm.iso || r[10]) : null;
    var endDate = isISO(em.iso || r[12]) ? (em.iso || r[12]) : null;
    var invalidDate = !!date && !Number.isFinite(time.parseISO(date));
    if (invalidDate) date = null;
    if (endDate && !Number.isFinite(time.parseISO(endDate))) endDate = null;
    var precision = invalidDate ? 'year' : (sm.precision || (date ? 'day' : 'year')); 
    var endPrecision = em.precision || (endDate ? 'day' : 'year');
    var kind = meta.kind || (r[4] > r[3] || endDate && endDate !== date ? 'interval' : 'point');
    var e = { id:i, stableId:meta.id || stableId(r), title:r[0], lat:r[1], lon:r[2], start:r[3], end:r[4], cat:r[5], w:r[6], place:r[7], desc:r[8], slug:r[9],
      date:date, who:r[11] || null, endDate:kind === 'interval' ? endDate : null, name:r[13] || r[0],
      temporalKind:kind, datePrecision:precision, endPrecision:endPrecision, dateUncertain:precision !== 'day' || !!(sm.source && /precision.*(?:not retain|unavailable)|requires source verification/i.test(sm.source.note || '')),  dateProvenance:{start:sm.source || null,end:em.source || null},
      mediaKey:meta.mediaKey || mediaKey(r), metadata:meta };
    e.t0 = bound(date, precision, r[3], time, false);
    e.t1 = kind === 'point' ? bound(date, precision, r[3], time, true) : bound(endDate, endPrecision, r[4], time, true);
    if (!Number.isFinite(e.t0)) e.t0 = historicalYear(r[3]);
    if (!Number.isFinite(e.t1) || e.t1 <= e.t0) e.t1 = time.addDays(e.t0, 1);
    return e;
  }
  function contains(e, t){ return t >= e.t0 && t < e.t1; }
  function overlaps(e, lo, hi, present){
    present = present == null ? Infinity : present;
    return e.t0 <= present && e.t0 < Math.min(hi, present + Number.EPSILON * Math.abs(present)) && e.t1 > lo;
  }
  function imageFor(e, images){ return images[e.stableId] || images[e.mediaKey] || images[e.slug] || null; }
  return { parseRow:parseRow, contains:contains, overlaps:overlaps, imageFor:imageFor, mediaKey:mediaKey, stableId:stableId, isISO:isISO, historicalYear:historicalYear };
});
