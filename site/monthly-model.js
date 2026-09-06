(function(root, factory){
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GTMonthly = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';
  var EPSILON = 1e-9;
  var DATE = /^([+-]?\d{1,7})-\d{2}-\d{2}$/;
  var DATE_WARNING = /precision.*(?:not retain|unavailable|unknown)|requires source verification|unverified date|date.*(?:uncertain|unverified)/i;

  function finiteLocation(e){
    return Number.isFinite(e.lat) && Number.isFinite(e.lon) && Math.abs(e.lat) <= 90 && Math.abs(e.lon) <= 180;
  }
  function ringIndex(coordinates){
    var points = [], minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    (coordinates || []).forEach(function(p){
      if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return;
      var x = p[0], y = p[1];
      if (points.length){
        var previous = points[points.length - 1][0];
        while (x - previous > 180) x -= 360;
        while (x - previous < -180) x += 360;
      }
      points.push([x, y]);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    });
    return {points:points, minX:minX, maxX:maxX, minY:minY, maxY:maxY};
  }
  function inRing(lat, lon, ring){
    if (ring.points.length < 3 || lat < ring.minY - EPSILON || lat > ring.maxY + EPSILON) return false;
    // Unwrap the query into the ring's longitude range, including dateline islands.
    var x = lon + 360 * Math.round(((ring.minX + ring.maxX) / 2 - lon) / 360);
    if (x < ring.minX - EPSILON || x > ring.maxX + EPSILON) return false;
    var inside = false, points = ring.points;
    for (var i = 0, j = points.length - 1; i < points.length; j = i++){
      var a = points[j], b = points[i], dx = b[0] - a[0], dy = b[1] - a[1];
      var cross = (x - a[0]) * dy - (lat - a[1]) * dx;
      if (Math.abs(cross) <= EPSILON && x >= Math.min(a[0], b[0]) - EPSILON && x <= Math.max(a[0], b[0]) + EPSILON && lat >= Math.min(a[1], b[1]) - EPSILON && lat <= Math.max(a[1], b[1]) + EPSILON) return true;
      if ((a[1] > lat) !== (b[1] > lat) && x < a[0] + (lat - a[1]) * dx / dy) inside = !inside;
    }
    return inside;
  }
  function createCountryIndex(geojson){
    var features = (geojson && geojson.features || []).map(function(feature){
      var geometry = feature.geometry || {}, polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
      return {name:feature.properties && feature.properties.name || String(feature.id || ''), polygons:polygons.map(function(p){ return p.map(ringIndex); })};
    }).filter(function(feature){ return feature.name && feature.polygons.length; }).sort(function(a, b){ return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    var cache = new Map();
    return function countryFor(lat, lon){
      if (!finiteLocation({lat:lat, lon:lon})) return null;
      var key = lat + '|' + lon;
      if (cache.has(key)) return cache.get(key);
      var match = null;
      for (var i = 0; i < features.length && !match; i++){
        var feature = features[i];
        if (feature.polygons.some(function(rings){ return rings.length && inRing(lat, lon, rings[0]) && !rings.slice(1).some(function(hole){ return inRing(lat, lon, hole); }); })) match = feature.name;
      }
      cache.set(key, match);
      return match;
    };
  }
  function sourceWarning(e){
    var meta = e.metadata || {}, start = meta.start || {}, provenance = e.dateProvenance || {};
    return [start.source, provenance.start, meta.source].some(function(source){ return source && DATE_WARNING.test(source.note || ''); });
  }
  function earthly(e){
    var meta = e.metadata || {}, location = meta.location || {};
    var bodies = [e.globe, e.body, meta.globe, meta.body, location.globe, location.body];
    if (bodies.some(function(body){ return body && !/^(?:earth|Q2|https?:\/\/www\.wikidata\.org\/entity\/Q2)$/i.test(String(body)); })) return false;
    var title = [e.title, e.name, e.slug].join(' ').replace(/_/g, ' ');
    var context = title + ' ' + (e.desc || '');
    if (/\b(?:on|surface of|landing on|landed on) (?:the )?(?:Mars|Moon|Venus)\b|\b(?:Martian|lunar) (?:surface|landing|lander)\b/i.test(title)) return false;
    var spaceObject = /\b(?:rover|lander|orbiter|spacecraft|space probe|robotic space mission|Mars exploration|lunar mission)\b/i.test(context) || /^(?:Apollo|Luna|Lunokhod|Chang['’]?e|Viking|Voyager|Pioneer|Venera|Mariner)[ -]?\d+\b/i.test(title);
    if (!spaceObject) return true;
    // A launch on Earth is distinct from the mission or its extraterrestrial destination.
    return /\blaunch(?:ed|es|ing)?\b/i.test(title) && /\b(?:launch|spaceport|cosmodrome|Cape Canaveral|Kennedy Space Center|Baikonur|Kourou|Vandenberg|Satish Dhawan|Tanegashima|Jiuquan|Wenchang|Xichang|Wallops|Mahia)\b/i.test(e.place || '');
  }
  function eventStart(e, time){
    var start = e.metadata && e.metadata.start || {}, iso = start.iso || e.date;
    return typeof iso === 'string' && DATE.test(iso) ? time.parseISO(iso) : NaN;
  }
  function eligible(e, time){
    var start = e.metadata && e.metadata.start || {}, precision = start.precision || e.datePrecision;
    return (precision === 'day' || precision === 'month') && Number.isFinite(eventStart(e, time)) && !sourceWarning(e) && !(precision === 'day' && e.dateUncertain) && finiteLocation(e) && earthly(e);
  }
  function monthKey(t, time){
    var p = time.parts(t);
    return String(p.year) + '-' + String(p.month).padStart(2, '0');
  }
  function reviewedCountry(e){
    var meta = e.metadata || {}, review = meta.monthlyReview || {}, source = review.source;
    var url = typeof source === 'string' ? source : source && source.url;
    return typeof meta.monthCountry === 'string' && meta.monthCountry.trim() && /^https?:\/\//.test(url || '') ? meta.monthCountry : null;
  }
  function countryRegistry(policy){
    var byName = new Map(), entries = [];
    (policy && policy.countries || []).forEach(function(country){
      var entry = {id:country.id || country.name, name:country.name, minimum:country.minimum || (country.highIncome ? 12 : 3), highIncome:!!country.highIncome, classification:country.incomeLevel || null};
      if (!entry.name) return;
      entries.push(entry);
      [entry.name].concat(country.aliases || [], country.mapNames || []).forEach(function(name){ byName.set(name, entry); });
    });
    return {entries:entries, byName:byName};
  }
  function coverage(events, policy){
    var registry = countryRegistry(policy), counts = new Map();
    registry.entries.forEach(function(country){ counts.set(country.name, Object.assign({}, country, {available:0, reviewed:0})); });
    events.forEach(function(e){
      var country = registry.byName.get(e.monthCountry), name = country ? country.name : e.monthCountry;
      if (!name) return;
      if (!counts.has(name)) counts.set(name, {id:name, name:name, minimum:3, highIncome:false, classification:null, available:0, reviewed:0});
      var entry = counts.get(name), review = e.metadata && e.metadata.monthlyReview;
      entry.available++;
      if (review && review.source && /^https?:\/\//.test(review.source.url || '')) entry.reviewed++;
    });
    var countries = Array.from(counts.values()).map(function(country){
      return Object.assign(country, {shortfall:Math.max(0, country.minimum - country.available), reviewedShortfall:Math.max(0, country.minimum - country.reviewed), targetMet:country.available >= country.minimum});
    }).sort(function(a,b){return a.name.localeCompare(b.name);});
    return {countries:countries, countriesMeetingTarget:countries.filter(function(c){return c.targetMet;}).length, countriesReviewedToTarget:countries.filter(function(c){return !c.reviewedShortfall;}).length, totalCountries:countries.length, shortfall:countries.reduce(function(n,c){return n+c.shortfall;},0)};
  }
  function select(events, monthT, options){
    options = options || {};
    var time = options.time, lo = time.monthStart(monthT), hi = time.nextMonth(lo);
    var countryFor = options.countryFor || function(){ return null; };
    var registry = countryRegistry(options.policy);
    var rank = options.rank || function(e){ return e.w || 0; };
    var candidates = events.filter(function(e){ var t = eventStart(e, time); return eligible(e, time) && t >= lo && t < hi; });
    function identity(e){ return String(e.stableId || e.id || [e.slug || e.title, e.date, e.lat, e.lon].join('|')); }
    function score(e){ var value = rank(e); return Number.isFinite(value) ? value : 0; }
    candidates.sort(function(a, b){
      var difference = score(b) - score(a) || eventStart(a, time) - eventStart(b, time);
      var ak = identity(a), bk = identity(b);
      return difference || (ak < bk ? -1 : ak > bk ? 1 : 0);
    });
    var seen = new Set(), occurrences = new Set(), groups = new Map(), selected = [], eligibleCount = 0;
    candidates.forEach(function(e){
      var id = identity(e), occurrence = e.slug ? [e.slug, eventStart(e, time), e.lat, e.lon].join('|') : id;
      if (seen.has(id) || occurrences.has(occurrence)) return;
      seen.add(id); occurrences.add(occurrence); eligibleCount++;
      var country = reviewedCountry(e) || countryFor(e.lat, e.lon);
      if (!country) return;
      var registered = registry.byName.get(country);
      if (registered) country = registered.name;
      var used = groups.get(country) || 0;
      e.monthCountry = country;
      groups.set(country, used + 1); selected.push(e);
    });
    // Coverage targets are minimums, never truncation limits. The globe's visible-card budget is separate.
    return {events:selected, countries:groups.size, eligibleCount:eligibleCount, omittedCount:eligibleCount - selected.length, coverage:coverage(selected, options.policy)};
  }
  function stepIndex(index, elapsed, dt, direction, secondsPerMonth, count){
    count = Math.max(0, Math.floor(count));
    index = Math.max(0, Math.min(Math.max(0, count - 1), Math.floor(index)));
    direction = direction < 0 ? -1 : direction > 0 ? 1 : 0;
    elapsed = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
    if (!count) return {index:0, elapsed:0, direction:0, ended:true};
    if (!direction) return {index:index, elapsed:elapsed, direction:0, ended:false};
    if (index === (direction > 0 ? count - 1 : 0)) return {index:index, elapsed:0, direction:0, ended:true};
    if (!(secondsPerMonth > 0) || !Number.isFinite(secondsPerMonth)) throw new RangeError('secondsPerMonth must be positive');
    var total = elapsed + (Number.isFinite(dt) ? Math.max(0, dt) : 0);
    var steps = Math.floor((total + secondsPerMonth * EPSILON) / secondsPerMonth);
    var next = index + direction * steps;
    if (next <= 0 && direction < 0 || next >= count - 1 && direction > 0) return {index:direction > 0 ? count - 1 : 0, elapsed:0, direction:0, ended:true};
    return {index:next, elapsed:Math.max(0, total - steps * secondsPerMonth), direction:direction, ended:false};
  }
  return {createCountryIndex:createCountryIndex, eligible:eligible, select:select, coverage:coverage, monthKey:monthKey, stepIndex:stepIndex};
});
