const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const monthly = require('../site/monthly-model');
const time = require('../site/time');
const events = require('../site/event-model');

const date = iso => time.parseISO(iso);
const event = (id, iso = '2014-07-15', extra = {}) => ({stableId:id, slug:id, title:id, date:iso, datePrecision:'day', lat:5, lon:5, w:1, ...extra});
const box = (name, coordinates) => ({type:'Feature', properties:{name}, geometry:{type:'Polygon', coordinates}});
const countries = {type:'FeatureCollection', features:[
  box('A', [[[0,0],[10,0],[10,10],[0,10],[0,0]], [[2,2],[3,2],[3,3],[2,3],[2,2]]]),
  box('B', [[[20,0],[30,0],[30,10],[20,10],[20,0]]]),
  box('Date line', [[[170,-10],[-170,-10],[-170,10],[170,10],[170,-10]]])
]};
const countryFor = monthly.createCountryIndex(countries);

test('country containment respects holes, edges, oceans, and the dateline', () => {
  assert.equal(countryFor(5,5),'A');
  assert.equal(countryFor(2.5,2.5),null);
  assert.equal(countryFor(0,0),'A');
  assert.equal(countryFor(5,15),null);
  assert.equal(countryFor(0,179),'Date line');
  assert.equal(countryFor(0,-179),'Date line');
  assert.equal(countryFor(0,0),'A');
  assert.equal(countryFor(100,0),null);
  assert.equal(countryFor(0,NaN),null);
});

test('country containment supports MultiPolygon islands and reversed ring winding', () => {
  const index=monthly.createCountryIndex({features:[{properties:{name:'Islands'},geometry:{type:'MultiPolygon',coordinates:[
    [[[0,0],[0,1],[1,1],[1,0],[0,0]]], [[[5,5],[6,5],[6,6],[5,6],[5,5]]]
  ]}}]});
  assert.equal(index(.5,.5),'Islands');assert.equal(index(5.5,5.5),'Islands');assert.equal(index(3,3),null);
});

test('selection uses event starts in the exact calendar month, not interval overlap or a 30-day lookback', () => {
  const input=[event('june','2014-06-30',{temporalKind:'interval',endDate:'2014-09-01'}),event('first','2014-07-01'),event('last','2014-07-31'),event('august','2014-08-01')];
  const result=monthly.select(input,date('2014-07-12'),{time,countryFor});
  assert.deepEqual(result.events.map(e=>e.stableId),['first','last']);
  assert.equal(result.eligibleCount,2);assert.equal(result.countries,1);
  assert.equal(monthly.monthKey(date('2014-07-31'),time),'2014-07');
});

test('year-only, invalid, and source-warning dates are excluded; honest month precision is accepted', () => {
  assert.equal(monthly.eligible(event('year',null,{datePrecision:'year'}),time),false);
  assert.equal(monthly.eligible(event('bad','2014-02-30'),time),false);
  assert.equal(monthly.eligible(event('warn','2014-07-01',{metadata:{start:{precision:'day',source:{note:'Legacy extraction did not retain statement precision; date requires source verification.'}}}}),time),false);
  assert.equal(monthly.eligible(event('month','2014-07-01',{datePrecision:'month',dateUncertain:true,metadata:{start:{iso:'2014-07-01',precision:'month',source:{type:'wikidata'}}}}),time),true);
  assert.equal(monthly.eligible(event('warning-month','2014-07-01',{datePrecision:'month',metadata:{start:{precision:'month',source:{note:'Statement precision unavailable; only the year is retained.'}}}}),time),false);
});

test('non-Earth coordinates and space objects do not become Earth events; an explicit terrestrial launch can stay', () => {
  assert.equal(monthly.eligible(event('bad-geo',undefined,{lat:91}),time),false);
  assert.equal(monthly.eligible(event('mars',undefined,{metadata:{globe:'http://www.wikidata.org/entity/Q111'}}),time),false);
  assert.equal(monthly.eligible(event('Mars_Exploration_Rover',undefined,{title:'Mars Exploration Rover',desc:'A robotic space mission'}),time),false);
  assert.equal(monthly.eligible(event('landing',undefined,{title:'Apollo 11 landing on the Moon',place:'Kennedy Space Center'}),time),false);
  assert.equal(monthly.eligible(event('launch',undefined,{title:'Voyager 1 spacecraft launches',place:'Cape Canaveral'}),time),true);
  assert.equal(monthly.eligible(event('mislocated-launch',undefined,{title:'Spacecraft launches',place:'NASA headquarters'}),time),false);
  assert.equal(monthly.eligible(event('concert',undefined,{title:'The Freddie Mercury Tribute Concert',place:'Wembley Stadium'}),time),true);
});

