import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { stripTypeScriptTypes } from 'node:module';

// Exercise the actual seed initializer with storage failures between its writes.
const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const initializer = source.slice(source.indexOf('function ensureSeedPlans()'), source.indexOf('function loadPlans()'));
const body = stripTypeScriptTypes(initializer).split('function ensureSeedPlans()')[1].trim().slice(1);
const validator = stripTypeScriptTypes(source.slice(source.indexOf('function isBrief('), source.indexOf('// Demo seed plans:')));
const validateBrief = new Function('OBJECTIVES', validator+'; return isBrief')(['performance','awareness','consideration'].map(id=>({id})));
const make = new Function('window', 'loadPlans', 'seedPlans', 'SEED_KEY', 'SEED_VERSION', 'PLANS_KEY', 'isBrief', `return function () {${body}`);

const factory=(...args)=>make(...args, validateBrief);

for (const failingKey of ['meta', 'plans']) {
  test(`seed storage failure at ${failingKey} cannot resurrect a deleted seed`, () => {
    const data = new Map();
    const writes = [];
    const window = { localStorage: {
      getItem: (key) => data.get(key) ?? null,
      removeItem: (key) => data.delete(key),
      setItem: (key, value) => {
        writes.push(key);
        if (key === failingKey) throw new Error('Quota exceeded');
        data.set(key, value);
      },
    } };
    const seeds = [{ id: 'sample', brief: {} }];
    const run = factory(window, () => JSON.parse(data.get('plans') ?? '[]'), () => seeds, 'meta', 1, 'plans');
    run();
    assert.equal(data.has('plans'), false);
    assert.deepEqual(writes, failingKey === 'meta' ? ['meta'] : ['meta', 'plans']);
    // Both failure points leave no plans and can safely retry after recovery.
    window.localStorage.setItem = (key, value) => data.set(key, value);
    run();
    assert.equal(JSON.parse(data.get('plans')).length, 1);
    data.set('plans', '[]');
    run();
    assert.deepEqual(JSON.parse(data.get('plans')), []);
  });
}

test('initialization preserves a pre-existing plan and its order across reload', () => {
  const existing = { id: 'user-plan', savedAt: '2026-01-01T00:00:00.000Z', brief: { name: 'My campaign', budget: 12345, objectives:['awareness'], kpis:['Reach'], audiences:['Procurement'], seniority:['Manager'], start:'2026-12-01', end:'2027-02-01' } };
  const data = new Map([['plans', JSON.stringify([existing])]]);
  const window = { localStorage: {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  } };
  const run = factory(window, () => JSON.parse(data.get('plans')), () => [{ id: 'seed-a', brief: {} }, { id: 'seed-b', brief: {} }], 'meta', 1, 'plans');
  run();
  const first = JSON.parse(data.get('plans'));
  assert.deepEqual(first[0], existing);
  assert.deepEqual(first.map((p) => p.id), ['user-plan', 'seed-a', 'seed-b']);
  run();
  assert.deepEqual(JSON.parse(data.get('plans')), first);
});

for (const raw of ['broken JSON', '{"unexpected":true}', '[{"id":"unreadable"}]', '[null]']) {
  test(`seeding preserves unreadable original data: ${raw}`, () => {
    const data = new Map([['plans', raw]]);
    const writes = [];
    const window = {localStorage: {getItem: k => data.get(k) ?? null, setItem: (k,v) => {writes.push(k); data.set(k,v)}}};
    factory(window, () => [], () => [{id:'seed', brief:{}}], 'meta', 1, 'plans')();
    assert.equal(data.get('plans'), raw);
    assert.deepEqual(writes, []);
    assert.equal(data.has('meta'), false);
  });
}

