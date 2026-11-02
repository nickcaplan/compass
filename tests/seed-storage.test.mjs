import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { stripTypeScriptTypes } from 'node:module';

// Exercise the actual seed initializer with storage failures between its writes.
const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const initializer = source.slice(source.indexOf('function ensureSeedPlans()'), source.indexOf('function loadPlans()'));
const body = stripTypeScriptTypes(initializer).split('function ensureSeedPlans()')[1].trim().slice(1);
const factory = new Function('window', 'loadPlans', 'seedPlans', 'SEED_KEY', 'SEED_VERSION', 'PLANS_KEY', `return function () {${body}`);

for (const failingKey of ['meta', 'plans']) {
  test(`seed storage failure at ${failingKey} cannot resurrect a deleted seed`, () => {
    const data = new Map();
    const writes = [];
    const window = { localStorage: {
      getItem: (key) => data.get(key) ?? null,
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
    // Once storage works again, a failed plan write stays skipped, while a
    // failed metadata write may safely retry because no plan was ever added.
    window.localStorage.setItem = (key, value) => data.set(key, value);
    run();
    if (failingKey === 'plans') assert.equal(data.has('plans'), false);
    else {
      assert.equal(JSON.parse(data.get('plans')).length, 1);
      data.set('plans', '[]');
      run();
      assert.deepEqual(JSON.parse(data.get('plans')), []);
    }
  });
}

test('initialization preserves a pre-existing plan and its order across reload', () => {
  const existing = { id: 'user-plan', savedAt: '2026-01-01T00:00:00.000Z', brief: { name: 'My campaign', budget: 12345 } };
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
