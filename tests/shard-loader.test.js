const test = require('node:test');
const assert = require('node:assert/strict');
const shards = require('../site/shard-loader.js');
function row(title='Event'){ return [title,1,2,2010,2010,'cul',2,'Place','Description','Event']; }
function response(rows){ return {ok:true,json:async()=>rows}; }
function deferred(){ let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject}; }
function create(options={}){
  return shards.create({years:[2009,2010,2011],dir:'/data/y/',onRows:rows=>rows.length,...options});
}

test('simultaneous callers share one fetch and one insertion per year', async () => {
  const gate=deferred();let fetches=0,insertions=0;
  const loader=create({fetch:()=>{fetches++;return gate.promise;},onRows:rows=>{insertions++;return rows.length;}});
  const a=loader.load(2010),b=loader.load(2010);
  assert.equal(a,b);assert.equal(loader.status().states[2010],'loading');
  await Promise.resolve();assert.equal(fetches,1);
  gate.resolve(response([row()]));assert.deepEqual(await a,{year:2010,added:1});
  await b;assert.equal(insertions,1);
  assert.deepEqual(await loader.load(2010),{year:2010,added:0});assert.equal(fetches,1);
});

test('HTTP failure remains retryable and clears its error after success', async () => {
  let tries=0,inserted=0;const statuses=[];
  const loader=create({fetch:async()=>++tries===1?{ok:false,status:503}:response([row()]),onRows:rows=>{inserted+=rows.length;return rows.length;},onStatus:s=>statuses.push(s)});
  const failed=await loader.load(2010);
  assert.equal(failed.error,'HTTP 503');assert.equal(loader.status().states[2010],'error');
  assert.equal(inserted,0);
  const retried=await loader.load(2010);
  assert.equal(retried.added,1);assert.equal(tries,2);assert.equal(inserted,1);
  assert.equal(loader.status().states[2010],'loaded');assert.equal(loader.status().failures[2010],undefined);
  assert.deepEqual(statuses.map(s=>s.states[2010]),['loading','error','loading','loaded']);
});

test('network and JSON parse errors both release pending requests for retry', async () => {
  for(const fail of [()=>Promise.reject(new Error('Network interrupted')),()=>Promise.resolve({ok:true,json:async()=>{throw new SyntaxError('Incomplete JSON');}})]){
    let first=true;
    const loader=create({fetch:()=>first?(first=false,fail()):Promise.resolve(response([row()]))});
    assert((await loader.load(2010)).error);assert.equal(loader.status().states[2010],'error');
    assert.equal((await loader.load(2010)).added,1);assert.equal(loader.status().states[2010],'loaded');
  }
});

test('invalid payload does not become an empty successfully loaded year', async () => {
  let first=true,calls=0;
  const loader=create({fetch:async()=>response(first?(first=false,[['short']]):[row()]),onRows:rows=>{calls++;return rows.length;}});
  assert.equal((await loader.load(2010)).error,'Invalid event data');assert.equal(calls,0);
  assert.equal((await loader.load(2010)).added,1);assert.equal(calls,1);
});

test('an explicitly empty valid shard loads once', async () => {
  let fetches=0;
  const loader=create({fetch:async()=>{fetches++;return response([]);}});
  assert.equal((await loader.load(2010)).added,0);assert.equal(loader.status().states[2010],'loaded');
  await loader.load(2010);assert.equal(fetches,1);
});

test('concurrent overlapping ranges load each year once and permit retry of only failed years', async () => {
  const calls=new Map();
  const loader=create({fetch:async url=>{
    const year=Number(/(\d+)\.json$/.exec(url)[1]);calls.set(year,(calls.get(year)||0)+1);
    if(year===2010 && calls.get(year)===1)return {ok:false,status:502};
    return response([row(String(year))]);
  }});
  const [a,b]=await Promise.all([loader.range(2009.5,2010.9),loader.range(2010,2011.1)]);
  assert.equal(a.length,2);assert.equal(b.length,2);assert.deepEqual([...calls].sort(),[[2009,1],[2010,1],[2011,1]]);
  const retry=await loader.range(2009,2011);
  assert.equal(retry.filter(r=>r.added===1).length,1);
  assert.deepEqual([...calls].sort(),[[2009,1],[2010,2],[2011,1]]);
});

test('one slow year does not prevent other years completing and load order does not lose records', async () => {
  const gate=deferred(),seen=[];
  const loader=create({fetch:url=>url.includes('2009')?gate.promise:Promise.resolve(response([row('2011')])),onRows:(rows,year)=>{seen.push(year);return rows.length;}});
  const old=loader.load(2009);await loader.load(2011);
  assert.deepEqual(seen,[2011]);gate.resolve(response([row('2009')]));await old;
  assert.deepEqual(seen,[2011,2009]);assert.equal(loader.status().states[2009],'loaded');
});

test('consumer insertion failure stays retryable and state snapshots cannot mutate internal status', async () => {
  let first=true;
  const loader=create({fetch:async()=>response([row()]),onRows:rows=>{if(first){first=false;throw new Error('Insert failed');}return rows.length;}});
  assert.equal((await loader.load(2010)).error,'Insert failed');
  const snapshot=loader.status();snapshot.states[2010]='loaded';snapshot.failures[2010]='changed';
  assert.equal(loader.status().states[2010],'error');assert.equal(loader.status().failures[2010],'Insert failed');
  assert.equal((await loader.load(2010)).added,1);
});
