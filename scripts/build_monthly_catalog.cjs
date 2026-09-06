#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const time = require('../site/time');
const eventModel = require('../site/event-model');
const monthly = require('../site/monthly-model');

const ROOT = path.resolve(__dirname, '..');
const YEAR = 2011;
const SOURCES = ['site/data/events.json', 'site/data/y/2011.json'];
const PILOT = 'site/data/monthly-pilot.json';
const OPTIONAL_REVIEWED = ['site/data/monthly-us-feb-2011.json', 'site/data/monthly-location-corrections.json'];
const OUTPUT = 'site/data/monthly-catalog.json';
const CONFLICTS = {
  'evt-m40cp3-7zgj7n': {replacement:'evt-1ee7svq-xk7x64', reason:'Reviewed IGN source dates this Lorca earthquake to May 11, not the duplicate year-page date May 1.'},
  'evt-1eabety-1vvtd9c': {reason:'The title, description and article identify the 2021 Biathlon World Championships, contradicting the recorded 2011 date. Quarantined, not silently redated.'}
};

function clone(value){ return JSON.parse(JSON.stringify(value)); }
function sorted(object){ return Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b, 'en'))); }
function reviewedSource(meta){
  const source = meta.monthlyReview && meta.monthlyReview.source;
  return typeof source === 'string' ? source : source && source.url;
}
function reviewed(meta){ return /^https?:\/\//.test(reviewedSource(meta) || ''); }
function article(slug){
  try { return decodeURIComponent(String(slug || '')).replace(/_/g, ' ').toLowerCase(); }
  catch { return String(slug || '').replace(/_/g, ' ').toLowerCase(); }
}
function occurrence(e){ return [article(e.slug) || e.title, e.date, e.lat, e.lon].join('|'); }
function storyDate(e){ return e.slug ? [article(e.slug), e.date].join('|') : null; }
function monthOf(e){ return monthly.monthKey(e.t0, time); }
function count(object, key){ object[key] = (object[key] || 0) + 1; }

function exclusionReason(e){
  if (!Number.isFinite(e.lat) || !Number.isFinite(e.lon) || Math.abs(e.lat) > 90 || Math.abs(e.lon) > 180) return 'invalid-coordinates';
  if (!e.date || !['day', 'month'].includes(e.datePrecision)) return 'unknown-or-invalid-month';
  const source = e.metadata.start && e.metadata.start.source || {};
  if (e.datePrecision === 'day' && e.dateUncertain || /precision.*(?:not retain|unavailable|unknown)|requires source verification/i.test(source.note || '')) return 'source-precision-warning';
  return 'non-earth-or-unresolved-space-event';
}

function makeCoverage(records, geojson, countries){
  const months = Array.from({length:12}, (_, index) => YEAR + '-' + String(index + 1).padStart(2, '0'));
  const names = new Set((geojson.features || []).map(feature => feature.properties && feature.properties.name).filter(Boolean));
  records.forEach(record => { if (record.country) names.add(record.country); });
  (countries || []).forEach(country => names.add(country.name));
  const universe = Array.from(names).sort((a, b) => a.localeCompare(b, 'en'));
  const classifications = new Map((countries || []).map(country => [country.name, country]));
  return {
    targets:{minimumPerCountryMonth:3, minimumPerHighIncomeCountryMonth:12, interpretation:'minimums, never selection caps'},
    countryBasis:'Source-backed event-location country for independently reviewed rows; present-day low-resolution polygon inference for imported rows. No nearest-country fallback.',
    incomeClassification:countries ? 'Provided external country classification; see sources.' : 'Not supplied: shortfallTo12 is reported for every mapped country, without claiming those countries are high-income.',
    countryUniverse:countries ? 'Map countries plus explicitly provided classification countries, including countries without map polygons.' : 'Bundled map countries only; not a complete sovereign-country or World Bank economy universe.',
    countryCount:universe.length,
    months:months.map(month => {
      const availableByCountry = Object.fromEntries(universe.map(country => [country, {available:0, independentlyReviewed:0, catalogImported:0}]));
      const here = records.filter(record => monthOf(record.event) === month);
      for (const record of here){
        if (!record.country) continue;
        const entry = availableByCountry[record.country]; entry.available++;
        entry[record.reviewed ? 'independentlyReviewed' : 'catalogImported']++;
      }
      const unmetMinimums = universe.map(country => {
        const available = availableByCountry[country].available, classification = classifications.get(country);
        const required = classification && classification.highIncome === true ? 12 : 3;
        return {country, available, required, shortfall:Math.max(0, required - available), shortfallTo3:Math.max(0, 3 - available), shortfallTo12:Math.max(0, 12 - available), highIncome:classification ? classification.highIncome === true : null};
      }).filter(entry => entry.shortfall || entry.highIncome === null && entry.shortfallTo12);
      return {month, events:here.length, independentlyReviewed:here.filter(record => record.reviewed).length,
        mappedEvents:here.filter(record => record.country).length, unresolvedCountry:here.filter(record => !record.country).length,
        countriesWithEvents:universe.filter(country => availableByCountry[country].available > 0).length,
        countriesWithAtLeast3:universe.filter(country => availableByCountry[country].available >= 3).length,
        countriesWithAtLeast12:universe.filter(country => availableByCountry[country].available >= 12).length,
        availableByCountry, unmetMinimums};
    })
  };
}

function buildCatalog({inputs, pilot, geojson, photoKeys = [], videoKeys = [], countries = null, reviewedInputs = []}){
  if (pilot.from !== '2011-01' || pilot.through !== '2011-12') throw new Error('Pilot must explicitly cover the 2011 calendar year.');
  const countryFor = monthly.createCountryIndex(geojson), photos = new Set(photoKeys), videos = new Set(videoKeys);
  const exclusions = [], byId = new Map(), overrideIds = new Set(), overrideStories = new Map();
  const summary = {inputRows:inputs.reduce((n, input) => n + input.rows.length, 0), outsideYear:0, inYearInputRows:0,
    sourcePrecisionExcluded:0, otherEligibilityExcluded:0, reviewedRows:0, catalogImportedRows:0, duplicatesRemoved:0,
    reviewedDuplicatesSuppressed:0, knownConflictsQuarantined:0, sourceTypes:{}, statusCounts:{}};
  function reject(e, reason, extra = {}){ exclusions.push({id:e.stableId, title:e.title, date:e.date, sourceType:e.metadata.source && e.metadata.source.type || 'unknown', reason, ...extra}); }
  const reviewedRows = [{path:PILOT, rows:pilot.events}].concat(reviewedInputs).flatMap(input => input.rows.map(row => ({row, path:input.path})));
  for (const input of reviewedRows){
    const row = input.row;
    const copy = clone(row), e = eventModel.parseRow(copy, 0, time);
    if (!reviewed(e.metadata) || !monthly.eligible(e, time) || time.parts(e.t0).year !== YEAR) throw new Error('Invalid reviewed pilot row: ' + e.stableId);
    const existing = byId.get(e.stableId);
    if (existing && existing.event.mediaKey !== e.mediaKey) throw new Error('Reviewed override changes media identity: ' + e.stableId);
    overrideIds.add(e.stableId); overrideStories.set(storyDate(e), e.stableId);
    byId.set(e.stableId, {row:copy, event:e, reviewed:true, sourceFiles:Array.from(new Set((existing ? existing.sourceFiles : []).concat(input.path)))});
  }
  for (const input of inputs){
    for (const row of input.rows){
      const e = eventModel.parseRow(row, 0, time);
      if (time.parts(e.t0).year !== YEAR){ summary.outsideYear++; continue; }
      summary.inYearInputRows++;
      if (overrideIds.has(e.stableId)){
        const replacement = byId.get(e.stableId);
        if (!replacement.sourceFiles.includes(input.path)) replacement.sourceFiles.push(input.path);
        summary.reviewedDuplicatesSuppressed++; continue;
      }
      const known = CONFLICTS[e.stableId];
      if (known){
        reject(e, 'known-source-conflict', {note:known.reason, ...(known.replacement ? {supersededBy:known.replacement} : {})});
        summary.knownConflictsQuarantined++; continue;
      }
      const replacement = overrideStories.get(storyDate(e));
      if (replacement){ reject(e, 'reviewed-occurrence-replacement', {supersededBy:replacement}); summary.reviewedDuplicatesSuppressed++; continue; }
      if (!monthly.eligible(e, time)){
        const reason = exclusionReason(e); reject(e, reason);
        if (reason === 'source-precision-warning' || reason === 'unknown-or-invalid-month') summary.sourcePrecisionExcluded++; else summary.otherEligibilityExcluded++;
        continue;
      }
      if (byId.has(e.stableId)){
        const existing = byId.get(e.stableId);
        if (!existing.sourceFiles.includes(input.path)) existing.sourceFiles.push(input.path);
        summary.duplicatesRemoved++; continue;
      }
      const copy = clone(row);
      byId.set(e.stableId, {row:copy, event:eventModel.parseRow(copy, 0, time), reviewed:false, sourceFiles:[input.path]});
    }
  }
  const records = Array.from(byId.values()).sort((a, b) => Number(b.reviewed) - Number(a.reviewed)
    || Number(videos.has(b.event.mediaKey) || photos.has(b.event.mediaKey)) - Number(videos.has(a.event.mediaKey) || photos.has(a.event.mediaKey))
    || b.event.w - a.event.w || a.event.stableId.localeCompare(b.event.stableId, 'en'));
  const occurrences = new Map(), retained = [];
  for (const record of records){
    const key = occurrence(record.event), existing = occurrences.get(key);
    if (existing){
      existing.sourceFiles = Array.from(new Set(existing.sourceFiles.concat(record.sourceFiles))).sort();
      if (existing.row[14].monthlyCatalog) existing.row[14].monthlyCatalog.sourceFiles = existing.sourceFiles;
      reject(record.event, 'duplicate-article-date-coordinate', {supersededBy:existing.event.stableId}); summary.duplicatesRemoved++; continue;
    }
    occurrences.set(key, record); retained.push(record);
    const e = record.event, status = record.reviewed ? 'independently-reviewed' : 'catalog-import';
    record.country = record.reviewed && e.metadata.monthCountry || countryFor(e.lat, e.lon);
    record.row[14].monthlyCatalog = {status, independentlyReviewed:record.reviewed, sourceFiles:record.sourceFiles.sort(),
      country:record.country || null, countryMethod:record.reviewed && e.metadata.monthCountry ? 'source-backed-event-location' : record.country ? 'present-day-polygon-inference' : 'unresolved',
      hasEventPhoto:photos.has(e.mediaKey), hasEventVideo:videos.has(e.mediaKey),
      note:record.reviewed ? 'Date, headline and named place reviewed; see monthlyReview for coordinate and media limitations.' : 'Imported catalog record with usable date precision; headline, date and event location have not been independently fact-checked.'};
    count(summary.sourceTypes, e.metadata.source && e.metadata.source.type || 'unknown'); count(summary.statusCounts, status);
    summary[record.reviewed ? 'reviewedRows' : 'catalogImportedRows']++;
  }
  retained.sort((a, b) => a.event.t0 - b.event.t0 || a.event.stableId.localeCompare(b.event.stableId, 'en'));
  summary.events = retained.length; summary.mappedEvents = retained.filter(record => record.country).length;
  summary.unresolvedCountry = summary.events - summary.mappedEvents;
  summary.sourceTypes = sorted(summary.sourceTypes); summary.statusCounts = sorted(summary.statusCounts);
  return {version:1, from:pilot.from, through:pilot.through, updatedAt:pilot.updatedAt,
    policy:'Expanded 2011 catalog, not a live feed or fact-checked world history. Imported date/Earth-eligible records are explicitly distinguished from independently reviewed overrides. Minimum targets are 3 events per country/month and 12 per high-income country/month, never caps. Existing source gaps remain visible; no filler, invented dates, nearest-country allocation, or claims that these minimums are met.',
    summary, coverage:makeCoverage(retained, geojson, countries), exclusions:exclusions.sort((a, b) => a.id.localeCompare(b.id, 'en')),
    events:retained.map(record => record.row)};
}

function readSource(relative){
  const content = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  return {path:relative, data:JSON.parse(content), sha256:crypto.createHash('sha256').update(content).digest('hex')};
}
function main(args = process.argv.slice(2)){
  const check = args.includes('--check');
  const unexpected = args.filter(arg => arg !== '--check');
  if (unexpected.length) throw new Error('Usage: node scripts/build_monthly_catalog.cjs [--check]');
  const inputs = SOURCES.map(readSource), pilot = readSource(PILOT), geo = readSource('site/assets/countries-110m.json');
  const supplements = OPTIONAL_REVIEWED.filter(file => fs.existsSync(path.join(ROOT, file))).map(readSource);
  const photos = readSource('site/data/event-photos.json'), media = readSource('site/data/event-media.json');
  const result = buildCatalog({inputs:inputs.map(input => ({path:input.path, rows:input.data})), pilot:pilot.data, geojson:geo.data,
    photoKeys:photos.data.events.map(entry => entry.key), videoKeys:Object.entries(media.data).filter(([, entry]) => entry.kind === 'video').map(([key]) => key),
    reviewedInputs:supplements.map(input => ({path:input.path, rows:input.data.events}))});
  result.sources = inputs.concat(pilot, supplements, geo, photos, media).map(source => ({path:source.path, sha256:source.sha256}));
  const generated = JSON.stringify(result, null, 2) + '\n', target = path.join(ROOT, OUTPUT);
  if (check){
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== generated) throw new Error(OUTPUT + ' is stale; run node scripts/build_monthly_catalog.cjs');
  } else fs.writeFileSync(target, generated);
  console.log(JSON.stringify({output:OUTPUT, check, summary:result.summary, months:result.coverage.months.map(({month, events, independentlyReviewed, mappedEvents, unresolvedCountry, countriesWithEvents, countriesWithAtLeast3, countriesWithAtLeast12}) => ({month, events, independentlyReviewed, mappedEvents, unresolvedCountry, countriesWithEvents, countriesWithAtLeast3, countriesWithAtLeast12}))}, null, 2));
  return result;
}

if (require.main === module) main();
module.exports = {buildCatalog, makeCoverage, main};
