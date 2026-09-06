const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {buildCatalog} = require('../scripts/build_monthly_catalog.cjs');
const eventModel = require('../site/event-model');
const monthly = require('../site/monthly-model');
const time = require('../site/time');

function row(id, date='2011-02-01', extra={}){
  return [extra.title || id, extra.lat == null ? 5 : extra.lat, extra.lon == null ? 5 : extra.lon, 2011, 2011, 'cul', 2, 'Place', 'Catalog description', extra.slug || id, date, null, null, extra.title || id,
    {id,mediaKey:extra.mediaKey || id+'|media',source:{type:'dated',url:'https://example.com/'+id},kind:'point',start:{iso:date,precision:'day',source:{type:'dated',url:'https://example.com/'+id}},end:null,...extra.metadata}];
}
const geojson={features:[{properties:{name:'Country A'},geometry:{type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]]]}}]};
function fixture(rows=[], pilotRows=[]){return {inputs:[{path:'base.json',rows}],pilot:{from:'2011-01',through:'2011-12',updatedAt:'2026-09-05',events:pilotRows},geojson};}
function reviewedRow(id,date='2011-02-01',extra={}){
  const r=row(id,date,extra);r[14].monthCountry='Country A';r[14].monthlyReview={source:{url:'https://primary.example/'+id,title:'Checked source'}};return r;
}

test('catalog retains all eligible entries without caps and reports minima as shortfalls',()=>{
  const rows=Array.from({length:15},(_,i)=>row('entry'+i));
  const result=buildCatalog(fixture(rows));
  assert.equal(result.events.length,15);
  const feb=result.coverage.months[1],jan=result.coverage.months[0];
  assert.equal(feb.availableByCountry['Country A'].available,15);
  assert.equal(feb.countriesWithAtLeast12,1);
  assert.equal(jan.unmetMinimums[0].shortfallTo3,3);assert.equal(jan.unmetMinimums[0].shortfallTo12,12);
  assert.ok(result.events.every(r=>r[14].monthlyCatalog.status==='catalog-import'));
});

test('reviewed overrides replace originals and same dated event at conflicting coordinates, preserving identity',()=>{
  const original=row('original','2011-02-01',{slug:'Shared'}),duplicate=row('duplicate','2011-02-01',{slug:'Shared',lon:6});
  const corrected=reviewedRow('original','2011-02-01',{slug:'Shared',title:'Reviewed title'});
  const result=buildCatalog(fixture([original,duplicate],[corrected]));
  assert.equal(result.events.length,1);assert.equal(result.events[0][0],'Reviewed title');
  assert.equal(result.events[0][14].id,'original');assert.equal(result.events[0][14].mediaKey,original[14].mediaKey);
  assert.equal(result.events[0][14].monthlyCatalog.status,'independently-reviewed');
  assert.equal(result.summary.reviewedDuplicatesSuppressed,2);
  assert.ok(result.exclusions.some(e=>e.id==='duplicate'&&e.supersededBy==='original'));
});

test('optional reviewed supplements overlay identical identities without inflating counts',()=>{
  const first=reviewedRow('event'),next=reviewedRow('event','2011-02-01',{title:'Updated checked title'});
  const result=buildCatalog({...fixture([], [first]),reviewedInputs:[{path:'extra.json',rows:[next,reviewedRow('second')]}]});
  assert.equal(result.events.length,2);assert.equal(result.summary.reviewedRows,2);
  assert.equal(result.events.find(r=>r[14].id==='event')[0],'Updated checked title');
  assert.ok(result.events.find(r=>r[14].id==='event')[14].monthlyCatalog.sourceFiles.includes('extra.json'));
});

test('year-only dates, precision warnings, non-Earth events, and other years are not imported',()=>{
  const year=row('year',null,{metadata:{start:{iso:null,precision:'year'}}});
  const warning=row('warning','2011-02-01',{metadata:{start:{iso:'2011-02-01',precision:'day',source:{note:'Date requires source verification.'}}}});
  const mars=row('Mars_Exploration_Rover','2011-02-01');
  const later=row('later','2012-02-01');later[3]=later[4]=2012;
  const result=buildCatalog(fixture([year,warning,mars,later,row('valid')]));
  assert.equal(result.events.length,1);assert.equal(result.events[0][14].id,'valid');assert.equal(result.summary.outsideYear,1);
  assert.equal(result.summary.sourcePrecisionExcluded,2);assert.equal(result.summary.otherEligibilityExcluded,1);
});

test('unresolved countries remain catalog records but do not falsely satisfy country minima',()=>{
  const result=buildCatalog(fixture([row('ocean','2011-02-01',{lon:40})]));
  assert.equal(result.events.length,1);assert.equal(result.events[0][14].monthlyCatalog.country,null);
  assert.equal(result.coverage.months[1].unresolvedCountry,1);assert.equal(result.coverage.months[1].availableByCountry['Country A'].available,0);
});

test('event occurrence dedup prefers retained event media and retains source lineage',()=>{
  const first=row('a','2011-02-01',{slug:'Event'}),second=row('b','2011-02-01',{slug:'Event'});
  const args=fixture([first]);args.inputs.push({path:'shard.json',rows:[second]});args.photoKeys=[second[14].mediaKey];
  const result=buildCatalog(args);
  assert.equal(result.events.length,1);assert.equal(result.events[0][14].id,'b');
  assert.deepEqual(result.events[0][14].monthlyCatalog.sourceFiles,['base.json','shard.json']);
});

test('country classification adds unmapped high-income countries and applies twelve as a minimum',()=>{
  const result=buildCatalog({...fixture([row('a')]),countries:[{name:'Country A',highIncome:true},{name:'Missing Island',highIncome:true}]});
  const feb=result.coverage.months[1];
  assert.equal(feb.unmetMinimums.find(e=>e.country==='Country A').shortfall,11);
  assert.equal(feb.unmetMinimums.find(e=>e.country==='Missing Island').shortfall,12);
});

test('generated catalog contains reviewed overrides and only eligible 2011 records with distinct identities',()=>{
  const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../site/data/monthly-catalog.json'),'utf8'));
  assert.ok(catalog.events.length>1000);assert.ok(catalog.summary.reviewedRows>=11);
  assert.equal(new Set(catalog.events.map(r=>r[14].id)).size,catalog.events.length);
  assert.ok(catalog.events.every((r,i)=>{const e=eventModel.parseRow(r,i,time);return monthly.eligible(e,time)&&time.parts(e.t0).year===2011;}));
  assert.ok(!catalog.events.some(r=>r[14].id==='evt-m40cp3-7zgj7n'||r[14].id==='evt-1eabety-1vvtd9c'));
  assert.ok(catalog.events.some(r=>r[14].mediaKey==='STS-133|2011-02-24|28.58|-80.65'));
  const counts=catalog.events.reduce((out,r)=>{out[r[14].monthlyCatalog.status]=(out[r[14].monthlyCatalog.status]||0)+1;return out;},{});
  assert.deepEqual(counts,catalog.summary.statusCounts);
});
