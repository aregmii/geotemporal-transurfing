const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const identity = require('../site/event-photos.js');
const repo = process.argv[2] || path.join(__dirname, '..');
const media = JSON.parse(fs.readFileSync(path.join(__dirname, '../site/data/event-media.json')));
const data = path.join(repo, 'site/data');
const files = [path.join(data, 'events.json'), ...fs.readdirSync(path.join(data, 'y')).filter(f => f.endsWith('.json')).map(f => path.join(data, 'y', f))];
const rows = files.flatMap(f => JSON.parse(fs.readFileSync(f)));
const identities = new Set(rows.map(identity.keyForEvent));

for (const [key, item] of Object.entries(media)) {
  assert.equal(identity.keyForMatch(item.match), key);
  assert(identities.has(key), 'Missing exact event: ' + key);
  assert.equal(item.autoplayApproved, true);
  assert.equal(item.mediaRole, 'contemporaneous');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(item.mediaDate));
  assert(item.filePage.startsWith('https://commons.wikimedia.org/wiki/File:'));
  assert(item.author && item.license && item.location && item.notes && item.changes);
  const file = path.join(repo, 'site/media', item.file);
  assert(fs.statSync(file).size > 0);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stderr);
  const info = JSON.parse(probe.stdout);
  assert.equal(info.streams.some(s => s.codec_type === 'audio'), item.hasAudio);
  assert.equal(info.streams.some(s => s.codec_type === 'video'), item.kind === 'video');
  assert(Math.abs(Number(info.format.duration) - item.seconds) < 0.05);
  const decode = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-xerror', '-i', file, '-f', 'null', '-'], { encoding: 'utf8' });
  assert.equal(decode.status, 0, decode.stderr);
  assert.equal(decode.stderr.trim(), '', 'Decode error: ' + file + '\n' + decode.stderr);
}
const egypt = media['Egyptian_revolution_of_2011|2011-01-25|30.04|31.24'];
assert.equal(egypt.mediaDate, '2011-01-28');
assert.equal(egypt.sourceFileDate, '2011-01-29');
assert.equal(media['Egyptian_revolution_of_2011|2015-01-25|30.04|31.24'], undefined);
assert(!Object.keys(media).some(key => !key.includes('|')), 'No legacy slug-only autoplay');
console.log(`${Object.keys(media).length} exact event-media associations validated against ${rows.length} rows. All files decode cleanly; audio/video tracks, duration, recording dates, and wrong-year rejection passed.`);
