const model = require('../site/event-model.js');
const path = require('path');
function wikipedia(slug){ return 'https://en.wikipedia.org/wiki/' + encodeURIComponent(slug || ''); }
function metadata(row, options = {}){
  const raw = options.raw;
  const supplied = raw && row[16] && typeof row[16] === 'object' ? row[16] : (!raw && row[14] && typeof row[14] === 'object' ? row[14] : {});
  const date = raw ? row[13] : row[10];
  const sourceType = options.sourceType || (raw ? row[12] : 'curated') || 'event';
  const sourceIdentity = supplied.sourceIdentity || [sourceType, row[9], row[0], date || row[3], row[1], row[2]].join('|');
  const photoRow = row.slice(); photoRow[10] = model.isISO(date) ? date : null;
  const source = {type:sourceType, file:options.file ? path.basename(options.file) : undefined, url:wikipedia(row[9])};
  const knownDay = sourceType === 'yearpage' || sourceType === 'dated' || sourceType === 'birth-deep' || sourceType === 'death-deep' || sourceType === 'curated';
  const start = supplied.start || {iso:model.isISO(date) ? date : null, precision:model.isISO(date) ? 'day' : 'year', source};
  if (!supplied.start && model.isISO(date) && !knownDay) start.source = {...source, note:'Legacy extraction did not retain statement precision; date requires source verification.'};
  return {...supplied, id:supplied.id || model.stableId(photoRow, sourceIdentity), sourceIdentity, mediaKey:supplied.mediaKey || model.mediaKey(photoRow),
    source:supplied.source || source, kind:supplied.kind || (row[4] > row[3] ? 'interval' : 'point'), start,
    end:supplied.end || (row[4] > row[3] ? {iso:null,precision:'year',source} : null)};
}
function applyDates(row, meta, facts){
  if (!row[10] && meta.source.type === 'event' && facts.start && Number(/^([+-]?\d+)-/.exec(facts.start)?.[1]) === row[3]) {
    row[10] = facts.start;
    meta.mediaKey = model.mediaKey(row);
    meta.start = {iso:facts.start,precision:facts.startPrecision || 'day',source:{type:'wikidata',property:'P580',url:meta.source.url}};
  }
  if (meta.kind === 'point' && meta.source.type !== 'yearpage' && facts.start === row[10] && facts.end && facts.end > row[10]) {
    meta.kind = 'interval';
    meta.durationSource = 'Article interval matched the event start date';
  }
  // Article facts belong to the article's interval, never to a dated sub-event sharing that article.
  if (meta.kind === 'interval' && meta.source.type !== 'yearpage') {
    if (!row[10] && facts.start) { row[10] = facts.start; meta.start = {iso:facts.start,precision:facts.startPrecision || 'day',source:{type:'wikidata',property:'P580',url:meta.source.url}}; }
    if (facts.end && !(meta.end && meta.end.iso)) {
      const precision = facts.endPrecision;
      if (precision) {
        row[12] = facts.end;
        meta.end = {iso:facts.end,precision,source:{type:'wikidata',property:'P582',url:meta.source.url}};
        const y = Number(/^([+-]?\d+)-/.exec(facts.end)?.[1]);
        if (Number.isFinite(y)) row[4] = y <= 0 ? y - 1 : y;
      } else {
        // Legacy facts rounded month ends to day 28 and year ends to December 31. Their exact precision was lost.
        row[12] = null;
        const y = Number(/^([+-]?\d+)-/.exec(facts.end)?.[1]);
        if (Number.isFinite(y)) row[4] = y <= 0 ? y - 1 : y;
        meta.end = {iso:null,precision:'year',source:{type:'legacy-facts',url:meta.source.url,note:'Original end precision was not retained; only its year is used.'}};
      }
    }
  }
  if (meta.end && meta.end.iso) row[12] = meta.end.iso;
  if (meta.kind === 'point') { row[4] = row[3]; row[12] = null; meta.end = null; }
  if (row[10] && !meta.start.iso) meta.start = {...meta.start,iso:row[10],precision:'day'};
  return meta;
}
function applyOverride(row, meta, overrides){
  for (const o of overrides) {
    const m = o.match;
    if (row[9] !== m.slug || (m.id && meta.id !== m.id) || (m.date && row[10] !== m.date) || (m.start != null && row[3] !== m.start)) continue;
    if (o.title) row[0] = o.title;
    if (o.date) { row[10] = o.date; const y = Number(/^([+-]?\d+)-/.exec(o.date)[1]); row[3] = y <= 0 ? y - 1 : y; }
    if (o.kind) meta.kind = o.kind;
    if (o.endDate && o.kind === 'interval') {
      row[12] = o.endDate;
      const y = Number(/^([+-]?\d+)-/.exec(o.endDate)[1]);
      row[4] = y <= 0 ? y - 1 : y;
      meta.end = {iso:o.endDate,precision:o.endPrecision || 'day',source:{type:'verified-override',url:o.source,note:o.note}};
    }
    if (o.kind === 'point') { row[4] = row[3]; row[12] = null; meta.end = null; }
    meta.start = {iso:row[10],precision:o.precision || 'day',source:{type:'verified-override',url:o.source,note:o.note}};
    meta.override = true;
  }
  return meta;
}
module.exports = {metadata, applyDates, applyOverride};
