const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../site/event-model.js');
const time = require('../site/time.js');
function row(date, start=2024, end=start){ return ['Event',0,0,start,end,'cul',2,'Place','Event description','Event',date,null,null,'Original event']; }

test('a known January 1 is a one-day event', () => {
  const e=model.parseRow(row('2024-01-01'),4,time);
  assert.equal(e.id,4);assert.equal(e.date,'2024-01-01');assert.equal(e.datePrecision,'day');
  assert(model.contains(e,time.parseISO('2024-01-01')));
  assert(!model.contains(e,time.parseISO('2024-01-02')));
});

test('leap day expires exactly at March 1 in both traversal directions', () => {
  const e=model.parseRow(row('2024-02-29'),0,time);
  assert.equal(e.t0,time.parseISO('2024-02-29'));assert.equal(e.t1,time.parseISO('2024-03-01'));
  assert(!model.contains(e,time.parseISO('2024-02-28')));
  assert(!model.contains(e,time.parseISO('2024-03-01')));
  assert(model.contains(e,time.addDays(time.parseISO('2024-03-01'),-0.5)));
});

test('month precision covers the real month without pretending the padded day was known', () => {
  const r=row(null);r[14]={kind:'point',start:{iso:'2024-02-01',precision:'month'}};
  const e=model.parseRow(r,0,time);
  assert.equal(e.datePrecision,'month');assert.equal(e.t0,time.parseISO('2024-02-01'));
  assert.equal(e.t1,time.parseISO('2024-03-01'));
});

test('year-only precision remains an uncertain point within its year', () => {
  const e=model.parseRow(row(null),0,time);
  assert.equal(e.temporalKind,'point');assert.equal(e.date,null);assert.equal(e.datePrecision,'year');
  assert.equal(e.t0,2024);assert.equal(e.t1,2025);
});

test('interval includes its known last day and excludes the next', () => {
  const r=row('2024-02-28');r[12]='2024-03-01';r[14]={kind:'interval',end:{iso:'2024-03-01',precision:'day'}};
  const e=model.parseRow(r,0,time);
  assert.equal(e.t1,time.parseISO('2024-03-02'));
  assert(model.contains(e,time.parseISO('2024-03-01')));
  assert(!model.contains(e,time.parseISO('2024-03-02')));
});

test('historical BCE row labels convert to astronomical chronology without losing their labels', () => {
  const e=model.parseRow(row(null,-1),0,time);
  assert.equal(e.start,-1);assert.equal(e.t0,0);assert.equal(e.t1,1);
  const exact=model.parseRow(row('0000-02-29',-1),0,time);
  assert.equal(exact.t1,time.parseISO('0000-03-01'));
  assert(!model.contains(exact,time.parseISO('0000-03-01')));
});

test('period eligibility excludes future-start rows even if they intersect the overview', () => {
  const e=model.parseRow(row('2024-07-01'),0,time);
  const present=time.parseISO('2024-06-30');
  assert(!model.overlaps(e,2024,2025,present));
  assert(model.overlaps(e,2024,2025,time.parseISO('2024-07-01')));
});

test('invalid exact dates do not create NaN event bounds', () => {
  const e=model.parseRow(row('2023-02-29',2023),0,time);
  assert(Number.isFinite(e.t0));assert(Number.isFinite(e.t1));
  assert.equal(e.date,null);assert.equal(e.datePrecision,'year');
});
