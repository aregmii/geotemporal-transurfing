(function (root) {
  'use strict';

  function keyForMatch(match) {
    return encodeURIComponent(match.slug) + '|' + match.start + '|' + match.lat + '|' + match.lon;
  }

  function keyForEvent(event) {
    if (event.mediaKey) return event.mediaKey;
    if (Array.isArray(event)) {
      if (event[14] && event[14].mediaKey) return event[14].mediaKey;
      return keyForMatch({ slug: event[9], start: event[10] || event[3], lat: event[1], lon: event[2] });
    }
    if (event.metadata && event.metadata.mediaKey) return event.metadata.mediaKey;
    var source = event.sourceIdentity || (event.metadata && event.metadata.sourceIdentity);
    if (source && typeof source === 'object') return keyForMatch(source);
    return keyForMatch({ slug: event.slug, start: event.date || event.start, lat: event.lat, lon: event.lon });
  }

  function createIndex(manifest) {
    var index = new Map();
    (manifest.events || []).forEach(function (entry) {
      var key = keyForMatch(entry.match);
      if (entry.key !== key || index.has(key)) throw new Error('Invalid or duplicate event-photo key: ' + key);
      index.set(key, entry);
    });
    return index;
  }

  function photosFor(event, index) {
    var entry = index.get(keyForEvent(event));
    return entry ? entry.photos : [];
  }

  var api = { keyForMatch: keyForMatch, keyForEvent: keyForEvent, createIndex: createIndex, photosFor: photosFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GTEventPhotos = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