const recovery = stripTypeScriptTypes(source.slice(source.indexOf('function recoverCorruptPlans()'), source.indexOf('function loadPlans()')));
for (const raw of ['[null]', '[{"id":"incomplete"}]', '[{"id":"partial","savedAt":"now","brief":{}}]']) {
  test(`structurally invalid arrays are backed up before any seed or mutation: ${raw}`, () => {
    const data = new Map([['plans',raw]]);
    const window={localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
    const run=new Function('window','PLANS_KEY','PLANS_CORRUPT_KEY','isBrief',`let plansRecovered=false,plansLoadFailed=false;${recovery};recoverCorruptPlans();return {plansRecovered,plansLoadFailed}`);
    assert.deepEqual(run(window,'plans','backup',validateBrief),{plansRecovered:true,plansLoadFailed:false});
    assert.equal(data.has('plans'),false);assert.equal(JSON.parse(data.get('backup'))[0].payload,raw);
    data.set('plans',raw);window.localStorage.setItem=()=>{throw Error('quota')};
    assert.deepEqual(run(window,'plans','backup',validateBrief),{plansRecovered:false,plansLoadFailed:true});assert.equal(data.get('plans'),raw);
  });
}

const cleanup = stripTypeScriptTypes(source.slice(source.indexOf('function cleanDemoAudiences()'), source.indexOf('function SkeletonBlock()')));
for (const fails of [false, true]) {
  test(`retired demo audience cleanup is idempotent and preserves whole plans, storage failure=${fails}`, () => {
    const plans = [
      {id:'old', savedAt:'now', brief:{name:'Old', audiences:['R&D','Department Head']}},
      {id:'mixed', savedAt:'then', brief:{name:'Mixed', audiences:['Scientist / Researcher','R&D']}},
      {id:'current', savedAt:'later', brief:{name:'Current', audiences:['Procurement']}},
    ];
    let raw=JSON.stringify(plans),writes=0;
    const window={localStorage:{getItem:()=>raw,setItem:(_,v)=>{if(fails)throw Error('quota');raw=v;writes++}}};
    const run=new Function('window','PLANS_KEY','AUDIENCES',`let plansLoadFailed=false;${cleanup};cleanDemoAudiences();cleanDemoAudiences();return plansLoadFailed`);
    assert.equal(run(window,'plans',['Procurement','Scientist / Researcher']),fails);
    if(fails){assert.equal(raw,JSON.stringify(plans));assert.equal(writes,0)}
    else{assert.equal(writes,1);assert.deepEqual(JSON.parse(raw),plans.map((p,i)=>({...p,brief:{...p.brief,audiences:[[],['Scientist / Researcher'],['Procurement']][i]}})))}
  });
}

const seedSource = stripTypeScriptTypes(source.slice(source.indexOf('function isoDaysFromNow('), source.indexOf('function ensureSeedPlans()')));
const actualSeeds = new Function(`${seedSource}; return seedPlans;`)();
test('every example has the proposed explicit market mapping', () => {
 assert.deepEqual(actualSeeds(new Date('2026-11-09T14:00:00Z')).map(p=>[p.id,p.brief.markets]), [
 ['seed-active-1',['uk']],['seed-active-2',['france','germany']],['seed-past-1',['uk']],
 ['seed-past-2',['north-america','uk','france','germany']],['seed-past-3',['uk']],['seed-past-4',['uk']],['seed-past-5',['uk']]]);
});
test('market backfill is seed-only, content-exact, idempotent and preserves deletes, dates and explicit choices', () => {
 const date='2026-11-09T14:00:00Z';
 const originals=actualSeeds(new Date(date)).map(p=>{const {markets,...brief}=p.brief;return {...p,savedAt:date,brief}});
 const edited=structuredClone(originals[0]);edited.brief.start='2026-11-01';
 const custom={...structuredClone(originals[1]),id:'my-own-plan'};
 const explicit={...structuredClone(originals[2]),brief:{...originals[2].brief,markets:[]}};
 const deleted=originals[6].id;
 const old=[...originals.slice(0,6),edited,custom,explicit];
 const data=new Map([['plans',JSON.stringify(old)],['meta',JSON.stringify({version:2,applied:originals.map(p=>p.id)})]]);
 const window={localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}};
 const run=factory(window,()=>JSON.parse(data.get('plans')),actualSeeds,'meta',2,'plans');run();
 const result=JSON.parse(data.get('plans'));assert.equal(result.length,old.length);assert.equal(result.some(p=>p.id===deleted),false);
 for(let i=0;i<6;i++){assert.deepEqual(result[i],{...old[i],brief:{...old[i].brief,markets:actualSeeds(new Date(date))[i].brief.markets}})}
 assert.deepEqual(result.slice(6),old.slice(6));const once=data.get('plans');run();assert.equal(data.get('plans'),once);
});
