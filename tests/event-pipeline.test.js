const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const temporal = require('../pipeline/event-metadata.js');
const overrides = require('../pipeline/event_overrides.json');
const model = require('../site/event-model.js');
const root = path.resolve(__dirname, '..');
function row(title, slug, date, lat=1, lon=2){ return [title,lat,lon,2010,2010,'cul',2,'Place','Source event description',slug,date,null,null,title]; }

test('a treaty signing does not inherit the article operating interval', () => {
  const r = row('New START','New_START','2010-04-08',50.09,14.42);
  const m = temporal.metadata(r,{sourceType:'event'});
  temporal.applyDates(r,m,{start:'2011-02-05',end:'2021-02-05'});
  temporal.applyOverride(r,m,overrides);
  assert.equal(r[0],'New START signed in Prague');
  assert.equal(r[4],2010); assert.equal(r[12],null); assert.equal(m.kind,'point');
  assert.equal(m.start.iso,'2010-04-08'); assert.match(m.start.source.url,/obamawhitehouse/);
});

test('legacy end dates cannot manufacture exact month-end precision', () => {
  const r = row('Campaign','Campaign','2010-04-08'); r[4]=2015;
  const m = temporal.metadata(r,{sourceType:'event'});
  temporal.applyDates(r,m,{end:'2015-02-28'});
  assert.equal(r[12],null); assert.equal(m.end.precision,'year'); assert.equal(m.end.iso,null);
});

test('new precision metadata preserves month and year as bounds', () => {
  const r = row('Campaign','Campaign','2010-04-08');r[4]=2015;
  const m = temporal.metadata(r,{sourceType:'event'});
  temporal.applyDates(r,m,{end:'2015-02-01',endPrecision:'month'});
  assert.equal(r[12],'2015-02-01');assert.equal(m.end.precision,'month');
});

test('identity survives headline edits, sorting, and includes event-specific source', () => {
  const r = row('Original source event','Shared_article','2010-04-08');
  const id = model.stableId(r);r[0]='Improved display headline';assert.equal(model.stableId(r),id);
  const second = row('Another source event','Shared_article','2010-04-08');
  assert.notEqual(model.stableId(second),id);
  const moved = r.slice();moved[1]=10;assert.notEqual(model.stableId(moved),id);
});

test('merge retains distinct year-page events sharing the same article', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'gt-events-'));
  try {
    const raw = (title,date) => [title,1,2,2010,2010,'cul',2,'Place','Source event description','Shared_article','exact',50,'yearpage',date,null];
    const rows = [raw('The first meeting opens','2010-01-01'),raw('The second meeting opens','2010-02-02')];
    const firstFile=path.join(temp,'input.json'), out=path.join(temp,'output.json');
    fs.writeFileSync(firstFile,JSON.stringify(rows));
    execFileSync(process.execPath,[path.join(root,'pipeline/merge.js'),out,'--wikidata',firstFile],{cwd:temp});
    const built=JSON.parse(fs.readFileSync(out,'utf8'));
    assert.equal(built.length,2);assert.equal(built[0][10],'2010-01-01');
    assert.notEqual(built[0][14].id,built[1][14].id);
    assert.equal(built[0][14].mediaKey,'Shared_article|2010-01-01|1|2');
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
});

test('event-specific photos outrank an unrelated photo attached to the article', () => {
  const e={stableId:'evt-example',mediaKey:'Shared|2010-01-01|1|2',slug:'Shared'};
  const photos={Shared:{file:'generic.jpg'},'Shared|2010-01-01|1|2':{file:'event.jpg'}};
  assert.equal(model.imageFor(e,photos).file,'event.jpg');
});

test('2015 Rugby World Cup interval names the tournament and ends on the sourced final day', () => {
  const r=row('New Zealand wins 2015 Rugby World Cup','2015_Rugby_World_Cup','2015-09-18',53,-1);
  r[3]=r[4]=2015;r[14]={id:'evt-10zos9g-3jw8jo'};
  const m=temporal.metadata(r,{sourceType:'dated'}),id=m.id,key=m.mediaKey;
  temporal.applyOverride(r,m,overrides);
  assert.equal(r[0],'2015 Rugby World Cup');assert.equal(r[10],'2015-09-18');assert.equal(r[12],'2015-10-31');
  assert.equal(m.kind,'interval');assert.equal(m.end.precision,'day');
  assert.equal(m.end.source.url,'https://www.world.rugby/news/163399/new-report-confirms-record-breaking-rugby-world-cup-2015-economic-impact?lang=en');
  assert.equal(m.id,id);assert.equal(m.mediaKey,key);
  const time=require('../site/time.js');r[14]=m;const e=model.parseRow(r,0,time);
  assert(model.contains(e,time.parseISO('2015-10-31')));assert(!model.contains(e,time.parseISO('2015-11-01')));
});

test('a verified final-date correction keeps identity and does not retitle the final', () => {
  const r=row('2020 FIFA Club World Cup Final','2020_FIFA_Club_World_Cup_final','2021-11-02',25.31,51.42);
  r[3]=r[4]=2021;r[14]={id:'evt-s4mmu6-1bf7bc8'};
  const m=temporal.metadata(r,{sourceType:'dated'}),id=m.id,key=m.mediaKey;
  temporal.applyOverride(r,m,overrides);
  assert.equal(r[0],'2020 FIFA Club World Cup Final');assert.equal(r[10],'2021-02-11');assert.equal(r[12],null);
  assert.equal(m.kind,'point');assert.equal(m.id,id);assert.equal(m.mediaKey,key);
  assert.equal(m.start.source.url,'https://inside.fifa.com/tournaments/mens/clubworldcup/qatar2020/news/pavard-completes-sextuple-for-dominant-bayern');
});

test('tournament override cannot rename a different event sharing the article and date', () => {
  const r=row('Opening ceremony begins','2015_Rugby_World_Cup','2015-09-18',51.45,-0.34);
  r[3]=r[4]=2015;
  const m=temporal.metadata(r,{sourceType:'yearpage'}),before=JSON.stringify(r);
  temporal.applyOverride(r,m,overrides);
  assert.equal(JSON.stringify(r),before);assert.equal(m.override,undefined);
});
