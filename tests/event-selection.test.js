const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../site/event-selection');
const row=(id,lat=50,lon=0,date='2014-01-01')=>({stableId:id,slug:id,date,lat,lon});
test('densest city does not displace other occupied regions from first round',()=>{
 const a=[row('London-A'),row('London-B'),row('Tokyo',35,140),row('Lima',-12,-77),row('London-C')];
 assert.deepEqual(S.select(a,3).map(e=>e.slug),['London-A','Tokyo','Lima']);
});
test('featured real media stays first and budget is respected',()=>{
 const a=[row('London'),row('Tokyo',35,140),row('photo',40,-70)];assert.deepEqual(S.select(a,2,e=>e.slug==='photo').map(e=>e.slug),['photo','London']);
});
test('same article date and place is one projection; different dates or places survive',()=>{
 const a=[row('event'),{...row('event'),stableId:'second-source'},row('event',50,0,'2014-01-02'),row('event',51,0)];
 assert.equal(S.select(a,20).length,3);assert.equal(a.length,4);assert.equal(a[1].stableId,'second-source');
});
test('selection contains only supplied event objects and handles empty or zero budget',()=>{
 const a=[row('a'),row('b',35,140)];assert.ok(S.select(a,4).every(e=>a.includes(e)));assert.deepEqual(S.select(a,0),[]);assert.deepEqual(S.select([],4),[]);
});
test('a selected monthly projection is larger while unrelated events stay readable',()=>{
 const chosen=row('selected'),other=row('nearby',35,140),context=row('elsewhere',-10,-80);
 const focus=S.presentation(chosen,chosen,[context]),nearby=S.presentation(other,chosen,[context]),related=S.presentation(context,chosen,[context]);
 assert.equal(focus.scale,1.65);assert.equal(focus.cardOpacity,1);
 assert.equal(nearby.scale,1);assert(nearby.cardOpacity>=.75);assert(nearby.baseOpacity>=.6);
 assert(related.cardOpacity>nearby.cardOpacity);assert.equal(S.presentation(other,null).cardOpacity,.96);
});
