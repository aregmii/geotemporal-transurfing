const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../site/data/monthly-coverage-policy.json');
const geography = require('../site/assets/countries-110m.json');
const monthly = require('../site/monthly-model');
const time = require('../site/time');

test('coverage policy preserves all 218 FY2027 World Bank economies and all 87 high-income targets', () => {
  assert.equal(policy.classificationYear, 'FY2027');
  assert.equal(policy.source.url, 'https://datahelpdesk.worldbank.org/knowledgebase/articles/906519-world-bank-country-and-lending-groups');
  assert.equal(policy.updatedAt, '2026-09-05');
  assert.equal(policy.countries.length, 218);
  assert.equal(new Set(policy.countries.map(c => c.id)).size, 218);
  assert.equal(new Set(policy.countries.map(c => c.name)).size, 218);
  const counts = {LIC:0, LMC:0, UMC:0, HIC:0};
  for (const country of policy.countries) {
    assert.ok(Object.hasOwn(counts, country.incomeLevel), country.name);
    counts[country.incomeLevel]++;
    assert.equal(country.highIncome, country.incomeLevel === 'HIC', country.name);
    assert.equal(country.minimum, country.highIncome ? 12 : 3, country.name);
    assert.ok(Array.isArray(country.aliases) && Array.isArray(country.mapNames), country.name);
  }
  assert.deepEqual(counts, {LIC:25, LMC:47, UMC:59, HIC:87});
  assert.deepEqual(policy.incomeCounts, counts);
});

test('the complete policy uses source classifications, including smaller high-income economies', () => {
  const country = name => policy.countries.find(c => c.name === name);
  for (const name of ['American Samoa', 'Andorra', 'Bulgaria', 'Costa Rica', 'Guyana', 'Russian Federation', 'Singapore', 'Taiwan, China', 'Nauru', 'Palau']) {
    assert.equal(country(name).minimum, 12, name);
  }
  for (const [name, level] of [['Argentina','UMC'], ['Türkiye','UMC'], ['Vietnam','UMC'], ['Namibia','LMC'], ['Venezuela','LMC'], ['Ethiopia','LIC']]) {
    assert.equal(country(name).incomeLevel, level, name);
    assert.equal(country(name).minimum, 3, name);
  }
  assert.deepEqual(country('Singapore').mapNames, []);
  assert.deepEqual(country('Andorra').mapNames, []);
});

test('map aliases resolve uniquely and only refer to actual bundled geometries', () => {
  const names = new Set(geography.features.map(f => f.properties.name));
  const owners = new Map();
  for (const country of policy.countries) {
    for (const name of [country.name, ...country.aliases, ...country.mapNames]) {
      assert.ok(!owners.has(name) || owners.get(name) === country.id, name);
      owners.set(name, country.id);
    }
    for (const name of country.mapNames) assert.ok(names.has(name), name);
  }
  assert.equal(policy.countries.filter(c => c.mapNames.length).length, 171);
  assert.deepEqual([...names].filter(name => !owners.has(name)).sort(), [
    'Antarctica', 'Falkland Is.', 'Fr. S. Antarctic Lands', 'N. Cyprus', 'Somaliland', 'W. Sahara'
  ]);
});

test('country selection unifies map names with World Bank names without losing high-income minimums', () => {
  const examples = [
    ['United States of America','United States',12], ['South Korea','Korea, Rep.',12],
    ['Russia','Russian Federation',12], ['Slovakia','Slovak Republic',12],
    ['Turkey','Türkiye',3], ['North Korea',"Korea, Dem. People's Rep.",3],
    ['Dem. Rep. Congo','Congo, Dem. Rep.',3], ['Congo','Congo, Rep.',3],
    ['eSwatini','Eswatini',3], ['Palestine','West Bank and Gaza',3]
  ];
  for (const [mapName, canonical, minimum] of examples) {
    const event = {stableId:mapName, slug:mapName, title:mapName, date:'2011-02-15', datePrecision:'day', lat:5, lon:5};
    const result = monthly.select([event], time.parseISO('2011-02-01'), {time, policy, countryFor:() => mapName});
    assert.equal(result.events[0].monthCountry, canonical);
    const country = result.coverage.countries.find(c => c.name === canonical);
    assert.equal(country.minimum, minimum, mapName);
    assert.equal(country.available, 1, mapName);
    assert.equal(result.coverage.totalCountries, 218, mapName);
  }
});

test('empty-month coverage retains unmapped economies and reports missing events honestly', () => {
  const result = monthly.select([], time.parseISO('2011-02-01'), {time, policy});
  assert.equal(result.events.length, 0);
  assert.equal(result.coverage.totalCountries, 218);
  assert.equal(result.coverage.shortfall, 1437);
  assert.equal(result.coverage.countriesMeetingTarget, 0);
  const singapore = result.coverage.countries.find(c => c.name === 'Singapore');
  assert.equal(singapore.available, 0);
  assert.equal(singapore.shortfall, 12);
  assert.equal(singapore.reviewedShortfall, 12);
});