test('selection retains every unique eligible country event; coverage minimums are not caps', () => {
  const input=[event('invalid','not-a-date'),event('a1','2014-07-01',{w:1}),event('a2','2014-07-01',{w:2}),event('a3','2014-07-01',{w:3}),event('a4','2014-07-01',{w:4}),event('b1','2014-07-01',{lon:25,w:2}),event('sea','2014-07-01',{lon:15,w:4})];
  input.push({...input[4]},{...input[4],stableId:'a4-second-source'});
  const options={time,countryFor,limit:3,rank:e=>e.w};
  const result=monthly.select(input,date('2014-07-01'),options);
  assert.deepEqual(result.events.map(e=>e.stableId),['a4','a3','a2','b1','a1']);
  assert.deepEqual(monthly.select(input.slice().reverse(),date('2014-07-01'),options).events.map(e=>e.stableId),['a4','a3','a2','b1','a1']);
  assert.equal(result.countries,2);assert.equal(result.eligibleCount,6);assert.equal(result.omittedCount,1);
  assert.ok(result.events.every(e=>e.monthCountry==='A'||e.monthCountry==='B'));
  assert.equal(monthly.select(input,date('2014-07-01'),{...options,limit:0}).events.length,5);
});

test('coverage uses 12 and 3 as per-country minimums, includes empty countries and separates reviewed counts', () => {
  const policy={countries:[{id:'AA',name:'A',highIncome:true,incomeLevel:'HIC',minimum:12,aliases:['A alias']},{id:'BB',name:'B',minimum:3},{id:'CC',name:'C',minimum:3}]};
  const input=Array.from({length:14},(_,i)=>event('a'+i,'2014-07-01',{metadata:i<2?{monthlyReview:{source:{url:'https://example.com/source'}}}:{}}));
  input.push(event('b1','2014-07-01',{lon:25}),event('b2','2014-07-01',{lon:25}));
  const result=monthly.select(input,date('2014-07-01'),{time,countryFor:(lat,lon)=>lon===25?'B':'A alias',policy});
  assert.equal(result.events.length,16);
  assert.equal(result.events.filter(e=>e.monthCountry==='A').length,14);
  assert.deepEqual(result.coverage.countries.map(c=>[c.name,c.minimum,c.available,c.reviewed,c.shortfall]),[['A',12,14,2,0],['B',3,2,0,1],['C',3,0,0,3]]);
  assert.equal(result.coverage.countriesMeetingTarget,1);
  assert.equal(result.coverage.countriesReviewedToTarget,0);
  assert.equal(result.coverage.shortfall,4);
});

test('10, 5, and 1 second month steps respect exact boundaries without cumulative frame drift', () => {
  for(const seconds of [10,5,1]){
    let state={index:1,elapsed:0,direction:1};
    const frames=seconds*60;
    for(let i=0;i<frames-1;i++)state=monthly.stepIndex(state.index,state.elapsed,1/60,state.direction,seconds,10);
    assert.equal(state.index,1);
    state=monthly.stepIndex(state.index,state.elapsed,1/60,state.direction,seconds,10);
    assert.equal(state.index,2);assert.ok(state.elapsed<1e-8);assert.equal(state.direction,1);
  }
});

