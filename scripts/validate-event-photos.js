const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const photos = require('../site/event-photos.js');
const repo = process.argv[2] || path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../site/data/event-photos.json')));
const files = [path.join(repo, 'site/data/events.json'), ...fs.readdirSync(path.join(repo, 'site/data/y')).filter(f => f.endsWith('.json')).map(f => path.join(repo, 'site/data/y', f))];
const rows = files.flatMap(f => JSON.parse(fs.readFileSync(f)));
const identities = new Map(rows.map(row => [photos.keyForEvent(row), row]));
const index = photos.createIndex(manifest);

for (const entry of manifest.events) {
  assert(identities.has(entry.key), 'No exact source record: ' + entry.key);
  const row = identities.get(entry.key);
  assert.equal(photos.photosFor(row, index)[0].file, entry.photos[0].file);
  for (const photo of entry.photos) {
    assert(fs.statSync(path.join(repo, 'site/img', photo.file)).size > 0, 'Missing image: ' + photo.file);
    assert(/^(contemporaneous|aftermath|context)$/.test(photo.photoRole));
    assert(/^\d{4}-\d{2}(-\d{2})?$/.test(photo.photoDate));
    assert(photo.location && photo.author && photo.license && photo.filePage.startsWith('https://commons.wikimedia.org/wiki/File:'));
    assert.equal(photo.verifiedAt, manifest.auditedAt);
  }
  // A birth, a death, or a later article-linked event must not inherit this image.
  const wrongDate = row.slice(); wrongDate[10] = '1600-02-01'; wrongDate[14] = null;
  assert.deepEqual(photos.photosFor(wrongDate, index), []);
  const wrongPlace = row.slice(); wrongPlace[1] += 0.01; wrongPlace[14] = null;
  assert.deepEqual(photos.photosFor(wrongPlace, index), []);
  // Corrections to runtime dates retain the original association identity.
  assert.equal(photos.photosFor({ mediaKey: entry.key, date: '1600-02-01' }, index)[0].file, entry.photos[0].file);
  assert.equal(photos.photosFor({ metadata: { mediaKey: entry.key }, start: 123 }, index)[0].file, entry.photos[0].file);
  const correctedRow = row.slice(); correctedRow[10] = '1600-02-01'; correctedRow[14] = { mediaKey: entry.key };
  assert.equal(photos.photosFor(correctedRow, index)[0].file, entry.photos[0].file);
}
const handshake = manifest.events.find(e => e.match.slug === 'New_START');
assert.equal(handshake.match.start, '2010-04-08');
assert.deepEqual(photos.photosFor({ slug: 'New_START', date: '2011-02-05', lat: 50.09, lon: 14.42 }, index), []);
const eclipse = manifest.events.find(e => e.match.slug === 'Solar_eclipse_of_March_20,_2015').photos[0];
assert.equal(eclipse.author, 'Damien Deltenre');
assert.equal(eclipse.license, 'CC BY-SA 3.0');
console.log(`${manifest.events.length} associations validated against ${rows.length} rows and existing local JPEGs. Shared-slug, different-date, different-location, and corrected-date matching checks passed.`);
