const test=require('node:test'),assert=require('node:assert/strict');
const {buildCatalog}=require('../scripts/build_monthly_catalog.cjs');
const corrections=require('../site/data/monthly-location-corrections.json');
const original=require('../site/data/y/2011.json');
const catalog=require('../site/data/monthly-catalog.json');
const borders=require('../site/assets/countries-110m.json');
const expected=[['evt-161g2d7-1q0u3p7','2011-02-09',4.85,31.6,'South Sudan'],['evt-3o8vkk-g3n8kq','2011-02-27',15.6,32.53,'Sudan']];
test('source-reviewed city markers retain event identities, media keys, and original location lineage',()=>{
  for(const [id,date,lat,lon,country] of expected){
    const before=original.find(r=>r[14].id===id),after=corrections.events.find(r=>r[14].id===id);
    assert(before&&after);assert.equal(after[10],date);assert.deepEqual(after.slice(1,3),[lat,lon]);
    assert.equal(after[14].mediaKey,before[14].mediaKey);assert.equal(after[14].sourceIdentity,before[14].sourceIdentity);
    assert.equal(after[14].monthCountry,country);assert.equal(after[14].monthlyReview.locationPrecision,'approximate-city');
    assert.deepEqual(after[14].monthlyReview.originalCoordinates,before.slice(1,3));
    assert.match(after[14].monthlyReview.source.url,/^https:\/\/(www\.gov\.uk|unmis\.unmissions\.org)\//);
  }
});
test('two corrections replace rather than duplicate the old centroid records in the build',()=>{
  const rows=original.filter(r=>expected.some(([id])=>id===r[14].id));
  const result=buildCatalog({inputs:[{path:'site/data/y/2011.json',rows}],pilot:{from:'2011-01',through:'2011-12',updatedAt:'2026-09-05',events:[]},geojson:borders,reviewedInputs:[{path:'site/data/monthly-location-corrections.json',rows:corrections.events}]});
  assert.equal(result.events.length,2);assert.equal(result.summary.reviewedRows,2);assert.equal(result.summary.reviewedDuplicatesSuppressed,2);
  assert.notDeepEqual(result.events[0].slice(1,3),result.events[1].slice(1,3));
  for(const [id,date,lat,lon,country] of expected){
    const built=catalog.events.filter(r=>r[14].id===id);assert.equal(built.length,1);
    assert.equal(built[0][10],date);assert.deepEqual(built[0].slice(1,3),[lat,lon]);assert.equal(built[0][14].monthlyCatalog.country,country);
  }
});