test('monthly playback handles reverse, multi-month deltas, pause, and both terminal bounds', () => {
  assert.deepEqual(monthly.stepIndex(4,0,12,1,5,20),{index:6,elapsed:2,direction:1,ended:false});
  assert.deepEqual(monthly.stepIndex(4,0,12,-1,5,20),{index:2,elapsed:2,direction:-1,ended:false});
  assert.deepEqual(monthly.stepIndex(2,3,99,0,5,20),{index:2,elapsed:3,direction:0,ended:false});
  assert.deepEqual(monthly.stepIndex(18,0,20,1,5,20),{index:19,elapsed:0,direction:0,ended:true});
  assert.deepEqual(monthly.stepIndex(1,0,20,-1,5,20),{index:0,elapsed:0,direction:0,ended:true});
  assert.deepEqual(monthly.stepIndex(0,0,1,-1,5,20),{index:0,elapsed:0,direction:0,ended:true});
});

test('existing 2003 Winter Games cannot leak into March and Mars rover cannot appear in Earth monthly POC', () => {
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../site/data/events.json'),'utf8'));
  const games=events.parseRow(raw.find(r=>r[9]==='2003_Asian_Winter_Games'),0,time);
  const rover=events.parseRow(raw.find(r=>r[9]==='Mars_Exploration_Rover'),1,time);
  const map=()=> 'Japan';
  assert.equal(monthly.select([games],date('2003-02-01'),{time,countryFor:map}).events.length,1);
  assert.equal(monthly.select([games],date('2003-03-01'),{time,countryFor:map}).events.length,0);
  assert.equal(monthly.eligible(rover,time),false);
});

test('bundled present-day geography resolves known inland places and dateline islands', () => {
  const geo=JSON.parse(fs.readFileSync(path.join(__dirname,'../site/assets/countries-110m.json'),'utf8'));
  const index=monthly.createCountryIndex(geo);
  assert.equal(index(48.86,2.35),'France');
  assert.equal(index(27.7,85.32),'Nepal');
  assert.equal(index(-15.6,167),'Vanuatu');
  assert.equal(index(-16.5,179.5),'Fiji');
});

test('source-backed country associations rescue offshore events but unsourced labels cannot override geography', () => {
  const input=[event('source','2014-07-01',{lon:15,metadata:{monthCountry:'Japan',monthlyReview:{source:{url:'https://www.jma.go.jp/example'}}}}),event('unsourced','2014-07-01',{lon:15,metadata:{monthCountry:'Japan'}})];
  const result=monthly.select(input,date('2014-07-01'),{time,countryFor});
  assert.deepEqual(result.events.map(e=>e.stableId),['source']);assert.equal(result.events[0].monthCountry,'Japan');
});

test('reviewed 2011 pilot preserves media identities, has three February events, and does not invent missing months', () => {
  const pilot=JSON.parse(fs.readFileSync(path.join(__dirname,'../site/data/monthly-pilot.json'),'utf8'));
  const rows=pilot.events.map((r,i)=>events.parseRow(r,i,time));
  assert.equal(pilot.version,1);assert.equal(pilot.from,'2011-01');assert.equal(pilot.through,'2011-12');assert.equal(rows.length,11);
  assert.equal(new Set(rows.map(e=>e.stableId)).size,11);
  assert.ok(rows.every(e=>monthly.eligible(e,time)&&e.metadata.monthlyReview.source.url));
  const february=monthly.select(rows,date('2011-02-01'),{time,countryFor:()=>null});
  assert.equal(february.events.length,3);assert.equal(february.countries,3);
  assert.ok(february.events.some(e=>e.mediaKey==='STS-133|2011-02-24|28.58|-80.65'));
  assert.ok(february.events.some(e=>e.title==='Christchurch earthquake'));
  assert.ok(february.events.some(e=>e.monthCountry==='Germany'));
  const march=monthly.select(rows,date('2011-03-01'),{time,countryFor:()=>null});
  assert.equal(march.events.length,2);assert.ok(march.events.every(e=>e.monthCountry==='Japan'));
  for(const month of ['2011-06-01','2011-10-01','2011-11-01','2011-12-01'])assert.equal(monthly.select(rows,date(month),{time,countryFor}).events.length,0);
  const original=JSON.parse(fs.readFileSync(path.join(__dirname,'../site/data/events.json'),'utf8')).concat(JSON.parse(fs.readFileSync(path.join(__dirname,'../site/data/y/2011.json'),'utf8')));
  for(const r of pilot.events){const before=original.find(x=>x[14].id===r[14].id);assert.ok(before);assert.equal(r[14].mediaKey,before[14].mediaKey);}
});
