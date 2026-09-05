(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GTTime = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var DAY_MS = 86400000;
  function leap(y) { return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0); }
  function daysInYear(y) { return leap(y) ? 366 : 365; }
  function daysBeforeYear(y) { return 365 * y + Math.floor((y - 1) / 4) - Math.floor((y - 1) / 100) + Math.floor((y - 1) / 400); }
  function monthDays(y, m) { return [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }
  function fromParts(y, m, d, seconds) {
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1 || d > monthDays(y, m)) return NaN;
    var days = d - 1;
    for (var i = 1; i < m; i++) days += monthDays(y, i);
    return y + (days + (seconds || 0) / 86400) / daysInYear(y);
  }
  function parseISO(iso) {
    var m = /^([+-]?\d{1,7})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?Z)?$/.exec(String(iso));
    if (!m || +(m[4] || 0) > 23 || +(m[5] || 0) > 59 || +(m[6] || 0) > 59) return NaN;
    var seconds = +(m[4] || 0) * 3600 + +(m[5] || 0) * 60 + +(m[6] || 0) + Number('0.' + (m[7] || '0'));
    return fromParts(+m[1], +m[2], +m[3], seconds);
  }
  function toDay(t) { var y = Math.floor(t); return daysBeforeYear(y) + (t - y) * daysInYear(y); }
  function fromDay(day) {
    if (!Number.isFinite(day)) return NaN;
    if (Math.abs(day - Math.round(day)) < 1e-9) day = Math.round(day);
    var y = Math.floor(day / 365.2425);
    while (daysBeforeYear(y) > day) y--;
    while (daysBeforeYear(y + 1) <= day) y++;
    return y + (day - daysBeforeYear(y)) / daysInYear(y);
  }
  var epoch = daysBeforeYear(1970);
  function fromDate(d) { return d instanceof Date && Number.isFinite(d.getTime()) ? fromDay(epoch + d.getTime() / DAY_MS) : NaN; }
  function toDate(t) {
    if (!Number.isFinite(t)) return null;
    var ms = (toDay(t) - epoch) * DAY_MS;
    if (Math.abs(ms) > 8640000000000000) return null;
    return new Date(Math.round(ms));
  }
  function parts(t) {
    var y = Math.floor(t), days = Math.max(0, (t - y) * daysInYear(y));
    // A fractional year loses sub-day precision at large magnitudes. Snap only within its rounding uncertainty.
    var ulp = Math.pow(2, Math.floor(Math.log2(Math.max(1, Math.abs(t)))) - 52);
    var tolerance = Math.max(1e-8, ulp * daysInYear(y) / 2 + Number.EPSILON * 366);
    var nearest = Math.round(days);
    if (nearest < daysInYear(y) && Math.abs(days - nearest) <= tolerance) days = nearest;
    var whole = Math.floor(days), m = 1;
    while (m < 12 && whole >= monthDays(y, m)) { whole -= monthDays(y, m); m++; }
    return { year:y, month:m, day:whole + 1 };
  }
  function addDays(t, n) { return fromDay(toDay(t) + n); }
  function monthStart(t) { var p = parts(t); return fromParts(p.year, p.month, 1); }
  function nextMonth(t, delta) {
    var p = parts(t), n = p.year * 12 + p.month - 1 + (delta == null ? 1 : delta), y = Math.floor(n / 12);
    return fromParts(y, n - y * 12 + 1, 1);
  }
  function clamp(t, lo, hi) { return Number.isFinite(t) ? Math.max(lo, Math.min(hi, t)) : lo; }
  function now() { return fromDate(new Date()); }
  function advance(t, seconds, daysPerSecond, direction, lo, hi) { return clamp(addDays(t, Math.max(0, seconds) * daysPerSecond * direction), lo, hi); }
  return { parseISO:parseISO, fromDate:fromDate, toDate:toDate, fromParts:fromParts, parts:parts, toDay:toDay, fromDay:fromDay,
    addDays:addDays, monthStart:monthStart, nextMonth:nextMonth, daysInYear:daysInYear, clamp:clamp, now:now, advance:advance };
}));
