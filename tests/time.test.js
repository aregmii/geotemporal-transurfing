const test = require('node:test');
const assert = require('node:assert/strict');
const time = require('../site/time.js');
const DAY = 86400000;
function utc(year, month, day, hour=0, minute=0, second=0, millis=0){
  const d = new Date(0);d.setUTCFullYear(year,month-1,day);d.setUTCHours(hour,minute,second,millis);return d;
}

test('Gregorian leap rules preserve 2000 and year zero, reject 1900 and 2100 leap days', () => {
  for(const year of [0,1600,2000,2024]){
    assert.equal(time.daysInYear(year),366);
    assert(Number.isFinite(time.fromParts(year,2,29)));
  }
  for(const year of [1900,2100,2023]){
    assert.equal(time.daysInYear(year),365);
    assert(Number.isNaN(time.fromParts(year,2,29)));
  }
});

test('Gregorian UTC conversion agrees with native Date across centuries and BCE', () => {
  for(const year of [-400,-1,0,1,99,100,1582,1600,1900,1970,2000,2024,2100,9999]){
    for(const [month,day] of [[1,1],[2,28],[3,1],[7,1],[12,31]]){
      const d=utc(year,month,day,12,34,56,789);
      const numeric=time.fromDate(d);
      assert.deepEqual(time.parts(numeric),{year,month,day});
      assert.equal(time.toDate(numeric).getTime(),d.getTime(),`${year}-${month}-${day}`);
    }
  }
});

test('calendar addition crosses leap day and BCE/year-zero boundaries in both directions', () => {
  for(const [before,after] of [['2024-02-28','2024-02-29'],['2024-02-29','2024-03-01'],['1900-02-28','1900-03-01'],['0000-02-29','0000-03-01'],['-000001-12-31','0000-01-01'],['0000-12-31','0001-01-01']]){
    assert.equal(time.addDays(time.parseISO(before),1),time.parseISO(after));
    assert.equal(time.addDays(time.parseISO(after),-1),time.parseISO(before));
  }
});

test('month navigation honors year boundaries including astronomical year zero', () => {
  assert.equal(time.nextMonth(time.parseISO('2024-12-31')),time.parseISO('2025-01-01'));
  assert.equal(time.nextMonth(time.parseISO('0000-01-31'),-1),time.parseISO('-000001-12-01'));
  assert.equal(time.monthStart(time.parseISO('2024-02-29')),time.parseISO('2024-02-01'));
});

test('deep-time dates retain their represented calendar day despite fractional-year rounding', () => {
  for(const year of [-4600000000,-1000000,1000000,4600000000]){
    for(const [month,day] of [[1,1],[3,1],[7,1],[12,31]]){
      const numeric=time.fromParts(year,month,day);
      assert.deepEqual(time.parts(numeric),{year,month,day},`${year}-${month}-${day}`);
      assert.equal(time.toDate(numeric),null);
    }
  }
});

test('deep-time forward and reverse travel is finite and returns within represented precision', () => {
  for(const year of [-4600000000,-1000000,1000000]){
    const t=time.fromParts(year,7,1),next=time.addDays(t,1000),back=time.addDays(next,-1000);
    assert(next>t);assert(Number.isFinite(next));
    assert(Math.abs(back-t)<=Math.abs(t)*Number.EPSILON*2);
  }
});

test('playback clamps at the present and earliest bound without wrapping', () => {
  const lo=time.parseISO('2000-01-01'),hi=time.parseISO('2026-09-05T12:00:00Z');
  assert.equal(time.advance(time.addDays(hi,-1),10,10,1,lo,hi),hi);
  assert.equal(time.advance(hi,10,10,1,lo,hi),hi);
  assert.equal(time.advance(time.addDays(lo,1),10,10,-1,lo,hi),lo);
  assert.equal(time.advance(lo,10,10,-1,lo,hi),lo);
  assert.equal(time.advance(hi,-1,10,-1,lo,hi),hi);
  assert.equal(time.clamp(NaN,lo,hi),lo);
});

test('reverse and slower playback use the same continuous chronological clock', () => {
  const start=time.parseISO('2024-03-01T12:00:00Z');
  const reverse=time.advance(start,2,0.5,-1,2024,2025);
  const forward=time.advance(reverse,2,0.5,1,2024,2025);
  assert.equal(time.toDate(reverse).getTime(),utc(2024,2,29,12).getTime());
  assert.equal(time.toDate(forward).getTime(),utc(2024,3,1,12).getTime());
});

test('invalid dates and offsets cannot silently roll into another date', () => {
  for(const iso of ['2023-02-29','2012-09-31','2024-00-01','2024-13-01','2024-01-00','2024-01-01T24:00:00Z','2024-01-01T12:60:00Z','2024-01-01T12:00:60Z','2024-01-01T12:00:00+02:00','nonsense']){
    assert(Number.isNaN(time.parseISO(iso)),iso);
  }
  assert(Number.isNaN(time.fromDate(new Date(NaN))));
  assert.equal(time.toDate(Infinity),null);
});

test('now uses actual UTC and preserves the final millisecond of a year', () => {
  const before=Date.now(),actual=time.toDate(time.now()).getTime(),after=Date.now();
  assert(actual>=before-1 && actual<=after+1);
  const last=time.parseISO('2024-12-31T23:59:59.999Z');
  assert.deepEqual(time.parts(last),{year:2024,month:12,day:31});
  assert.equal(time.toDate(last).getTime(),utc(2025,1,1).getTime()-1);
});
