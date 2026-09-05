(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GTShards = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function create(options) {
    var states = {}, pending = {}, failures = {}, fetcher = options.fetch || fetch;
    function status() { return { states:Object.assign({}, states), failures:Object.assign({}, failures) }; }
    function load(year) {
      if (states[year] === 'loaded') return Promise.resolve({ year:year, added:0 });
      if (pending[year]) return pending[year];
      states[year] = 'loading'; delete failures[year];
      if (options.onStatus) options.onStatus(status());
      pending[year] = Promise.resolve().then(function () { return fetcher(options.dir + year + '.json'); })
        .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
        .then(function (rows) {
          if (!Array.isArray(rows) || rows.some(function (r) { return !Array.isArray(r) || r.length < 10; })) throw new Error('Invalid event data');
          var added = options.onRows(rows, year);
          states[year] = 'loaded';
          return { year:year, added:typeof added === 'number' ? added : rows.length };
        }).catch(function (error) {
          states[year] = 'error'; failures[year] = String(error.message || error);
          return { year:year, added:0, error:failures[year] };
        }).then(function (result) { delete pending[year]; if (options.onStatus) options.onStatus(status()); return result; });
      return pending[year];
    }
    function range(start, end) {
      return Promise.all(options.years.filter(function (y) { return y >= Math.floor(start) && y <= Math.floor(end); }).map(load));
    }
    return { range:range, load:load, status:status };
  }
  return { create:create };
}));
