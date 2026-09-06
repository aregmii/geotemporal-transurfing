const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const recommendations=require('../site/monthly-recommendations.js');
const event=(id,country='France',date='2011-02-01',extra={})=>({stableId:id,title:id,monthCountry:country,date,lat:45,lon:2,w:2,cat:'cul',...extra});

test('recommendations use only the current month, unique valid events, and diverse countries',()=>{
  const events=[event('fr1'),event('fr2'),event('us','United States'),event('np','Nepal'),event('br','Brazil'),event('old','Japan','2011-01-02'),event('next','Japan','2011-03-01'),event('bad','Japan','2011-02-02',{lat:NaN}),event('fr1')];
  const rows=recommendations.select(events,{month:'2011-02'});
  assert.equal(rows.length,4);assert.equal(new Set(rows.map(e=>e.monthCountry)).size,4);
  assert(rows.every(e=>e.date.startsWith('2011-02')));
  assert(!rows.some(e=>['old','next','bad'].includes(e.stableId)));
});
test('elsewhere excludes the selected event and country, with no invented filler',()=>{
  const selected=event('fr1');
  const rows=recommendations.select([selected,event('fr2'),event('np','Nepal')],{month:'2011-02',selected});
  assert.deepEqual(rows.map(e=>e.stableId),['np']);
  assert.deepEqual(recommendations.select([selected],{month:'2011-02',selected}),[]);
});
test('reviewed records and verified media rank ahead within a country without dropping diversity',()=>{
  const events=[event('unreviewed'),event('reviewed','France','2011-02-01',{metadata:{monthlyReview:{source:{url:'https://example.org'}}}}),event('clip','Canada'),event('plain','Canada'),event('uk','United Kingdom')];
  const rows=recommendations.select(events,{month:'2011-02',hasMedia:e=>e.stableId==='clip',limit:3});
  assert.deepEqual(rows.map(e=>e.stableId),['reviewed','clip','uk']);
});

test('every rendered recommendation clicks through the shared event-selection path',()=>{
  function el(){return {children:[],dataset:{},classList:{add(){}},appendChild(c){this.children.push(c);},append(...cs){this.children.push(...cs);},replaceChildren(){this.children=[];},setAttribute(){}};}
  const nodes=Object.fromEntries(['recommendedEvents','recommendationsHeading','recommendationsMonth','monthRecommendations','monthBrowse'].map(id=>[id,el()]));
  const events=[event('fr'),event('np','Nepal'),event('ca','Canada'),event('uk','United Kingdom')], clicks=[];
  const context={document:{getElementById:id=>nodes[id],createElement:el},TIME:{},MONTHLY:{monthKey:()=> '2011-02'},window:{GTMonthlyRecommendations:recommendations},selected:null,nowT:0,monthLabel:()=> 'Feb 2011',monthSelection:{events},off:{},PHOTOS_ONLY:false,visualFor:()=>null,mediaFor:()=>null,photoFor:()=>null,ICON_URL:{cul:'icons/culture.svg'},whenLabel:e=>e.date,selectEvent:e=>clicks.push(e)};
  const source=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8'),start=source.indexOf('function renderRecommendations('),end=source.indexOf('\n}',start)+2;
  vm.runInNewContext(source.slice(start,end),context);
  context.renderRecommendations();assert.equal(nodes.recommendedEvents.children.length,4);
  for(const button of nodes.recommendedEvents.children){assert(button.dataset.event);button.onclick();}
  assert.equal(new Set(clicks.map(e=>e.stableId)).size,4);assert(clicks.every(e=>events.includes(e)));
  context.selected=events[0];context.renderRecommendations();
  assert.equal(nodes.recommendationsHeading.textContent,'Elsewhere this month');
  assert(nodes.recommendedEvents.children.every(b=>b.dataset.event!=='fr'));
  context.off.cul=true;context.renderRecommendations();
  assert.equal(nodes.recommendedEvents.children[0].textContent,'No other events match this month and your filters.');
});
