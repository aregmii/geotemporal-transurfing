window.__gtStart = function(){
"use strict";

var EARTH_SRC = window.__GT.earth || "assets/earth.jpg";
var IMG_DIR = window.__GT.imgDir != null ? window.__GT.imgDir : "img/";
var BORDERS = window.__GT.borders;
var RAW = window.__GT.events;
var MONTHLY = window.GTMonthly;
var MONTHLY_POLICY = window.__GT.coveragePolicy || {countries:[]};
var countryFor = MONTHLY ? MONTHLY.createCountryIndex(BORDERS) : null;
var monthSelection = {events:[], countries:0, eligibleCount:0, omittedCount:0};
var monthElapsed = 0, secondsPerMonth = 10, monthLoading = false;
function mediaCutoff(){ return MONTHLY ? window.GTTime.nextMonth(nowT) : nowT; }
var IMAGES = window.__GT.images;
var MEDIA = window.__GT.media || {};
var PHOTO_INDEX = window.GTEventPhotos.createIndex(window.__GT.eventPhotos || {events:[]});
function photoFor(e, panel){
  var photos = window.GTEventPhotos.photosFor(e, PHOTO_INDEX);
  for (var i = 0; i < photos.length; i++){
    var p = photos[i];
    if (panel) return p;
    if (p.photoRole === 'context') continue;
    var date = p.photoDate && p.photoDate.length === 10 ? window.GTTime.parseISO(p.photoDate) : NaN;
    if (Number.isFinite(date) && (window.GTMonthly ? date < mediaCutoff() : date <= nowT)) return p;
  }
  return null;
}
function mediaFor(e, panel){
  var m = MEDIA[e.stableId] || MEDIA[e.mediaKey];
  if (!m) return null;
  if (panel) return m;
  var t = window.GTTime.parseISO(m.mediaDate);
  return m.autoplayApproved && m.mediaRole === 'contemporaneous' && Number.isFinite(t) && (window.GTMonthly ? t < mediaCutoff() : t <= nowT) ? m : null;
}

function visualFor(e){
  var photo = photoFor(e), media = mediaFor(e);
  return photo || (media && media.kind === 'video' ? media : null);
}
function clipIdentity(e, media){
  return JSON.stringify([e.stableId || e.mediaKey, media.kind, media.file]);
}
function cardMediaStamp(e){
  var photo = photoFor(e), media = mediaFor(e);
  return JSON.stringify([photo ? photo.file : null, media ? clipIdentity(e, media) : null]);
}
function cardTextureKey(e){ return (e.stableId || e.mediaKey || e.cat) + ':' + cardMediaStamp(e); }

var LINKS = window.__GT.links || [];              // [[slugA, relation, slugB], ...] from Wikidata cause/effect properties          // slug -> { file, kind, author, license, licenseUrl, filePage, seconds }
var MEDIA_DIR = window.__GT.mediaDir != null ? window.__GT.mediaDir : "media/";
var DEG = Math.PI / 180;

var CATS = {
  con:{label:'Conflict',        v:'--con'},
  cul:{label:'Culture & belief', v:'--cul'},
  sci:{label:'Science & discovery', v:'--sci'},
  dis:{label:'Disasters',       v:'--dis'}
};

var TIME = window.GTTime, EVENT_MODEL = window.GTEvents;
var temporalView = MONTHLY ? 'month' : 'period', periodDays = 365 * 5, densityLevel = 1;
function presentTime(){ return TIME.now(); }
function parseRow(r, i){ return EVENT_MODEL.parseRow(r, i, TIME); }
function fracOfDate(iso){ return TIME.parseISO(iso); }
var STEP = 1 / 12, BACKGROUND = 0.42;
function viewBounds(t, w){
  if (MONTHLY) return {start:TIME.monthStart(t),end:TIME.nextMonth(t),overview:true};
  var era = ERAS[w.era];
  if (!era.slider) return { start:w.start, end:Math.min(w.end, presentTime()), overview:true };
  return temporalView === 'moment'
    ? { start:t, end:t, overview:false }
    : { start:TIME.addDays(t, -periodDays), end:t, overview:true };
}
function eligibleEvent(e){ return e.t0 <= presentTime() && (!MONTHLY || MONTHLY.eligible(e,TIME)); }
function inView(e, t, w){
  if (!eligibleEvent(e)) return false;
  var b = viewBounds(t, w);
  if (MONTHLY) return e.t0 >= b.start && e.t0 < b.end;
  return b.overview ? e.t0 <= b.end && e.t1 > b.start : EVENT_MODEL.contains(e, t);
}
function prominence(e, now){
  if (!inView(e, now, WINDOWS[wi])) return 0;
  if (MONTHLY) return 1;
  if (temporalView === 'moment') return 1;
  return e.temporalKind === 'interval' && now > TIME.addDays(e.t0, 30) ? 0.62 : 1;
}
function inMonth(e, w){
  if (MONTHLY) return inView(e,w.end,w);
  var end = Math.min(TIME.nextMonth(w.end), presentTime());
  var begin = temporalView === 'period' ? TIME.addDays(w.end, -periodDays) : w.end;
  return eligibleEvent(e) && e.t0 <= end && e.t1 > begin;
}
function inWindow(e, w){
  return ERAS[w.era].slider ? inMonth(e, w) : eligibleEvent(e) && e.t0 <= Math.min(w.end, presentTime()) && e.t1 > w.start;
}
function fracYear(y){ return TIME.monthStart(y); }

var EVENTS = RAW.map(parseRow);
// Large builds keep only the top events per year in events.json and the rest in data/y/<year>.json shards,
// listed in data/index.json; a window loads the shards it touches on demand (not in the playground build).
var SHARDS = window.__GT.shards || null;   // { years:[...], dir:'data/y/' }
var loadedYears = {};

// Two rails. "century" = calendar decades with 5-year windows; "all" = eleven eras from the first stone tools.
var ERA_SETS = {
  // a slider: the window is `width` years wide and moves one year at a time across from..to
  recent:  [ {name:'', label:'', from:2000, to:presentTime(), step:1/12, width:1/12, slider:true, tick:5} ],   // one month at a time, from the first month
  century: [ {name:'', label:'', from:Math.floor(presentTime()) - 100, to:presentTime(), step:1/12, width:1/12, slider:true, tick:10} ],
  all: [
    {name:'ORIGINS',        label:'4–0.3 Mya',        from:-4000000, to:-320000, step:1000000},
    {name:'HOMO SAPIENS',   label:'320–12 kya',       from:-320000,  to:-10000,  step:100000},
    {name:'NEOLITHIC',      label:'10,000–3000 BCE',  from:-10000,   to:-3000,   step:1000},
    {name:'ANCIENT',        label:'3000–500 BCE',     from:-3000,    to:-500,    step:500},
    {name:'CLASSICAL',      label:'500 BCE–500 CE',   from:-500,     to:500,     step:250},
    {name:'POST-CLASSICAL', label:'500–1300',         from:500,      to:1300,    step:200},
    {name:'RENAISSANCE',    label:'1300–1600',        from:1300,     to:1600,    step:100},
    {name:'EARLY MODERN',   label:'1600–1800',        from:1600,     to:1800,    step:50},
    {name:'INDUSTRIAL',     label:'1800–1900',        from:1800,     to:1900,    step:25},
    {name:'MODERN',         label:'1900–1990',        from:1900,     to:1990,    step:15},
    {name:'CONTEMPORARY',   label:'1990–present',     from:1990,     to:presentTime(),    step:12}
  ]
};
if (MONTHLY) ERA_SETS = {recent:[{name:'2011 pilot',label:'2011',from:2011,to:TIME.fromParts(2011,12,1),step:1/12,width:1/12,slider:true,tick:1}]};
var navigationGeneration = 0;
var mode = 'recent';
var ERAS = ERA_SETS[mode];
var WINDOWS = [];
function buildWindows(){
  if (mode === 'century') ERAS[0].from = Math.floor(presentTime()) - 100;
  WINDOWS = [];
  ERAS.forEach(function(era, ei){
    if (!MONTHLY && ei === ERAS.length - 1) era.to = presentTime();
    era.first = WINDOWS.length;
    if (era.slider){
      for (var at = TIME.monthStart(era.from); at <= era.to; at = TIME.nextMonth(at))
        WINDOWS.push({ start:TIME.nextMonth(at, -1), end:at, era:ei });
    } else {
      for (var a = era.from; a < era.to; a += era.step) WINDOWS.push({ start:a, end:Math.min(a + era.step, era.to), era:ei });
    }
    era.count = WINDOWS.length - era.first;
  });
}

buildWindows();

function ago(y){
  var n = -y + 2000;
  if (n >= 1000000) return (Math.round(n / 100000) / 10) + ' million years ago';
  if (n >= 100000)  return Math.round(n / 10000) * 10 + ',000 years ago';
  return Math.round(n / 1000) + ',000 years ago';
}
var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function dayLabel(iso){
  // "1969-07-16" -> "16 Jul 1969"; BCE dates keep the year label logic
  var m = iso.match(/^(-?\d+)-(\d{2})-(\d{2})$/); if (!m) return iso;
  var y = parseInt(m[1], 10); if (y <= 0) y = y - 1;   // Wikidata astronomical year -> historical, matching row years
  return parseInt(m[3], 10) + ' ' + MONTHS[parseInt(m[2], 10) - 1] + ' ' + yearLabel(y);
}
function dayNumber(iso){ var t = TIME.parseISO(iso); return Number.isFinite(t) ? Math.round(TIME.toDay(t)) : null; }

function whenLabel(e){
  if (e.date && e.datePrecision === 'day') return dayLabel(e.date);
  if (e.date && e.datePrecision === 'month') return monthLabel(e.t0) + ' · month known';
  return e.start === e.end ? yearLabel(e.start) : rangeLabel(e.start, e.end);
}
function yearLabel(y){
  if (y < -10000) return ago(y);
  if (y < 0) return Math.abs(y).toLocaleString() + ' BCE';
  return String(y);
}
function rangeLabel(a, b){
  if (b < -10000){
    var A = ago(a).replace(' years ago',''), B = ago(b).replace(' years ago','');
    var unitA = A.indexOf('million') >= 0 ? ' million' : '';
    var unitB = B.indexOf('million') >= 0 ? ' million' : '';
    if (unitA === unitB) return A.replace(' million','') + '–' + B + ' years ago';
    return A + ' – ' + B + ' years ago';
  }
  if (a < -10000) return ago(a) + ' – ' + yearLabel(b);
  if (a < 0 && b <= 0) return Math.abs(a).toLocaleString() + '–' + Math.abs(b).toLocaleString() + ' BCE';
  if (a < 0 && b > 0)  return Math.abs(a) + ' BCE – ' + b + ' CE';
  if (a !== Math.floor(a) || b !== Math.floor(b)) return monthLabel(a) + ' – ' + monthLabel(b);
  return a + '–' + b;
}
var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function monthLabel(y){ var p = TIME.parts(y); return MONTHS[p.month - 1] + ' ' + (p.year <= 0 ? (1 - p.year) + ' BCE' : p.year); }

// ---------- icons ----------
function css(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function drawGlyph(ctx, cat, s){
  // s = box size; glyph drawn in a 64-unit coordinate space
  var k = s / 64;
  ctx.save(); ctx.scale(k, k);
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff';
  ctx.lineWidth = 5.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (cat === 'con'){
    ctx.beginPath(); ctx.moveTo(17,47); ctx.lineTo(47,17); ctx.moveTo(17,17); ctx.lineTo(47,47); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(15,38); ctx.lineTo(26,49); ctx.moveTo(49,38); ctx.lineTo(38,49); ctx.stroke();
  } else if (cat === 'cul'){
    ctx.beginPath(); ctx.moveTo(11,27); ctx.lineTo(32,12); ctx.lineTo(53,27); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14,52); ctx.lineTo(50,52); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(20,31); ctx.lineTo(20,48); ctx.moveTo(32,31); ctx.lineTo(32,48); ctx.moveTo(44,31); ctx.lineTo(44,48);
    ctx.stroke();
  } else if (cat === 'sci'){
    ctx.lineWidth = 4;
    for (var i = 0; i < 3; i++){
      ctx.beginPath(); ctx.ellipse(32,32,21,8.5,i*Math.PI/3,0,2*Math.PI); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(32,32,4.2,0,2*Math.PI); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(32,12); ctx.lineTo(54,50); ctx.lineTo(10,50); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(32,26); ctx.lineTo(32,37); ctx.stroke();
    ctx.beginPath(); ctx.arc(32,44.5,3,0,2*Math.PI); ctx.fill();
  }
  ctx.restore();
}
function iconCanvas(cat, px, ring){
  var c = document.createElement('canvas'); c.width = px; c.height = px;
  var ctx = c.getContext('2d'), r = px / 2;
  ctx.beginPath(); ctx.arc(r, r, r - 2, 0, 2*Math.PI);
  ctx.fillStyle = css(CATS[cat].v); ctx.fill();
  if (ring){ ctx.lineWidth = px * 0.06; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.stroke(); }
  ctx.translate(px * 0.16, px * 0.16);
  drawGlyph(ctx, cat, px * 0.68);
  return c;
}
function ringCanvas(px, dashed){
  var c = document.createElement('canvas'); c.width = px; c.height = px;
  var ctx = c.getContext('2d'), r = px / 2;
  ctx.beginPath(); ctx.arc(r, r, r - 4, 0, 2*Math.PI);
  ctx.lineWidth = dashed ? 3 : 4; ctx.strokeStyle = '#fff';
  if (dashed) ctx.setLineDash([7, 6]);
  ctx.stroke();
  return c;
}
var ICON_URL = {};
Object.keys(CATS).forEach(function(k){ ICON_URL[k] = iconCanvas(k, 64, false).toDataURL(); });

// ---------- state ----------
// opening window: 2020–2025 (a slider window is keyed by its start year)
var wi = WINDOWS.findIndex(function(w){ return w.start === 2020; });
var nowT = 0;                                          // the moment on the globe, a fractional year; set with the window
if (wi < 0) wi = WINDOWS.findIndex(function(w){ return w.start <= 2022 && w.end >= 2022; });
if (wi < 0) wi = WINDOWS.length - 1;
var selected = null, hovered = null, hoveredSky = null, idle = true, idleTimer = null;
// The clock every animation reads. Normally the browser's; a recorder can freeze it and step it by hand
// (window.__cgtFrame), so a film of the app is smooth however slowly the frames were rendered.
var VIRTUAL_MS = null;
function clockNow(){ return VIRTUAL_MS != null ? VIRTUAL_MS : performance.now(); }
var ANIMS = [];                                        // running tweens: functions of the clock, true when done
function runAnims(){
  var t = clockNow();
  ANIMS.slice().reverse().forEach(function(animation){
    if (ANIMS.indexOf(animation) < 0) return;
    if (animation(t)){ var index=ANIMS.indexOf(animation); if(index>=0)ANIMS.splice(index,1); }
  });
}
function agoText(ly){ return ly >= 1000000 ? (ly / 1000000).toFixed(1) + ' MILLION YEARS AGO' : ly >= 2 ? Math.round(ly).toLocaleString() + ' YEARS AGO' : 'ABOUT A YEAR AGO'; }
var off = { con:false, cul:false, sci:false, dis:false };
var camDist = 3.9;
var observerMode = 'orbit', orbitQuat = new THREE.Quaternion();
var observerKeys = {}, observerTickLast = null;
var observerStatusLast = '', observerRevision=0, observerSignature='', observerBoundRevision=-1, observerLastBind=-Infinity;
var MAX_OBSERVER_R = MONTHLY ? 6 : 140;

// ---------- three ----------
var wrap = document.getElementById('globewrap');
var canvas = document.getElementById('c');
var renderer = new THREE.WebGLRenderer({ canvas:canvas, antialias:true, alpha:false, preserveDrawingBuffer:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x05070d, 1);
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 3000);
camera.position.set(0, 0, camDist);
function syncObserver(){
  if (observerMode === 'orbit'){
    camera.quaternion.copy(orbitQuat).invert();
    camera.position.set(0,0,camDist).applyQuaternion(camera.quaternion);
  } else camDist = camera.position.length();
  camera.updateMatrixWorld(true);
  var signature=camera.position.toArray().concat(camera.quaternion.toArray()).map(function(v){return v.toFixed(6);}).join(',');
  if(signature!==observerSignature){observerSignature=signature;observerRevision++;}
}
function earthOccludes(point){ return GTObserver.earthOccludes(camera.position, point); }
function visibleNormal(e){ return GTObserver.surfaceFacing(e.normal, camera.position); }
function projectEarthPoint(point){ return point.clone().project(camera); }
function cameraRay(mx,my){
  var point = new THREE.Vector3(mx / W * 2 - 1, 1 - my / H * 2, 0.5).unproject(camera);
  return new THREE.Ray(camera.position.clone(), point.sub(camera.position).normalize());
}
function eventOnScreen(e){
  var p = projectEarthPoint(e.normal.clone().multiplyScalar(1.002 + HOVER));
  return p.z >= -1 && p.z <= 1 && Math.abs(p.x) < 1.08 && Math.abs(p.y) < 1.08;
}
function setObserverDistance(distance){
  distance = Math.max(minCamDist, Math.min(MAX_OBSERVER_R, distance));
  if (observerMode === 'free') camera.position.setLength(distance);
  camDist = distance; syncObserver();
}
function setObserverMode(mode){
  ANIMS.length = 0; velX = velY = 0; syncObserver();
  if (mode === 'orbit' && observerMode === 'free'){
    camera.lookAt(0,0,0); orbitQuat.copy(camera.quaternion).invert();
  }
  observerMode = mode; syncObserver();
  var b = document.getElementById('freeViewBtn');
  if (b){ b.setAttribute('aria-pressed', mode === 'free' ? 'true':'false'); b.textContent = mode === 'free' ? 'FREE MOVEMENT' : 'EXPLORE XYZ'; }
  var controls = document.getElementById('observerMove'); if(controls) controls.hidden = mode !== 'free';
  var hint=document.getElementById('observerHint'); if(hint) hint.hidden = mode !== 'free';
  render();
}
function returnToEarth(){
  setObserverMode('orbit'); orbitQuat.copy(targetQuat(22,18)); camDist=3.9;
  syncObserver(); bindNow(true); render();
}
function translateObserver(dx,dy,dz){
  if(observerMode !== 'free') setObserverMode('free');
  ANIMS.length=0; velX=velY=0;
  var next=camera.position.clone().add(new THREE.Vector3(dx,dy,dz));
  if(next.length()<minCamDist) next.setLength(minCamDist);
  if(next.length()>MAX_OBSERVER_R) next.setLength(MAX_OBSERVER_R);
  camera.position.copy(next); syncObserver(); bindNow(true); render();
}
function tickObserver(seconds){
  if(observerMode !== 'free') return;
  var move=new THREE.Vector3((observerKeys.KeyD?1:0)-(observerKeys.KeyA?1:0),(observerKeys.KeyE?1:0)-(observerKeys.KeyQ?1:0),(observerKeys.KeyS?1:0)-(observerKeys.KeyW?1:0));
  if(move.lengthSq()){
    move.normalize().multiplyScalar(Math.max(0.15,(camDist-1)*0.5)*seconds).applyQuaternion(camera.quaternion);
    translateObserver(move.x,move.y,move.z);
  }
}

scene.add(new THREE.AmbientLight(0xffffff, 0.62));
var sunLight = new THREE.DirectionalLight(0xfff4e0, 0.9);
sunLight.position.set(1.5, 1.0, 2.5);
scene.add(sunLight);

var globe = new THREE.Group();
scene.add(globe);

// How close you may get is decided by the Earth texture, not by taste: past the point where one texel covers
// more than a couple of screen pixels the ground turns to mush and the illusion goes with it. 2048x1024 is
// 20 km per texel and runs out at about 1.6 radii; run pipeline/fetch_earth.py to drop in NASA's 5400x2700
// Blue Marble and this opens up on its own, no code change.
var minCamDist = 1.6;
var tex = new THREE.TextureLoader().load(EARTH_SRC, function(t){
  var w = t.image && t.image.width;
  if (w) minCamDist = Math.max(1.08, Math.min(1.9, 1.08 + 0.52 * (2048 / w)));
  render();
});
tex.anisotropy = 4;
var earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshLambertMaterial({ map:tex }));
globe.add(earth);

// atmosphere
var atmo = new THREE.Mesh(new THREE.SphereGeometry(1.035, 64, 48),
  new THREE.MeshBasicMaterial({ color:0x5aa4ff, transparent:true, opacity:0.10, side:THREE.BackSide }));
scene.add(atmo);
var atmo2 = new THREE.Mesh(new THREE.SphereGeometry(1.075, 64, 48),
  new THREE.MeshBasicMaterial({ color:0x3a7fe0, transparent:true, opacity:0.05, side:THREE.BackSide }));
scene.add(atmo2);

function toVec(lat, lon, r){
  var theta = (90 - lat) * DEG, phi = (lon + 180) * DEG;
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
}

// ---------- catalog sky and geometric Solar System ----------
// World axes are Earth-fixed. EQJ catalog directions are precessed/nutated to EQD,
// then rotated by apparent sidereal time. Only directions are translated to the observer.
var SKY_R = 900, AU_IN_EARTH_RADII = GTObserver.AU_KM / GTObserver.EARTH_KM;
var sky = new THREE.Group(); scene.add(sky);
var bodiesGroup = new THREE.Group(); scene.add(bodiesGroup);
var skyDate = null, skyAvailable = false, skyLabelSprites = [];
var skyCatalogPoints = null, skyCatalogPositions = [];
var bodyPositions = {}, BODY_RADII_KM = {Sun:695700,Moon:1737.4,Mercury:2439.7,Venus:6051.8,Mars:3389.5,Jupiter:69911,Saturn:58232};
function skyLonLat(raDeg, decDeg, gmstDeg){ return [decDeg, ((raDeg - gmstDeg + 540) % 360) - 180]; }
function makeTextSprite(text, size, dim){
  // screen-constant label: sizeAttenuation off, scale is a fraction of the viewport height
  var c = document.createElement('canvas'); c.width = 512; c.height = 64;
  var ctx = c.getContext('2d'); ctx.font = '500 30px "IBM Plex Mono", monospace'; ctx.fillStyle = dim ? 'rgba(180,196,224,.55)' : 'rgba(232,236,244,.9)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 32);
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(c), transparent:true, depthTest:false, sizeAttenuation:false }));
  sp.scale.set(size * 12, size, 1); sp.center.set(0.5, 1.7); sp.renderOrder = 20; return sp;
}
var SKYLABELS = window.__GT.skyLabels || { stars:[], constellations:[] };

var skySphere, moonMesh, sunSprite, planetSprites = {};
function buildSkyStatic(){
  var catalog = window.__GT.starCatalog;
  var stars = catalog && catalog.features ? catalog.features.map(function(f){ return [f.geometry.coordinates[0],f.geometry.coordinates[1],f.properties.mag]; }) : SKYLABELS.stars.map(function(st){ return [st[1],st[2],st[3]]; });
  var positions=[], colors=[];
  stars.forEach(function(st){
    var ra=st[0]*DEG,dec=st[1]*DEG;
    skyCatalogPositions.push({x:Math.cos(dec)*Math.cos(ra),y:Math.cos(dec)*Math.sin(ra),z:Math.sin(dec)});
    positions.push(0,0,0);
    var brightness=Math.max(0.13,Math.min(1,Math.pow(10,-0.15*(st[2]+1))));
    colors.push(brightness,brightness,brightness);
  });
  var geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  skyCatalogPoints=new THREE.Points(geo,new THREE.PointsMaterial({size:2,sizeAttenuation:false,vertexColors:true,depthWrite:false}));
  skyCatalogPoints.frustumCulled=false; skyCatalogPoints.renderOrder=-10; sky.add(skyCatalogPoints);

  // the Moon: a lit sphere at its true distance and size, so its phase and apparent size are right
  moonMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2727, 32, 24), new THREE.MeshLambertMaterial({ color:0xd9d9d2 }));
  bodiesGroup.add(moonMesh);

  // the Sun: a bright sprite far out, plus the directional light comes from it
  var sc = document.createElement('canvas'); sc.width = sc.height = 256; var sctx = sc.getContext('2d');
  var grad = sctx.createRadialGradient(128, 128, 0, 128, 128, 128); grad.addColorStop(0, 'rgba(255,255,250,1)'); grad.addColorStop(0.38, 'rgba(255,253,240,1)'); grad.addColorStop(0.40, 'rgba(255,240,205,.55)'); grad.addColorStop(0.7, 'rgba(255,225,170,.12)'); grad.addColorStop(1, 'rgba(255,220,150,0)');
  sctx.fillStyle = grad; sctx.fillRect(0, 0, 256, 256);
  sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(sc), transparent:true, depthTest:true, depthWrite:false }));
  sunSprite.scale.set(700 * 0.0093 * 2.6, 700 * 0.0093 * 2.6, 1); bodiesGroup.add(sunSprite);   // disc is 0.53° wide; the glare around it about 2.6× that

  // planets visible to the eye: small warm points with labels
  ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].forEach(function(name){
    var pc = document.createElement('canvas'); pc.width = pc.height = 32; var pctx = pc.getContext('2d');
    pctx.beginPath(); pctx.arc(16, 16, 6, 0, 2 * Math.PI); pctx.fillStyle = name === 'Mars' ? '#ffb28a' : '#fff4d6'; pctx.fill();
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(pc), transparent:true, depthTest:true, sizeAttenuation:false }));
    sp.scale.set(0.003, 0.003, 1); bodiesGroup.add(sp);
    planetSprites[name] = sp;
  });
  // sky label candidates — the picker below shows the dozen most important ones on screen each frame
  SKYLABELS.stars.forEach(function(st){
    var ll = skyLonLat(st[1], st[2], 0);
    var text = st[0].toUpperCase() + ' · STAR' + (st[4] ? ' · ' + fmtLy(st[4]) : '');
    LABEL_CANDIDATES.push({ text:text, eqj:equatorialVector(ll[1], ll[0]), pos:new THREE.Vector3(), prio: 6 - st[3], name:st[0], kind:'star', ly:st[4] });
  });
  (SKYLABELS.dsos || []).forEach(function(d){
    var ll = skyLonLat(d[1], d[2], 0);
    var text = d[0].toUpperCase() + ' · ' + String(d[4]).toUpperCase() + (d[5] ? ' · ' + fmtLy(d[5]) : '');
    LABEL_CANDIDATES.push({ text:text, eqj:equatorialVector(ll[1], ll[0]), pos:new THREE.Vector3(), prio: 5.5 - (d[3] || 5), name:d[0], kind:String(d[4]), ly:d[5] });
  });
  SKYLABELS.constellations.forEach(function(cn){
    var ll = skyLonLat(cn[1], cn[2], 0);
    LABEL_CANDIDATES.push({ text:cn[0].toUpperCase(), eqj:equatorialVector(ll[1], ll[0]), pos:new THREE.Vector3(), prio: cn[3] === 1 ? 2.5 : cn[3] === 2 ? 1.5 : 0.5, dim:true, name:cn[0], kind:'constellation' });
  });
  for (var li = 0; li < LABEL_POOL_SIZE; li++){
    var lb = makeTextSprite('', 0.026); lb.visible = false; sky.add(lb); LABEL_POOL.push(lb);
  }
}
function equatorialVector(ra,dec){ return {x:Math.cos(dec*DEG)*Math.cos(ra*DEG),y:Math.cos(dec*DEG)*Math.sin(ra*DEG),z:Math.sin(dec*DEG)}; }
var LABEL_CANDIDATES = [], LABEL_POOL = [], LABEL_POOL_SIZE = 14, LABEL_TEX = {};
var SKY_ON_SCREEN = [];                          // the labels drawn this frame, with screen positions, for hover
var SKYFACTS = window.__GT.skyFacts || {};
function skyLabelAt(mx, my){
  // the label text sits just under its point (centre.y = 1.7 of a 0.026-high sprite): a band about 22 px high
  for (var i = 0; i < SKY_ON_SCREEN.length; i++){
    var c = SKY_ON_SCREEN[i];
    if (Math.abs(mx - c._sx) < 90 && my > c._sy - 6 && my < c._sy + 30) return c;
  }
  return null;
}
function fmtLy(ly){ return ly >= 1000000 ? (ly / 1000000).toFixed(1) + ' M LY' : ly >= 1000 ? Math.round(ly / 100) / 10 + ' K LY' : ly + ' LY'; }
function labelTexture(text, dim){
  var key = (dim ? 'd:' : 'b:') + text;
  if (LABEL_TEX[key]) return LABEL_TEX[key];
  var c = document.createElement('canvas'); c.width = 768; c.height = 64;
  var ctx = c.getContext('2d'); ctx.font = '500 28px "IBM Plex Mono", monospace'; ctx.fillStyle = dim ? 'rgba(180,196,224,.6)' : 'rgba(236,240,248,.92)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 384, 32);
  var tex = new THREE.CanvasTexture(c); LABEL_TEX[key] = tex; return tex;
}
var _lw = new THREE.Vector3();
function skyLabelClear(sx,sy){
  // Keep the complete label band clear of the Earth even when it is off-center.
  var xs=[sx-110,sx,sx+110],ys=[sy+8,sy+27];
  for(var x=0;x<xs.length;x++) for(var y=0;y<ys.length;y++){
    var ray=cameraRay(xs[x],ys[y]);
    if(earthOccludes(ray.at(SKY_R,new THREE.Vector3()))) return false;
  }
  return true;
}
function pickSkyLabels(){
  SKY_ON_SCREEN=[];
  if (!skyAvailable){ LABEL_POOL.forEach(function(lb){lb.visible=false;}); return; }
  var chosen=[];
  var bodies=[{obj:moonMesh,text:'MOON',prio:99,name:'Moon',kind:'moon'}, {obj:sunSprite,text:'SUN',prio:98,name:'Sun',kind:'star'}];
  Object.keys(planetSprites).forEach(function(n){bodies.push({obj:planetSprites[n],text:n.toUpperCase(),prio:90,name:n,kind:'planet'});});
  var all=bodies.filter(function(b){return b.obj.visible;}).map(function(b){
    return {text:b.text+' · '+Math.round(bodyPositions[b.name].distanceTo(camera.position)*6371).toLocaleString()+' KM',pos:b.obj.position.clone().sub(camera.position),prio:b.prio,name:b.name,kind:b.kind};
  }).concat(LABEL_CANDIDATES);
  for(var i=0;i<all.length;i++){
    var c=all[i];
    _lw.copy(c.pos).add(camera.position);
    if(earthOccludes(_lw)) continue;
    _lw.project(camera);
    if(_lw.z < -1 || _lw.z > 1) continue;
    var sx=(_lw.x+1)/2*W,sy=(1-_lw.y)/2*H;
    if(sx<30 || sx>W-30 || sy<30 || sy>H-30 || !skyLabelClear(sx,sy)) continue;
    c._sx=sx;c._sy=sy;chosen.push(c);
  }
  chosen.sort(function(a, b){ return b.prio - a.prio; });
  var used = [];
  var n = 0;
  for (var k = 0; k < chosen.length && n < LABEL_POOL_SIZE; k++){
    var c2 = chosen[k], ok = true;
    for (var u = 0; u < used.length; u++){ if (Math.abs(used[u].x - c2._sx) < 150 && Math.abs(used[u].y - c2._sy) < 22){ ok = false; break; } }
    if (!ok) continue;
    used.push({ x:c2._sx, y:c2._sy });
    SKY_ON_SCREEN.push(c2);
    var lb = LABEL_POOL[n++];
    lb.material.map = labelTexture(c2.text, !!c2.dim); lb.material.needsUpdate = true;
    lb.scale.set(0.026 * 12, 0.026, 1);
    lb.position.copy(c2.pos); lb.visible = true;
  }
  for (; n < LABEL_POOL_SIZE; n++) LABEL_POOL[n].visible = false;
}

// The observer remains independent of camera orientation in an Earth-fixed frame.
var skyDateText = '', viewpointLast = '';
var _below = new THREE.Vector3(), _qInv = new THREE.Quaternion();
function latLonOf(v){
  var lat = Math.asin(Math.max(-1, Math.min(1, v.y))) / DEG;
  var lon = Math.atan2(v.z, -v.x) / DEG - 180;
  if (lon < -180) lon += 360; if (lon > 180) lon -= 360;
  return [lat, lon];
}
function writeViewpoint(){
  _below.copy(camera.position).normalize();
  var ll=latLonOf(_below),km=Math.round((camDist-1)*GTObserver.EARTH_KM);
  var where=Math.abs(ll[0]).toFixed(1)+'°'+(ll[0]>=0?'N':'S')+' '+Math.abs(ll[1]).toFixed(1)+'°'+(ll[1]>=0?'E':'W');
  var text=km.toLocaleString()+' KM ABOVE '+where+' · '+skyDateText;
  if(text!==viewpointLast){viewpointLast=text;document.getElementById('skyDate').textContent=text;}
  var coords=document.getElementById('observerCoordinates');
  if(coords){ coords.textContent='X '+Math.round(camera.position.x*6371).toLocaleString()+' · Y '+Math.round(camera.position.y*6371).toLocaleString()+' · Z '+Math.round(camera.position.z*6371).toLocaleString()+' KM'; }
}
function monthMidDate(fracYearValue){
  var year=Math.floor(fracYearValue+1e-6),month=Math.round((fracYearValue-year)*12);
  if(month>11){month=0;year++;} return new Date(Date.UTC(year,month,15,12));
}
var lastSkyComputed=null;
function setSkyDate(date){
  if (MONTHLY){
    skyAvailable=false; sky.visible=false; bodiesGroup.visible=false;
    skyDate=null; skyDateText='EARTH · MONTHLY ARCHIVE';
    sunLight.intensity=0.9; sunLight.position.set(5,3,5);
    writeViewpoint(); return;
  }
  skyAvailable=typeof Astronomy!=='undefined' && GTObserver.supportedDate(date);
  sky.visible=skyAvailable; bodiesGroup.visible=skyAvailable;
  if(!skyAvailable){
    skyDate=null;lastSkyComputed=null;skyDateText='SKY UNAVAILABLE · SUPPORTED 1900–2100';
    sunLight.intensity=0; writeViewpoint(); return;
  }
  skyDate=date;
  skyDateText='SKY '+date.toISOString().slice(0,16).replace('T',' ')+' UTC · GEOMETRIC';
  if(lastSkyComputed===+date){writeViewpoint();return;}
  lastSkyComputed=+date;
  var rot=Astronomy.Rotation_EQJ_EQD(date),gast=Astronomy.SiderealTime(date);
  function fixed(v){ return GTObserver.eqdToFixed(Astronomy.RotateVector(rot,new Astronomy.Vector(v.x,v.y,v.z,date)),gast); }
  var arr=skyCatalogPoints.geometry.attributes.position.array;
  skyCatalogPositions.forEach(function(v,i){var p=fixed(v);arr[i*3]=p.x*SKY_R;arr[i*3+1]=p.y*SKY_R;arr[i*3+2]=p.z*SKY_R;});
  skyCatalogPoints.geometry.attributes.position.needsUpdate=true;
  LABEL_CANDIDATES.forEach(function(c){var p=fixed(c.eqj);c.pos.set(p.x,p.y,p.z).multiplyScalar(SKY_R-20);});
  var bodies=GTObserver.geometricBodies(Astronomy,date,Object.keys(BODY_RADII_KM));
  Object.keys(bodies).forEach(function(n){var p=bodies[n];bodyPositions[n]=new THREE.Vector3(p.x,p.y,p.z);});
  sunLight.intensity=0.9; updateSunLight(); writeViewpoint();
}
function updateSunLight(){
  if(!skyAvailable || !bodyPositions.Sun) return;
  sky.position.copy(camera.position);
  sunLight.position.copy(bodyPositions.Sun).normalize().multiplyScalar(100);
  moonMesh.position.copy(bodyPositions.Moon);
  moonMesh.visible=!earthOccludes(bodyPositions.Moon) || bodyPositions.Moon.distanceTo(camera.position)<1;
  function drawBody(name,obj){
    var relative=bodyPositions[name].clone().sub(camera.position),dist=relative.length();
    var display=Math.min(SKY_R-30,dist);
    obj.position.copy(camera.position).add(relative.setLength(display));
    obj.visible=!earthOccludes(bodyPositions[name]);
    if(name==='Sun'){
      var diameter=2*BODY_RADII_KM.Sun/6371/dist*display*2.6;
      obj.scale.set(diameter,diameter,1);
    }
  }
  drawBody('Sun',sunSprite);
  Object.keys(planetSprites).forEach(function(n){drawBody(n,planetSprites[n]);});
}

// borders as line segments
(function(){
  var pts = [];
  function ring(coords){
    for (var i = 0; i < coords.length - 1; i++){
      var a = toVec(coords[i][1], coords[i][0], 1.004), b = toVec(coords[i+1][1], coords[i+1][0], 1.004);
      pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  BORDERS.features.forEach(function(f){
    var g = f.geometry; if (!g) return;
    if (g.type === 'Polygon') g.coordinates.forEach(ring);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(function(p){ p.forEach(ring); });
  });
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  window.__borders = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.32 }));
  globe.add(window.__borders);
})();

// marker sprites
var SPRITE_TEX = {}, RING_TEX, RING_DASH;
Object.keys(CATS).forEach(function(k){
  SPRITE_TEX[k] = new THREE.CanvasTexture(iconCanvas(k, 128, true));
});
RING_TEX = new THREE.CanvasTexture(ringCanvas(128, false));
RING_DASH = new THREE.CanvasTexture(ringCanvas(128, true));

var markers = new THREE.Group(); globe.add(markers);
var MAX_SHOWN = 400;
function shownCap(){ return Math.round(Math.min(MAX_SHOWN, Math.max(90, 150 * Math.pow(3.9 / camDist, 1.2)) * densityLevel)); }

// Each event is a hologram: a translucent light beam rising from the exact spot, with the event's image floating
// at the top as a framed card. Cards that would overlap on screen are lifted higher, so dense regions stack
// upward instead of piling on one another.
var CARD_W = 0.11, CARD_H = 0.0825;          // world units at weight 1; scales with weight and zoom
var HOVER = 0.022;                           // how far the card floats above the ground
var BEAM_GEO = new THREE.CylinderGeometry(0.004, 0.016, 1, 12, 1, true);
BEAM_GEO.translate(0, 0.5, 0);               // base at the origin, rising along +Y
var BASE_TEX = (function(){
  var c = document.createElement('canvas'); c.width = c.height = 64; var ctx = c.getContext('2d');
  var g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
var POOL = [];
for (var pi = 0; pi < MAX_SHOWN; pi++){
  var holder = new THREE.Group();
  var beam = new THREE.Mesh(BEAM_GEO, new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.22, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }));
  var base = new THREE.Sprite(new THREE.SpriteMaterial({ map:BASE_TEX, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }));
  base.scale.set(0.03, 0.03, 1);
  // depthTest on: a card is a real object at a real height above its point, and the Earth's limb should hide it
  // the moment it goes round the back — the same way it hides the beam it stands on.
  var card = new THREE.Sprite(new THREE.SpriteMaterial({ map:SPRITE_TEX.con, transparent:true, depthTest:true, depthWrite:false }));
  var badge = new THREE.Sprite(new THREE.SpriteMaterial({ map:SPRITE_TEX.con, transparent:true, depthTest:false, depthWrite:false }));
  badge.renderOrder = 3; badge.visible = false;
  var pile = new THREE.Sprite(new THREE.SpriteMaterial({ transparent:true, depthTest:false, depthWrite:false }));
  pile.renderOrder = 4; pile.visible = false;
  holder.add(beam); holder.add(base); holder.add(card); holder.add(badge); holder.add(pile);
  holder.visible = false; holder.userData = { beam:beam, base:base, card:card, badge:badge, pile:pile };
  POOL.push(holder); markers.add(holder);
}

// Every card stands directly on its own spot. Nothing is offset to make room.
//
// An earlier version let a crowded card climb the screen to find space. It unstacked a busy city, but it also
// broke the one thing the map is for: a card that has moved is a card whose country you can no longer read, and
// near the edge of the disc a climbing card ended up over the stars. Density is not worth that. When two cards
// want the same pixels the less important one folds into the more important one's +N chip, where it is one click
// away and still labelled with its own place.

// How close an event has to be, on the ground, before another card may stand for it. Screen distance was the
// wrong measure: at low zoom it swallowed half a continent, and what a "+14" meant changed every time you
// scrolled. Kilometres do not move. Anything further away keeps its own dot and waits for you to zoom in.
var FOLD_KM = 250;
var EARTH_KM = 6371;
function kmApart(a, b){
  var d = Math.max(-1, Math.min(1, a.normal.dot(b.normal)));
  return Math.acos(d) * EARTH_KM;
}

// The chip a card wears when other events folded into it: "+7". One texture per count, built once and reused.
var PILE_TEX = {};
function pileTexture(count){
  var label = '+' + (count > 99 ? 99 : count);
  if (PILE_TEX[label]) return PILE_TEX[label];
  var c = document.createElement('canvas'); c.width = 128; c.height = 64;
  var ctx = c.getContext('2d');
  ctx.font = '600 30px "IBM Plex Mono", ui-monospace, monospace';
  var w = Math.min(120, ctx.measureText(label).width + 28), h = 40, x = (128 - w) / 2, y = 12, r = h / 2;
  ctx.beginPath();
  ctx.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5);
  ctx.arc(x + w - r, y + r, r, Math.PI * 1.5, Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8,14,26,.92)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(240,182,58,.95)'; ctx.stroke();
  ctx.fillStyle = '#F0B63A'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 30px "IBM Plex Mono", ui-monospace, monospace';
  ctx.fillText(label, 64, y + r + 1);
  var t = new THREE.CanvasTexture(c); t.needsUpdate = true;
  PILE_TEX[label] = t;
  return t;
}
var Y_AXIS = new THREE.Vector3(0, 1, 0);
function prepareEvent(e){
  e.normal = toVec(e.lat, e.lon, 1);
  e.foot = toVec(e.lat, e.lon, 1.002);
  e.pos = e.foot.clone();                                     // card position, set per frame from the stack height
  e.size = 0.75 + e.w * 0.18;                                 // 0.93 .. 1.47 — scales the card
  e.baseH = 0.045 + e.w * 0.018;                              // beam height before stacking
  e.quat = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, e.normal.clone().normalize());
}
EVENTS.forEach(prepareEvent);
var shardLoader = SHARDS && window.GTShards.create({
  years:SHARDS.years, dir:SHARDS.dir,
  onRows:function(rows){
    var ids = new Set(EVENTS.map(function(e){ return e.stableId; })), added = 0;
    rows.forEach(function(r){ var e = parseRow(r, EVENTS.length); if (ids.has(e.stableId)) return; ids.add(e.stableId); prepareEvent(e); EVENTS.push(e); added++; });
    meanwhileCache = null;
    return added;
  },
  onStatus:function(state){
    var box = document.getElementById('dataStatus'); if (!box) return;
    var failed = Object.keys(state.failures), pending = Object.keys(state.states).filter(function(y){ return state.states[y] === 'loading'; });
    box.hidden = !failed.length && !pending.length;
    box.textContent = failed.length ? 'Some years could not load · Retry' : 'Loading historical events…';
    box.disabled = !failed.length;
  }
});
function ensureYears(start, end, done){
  if (!shardLoader){ done(false, true); return; }
  var b = viewBounds(nowT, WINDOWS[wi]);
  var lo = MONTHLY ? b.start : Math.min(start, b.start), hi = MONTHLY ? TIME.addDays(b.end,-1) : Math.min(presentTime(), Math.max(end, TIME.addDays(b.end, 32)));
  monthLoading=true;
  shardLoader.range(lo, hi).then(function(results){
    var state=shardLoader.status(), year=Math.floor(nowT);
    monthLoading=state.states[year]!=='loaded';
    done(results.some(function(r){ return r.added > 0; }), !monthLoading);
    if(MONTHLY){ renderMonthList(); showSpeed(); }
  });
}
var retryData = document.getElementById('dataStatus');
if (retryData) retryData.onclick = function(){ ensureYears(WINDOWS[wi].start, WINDOWS[wi].end, function(added){ bindWindow(); render(); resetTicker(); resolvePendingEvent(); }); };

// hologram card texture: the photo (or category glyph) with a tinted frame, scanlines and a badge
var CARD_TEX = {};
function cardTexture(e, onReady){
  var key = cardTextureKey(e);
  if (CARD_TEX[key] && onReady !== 'painter') return CARD_TEX[key];
  var compact = !visualFor(e);
  var cw = 256, ch = compact ? 108 : 192, col = css(CATS[e.cat].v);
  function paint(img, canvas){
    var c = canvas || document.createElement('canvas'); c.width = cw; c.height = ch; var ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(8,14,26,.72)'; ctx.fillRect(0, 0, cw, ch);
    if (img){
      var sw = img.videoWidth || img.width, sh = img.videoHeight || img.height, sc = Math.max(cw / sw, ch / sh);
      var dw = sw * sc, dh = sh * sc;
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      var tint = ctx.createLinearGradient(0, 0, 0, ch); tint.addColorStop(0, 'rgba(110,200,255,.16)'); tint.addColorStop(1, 'rgba(110,160,255,.28)');
      ctx.fillStyle = tint; ctx.fillRect(0, 0, cw, ch);
    } else {
      ctx.fillStyle = '#ecf1fa'; ctx.font = compact ? '600 24px Arial' : '600 20px Arial';
      var title = String(e.name || e.title || CATS[e.cat].label), words = title.split(/\s+/), lines = [], line = '';
      words.forEach(function(word){ var next = line ? line + ' ' + word : word; if (ctx.measureText(next).width > 226 && line){ lines.push(line); line = word; } else line = next; });
      if (line) lines.push(line);
      var maxLines = compact ? 2 : 4;
      if(lines.length > maxLines){ var last=lines[maxLines-1]; while(last.length && ctx.measureText(last+'…').width>226)last=last.slice(0,-1); lines[maxLines-1]=last+'…'; }
      lines.slice(0,maxLines).forEach(function(text,i){ctx.fillText(text,15,(compact?31:38)+i*27);});
      ctx.fillStyle = '#b7d5e9'; ctx.font = compact ? '18px Arial' : '15px Arial'; if (e.title) ctx.fillText(whenLabel(e),15,ch-14);

    }
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    for (var y = 0; y < ch; y += 4) ctx.fillRect(0, y, cw, 1.5);
    ctx.lineWidth = 5; ctx.strokeStyle = col; ctx.strokeRect(2.5, 2.5, cw - 5, ch - 5);
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.strokeRect(8, 8, cw - 16, ch - 16);
    if (!compact){
    ctx.beginPath(); ctx.arc(cw - 26, ch - 26, 18, 0, 2 * Math.PI); ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.save(); ctx.translate(cw - 26 - 12, ch - 26 - 12); drawGlyph(ctx, e.cat, 24); ctx.restore();
    }
    if (mediaFor(e)){   // a clip: play badge, bottom-left
      ctx.beginPath(); ctx.arc(26, ch - 26, 16, 0, 2 * Math.PI); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(21, ch - 34); ctx.lineTo(21, ch - 18); ctx.lineTo(34, ch - 26); ctx.closePath(); ctx.fillStyle = '#0b1220'; ctx.fill();
    }
    if (canvas) return c;                                   // live frame: caller owns the texture
    var tex = new THREE.CanvasTexture(c); CARD_TEX[key] = tex; return tex;
  }
  if (onReady === 'painter') return paint;                    // used by the live (video) cards
  var im = photoFor(e), md = mediaFor(e), poster = !im && md && md.kind === 'video' && md.poster;
  if (!im && !poster) return paint(null);
  var img = new Image();
  img.onload = function(){ var tex = paint(img); if (typeof onReady === 'function') onReady(tex); };
  img.src = poster ? MEDIA_DIR + md.poster : IMG_DIR + im.file;
  return paint(null);
}
var GLYPH_TEX = {};
Object.keys(CATS).forEach(function(k){ GLYPH_TEX[k] = cardTexture({ cat:k, slug:'' }, function(){}); });
// ---------- animated icons by kind of event ----------
// A plane going down, a tremor, a ballot dropping, a trophy, a rocket, a candle: drawn procedurally so every
// event has a moving picture that says what kind of thing it was, whether or not a photo exists.
var KIND_RULES = [
  ['plane',   /flight \d|air crash|plane crash|airlines|aircraft|air disaster|airliner|helicopter/i],
  ['rocket',  /^launch of|spaceflight|rocket|space shuttle|sts-\d|soyuz|apollo|artemis|satellite|probe|orbiter|lander|rover|mission to/i],
  ['quake',   /earthquake|quake|tremor/i],
  ['storm',   /hurricane|cyclone|typhoon|storm|tornado/i],
  ['flood',   /flood|tsunami|dam failure/i],
  ['volcano', /eruption|volcan/i],
  ['fire',    /wildfire|bushfire|fire\b|blaze|inferno/i],
  ['virus',   /pandemic|epidemic|outbreak|covid|ebola|cholera|plague|influenza/i],
  ['blast',   /bombing|bombings|attack|attacks|explosion|shooting|massacre|assassination|killing of|stabbing|terror/i],
  ['war',     /war\b|battle|siege|invasion|offensive|operation|coup|uprising|revolution|rebellion|insurgency|conflict|crisis|protests?|riots?|genocide|strike/i],
  ['ballot',  /election|referendum|inaugurat|vote|elected/i],
  ['trophy',  /final\b|finals|cup\b|championship|grand prix|super bowl|olympic|world series|tournament|open\b|derby|games\b|wins /i],
  ['treaty',  /treaty|agreement|accord|summit|conference|convention|pact|armistice|ceasefire|peace/i],
  ['birth',   /^birth of /i],
  ['death',   /^death of /i],
  ['orbit',   /discovery|discovered|invention|telescope|comet|asteroid|planet|nebula|galaxy|element|particle|experiment|observ|nobel|introduced$/i],
];
var KIND_DEFAULT = { con:'war', dis:'blast', sci:'orbit', cul:'culture' };
function kindOf(e){
  if (e.kind) return e.kind;
  var text = e.name + ' ' + e.title;
  for (var i = 0; i < KIND_RULES.length; i++) if (KIND_RULES[i][1].test(text)) return (e.kind = KIND_RULES[i][0]);
  return (e.kind = KIND_DEFAULT[e.cat] || 'culture');
}
// draw one kind, centred at (0,0) in a 100-unit box, at time t (ms); col is the category colour
function drawKind(ctx, kind, t, col){
  var s = t / 1000, TAU = Math.PI * 2;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 5;
  function ring(r, a){ ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.globalAlpha = a; ctx.stroke(); ctx.globalAlpha = 1; }
  if (kind === 'plane'){
    var k = (s * 0.45) % 1;                                        // a plane descends across the box, trailing smoke
    ctx.save(); ctx.translate(-45 + k * 90, -30 + k * 55); ctx.rotate(0.55);
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(22, 0); ctx.moveTo(-4, 0); ctx.lineTo(-12, -14); ctx.moveTo(-4, 0); ctx.lineTo(-12, 14); ctx.moveTo(-20, 0); ctx.lineTo(-24, -7); ctx.stroke();
    ctx.restore();
    for (var i = 1; i <= 4; i++){ var kk = k - i * 0.09; if (kk < 0) continue; ctx.beginPath(); ctx.arc(-45 + kk * 90, -30 + kk * 55, 3 + i * 1.5, 0, TAU); ctx.globalAlpha = 0.5 - i * 0.1; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; }
  } else if (kind === 'rocket'){
    var y = 30 - ((s * 0.5) % 1) * 80;                              // a rocket climbs, flame flickering
    ctx.beginPath(); ctx.moveTo(0, y - 30); ctx.lineTo(10, y - 6); ctx.lineTo(10, y + 12); ctx.lineTo(-10, y + 12); ctx.lineTo(-10, y - 6); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, y + 4); ctx.lineTo(-18, y + 16); ctx.moveTo(10, y + 4); ctx.lineTo(18, y + 16); ctx.stroke();
    var f = 10 + 8 * Math.abs(Math.sin(s * 25));
    ctx.beginPath(); ctx.moveTo(-6, y + 12); ctx.lineTo(0, y + 12 + f); ctx.lineTo(6, y + 12); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.fillStyle = '#fff';
  } else if (kind === 'quake'){
    var sh = Math.sin(s * 40) * 3 * (0.5 + 0.5 * Math.sin(s * 1.3));  // the ground line shakes and cracks
    ctx.save(); ctx.translate(sh, 0);
    ctx.beginPath(); ctx.moveTo(-45, 20); ctx.lineTo(-18, 20); ctx.lineTo(-8, 4); ctx.lineTo(2, 28); ctx.lineTo(12, 10); ctx.lineTo(20, 20); ctx.lineTo(45, 20); ctx.stroke();
    ctx.restore();
    for (var q = 0; q < 2; q++){ var ph = ((s * 0.9) + q * 0.5) % 1; ctx.strokeStyle = col; ring(12 + ph * 40, (1 - ph) * 0.7); ctx.strokeStyle = '#fff'; }
  } else if (kind === 'storm'){
    ctx.save(); ctx.rotate(-s * 2.2); ctx.strokeStyle = '#fff';       // a spiral turns
    for (var arm = 0; arm < 3; arm++){ ctx.beginPath(); for (var a = 0; a < 3.2; a += 0.15){ var r = 6 + a * 11; var ang = a + arm * TAU / 3; var x = Math.cos(ang) * r, yy = Math.sin(ang) * r; if (a === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); } ctx.stroke(); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fillStyle = col; ctx.fill(); ctx.fillStyle = '#fff';
  } else if (kind === 'flood'){
    for (var w = 0; w < 3; w++){ ctx.beginPath(); for (var x2 = -48; x2 <= 48; x2 += 4){ var yy2 = -18 + w * 18 + Math.sin(x2 / 9 + s * 4 + w) * 6; if (x2 === -48) ctx.moveTo(x2, yy2); else ctx.lineTo(x2, yy2); } ctx.globalAlpha = 1 - w * 0.25; ctx.stroke(); }
    ctx.globalAlpha = 1;
  } else if (kind === 'volcano'){
    ctx.beginPath(); ctx.moveTo(-42, 34); ctx.lineTo(-12, -14); ctx.lineTo(12, -14); ctx.lineTo(42, 34); ctx.closePath(); ctx.stroke();
    for (var p = 0; p < 7; p++){ var ph2 = ((s * 0.8) + p * 0.14) % 1; var px = Math.sin(p * 2.3) * 22 * ph2, py = -14 - ph2 * 48 + ph2 * ph2 * 26; ctx.beginPath(); ctx.arc(px, py, 4 - ph2 * 2, 0, TAU); ctx.fillStyle = col; ctx.globalAlpha = 1 - ph2; ctx.fill(); }
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
  } else if (kind === 'fire'){
    for (var fl = 0; fl < 3; fl++){ var h = 30 + 14 * Math.sin(s * 9 + fl * 2.1), ox = (fl - 1) * 16; ctx.beginPath(); ctx.moveTo(ox - 12, 30); ctx.quadraticCurveTo(ox - 14, 30 - h * 0.5, ox, 30 - h); ctx.quadraticCurveTo(ox + 14, 30 - h * 0.5, ox + 12, 30); ctx.closePath(); ctx.fillStyle = fl === 1 ? '#fff' : col; ctx.globalAlpha = fl === 1 ? 0.9 : 0.7; ctx.fill(); }
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
  } else if (kind === 'virus'){
    var pulse = 1 + 0.08 * Math.sin(s * 5);
    ctx.save(); ctx.scale(pulse, pulse); ctx.rotate(s * 0.6);
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.stroke();
    for (var sp = 0; sp < 8; sp++){ var an = sp * TAU / 8; ctx.beginPath(); ctx.moveTo(Math.cos(an) * 18, Math.sin(an) * 18); ctx.lineTo(Math.cos(an) * 32, Math.sin(an) * 32); ctx.stroke(); ctx.beginPath(); ctx.arc(Math.cos(an) * 34, Math.sin(an) * 34, 4, 0, TAU); ctx.fillStyle = col; ctx.fill(); }
    ctx.restore(); ctx.fillStyle = '#fff';
  } else if (kind === 'blast'){
    var b = (s * 1.1) % 1;                                          // a burst expands and fades, then again
    ctx.save(); ctx.rotate(s * 0.3);
    ctx.beginPath(); for (var r2 = 0; r2 < 12; r2++){ var an2 = r2 * TAU / 12, rad = (r2 % 2 ? 14 : 30) * (0.5 + b); ctx.lineTo(Math.cos(an2) * rad, Math.sin(an2) * rad); } ctx.closePath();
    ctx.fillStyle = col; ctx.globalAlpha = 1 - b * 0.8; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore(); ctx.fillStyle = '#fff';
  } else if (kind === 'war'){
    var clash = Math.max(0, Math.sin(s * 3));                        // crossed swords, a flash where they meet
    ctx.beginPath(); ctx.moveTo(-30, 30); ctx.lineTo(30, -30); ctx.moveTo(-30, -30); ctx.lineTo(30, 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-33, 15); ctx.lineTo(-15, 33); ctx.moveTo(33, 15); ctx.lineTo(15, 33); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 4 + clash * 12, 0, TAU); ctx.fillStyle = col; ctx.globalAlpha = 0.9 * clash; ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
  } else if (kind === 'ballot'){
    var d = (s * 0.7) % 1, drop = Math.min(1, d * 1.6);              // a ballot drops into the box
    ctx.beginPath(); ctx.rect(-30, 0, 60, 34); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.lineWidth = 8; ctx.strokeStyle = col; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#fff';
    ctx.save(); ctx.translate(0, -40 + drop * 38); ctx.rotate(0.15 * (1 - drop)); ctx.globalAlpha = 1 - Math.max(0, drop - 0.8) * 5;
    ctx.beginPath(); ctx.rect(-12, -14, 24, 20); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-1, 1); ctx.lineTo(7, -9); ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1;
  } else if (kind === 'trophy'){
    var lift = Math.sin(s * 2.5) * 5;                                // a trophy lifts, a sparkle turns
    ctx.save(); ctx.translate(0, lift);
    ctx.beginPath(); ctx.moveTo(-20, -30); ctx.lineTo(20, -30); ctx.lineTo(14, 4); ctx.quadraticCurveTo(0, 14, -14, 4); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-20, -24); ctx.quadraticCurveTo(-36, -22, -22, -6); ctx.moveTo(20, -24); ctx.quadraticCurveTo(36, -22, 22, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, 22); ctx.moveTo(-14, 26); ctx.lineTo(14, 26); ctx.stroke();
    ctx.restore();
    var sa = s * 3; ctx.save(); ctx.translate(26, -36); ctx.rotate(sa); ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.strokeStyle = col; ctx.stroke(); ctx.restore(); ctx.strokeStyle = '#fff';
  } else if (kind === 'treaty'){
    var g = 0.5 + 0.5 * Math.sin(s * 1.8);                           // two rings drift together and link
    ctx.beginPath(); ctx.arc(-26 + g * 12, 0, 18, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(26 - g * 12, 0, 18, 0, TAU); ctx.strokeStyle = col; ctx.stroke(); ctx.strokeStyle = '#fff';
  } else if (kind === 'birth'){
    var tw = 0.6 + 0.4 * Math.sin(s * 4);                            // a star twinkles, rays breathe
    ctx.beginPath(); for (var st = 0; st < 10; st++){ var an3 = st * TAU / 10 - Math.PI / 2, rr = st % 2 ? 12 : 28 * tw + 4; ctx.lineTo(Math.cos(an3) * rr, Math.sin(an3) * rr); } ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff';
  } else if (kind === 'death'){
    var fl2 = 1 + 0.25 * Math.sin(s * 11) + 0.1 * Math.sin(s * 23);   // a candle flame flickers
    ctx.beginPath(); ctx.rect(-8, -4, 16, 36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -6); ctx.quadraticCurveTo(-8, -20 * fl2, 0, -30 * fl2); ctx.quadraticCurveTo(8, -20 * fl2, 6, -6); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.fillStyle = '#fff';
  } else if (kind === 'orbit'){
    ctx.lineWidth = 3.5;
    for (var o = 0; o < 3; o++){ ctx.beginPath(); ctx.ellipse(0, 0, 34, 13, o * Math.PI / 3, 0, TAU); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
    for (var el = 0; el < 3; el++){ var a4 = s * 2 + el * 2.1, rot = el * Math.PI / 3, x4 = Math.cos(a4) * 34, y4 = Math.sin(a4) * 13; ctx.beginPath(); ctx.arc(x4 * Math.cos(rot) - y4 * Math.sin(rot), x4 * Math.sin(rot) + y4 * Math.cos(rot), 4.5, 0, TAU); ctx.fillStyle = col; ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.lineWidth = 5;
  } else {                                                           // culture: a temple, light breathing behind it
    ctx.beginPath(); ctx.moveTo(-34, -8); ctx.lineTo(0, -30); ctx.lineTo(34, -8); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-30, 30); ctx.lineTo(30, 30); ctx.moveTo(-20, -2); ctx.lineTo(-20, 26); ctx.moveTo(0, -2); ctx.lineTo(0, 26); ctx.moveTo(20, -2); ctx.lineTo(20, 26); ctx.stroke();
    var gl = 0.25 + 0.2 * Math.sin(s * 1.5); var grd = ctx.createRadialGradient(0, 0, 4, 0, 0, 60); grd.addColorStop(0, col); grd.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = gl; ctx.fillStyle = grd; ctx.fillRect(-60, -60, 120, 120); ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
  }
}

// Cards without a photo or clip animate their category glyph so the kind of event reads at a glance:
// conflict flashes, disasters send out shockwaves, science orbits, culture breathes. One shared texture per category.
var GLYPH_LIVE = {};                          // per category|kind: a full card (no photo) repainted with the moving icon
var BADGE_LIVE = {};                          // per category|kind: a small badge for cards that do have a photo or clip
function liveKey(e){ return e.cat + '|' + kindOf(e); }
function liveFor2(e){
  var key = liveKey(e);
  if (!GLYPH_LIVE[key]){
    var c = document.createElement('canvas'); c.width = 256; c.height = 192;
    GLYPH_LIVE[key] = { canvas:c, ctx:c.getContext('2d'), tex:new THREE.CanvasTexture(c), painter:cardTexture({ cat:e.cat, slug:'' }, 'painter'), cat:e.cat, kind:kindOf(e) };
    var b = document.createElement('canvas'); b.width = 96; b.height = 96;
    BADGE_LIVE[key] = { canvas:b, ctx:b.getContext('2d'), tex:new THREE.CanvasTexture(b), cat:e.cat, kind:kindOf(e) };
  }
  return GLYPH_LIVE[key];
}
function paintLiveGlyph(key, t){
  var L = GLYPH_LIVE[key], ctx = L.ctx, col = css(CATS[L.cat].v);
  L.painter(null, L.canvas);                        // frame, scanlines, badge — same as the static card
  ctx.save(); ctx.translate(128, 90); ctx.scale(1.05, 1.05); drawKind(ctx, L.kind, t, col); ctx.restore();
  L.tex.needsUpdate = true;
  var B = BADGE_LIVE[key], bc = B.ctx;
  bc.clearRect(0, 0, 96, 96);
  bc.beginPath(); bc.arc(48, 48, 44, 0, 2 * Math.PI); bc.fillStyle = 'rgba(8,14,26,.82)'; bc.fill(); bc.lineWidth = 3; bc.strokeStyle = col; bc.stroke();
  bc.save(); bc.beginPath(); bc.arc(48, 48, 41, 0, 2 * Math.PI); bc.clip(); bc.translate(48, 48); bc.scale(0.62, 0.62); drawKind(bc, B.kind, t, col); bc.restore();
  B.tex.needsUpdate = true;
}
var glyphLast = 0;
function updateLiveGlyphs(now){
  if (now - glyphLast < 50) return false;          // 20 fps is plenty for a glow
  glyphLast = now;
  var used = {};
  for (var i = 0; i < shown.length; i++){ var e = shown[i]; if (e.holder && e.holder.visible && e._sx != null) used[liveKey(e)] = true; }
  var any = false;
  Object.keys(used).forEach(function(k){ if (GLYPH_LIVE[k]){ paintLiveGlyph(k, now); any = true; } });
  return any;
}

var densityStats = {};
var shown = [];   // events currently bound to pool holders
var windowTotal = 0;
var monthCands = [], prevShown = [], CAT_COLOR = {}, PHOTOS_ONLY = false, CARD_SCALE = 1;
function catColor(cat){ if (!CAT_COLOR[cat]) CAT_COLOR[cat] = css(CATS[cat].v); return CAT_COLOR[cat]; }
function bindWindow(){
  // Once per month: every event that can be on the globe at some moment of this month. Then bindNow() picks,
  // for the moment NOW, the ones that are actually audible and gives them cards.
  var w = WINDOWS[wi];
  monthCands = EVENTS.filter(function(e){ return !off[e.cat] && inWindow(e, w); });
  if(MONTHLY){
    monthSelection=MONTHLY.select(EVENTS,w.end,{time:TIME,countryFor:countryFor,policy:MONTHLY_POLICY,rank:function(e){return e.w*10+(visualFor(e)?50:0);}});
    monthCands=monthSelection.events.filter(function(e){return !off[e.cat];});
    renderMonthList();
  }
  bindNow(true);
}
function renderMonthList(){
  if(!MONTHLY) return;
  var summary=document.getElementById('monthBrowseSummary'), picker=document.getElementById('monthCountry'), list=document.getElementById('monthEvents');
  if(!summary || !picker || !list) return;
  var events=monthSelection.events.filter(function(e){return !off[e.cat] && (!PHOTOS_ONLY || !!visualFor(e));});
  var coverage=monthSelection.coverage, countries=coverage.countries, chosen=picker.value;
  summary.textContent='Browse '+monthLabel(nowT)+' · '+events.length+' events';
  picker.replaceChildren(new Option('All countries / economies',''));
  countries.forEach(function(country){picker.add(new Option(country.name+' · '+country.available+' records / '+country.minimum+'+ target',country.name));});
  picker.value=countries.some(function(country){return country.name===chosen;}) ? chosen : '';
  var progress=document.getElementById('monthCoverageSummary'), detail=document.getElementById('countryCoverage');
  if(progress)progress.textContent=coverage.countriesMeetingTarget+' / '+coverage.totalCountries+' country record targets reached · '+coverage.countriesReviewedToTarget+' independently reviewed to target. Filters do not change these totals.';
  var country=countries.find(function(c){return c.name===picker.value;});
  if(detail)detail.textContent=country ? country.name+': '+country.available+' records, '+country.reviewed+' independently reviewed. Minimum '+country.minimum+' per month'+(country.highIncome?' (high-income)':'')+'. '+(country.shortfall ? country.shortfall+' more records needed.' : 'Record count meets the minimum; source review is tracked separately.') : 'Minimum 12 events per high-income economy and 3 per other country/economy, every month. These are coverage floors, not limits; all available records remain browsable.';
  list.replaceChildren();
  var filtered=events.filter(function(e){return !picker.value || e.monthCountry===picker.value;});
  filtered.sort(function(a,b){return a.monthCountry.localeCompare(b.monthCountry) || b.w-a.w;});
  if(!filtered.length){
    var empty=document.createElement('p'); empty.className='coverage-note';
    empty.textContent=monthLoading ? 'Loading this month’s records. Playback will wait.' : country && !country.available ? 'Coverage gap: no records yet for '+country.name+' in '+monthLabel(nowT)+'. This country still needs at least '+country.minimum+' events.' : 'No records match the current category or media filters.';
    list.appendChild(empty);
  }
  filtered.forEach(function(e){
    var button=document.createElement('button');button.type='button';button.className='month-event';button.dataset.event=e.stableId;
    var country=document.createElement('small');country.textContent=e.monthCountry+' · '+whenLabel(e);
    var title=document.createElement('strong');title.textContent=e.title;
    var tag=document.createElement('span'), media=mediaFor(e), photo=photoFor(e);
    var reviewed=e.metadata.monthlyReview && e.metadata.monthlyReview.source;
    tag.textContent=(reviewed?'Source-checked event':'Catalog record · needs source review')+' · '+(media && media.kind==='video' ? 'Archival clip'+(media.hasAudio ? ' · sound' : ' · silent') : photo ? 'Verified photograph' : 'No verified imagery');
    button.append(country,title,tag);
    button.onclick=function(){document.getElementById('monthBrowse').open=false;selectEvent(e);};
    list.appendChild(button);
  });
  picker.onchange=renderMonthList;
  renderRecommendations();
}
function renderRecommendations(){
  var list=document.getElementById('recommendedEvents');
  if(!MONTHLY || !list || !window.GTMonthlyRecommendations) return;
  document.getElementById('recommendationsHeading').textContent=selected?'Elsewhere this month':'Explore this month';
  document.getElementById('recommendationsMonth').textContent=monthLabel(nowT);
  var events=monthSelection.events.filter(function(e){return !off[e.cat] && (!PHOTOS_ONLY || !!visualFor(e));});
  var recommended=window.GTMonthlyRecommendations.select(events,{month:MONTHLY.monthKey(nowT,TIME),selected:selected,hasMedia:visualFor,limit:4});
  list.replaceChildren();
  document.getElementById('monthRecommendations').scrollTop=0;
  recommended.forEach(function(e){
    var button=document.createElement('button');button.type='button';button.className='recommended-event';button.dataset.event=e.stableId;
    button.setAttribute('aria-label','Explore '+e.title+' · '+e.monthCountry);
    var media=mediaFor(e),photo=photoFor(e),thumb=document.createElement('span');thumb.className='recommendation-thumb';
    var image=document.createElement('img');image.alt='';image.loading='lazy';
    if(photo)image.src=IMG_DIR+photo.file;
    else if(media && media.poster)image.src=MEDIA_DIR+media.poster;
    else {image.src=ICON_URL[e.cat];thumb.classList.add('no-photo');}
    image.onerror=function(){image.onerror=null;image.src=ICON_URL[e.cat];thumb.classList.add('no-photo');};
    thumb.appendChild(image);
    var copy=document.createElement('span');copy.className='recommendation-copy';
    var place=document.createElement('small');place.textContent=e.monthCountry;
    var title=document.createElement('strong');title.textContent=e.title;
    var detail=document.createElement('span');detail.textContent=whenLabel(e)+(media && media.kind==='video'?' · Clip':'');
    copy.append(place,title,detail);button.append(thumb,copy);
    button.onclick=function(){document.getElementById('monthBrowse').open=false;selectEvent(e);};
    list.appendChild(button);
  });
  if(!recommended.length){var empty=document.createElement('p');empty.className='coverage-note';empty.textContent='No other events match this month and your filters.';list.appendChild(empty);}
}
var lastBindT = NaN;
function bindNow(force){
  if (!force && nowT === lastBindT) return;
  lastBindT = nowT;
  syncObserver();
  var w = WINDOWS[wi];
  // The noise floor: with the whole Earth in frame the smallest tier (weight 1: minor year-page items) gets no
  // card at all. Coming in past 2.5 radii lifts the floor, so a country fills in with its smaller events as you
  // approach it.
  var far = camDist > 2.5, slider = ERAS[w.era] && ERAS[w.era].slider;
  var list = [];
  for (var i = 0; i < monthCands.length; i++){
    var e = monthCands[i];
    if (PHOTOS_ONLY){ if (!visualFor(e)) continue; }             // verified photographs or dated video
    else if (densityLevel < 1 && far && e.w <= 1) continue;
    e._p = inView(e, nowT, w) ? (slider ? prominence(e, nowT) : 1) : 0;
    if (e._p > 0.005) list.push(e);
  }
  // Reserve readable space for vetted moving footage, then photographs and event importance.
  function rank(e){ var m=mediaFor(e); return e.w * 3 + (m && m.kind === 'video' ? 30 : photoFor(e) ? 15 : 0) + e._p; }
  list.sort(function(a, b){ return (rank(b) - rank(a)) || (b.t0 - a.t0); });
  windowTotal = list.length;
  syncObserver();
  var cameraVisible = list.filter(function(e){ return visibleNormal(e) > 0 && eventOnScreen(e); });
  var baselineSelection = list.slice(0, shownCap()).filter(function(e){ return visibleNormal(e) > 0 && eventOnScreen(e); });
  densityStats = { eligible:list.length, verifiedPhotos:list.filter(function(e){return !!photoFor(e);}).length, cameraVisible:cameraVisible.length, previousSelection:baselineSelection.length, selected:Math.min(cameraVisible.length,shownCap()) };
  shown = window.GTEventSelection.select(cameraVisible, shownCap(), function(e){return !!visualFor(e);});
  densityStats.selected = shown.length;
  // While a panel is open, the event and its "meanwhile" partners always have a card, whatever their rank,
  // so the pairing the panel lists is the pairing the globe shows.
  if (FOOTAGE && selected === FOOTAGE.event && !off[selected.cat]){ selected._p=1; if(shown.indexOf(selected)<0)shown.unshift(selected); }
  if (selected){
    var pinned = [selected].concat(contextFor(selected)).filter(function(e){ return !off[e.cat] && inView(e, nowT, w) && (!PHOTOS_ONLY || visualFor(e)); });
    var rest = shown.filter(function(e){ return pinned.indexOf(e) < 0; });
    shown = pinned.concat(rest).slice(0, Math.max(shownCap(), pinned.length));
  }
  for (var p = 0; p < prevShown.length; p++){ prevShown[p].holder = null; prevShown[p]._sx = null; }
  prevShown = shown;
  shown.forEach(function(e, i){
    var h = POOL[i], u = h.userData;
    e.holder = h;
    var mediaStamp = cardMediaStamp(e);
    if (u.bound === e && u.mediaStamp === mediaStamp) return;
    u.mediaStamp = mediaStamp;                                       // same card in the same holder: nothing to redo
    u.bound = e;
    var tex = cardTexture(e, function(t){
      if (e.holder !== h || u.bound !== e || u.mediaStamp !== mediaStamp) return;
      var replace = u.card.material.map === u.fallbackMap;
      u.fallbackMap = t;
      if (replace){ u.card.material.map = t; u.card.material.needsUpdate = true; render(); }
    });
    var live = liveFor2(e);
    u.fallbackMap = tex || live.tex;
    u.card.material.map = u.fallbackMap; u.card.material.needsUpdate = true;
    u.badge.material.map = BADGE_LIVE[liveKey(e)].tex; u.badge.material.needsUpdate = true;
    u.hasPhoto = !!photoFor(e);
    u.beam.material.color.set(catColor(e.cat));
    h.position.copy(e.foot); h.quaternion.copy(e.quat);
    e.holder = h; e.stackH = 0;
  });
  // a holder keeps its card only while that card is at its index; anything else is rebound above
  shown.forEach(function(e, i){ e.holder = POOL[i]; });
  for (var j = shown.length; j < MAX_SHOWN; j++){ POOL[j].visible = false; }
}
// ---------- hot zones ----------
// Where the month's events pile up, the ground glows: one warm halo per cluster of events within HOT_KM of each
// other, sized by the weight it holds. A cluster on the far side of the Earth cannot be seen, so its light is
// put on the limb in its direction instead, fainter the further round it is — from over the Pacific you see
// North America's light on the edge and roll toward it.
var HOT_KM = 1500, HOT_POOL = 48;
var GLOW_TEX = (function(){
  var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d');
  var grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,200,110,.95)'); grad.addColorStop(0.3, 'rgba(255,170,80,.45)'); grad.addColorStop(0.65, 'rgba(255,140,60,.12)'); grad.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
var hotGround = [], hotLimb = [];
for (var hi = 0; hi < HOT_POOL; hi++){
  var gs = new THREE.Sprite(new THREE.SpriteMaterial({ map:GLOW_TEX, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, depthTest:true }));
  gs.visible = false; gs.renderOrder = 1; globe.add(gs); hotGround.push(gs);
  var ls = new THREE.Sprite(new THREE.SpriteMaterial({ map:GLOW_TEX, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, depthTest:false }));
  ls.visible = false; ls.renderOrder = 2; scene.add(ls); hotLimb.push(ls);
}
var _hn = new THREE.Vector3();
function updateHotZones(){
  var zones = [];
  for (var i = 0; i < shown.length; i++){
    var e = shown[i];
    if (!e.holder) continue;
    var heat = e.w * e.w * (0.5 + 0.5 * (e._p == null ? 1 : e._p));
    var placed = false;
    for (var z = 0; z < zones.length; z++){
      if (kmApart(zones[z].lead, e) < HOT_KM){ zones[z].heat += heat; zones[z].n++; placed = true; break; }
    }
    if (!placed) zones.push({ lead:e, heat:heat, n:1 });
  }
  zones.sort(function(a, b){ return b.heat - a.heat; });
  var g = 0, l = 0;
  for (var k = 0; k < zones.length && (g < HOT_POOL || l < HOT_POOL); k++){
    var zone = zones[k];
    if (zone.heat < 12) continue;                                        // one small event is not a hot zone
    var strength = Math.min(1, Math.sqrt(zone.heat) / 10);
    _hn.copy(zone.lead.normal).applyQuaternion(globe.quaternion);
    if (visibleNormal(zone.lead) > 0 && g < HOT_POOL){
      var sp = hotGround[g++];
      sp.position.copy(zone.lead.normal).multiplyScalar(1.012);
      // the glow is a far-view thing: it shrinks and thins as the camera comes down, so up close the map is the map
      var near = Math.max(0, Math.min(1, (camDist - 1.2) / 2.2));  // 0 at the closest zoom, 1 with the Earth in frame
      var size = (0.30 + 0.55 * strength) * (0.12 + 0.88 * near) * Math.max(0.6, Math.min(1.4, camDist / 3.9));
      sp.scale.set(size, size, 1); sp.material.opacity = (0.55 + 0.45 * strength) * (0.25 + 0.75 * near) / Math.sqrt(Math.max(1, shown.length / 40)); sp.visible = true;
    }
  }
  for (; g < HOT_POOL; g++) hotGround[g].visible = false;
  for (; l < HOT_POOL; l++) hotLimb[l].visible = false;
}
var selRing = new THREE.Sprite(new THREE.SpriteMaterial({ map:RING_TEX, transparent:true, depthTest:false }));
selRing.visible = false; selRing.renderOrder = 5; globe.add(selRing);
var ctxRings = [0,1,2,3,4,5].map(function(){
  var r = new THREE.Sprite(new THREE.SpriteMaterial({ map:RING_DASH, transparent:true, depthTest:false, opacity:0.9 }));
  r.visible = false; r.renderOrder = 5; globe.add(r); return r;
});

// ---------- rotation ----------
function targetQuat(lat, lon){
  var P = toVec(lat, lon, 1);
  var b = -Math.atan2(P.x, P.z);
  var zPrime = Math.sqrt(P.x * P.x + P.z * P.z);
  var a = Math.atan2(P.y, zPrime);
  var qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), b);
  var qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), a);
  return qx.multiply(qy);
}
orbitQuat.copy(targetQuat(22, 18)); syncObserver();

var W = 0, H = 0;
function resize(){
  var r = wrap.getBoundingClientRect();
  W = r.width; H = r.height;
  renderer.setSize(W, H, false);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  camera.aspect = W / H; camera.updateProjectionMatrix();
  render();
}

function visibleEvents(){ return shown; }
var _tmp = new THREE.Vector3();
function worldNormal(e){ return _tmp.copy(e.normal).applyQuaternion(globe.quaternion); }

var _v = new THREE.Vector3();
function cardPixels(){
  // approximate on-screen height in px of a unit-size card at the globe's front
  return CARD_H * H / (2 * Math.tan(camera.fov * DEG / 2) * Math.max(0.3, camDist - 1));
}
function render(){
  if (!W) return;
  syncObserver();
  if(observerBoundRevision!==observerRevision && clockNow()-observerLastBind>=100){
    observerLastBind=clockNow();observerBoundRevision=observerRevision;bindNow(true);
  }
  var list = shown;
  var ctxEls = selected ? contextFor(selected) : [];
  var behind = 0;
  // A card's size is set in world units, so left alone it grows on screen exactly as fast as the Earth does and
  // zooming in reveals nothing — the same cards, larger. Scaling the world size with camDist cancels that out:
  // the card stays about the same number of pixels while the ground beneath it spreads apart, so coming in on a
  // country pulls its events out of one another. The exponent leaves cards a little larger up close, where you
  // are reading them, than they are with the whole Earth in frame.
  var zoomBoost = Math.max(0.30, Math.min(1.6, 0.86 * Math.pow(camDist / 3.9, 0.55))) * CARD_SCALE;
  var pxPerUnit = cardPixels();
  var placed = [];      // {x, y, hw, hh} of cards already laid out this frame, in px
  var hiddenCount = 0;
  // lay out by importance so the biggest events claim their spot first
  // ---- pass 1: measure every event and group the ones that stand on the same ground ----
  // The list is in importance order, so the first event at a place leads its group and the anchor is its spot.
  var groups = [];
  list.forEach(function(e){
    var h = e.holder; if (!h) return;
    var front = visibleNormal(e) > 0 && eventOnScreen(e);
    h.visible = front;
    e.folded = null; e._sx = null;
    if (!front){ behind++; return; }
    var prom = e._p == null ? 1 : e._p;              // loudness now
    var focusStyle = MONTHLY ? window.GTEventSelection.presentation(e,selected,ctxEls) : null;
    var scale = e.size * zoomBoost * (0.80 + 0.20 * prom) * (focusStyle ? focusStyle.scale : 1);
    var compact = !visualFor(e);
    e._cw = CARD_W * scale * (compact ? .94 : 1); e._chh = CARD_H * scale * (compact ? .529 : 1); e._prom = prom;
    e._hw = e._cw * pxPerUnit / CARD_H * 0.5; e._hh = e._chh * pxPerUnit / CARD_H * 0.5;
    _v.copy(e.normal).multiplyScalar(1.002 + HOVER).applyQuaternion(globe.quaternion);
    var cameraDepth=-_v.clone().applyMatrix4(camera.matrixWorldInverse).z;
    var localPixels=H/(2*Math.tan(camera.fov*DEG/2)*Math.max(camera.near,cameraDepth));
    e._hw=e._cw*localPixels/2;e._hh=e._chh*localPixels/2;
    _v.project(camera);
    e._bx = (_v.x + 1) / 2 * W; e._by = (1 - _v.y) / 2 * H;
    for (var g = 0; g < groups.length; g++){
      if (kmApart(groups[g].leader, e) < FOLD_KM){ groups[g].members.push(e); return; }
    }
    groups.push({ leader:e, members:[] });
  });

  // ---- pass 2: lay each group out as holograms rising from their own ground ----
  // Every card stands on a vertical beam over its own point — the surface normal, straight up from the ground
  // in 3D — never offset across the screen. When events share a spot, the first stands at the usual height and
  // the next ones rise higher on longer beams, each still exactly over its own coordinates, so a country with
  // three things going on shows three holograms at three heights. Seen from straight above they line up and the
  // ones behind fold into +N; tilt the view or come round the side and the column opens out, which is how a
  // real column of objects behaves. Nothing is ever drawn anywhere but above where it happened.
  function hide(e){
    var u = e.holder.userData;
    u.card.visible = false; u.beam.visible = false; u.badge.visible = false; u.pile.visible = false;
    u.base.visible = true; u.base.scale.set(0.03, 0.03, 1);
    e._sx = null; e.stackH = 0; e.pos.copy(e.foot); hiddenCount++;
  }
  function screenAt(e, height){
    _v.copy(e.normal).multiplyScalar(1.002 + height).applyQuaternion(globe.quaternion);
    var depth=-_v.clone().applyMatrix4(camera.matrixWorldInverse).z;
    if(depth<=camera.near) return null;
    var pixels=H/(2*Math.tan(camera.fov*DEG/2)*depth);
    e._hw=e._cw*pixels/2;e._hh=e._chh*pixels/2;
    _v.project(camera);
    return [(_v.x + 1) / 2 * W, (1 - _v.y) / 2 * H];
  }
  function clear(sx, sy, hw, hh, isSel){
    if (isSel) return true;
    if(sx-hw<4 || sx+hw>W-4 || sy-hh<4 || sy+hh>H-4) return false;
    for (var i = 0; i < placed.length; i++){
      var p = placed[i];
      if (Math.abs(p.x - sx) < p.hw + hw && Math.abs(p.y - sy) < p.hh + hh) return false;
    }
    return true;
  }
  function show(e, height, sx, sy, group){
    var u = e.holder.userData, cw = e._cw, chh = e._chh;
    placed.push({ x:sx, y:sy, hw:e._hw, hh:e._hh, e:e, folded:group.folded });
    e._sx = sx; e._sy = sy; e._px = e._hw * 2; e.stackH = height;
    u.card.visible = true; u.base.visible = true; u.beam.visible = true;
    u.beam.scale.set(1, height, 1);                              // the beam runs from the ground to the card
    u.card.position.set(0, height, 0);
    u.card.scale.set(cw, chh, 1);
    u.card.center.set(0.5, 0.5);
    if (u.hasPhoto && mediaFor(e) == null){
      var bs = chh * 0.34;
      u.badge.visible = true; u.badge.position.set(0, height, 0); u.badge.scale.set(bs, bs, 1);
      u.badge.center.set(0.5 + (cw / 2 - bs * 0.62) / bs, 0.5 + (chh / 2 - bs * 0.62) / bs);
    } else u.badge.visible = false;
    u.base.scale.set(0.02, 0.02, 1);
    var dim = selected && selected.id !== e.id && ctxEls.indexOf(e) < 0;
    // rising or sinking: a card fades in as its day approaches and out as it passes; while it is here it is bright
    // as a headline and dimmer at the background level a long-running thing settles to
    var vis = Math.min(1, e._prom / BACKGROUND);
    var fade = (0.62 + 0.38 * e._prom) * vis;
    var tall = height > HOVER * 1.5;
    // Monthly browsing keeps the surrounding events readable while the selection grows.
    var focusStyle = MONTHLY ? window.GTEventSelection.presentation(e,selected,ctxEls) : null;
    u.card.material.opacity = (focusStyle ? focusStyle.cardOpacity : dim ? 0.25 : 0.96) * fade;
    u.badge.material.opacity = (focusStyle ? focusStyle.badgeOpacity : dim ? 0.2 : 1) * fade;
    u.beam.material.opacity = (focusStyle ? (focusStyle.beamOpacity == null ? (tall ? 0.4 : 0.22) : focusStyle.beamOpacity) : dim ? 0.05 : (tall ? 0.4 : 0.22)) * vis * (visualFor(e) ? 1 : .38);
    u.base.material.opacity = (focusStyle ? focusStyle.baseOpacity : dim ? 0.2 : 0.9) * vis;
    if (u.pile) u.pile.material.opacity = vis;
    e.pos.copy(e.normal).multiplyScalar(1.002 + height);
  }
  // heights a column climbs through, in multiples of HOVER: the second hologram over a spot stands about a card
  // height above the first, and so on; past the last one the rest fold
  var LEVELS = [1, 2.6, 4.2, 5.8, 7.4, 9.0];
  groups.forEach(function(group){
    var L = group.leader;
    group.folded = [];
    var members = [L].concat(group.members), level = 0;
    for (var m = 0; m < members.length; m++){
      var e = members[m], sel = selected && selected.id === e.id, done = false;
      for (; level < LEVELS.length && !done; level++){
        var height = HOVER * LEVELS[level];
        var at = screenAt(e, height);
        if (at && clear(at[0], at[1], e._hw, e._hh, sel)){ show(e, height, at[0], at[1], group); done = true; }
      }
      if (!done){
        if (m === 0){
          // even the leader has no room: the group folds into whatever card is standing there, if it is close
          var host = null, hostKm = FOLD_KM;
          for (var k = 0; k < placed.length; k++){ var km = kmApart(placed[k].e, L); if (km < hostKm){ hostKm = km; host = placed[k]; } }
          members.forEach(function(x){ hide(x); if (host) host.folded.push(x); });
          return;
        }
        hide(e); group.folded.push(e);
      }
    }
  });

  // Every card has claimed its place, so the counts are final: a group's leader wears the "+N" chip for whatever
  // found no slot, and openPanel lists them.
  var foldedCount = 0;
  for (var pj = 0; pj < placed.length; pj++){
    var pl = placed[pj], pe = pl.e, ph = pe.holder;
    pe.folded = pl.folded;
    if (!ph) continue;
    var pu = ph.userData;
    var isLeader = groups.some(function(gr){ return gr.leader === pe; });
    if (!isLeader || !pl.folded.length){ pu.pile.visible = false; continue; }
    foldedCount += pl.folded.length;
    var cw2 = pu.card.scale.x, ch2 = pu.card.scale.y;
    var chipH = ch2 * 0.30, chipW = chipH * 2;
    pu.pile.material.map = pileTexture(pl.folded.length); pu.pile.material.needsUpdate = true;
    pu.pile.visible = true;
    pu.pile.position.set(0, pe.stackH, 0);
    pu.pile.scale.set(chipW, chipH, 1);
    // bottom-right corner of the card (larger centre.x moves the sprite left, larger centre.y moves it down)
    pu.pile.center.set(0.5 - (cw2 / 2 - chipW * 0.5 - cw2 * 0.04) / chipW,
                       0.5 + (ch2 / 2 - chipH * 0.5 - ch2 * 0.05) / chipH);
  }
  window.__borders.visible = WINDOWS[wi].start >= 1900;
  syncObserver();
  writeViewpoint();
  // The near clipping plane has to stay in front of the Earth's surface, which sits camDist - 1 away. At the old
  // fixed 0.1 anything closer than 1.1 sliced the planet open and left you looking at stars. It is only pulled in
  // when it has to be, because a very small near plane costs depth precision everywhere else.
  var wantNear = Math.min(0.1, Math.max(0.02, (camDist - 1) * 0.4));
  if (Math.abs(camera.near - wantNear) > wantNear * 0.15){ camera.near = wantNear; camera.updateProjectionMatrix(); }

  if (selected && selected.holder){
    selRing.position.copy(selected.pos);
    var sz = (selected._cw || CARD_W * selected.size * zoomBoost) * 1.2; selRing.scale.set(sz, sz, 1);
    selRing.visible = visibleNormal(selected) > 0 && eventOnScreen(selected);
  } else selRing.visible = false;
  ctxRings.forEach(function(r, i){
    var e = ctxEls[i];
    if (!e || !e.holder){ r.visible = false; return; }
    r.position.copy(e.pos);
    var s2 = CARD_W * e.size * zoomBoost * 1.3; r.scale.set(s2, s2, 1);
    r.visible = visibleNormal(e) > 0 && eventOnScreen(e);
  });

  updateHotZones();
  updateSunLight();
  pickSkyLabels();
  renderer.render(scene, camera);
  // one line: what is on screen out of what is in the window. The rest was true and nobody read it.
  document.getElementById('count').innerHTML = MONTHLY
    ? monthSelection.events.length+' MONTHLY RECORDS · '+monthSelection.countries+' COUNTRIES<br>12+ HIGH-INCOME · 3+ OTHERS · COVERAGE INCOMPLETE'
    :
    (windowTotal > list.length ? 'TOP ' + list.length + ' OF ' + windowTotal + ' — ZOOM IN FOR MORE' : list.length + ' EVENT' + (list.length === 1 ? '' : 'S') + ' THIS MONTH');
}

function pick(mx, my){
  var best=null,bestD=Infinity;
  visibleEvents().forEach(function(e){
    if(e._sx==null) return;
    var dx=Math.abs(e._sx-mx),dy=Math.abs(e._sy-my);
    if(dx>Math.max(12,e._hw||0) || dy>Math.max(12,e._hh||0)) return;
    var d=dx/Math.max(12,e._hw||0)+dy/Math.max(12,e._hh||0);
    if(d<bestD){bestD=d;best=e;}
  });
  return best;
}
function spanYears(e){ return e.t1 - e.t0; }
function dayOrdinal(iso){
  var t = TIME.parseISO(iso);
  return Number.isFinite(t) ? Math.round(TIME.toDay(t)) : null;
}
var MEANWHILE_MAX = 6, MEANWHILE_APART_KM = 1200, MEANWHILE_DAYS = 3;
var meanwhileCache = { key:null, list:[] };
function contextFor(e){
  if(MONTHLY) return [];
  // "Meanwhile": what else happened on the very same day, in other parts of the world. The anchor is the
  // event's date — for something that ran for months or years, the day it began. Picks are the biggest events of
  // that day, spread out so no two stand within MEANWHILE_APART_KM of each other or of the event itself; when the
  // day has fewer than three, events one to three days either side fill in, each labelled with its gap. Nothing
  // further away in time is ever shown: a two-year overlap is not "at the same time".
  var key = e.id + '|' + EVENTS.length + '|' + Math.floor(TIME.toDay(presentTime())) + '|' + Object.keys(off).filter(function(k){ return off[k]; }).join(',');
  if (meanwhileCache && meanwhileCache.key === key) return meanwhileCache.list;
  var out = [];
  var day0 = e.datePrecision === 'day' ? dayOrdinal(e.date) : null;
  if (day0 != null){
    var cands = [];
    for (var i = 0; i < EVENTS.length; i++){
      var o = EVENTS[i];
      if (o.id === e.id || o.slug === e.slug || !o.date || o.datePrecision !== 'day' || !eligibleEvent(o) || off[o.cat]) continue;
      var od = dayOrdinal(o.date); if (od == null) continue;
      var gap = od - day0; if (gap < -MEANWHILE_DAYS || gap > MEANWHILE_DAYS) continue;
      if (kmApart(e, o) < MEANWHILE_APART_KM) continue;
      cands.push({ e:o, gap:gap, score:(gap === 0 ? 100 : 0) + o.w * 10 + (photoFor(o) ? 3 : 0) + (o.date === e.date ? 0 : -Math.abs(gap)) });
    }
    cands.sort(function(a, b){ return b.score - a.score; });
    var sameDay = 0;
    for (var c = 0; c < cands.length && out.length < MEANWHILE_MAX; c++){
      var x = cands[c];
      if (x.gap !== 0 && (sameDay >= 3 || x.e.w < 3 || out.length >= 5)) break;   // neighbouring days fill in only when the day is thin, and only with events that matter
      var crowded = false;
      for (var p = 0; p < out.length; p++) if (kmApart(out[p], x.e) < MEANWHILE_APART_KM){ crowded = true; break; }
      if (crowded) continue;
      x.e._gap = x.gap;
      out.push(x.e);
      if (x.gap === 0) sameDay++;
    }
  }
  meanwhileCache = { key:key, list:out };
  return out;
}

// ---------- panel ----------
function tinyDesc(e){
  // the first sentence or two of the lead, at most ~220 characters; curated rows are already short
  var d = String(e.desc || '').replace(/\u00a0/g, ' ');
  var parts = d.split(/(?<=[a-z0-9\)])\.\s+(?=[A-Z])/);
  var out = parts[0] || '';
  if (parts[1] && (out + '. ' + parts[1]).length <= 220) out += '. ' + parts[1];
  if (out.length > 240) out = out.slice(0, 240).replace(/\s+\S*$/, '') + '…';
  return out.replace(/[.\s]*$/, '') + (out.length && !/…$/.test(out) ? '.' : '');
}
function openPanel(e){
  if (!e || !eligibleEvent(e) || MONTHLY && !inView(e,nowT,WINDOWS[wi])) return false;
  var changedSelection = selected !== e;
  if (changedSelection){ cancelFootage(); navigationGeneration++; ANIMS.length = 0; }
  selected = e;
  if (changedSelection){
    if (playDir) setPlayDir(0);
    if (e.t0 < ERAS[0].from){ setMode('all', e.t0); selected = e; }
    if(!MONTHLY){ nowT = boundedTime(e.t0); wi = windowIndexFor(nowT); }
    syncHeader(); placeHandle();
  }
  setSkyDate(dateOfNow());
  bindWindow(); render();
  if (changedSelection) resetTicker();
  document.getElementById('tip').classList.remove('on');
  // pin the event and its same-day partners onto the globe, then lay out
  var p = document.getElementById('panel');
  var ctxEls = contextFor(e);
  var when = whenLabel(e);
  var html = '<button class="pclose" id="pclose" aria-label="Close">✕</button>';
  html += '<div class="pcat"><img src="' + ICON_URL[e.cat] + '" alt="">' + CATS[e.cat].label + '</div>';
  html += '<h2 id="selectedEventHeading" tabindex="-1">' + e.title + '</h2>';
  var im = photoFor(e, true), md = mediaFor(e, true);
  var footageMedia = md && md.kind === 'video' && md.autoplayApproved && md.mediaRole === 'contemporaneous' && Number.isFinite(TIME.parseISO(md.mediaDate)) && TIME.parseISO(md.mediaDate) <= presentTime() ? md : null;
  // the hero: the clip (or the photo, kept moving) magnified
  var centre = md
    ? (md.kind === 'video' ? (footageMedia ? '<div id="footageScreen"></div>' : '<div class="imgslot">Recording unavailable at this date</div>')
                           : (im ? '<img class="kb" src="' + IMG_DIR + im.file + '" alt="">' : '') + '<audio src="' + MEDIA_DIR + md.file + '" controls preload="metadata"></audio>')
    : im ? '<img class="kb" src="' + IMG_DIR + im.file + '" alt="">' : MONTHLY ? '' : '<div class="imgslot"><img src="' + ICON_URL[e.cat] + '" alt="" style="width:44px;height:44px;opacity:.7"></div>';
  var credit = (md ? (md.title ? md.title + ' · ' : '') + (md.author ? md.author + ' · ' : '') + '<a href="' + (md.filePage || md.source || '#') + '" target="_blank" rel="noopener">' + (md.license || 'source') + '</a>'
                   : im ? (im.author ? im.author + ' · ' : '') + '<a href="' + im.filePage + '" target="_blank" rel="noopener">' + (im.license || 'Commons') + '</a>' : '');
  if(centre)html += '<div class="hero">' + centre + '</div>';
  if(MONTHLY && footageMedia) html += '<section class="event-controls" aria-label="Selected event playback"><p><strong>Event playback</strong> · <span id="eventClock">0:00</span></p><div class="event-buttons"><button id="eventRewind" type="button" aria-label="Play event backward">◀ Reverse</button><button id="eventPlay" type="button" aria-label="Play event">▶ Play</button><button id="eventForward" type="button" aria-label="Play event forward">Forward ▶</button></div><label>Clip position<input id="eventSeek" type="range" min="0" max="'+Number(footageMedia.seconds||1)+'" step="0.05" value="0"></label><label>Clip speed<select id="eventSpeed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><p id="eventAudioStatus" role="status"></p><p class="coverage-note">'+monthLabel(nowT)+' stays fixed. Close this event to resume monthly browsing.</p></section>';
  if (md && md.licenseUrl) credit += ' · <a href="' + md.licenseUrl + '" target="_blank" rel="noopener">License</a>';
  if (credit) html += '<div class="mcredit">' + credit + '</div>';
  if (im && (!md || md.kind !== 'video')) html += '<div class="photo-date">Photo: ' + im.photoDate + ' · ' + im.photoRole + ' · ' + im.location + '</div>';
  if (md) html += '<div class="photo-date">Recording: ' + md.mediaDate + ' · ' + md.mediaRole + ' · ' + md.location + '<details><summary>Recording notes</summary>' + md.notes + '<br>' + md.changes + '</details></div>';
  html += '<div class="pmeta">' + when + (e.endDate ? ' – ' + (e.endPrecision === 'year' ? yearLabel(e.end) : e.endPrecision === 'month' ? monthLabel(fracOfDate(e.endDate)) : dayLabel(e.endDate)) : '') + (e.who ? '<br>BY ' + e.who : '') + '<br>' + e.place + '</div>';
  if (e.dateUncertain) html += '<div class="photo-date">Date precision is uncertain in the source record.</div>';
  if (MONTHLY) html += '<div class="photo-date">Mapped country: '+(e.monthCountry || countryFor(e.lat,e.lon) || 'unresolved')+'. The month shows when this event began.</div>';
  else if (e.datePrecision === 'day') html += '<div class="photo-date">Event time of day unavailable; the sky starts at 00:00 UTC.</div>';
  if (e.metadata.monthlyReview && e.metadata.monthlyReview.locationPrecision === 'approximate-city') html += '<div class="photo-date">Approximate city location. Sources confirm the city, not the exact venue.</div>';
  html += '<p class="pdesc">' + tinyDesc(e) + '</p>';
  if(MONTHLY && e.metadata.monthlyReview && e.metadata.monthlyReview.source){
    var reviewedSource=e.metadata.monthlyReview.source;
    html += '<a class="plink" target="_blank" rel="noopener" href="'+reviewedSource.url+'">Source: '+reviewedSource.title+'</a><br><br>';
  }
  else if(MONTHLY) html += '<p class="coverage-note">Imported catalog record. Its exact headline, date and location still need independent source review.</p>';
  html += '<a class="plink" target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/' + e.slug + '">Read more →</a>';
  // the events standing on the same spot, which the "+N" chip on the globe counts. Biggest first, so the list
  // opens with the ones a reader is most likely to have been looking for.
  if (e.folded && e.folded.length){
    var here = e.folded.slice().sort(function(a, b){ return (b.w - a.w) || (b.t0 - a.t0); });
    html += '<div class="concurrent"><p>' + here.length + ' more event' + (here.length === 1 ? '' : 's') + ' within ' + FOLD_KM + ' km</p><div class="crow">';
    here.forEach(function(o){
      var th = photoFor(o) ? '<img class="kb" src="' + IMG_DIR + photoFor(o).file + '" alt="">' : '<img class="ic" src="' + ICON_URL[o.cat] + '" alt="">';
      html += '<button class="nb" data-event="' + encodeURIComponent(o.stableId) + '">' + th + '<b>' + o.title + '</b><span>' + o.place + ' · ' + (o.date ? dayLabel(o.date) : yearLabel(o.start)) + '</span></button>';
    });
    html += '</div></div>';
  }
  // meanwhile: the same day, elsewhere on the globe — "while this was happening here, that was happening there".
  // Place leads each row, so the pairing reads as geography; the same events are lit up on the globe.
  if (ctxEls.length){
    var began = spanYears(e) >= 45 / 365 || e.endDate;
    html += '<div class="concurrent meanwhile"><p>' + (began ? 'The day it began, elsewhere' : 'Meanwhile, elsewhere') + ' · ' + dayLabel(e.date) + '</p>';
    ctxEls.forEach(function(o){
      var thumb = photoFor(o) ? '<img class="kb" src="' + IMG_DIR + photoFor(o).file + '" alt="">' : '<img class="ic" src="' + ICON_URL[o.cat] + '" alt="">';
      var gapText = o._gap === 0 ? 'same day' : Math.abs(o._gap) + (Math.abs(o._gap) === 1 ? ' day ' : ' days ') + (o._gap > 0 ? 'later' : 'earlier');
      html += '<button class="mw" data-event="' + encodeURIComponent(o.stableId) + '">' + thumb + '<span class="mwt">' + (o.place ? '<em>' + o.place + '</em>' : '') + '<i>' + gapText + '</i><b>' + o.title + '</b></span></button>';
    });
    html += '</div>';
  }
  if (FOOTAGE && FOOTAGE.live.video.parentNode) FOOTAGE.live.video.parentNode.removeChild(FOOTAGE.live.video);
  p.innerHTML = html;
  p.classList.add('on');
  if(changedSelection)p.scrollTop=0;
  writeHash();
  document.getElementById('pclose').onclick = closePanel;
  Array.prototype.forEach.call(p.querySelectorAll('.ew, .nb, .mw'), function(b){
    b.onclick = function(){ selectEvent(decodeURIComponent(b.dataset.event)); };
  });
  if (footageMedia) enterFootage(e, footageMedia);
  if(MONTHLY){ showSpeed(); syncEventSound(); }
  resize();
  return true;
}
function selectEvent(eventOrId){
  var e=typeof eventOrId==='string' ? EVENTS.find(function(event){return event.stableId===eventOrId;}) : eventOrId;
  if(!e || !Number.isFinite(e.lat) || !Number.isFinite(e.lon)) return false;
  // Commit the user's selection before flying. A drag or second click may cancel
  // the camera tween, but must never silently discard the event they chose.
  if(!openPanel(e)) return false;
  var heading=document.getElementById('selectedEventHeading');
  if(heading && heading.focus)heading.focus({preventScroll:true});
  flyTo(e);
  return true;
}
function closePanel(){
  cancelFootage(); silenceTransportSound(); navigationGeneration++; ANIMS.length = 0; pendingEventHash = null;
  selected = null; hovered = null; document.getElementById('tip').classList.remove('on');
  setSkyDate(dateOfNow());
  bindWindow();                            // unpin
  document.getElementById('panel').classList.remove('on');
  syncHeader(); placeHandle(); resize(); writeHash();
  if(MONTHLY){showSpeed();syncEventSound();}
}

// ---------- live cards: a video clip plays (muted) inside its hologram, so a hurricane loops on the globe ----------
// The few biggest on-screen cards with a video clip get a canvas texture repainted from the video every frame.
var LIVE = {}, LIVE_MAX = 4, FOOTAGE = null, clipFrameSeconds = 0;
function liveMax(){ return camDist < 2 ? 8 : LIVE_MAX; }
var liveClips = Object.keys(MEDIA).some(function(k){ return MEDIA[k].kind === 'video'; });
function paintLiveFrame(L){
  if (!L.on || L.video.readyState < 2) return;
  L.paint(L.video, L.canvas); L.tex.needsUpdate = true;
  var e = L.event, u = e.holder && e.holder.userData;
  if (u && u.bound === e && mediaFor(e) && clipIdentity(e, mediaFor(e)) === L.key){
    u.card.material.map = L.tex; u.card.material.needsUpdate = true;
  }
  render();
}
function liveFor(e, media){
  var key = clipIdentity(e, media), L = LIVE[key];
  if (L) return L;
  var v = document.createElement('video');
  v.muted = true; v.loop = false; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
  if (media.poster) v.poster = MEDIA_DIR + media.poster;
  v.setAttribute('aria-label', media.title || 'Event footage');
  v.src = MEDIA_DIR + media.file;
  var canvas = document.createElement('canvas'), tex = new THREE.CanvasTexture(canvas);
  L = { key:key, event:e, media:media, video:v, canvas:canvas, tex:tex, paint:cardTexture(e, 'painter'), on:false, position:playDir<0?Number(media.seconds)||0:0, duration:Number(media.seconds) || 0 };
  L.seeker = window.GTMediaTransport.createSeeker(v, {
    onFrame:function(){ paintLiveFrame(L); },
    onError:function(){ if (FOOTAGE && FOOTAGE.live === L){ setPlayDir(0); var note = document.getElementById('footageNote'); if(note) note.textContent = 'This recording could not be decoded. Return to history to continue.'; } }
  });
  v.addEventListener('loadedmetadata', function(){ if(Number.isFinite(v.duration)) L.duration = v.duration; if(FOOTAGE && FOOTAGE.live === L) showSpeed(); });
  LIVE[key] = L; return L;
}
function cancelFootage(){
  if (!FOOTAGE) return;
  if(FOOTAGE.player) FOOTAGE.player.dispose();
  var L = FOOTAGE.live; FOOTAGE = null; L.on = false; L.seeker.cancel();
  playDir = 0; playing = false; clipFrameSeconds = 0;
  showSpeed();
}
function enterFootage(e, media){
  var same = FOOTAGE && FOOTAGE.event === e && FOOTAGE.live.key === clipIdentity(e, media);
  if(MONTHLY && same && FOOTAGE.player){var existingScreen=document.getElementById('footageScreen');if(existingScreen)existingScreen.appendChild(FOOTAGE.live.video);bindEventControls(FOOTAGE);showSpeed();return;}
  if (!same){
    cancelFootage();
    var L = liveFor(e, media);
    L.position = 0; L.on = true;
    FOOTAGE = {event:e, live:L, recordingDate:media.mediaDate};
    if(!MONTHLY){nowT = boundedTime(TIME.parseISO(media.mediaDate)); wi = windowIndexFor(nowT);}
    playDir = 0; lastPlayDir = 1; playing = false; playLast = clockNow(); clipFrameSeconds = 0;
    setSkyDate(dateOfNow()); bindWindow(); syncHeader(); placeHandle(); writeHash();
  }
  var screen = document.getElementById('footageScreen');
  if (screen) screen.appendChild(FOOTAGE.live.video);
  if(MONTHLY){
    var held=FOOTAGE; held.live.seeker.cancel();
    held.player=window.GTEventPlayer.create(held.live.video,{transport:window.GTMediaTransport,hasAudio:media.hasAudio,duration:held.live.duration,onFrame:function(){paintLiveFrame(held.live);},onState:function(state){if(FOOTAGE!==held)return;held.live.position=state.position;held.live.duration=state.duration;playDir=state.direction;playing=!!playDir;showSpeed();}});
    held.player.setVolume(volume);held.player.setSound(SOUND.on);
    bindEventControls(held);
    showSpeed();syncEventSound();return;
  }
  FOOTAGE.live.on = true; FOOTAGE.live.seeker.seek(FOOTAGE.live.position);
  silenceTransportSound(); showSpeed();
}
function bindEventControls(held){
  document.getElementById('eventPlay').onclick=function(){setPlayDir(playDir?0:1);};
  document.getElementById('eventRewind').onclick=function(){setPlayDir(-1);};
  document.getElementById('eventForward').onclick=function(){setPlayDir(1);};
  document.getElementById('eventSeek').oninput=function(){held.player.seek(+this.value);};
  document.getElementById('eventSpeed').value=held.player.state().rate;
  document.getElementById('eventSpeed').onchange=function(){held.player.setRate(+this.value);};
}
function exitFootage(retreat){
  if (!FOOTAGE) return;
  var direction = playDir, from = camDist;
  cancelFootage(); closePanel();
  if (retreat){
    var began = clockNow(), to = Math.max(3.9, Math.min(6, from * 1.8));
    ANIMS.push(function(now){ var t = Math.max(0, Math.min(1, (now - began) / 1500)), ease = t * t * (3 - 2 * t); setObserverDistance(from + (to - from) * ease); bindNow(true); render(); return t >= 1; });
  }
  setPlayDir(MONTHLY?0:direction);
}
function footageState(){
  var L = FOOTAGE && FOOTAGE.live;
  if(FOOTAGE && FOOTAGE.player) return Object.assign({phase:'footage',month:MONTHLY.monthKey(nowT,TIME),eventId:L.event.stableId,recordingDate:FOOTAGE.recordingDate},FOOTAGE.player.state());
  return {phase:L?'footage':'history',position:L?L.position:null,duration:L?L.duration:null,direction:playDir,rate:SPEEDS[speedIx],lastDirection:lastPlayDir,eventId:L?L.event.stableId:null,eventDate:L?L.event.date:null,recordingDate:FOOTAGE?FOOTAGE.recordingDate:null,error:L&&L.seeker.error()?L.seeker.error().message:null,seekPending:Object.keys(LIVE).some(function(k){return LIVE[k].on && LIVE[k].seeker.pending();})};
}
function updateLive(){
  var cands = [], seconds = clipFrameSeconds; clipFrameSeconds = 0;
  for (var i = 0; i < shown.length; i++){
    var e = shown[i], md = mediaFor(e);
    if (!md || md.kind !== 'video' || e._sx == null || !e.holder || !e.holder.visible) continue;
    cands.push({event:e, media:md});
  }
  cands.sort(function(a, b){ return (b.event._px || 0) - (a.event._px || 0); });
  var keep = {};
  if (FOOTAGE) keep[FOOTAGE.live.key] = true;
  cands.slice(0, liveMax()).forEach(function(candidate){
    var L = liveFor(candidate.event, candidate.media); keep[L.key] = true; L.on = true;
    if (!FOOTAGE || FOOTAGE.live !== L){
      L.position = window.GTMediaTransport.advance(L.position, L.duration, FOOTAGE ? 0 : seconds, window.GTMonthly?1:playDir, window.GTMonthly?1:SPEEDS[speedIx], !!window.GTMonthly).position;
      L.seeker.seek(L.position);
    }
  });
  if (FOOTAGE){ FOOTAGE.live.on = true; if(!FOOTAGE.player) FOOTAGE.live.seeker.seek(FOOTAGE.live.position); }
  Object.keys(LIVE).forEach(function(key){
    var L = LIVE[key];
    if (!keep[key]){
      L.on = false; L.seeker.cancel();
      var e = L.event, u = e.holder && e.holder.userData;
      if (u && u.bound === e && u.card.material.map === L.tex){ u.card.material.map = u.fallbackMap; u.card.material.needsUpdate = true; }
    }
  });
}
window.__gtFootage = {
  state:footageState,
  decoders:function(){return Object.keys(LIVE).map(function(k){var L=LIVE[k];return {key:k,on:L.on,position:L.position,decoder:L.seeker.state()};});},
  settle:function(){
    return Promise.all(Object.keys(LIVE).filter(function(k){return LIVE[k].on;}).map(function(k){return LIVE[k].seeker.settle();})).then(function(){Object.keys(LIVE).forEach(function(k){if(LIVE[k].on)paintLiveFrame(LIVE[k]);});render();return footageState();});
  }
};

// ---------- sound: clips get louder as their card grows on screen ----------
// Each event with a clip gets an <audio> routed through a gain + stereo panner. Every frame the visible cards are
// ranked by on-screen width; the three biggest play, gain follows width (quiet when small, full at ~300 px),
// pan follows screen x. Everything else is paused. Browsers require a click before audio starts: the Sound button.
var SOUND = { on:false, ctx:null, nodes:{}, active:[], ambient:null };
// Space ambience, generated live (no audio file, nothing licensed): three detuned sine voices a fifth apart through
// a slow filter, plus a breathing sub. It swells as you pull away from Earth and ducks under any event that is
// playing, so up close you hear the event and far out you hear the space around it.
function buildAmbient(){
  var c = SOUND.ctx, out = c.createGain(); out.gain.value = 0; out.connect(masterGain());
  var filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 700; filter.Q.value = 0.6; filter.connect(out);
  var voices = [], base = [55, 82.5, 110, 164.66];         // A1, E2, A2, E3 — an open fifth, no melody to tire of
  for (var i = 0; i < base.length; i++){
    var osc = c.createOscillator(); osc.type = i > 1 ? 'sine' : 'triangle'; osc.frequency.value = base[i];
    var g = c.createGain(); g.gain.value = i === 0 ? 0.5 : 0.22 - i * 0.03;
    var lfo = c.createOscillator(); lfo.frequency.value = 0.03 + i * 0.017;   // very slow drift, never in step
    var lfoGain = c.createGain(); lfoGain.gain.value = base[i] * 0.004;
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency); lfo.start();
    osc.connect(g); g.connect(filter); osc.start();
    voices.push(osc);
  }
  var swell = c.createOscillator(); swell.frequency.value = 0.05;             // the pad breathes over ~20 s
  var swellGain = c.createGain(); swellGain.gain.value = 180;
  swell.connect(swellGain); swellGain.connect(filter.frequency); swell.start();
  return { out:out, filter:filter };
}
function updateAmbient(eventLoudness){
  if (!SOUND.on || !SOUND.ctx) return;
  if (!SOUND.ambient) SOUND.ambient = buildAmbient();
  // 0 at the surface, 1 far out; an event playing close by pushes the ambience back down
  var far = Math.max(0, Math.min(1, (camDist - 2.2) / 7));
  var level = far * far * 0.30 * (1 - 0.85 * eventLoudness);
  SOUND.ambient.out.gain.setTargetAtTime(level, SOUND.ctx.currentTime, 0.9);
  SOUND.ambient.filter.frequency.setTargetAtTime(420 + far * 900, SOUND.ctx.currentTime, 1.2);
}
// Now and then, far out, a short phrase over the drone: a slow rising line on an organ-like tone, written for
// this and nothing else. It plays only when the Earth is small in the frame and no event is audible, roughly once
// a minute, so most of the time space is silent.
var MOTIF = [[220, 0], [261.63, 2.0], [329.63, 4.0], [392.0, 6.2], [440, 8.0], [329.63, 11.5]];   // A3 C4 E4 G4 A4 E4, seconds
var motifTimer = null, motifLastFar = 0;
function playMotif(){
  if(FOOTAGE || playDir<=0)return;
  var c = SOUND.ctx, t0 = c.currentTime;
  var out = c.createGain(); out.gain.value = 0.0; out.connect(masterGain());
  var far = Math.max(0, Math.min(1, (camDist - 4) / 8));
  SOUND.motifOut = out;
  out.gain.setTargetAtTime(0.10 * far, t0, 1.5);
  out.gain.setTargetAtTime(0, t0 + 13.5, 2.5);
  for (var i = 0; i < MOTIF.length; i++){
    var freq = MOTIF[i][0], at = t0 + MOTIF[i][1];
    var voice = c.createGain(); voice.gain.value = 0; voice.connect(out);
    var partials = [1, 2, 3, 4], levels = [0.5, 0.25, 0.12, 0.05];
    for (var p = 0; p < partials.length; p++){
      var osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq * partials[p];
      var g = c.createGain(); g.gain.value = levels[p]; osc.connect(g); g.connect(voice);
      osc.start(at); osc.stop(at + 6);
    }
    voice.gain.setTargetAtTime(1, at, 0.9);           // slow organ swell
    voice.gain.setTargetAtTime(0, at + 3.2, 1.2);
  }
  setTimeout(function(){ out.disconnect(); }, 18000);
}
function scheduleMotif(){
  clearTimeout(motifTimer);
  motifTimer = setTimeout(function(){
    if (SOUND.on && SOUND.ctx && camDist > 5 && !anyEventAudible()) playMotif();
    scheduleMotif();
  }, 45000 + Math.random() * 45000);
}
function anyEventAudible(){
  var keys = Object.keys(SOUND.nodes);
  for (var i = 0; i < keys.length; i++){ var n = SOUND.nodes[keys[i]]; if (n.playing && n.gain.gain.value > 0.05) return true; }
  return false;
}
var SOUND_MAX = 3, SOUND_QUIET_PX = 45, SOUND_FULL_PX = 220;   // card width on screen: silent below, full above (a big card at max zoom is ~280 px)
// Everything audible — the clips and the space pad — runs through one gain, so the slider in the header is a
// real volume control rather than a mute switch pretending to be one.
var volume = 0.7;
function masterGain(){
  if (!SOUND.master){
    SOUND.master = SOUND.ctx.createGain();
    SOUND.master.gain.value = volume;
    SOUND.master.connect(SOUND.ctx.destination);
  }
  return SOUND.master;
}
function setVolume(v){
  volume = Math.max(0, Math.min(1, v));
  if(MONTHLY && FOOTAGE && FOOTAGE.player) FOOTAGE.player.setVolume(volume);
  if (SOUND.ctx && SOUND.master) SOUND.master.gain.setTargetAtTime(volume, SOUND.ctx.currentTime, 0.08);
  try { localStorage.setItem('gt-vol', String(Math.round(volume * 100))); } catch (err) {}
}
function soundNode(e){
  var n = SOUND.nodes[e.slug];
  if (n) return n;
  var md = mediaFor(e);
  var el = document.createElement(md.kind === 'video' ? 'video' : 'audio');
  el.src = MEDIA_DIR + md.file; el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
  var src = SOUND.ctx.createMediaElementSource(el), gain = SOUND.ctx.createGain(), pan = SOUND.ctx.createStereoPanner ? SOUND.ctx.createStereoPanner() : null;
  gain.gain.value = 0;
  var out = masterGain();
  if (pan){ src.connect(gain); gain.connect(pan); pan.connect(out); } else { src.connect(gain); gain.connect(out); }
  n = { el:el, gain:gain, pan:pan, playing:false };
  SOUND.nodes[e.slug] = n; return n;
}
function silenceTransportSound(){
  Array.prototype.forEach.call(document.querySelectorAll('#panel audio, #panel video'),function(el){el.pause();});
  if (!SOUND || !SOUND.ctx) return;
  clearTimeout(motifTimer);
  if(SOUND.motifOut)SOUND.motifOut.gain.value=0;
  Object.keys(SOUND.nodes).forEach(function(k){var n=SOUND.nodes[k];n.el.pause();n.playing=false;n.gain.gain.value=0;});
  if(SOUND.ambient) SOUND.ambient.out.gain.setTargetAtTime(0,SOUND.ctx.currentTime,0.03);
}
function updateSound(){
  if(MONTHLY) return;
  if (!SOUND.on || !SOUND.ctx) return;
  if (FOOTAGE || playDir <= 0){ silenceTransportSound(); return; }
  if (!shown.length){ silenceTransportSound(); return; }
  var cands = [];
  for (var i = 0; i < shown.length; i++){
    var e = shown[i];
    if (!mediaFor(e) || !mediaFor(e).hasAudio || e._sx == null) continue;
    cands.push(e);
  }
  if (selected && mediaFor(selected) && mediaFor(selected).hasAudio && cands.indexOf(selected) < 0) cands.push(selected);
  cands.sort(function(a, b){ return (b._px || 0) - (a._px || 0); });
  var keep = cands.slice(0, SOUND_MAX), t = SOUND.ctx.currentTime;
  keep.forEach(function(e){
    var n = soundNode(e), px = e._px || 0;
    var loud = Math.max(0, Math.min(1, (px - SOUND_QUIET_PX) / (SOUND_FULL_PX - SOUND_QUIET_PX)));
    if (selected && selected.id === e.id) loud = 1;
    n.gain.gain.setTargetAtTime(Math.pow(loud, 1.6), t, 0.25);          // perceived loudness curve
    if (n.pan && e._sx != null) n.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, (e._sx / W - 0.5) * 1.6)), t, 0.25);
    if (!n.playing){ n.playing = true; n.el.play().catch(function(){ n.playing = false; }); }
  });
  var loudest = 0;
  keep.forEach(function(e){ var n = SOUND.nodes[e.slug]; if (n) loudest = Math.max(loudest, n.gain.gain.value); });
  updateAmbient(loudest);
  Object.keys(SOUND.nodes).forEach(function(slug){
    var n = SOUND.nodes[slug];
    if (n.playing && !keep.some(function(e){ return e.slug === slug; })){
      n.gain.gain.setTargetAtTime(0, t, 0.2);
      setTimeout(function(){ if (n.gain.gain.value < 0.02 && n.playing){ n.el.pause(); n.playing = false; } }, 600);
    }
  });
}
function setSound(on){
  if(MONTHLY){
    SOUND.on=!!on;
    if(FOOTAGE && FOOTAGE.player) FOOTAGE.player.setSound(SOUND.on);
    syncEventSound();return;
  }
  SOUND.on = on;
  var b = document.getElementById('soundBtn');
  // the button is an icon: the CSS shows the waves when it is on and the cross when it is off
  if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (on){
    if (!SOUND.ctx) SOUND.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (SOUND.ctx.state === 'suspended') SOUND.ctx.resume();
    updateSound();
    scheduleMotif();
  } else {
    clearTimeout(motifTimer);
    Object.keys(SOUND.nodes).forEach(function(k){ var n = SOUND.nodes[k]; n.el.pause(); n.playing = false; n.gain.gain.value = 0; });
    if (SOUND.ambient) SOUND.ambient.out.gain.setTargetAtTime(0, SOUND.ctx.currentTime, 0.3);
  }
}
function syncEventSound(){
  if(!MONTHLY) return;
  var state=FOOTAGE && FOOTAGE.player && FOOTAGE.player.state(), button=document.getElementById('soundBtn'), range=document.getElementById('volRange');
  var reason=state ? state.audioReason : 'Select an event with an archival clip to hear its sound.';
  if(button){button.disabled=!state || !state.audioAvailable;button.setAttribute('aria-pressed',SOUND.on && !!state && state.audioAvailable ? 'true':'false');button.title=reason;button.setAttribute('aria-label',SOUND.on?'Mute selected event':'Enable selected event sound');}
  if(range) range.disabled=!state || !state.audioAvailable;
  var label=document.getElementById('eventAudioStatus');if(label)label.textContent=state && state.error ? state.error : reason;
  var status=document.getElementById('soundStatus');if(status)status.textContent=state ? reason : 'Event audio only';
}
// Sharing a moment: the URL hash already carries the mode, the month and the open event, so the address bar is
// the share button. The header button is gone — it was taking a slot next to the categories to do what Cmd-L does.
window.__cgtSound = SOUND; window.__cgtEvents = EVENTS; window.__cgtShown = function(){ return shown; }; window.__cgtImages = IMAGES; window.__cgtOpen = openPanel; window.__cgtContext = contextFor; window.__cgtTickNext = function(){ tickerIndex++; showTicker(); }; window.__cgtSky = function(){ return SKY_ON_SCREEN; }; window.__cgtMotif = playMotif; window.__cgtFly = function(e){ flyTo(e, function(){ openPanel(e); }); }; window.__cgtGotoT = goToMoment; window.__cgtPhotosOnly = function(on, scale){ PHOTOS_ONLY = !!on; CARD_SCALE = scale || 1; bindNow(true); render(); }; window.__cgtView = function(lat, lon, dist){ setObserverMode('orbit'); orbitQuat.copy(targetQuat(lat, lon)); if (dist) camDist = Math.max(minCamDist, Math.min(140, dist)); bindNow(true); render(); }; window.__cgtFrame = function(ms){ VIRTUAL_MS = (VIRTUAL_MS == null ? performance.now() : VIRTUAL_MS) + ms; if (playDir && playLast > VIRTUAL_MS) playLast = VIRTUAL_MS - ms; tickOnce(); render(); }; window.__cgtFlick = function(vx, vy){ velX = vx * 60; velY = (vy || 0) * 60; }; window.__cgtWheel = function(steps){ for (var i = 0; i < Math.abs(steps); i++) camDist = Math.max(minCamDist, Math.min(140, camDist * (steps > 0 ? 1.07 : 0.93))); bindNow(true); render(); }; window.__cgtZoom = function(d){ camDist = Math.max(minCamDist, Math.min(140, d)); bindNow(true); render(); }; window.__cgtSpin = function(e){ setObserverMode('orbit'); orbitQuat.copy(targetQuat(e.lat, e.lon)); syncObserver(); }; window.__cgtCam = function(){ return camDist.toFixed(2); }; window.__cgtNow = function(){ return WINDOWS[wi].end; }; window.__cgtGoto = function(y){ var i = WINDOWS.findIndex(function(w){ return Math.abs(w.end - y) < 0.05; }); if (i >= 0) setWindow(i); };   // debugging hooks
var soundBtn = document.getElementById('soundBtn');
if (soundBtn){
  soundBtn.onclick = function(){ setSound(!SOUND.on); };
}
var volRange = document.getElementById('volRange');
if (volRange){
  var savedVol = null;
  try { savedVol = localStorage.getItem('gt-vol'); } catch (err) {}
  if (savedVol != null) volRange.value = savedVol;
  volume = (+volRange.value) / 100;
  volRange.oninput = function(){
    setVolume((+volRange.value) / 100);
    if (!SOUND.on && volume > 0) setSound(true);          // reaching for the slider means you want to hear it
  };
}

// ---------- spin to ----------
function spinTo(e){ flyTo(e, null, camDist); }
// Going to an event: the globe turns so the place comes to the middle while the camera comes down to a viewing
// height (FLY_HEIGHT radii — about 4,000 km up, where a card is a picture and the country fills the frame), both
// eased together over a second and a half; then the panel opens. Pulling back up is the viewer's own scroll.
var FLY_HEIGHT = 1.62;
function flyTo(e, done, heightOverride){
  if(!e || !Number.isFinite(e.lat) || !Number.isFinite(e.lon)) return;
  if(MONTHLY) setPlayDir(0);
  var flightGeneration = ++navigationGeneration;
  setObserverMode('orbit'); velX = velY = 0;
  var from = orbitQuat.clone(), to = targetQuat(e.lat, e.lon);
  var d0 = camDist, d1 = heightOverride != null ? heightOverride : MONTHLY ? 2.05 : Math.max(minCamDist, Math.min(camDist, FLY_HEIGHT));
  var t0 = clockNow(), dur = Math.abs(d1 - d0) > 0.05 ? 1500 : 700;
  ANIMS.length = 0;                                    // a new flight replaces any flight under way
  ANIMS.push(function(t){
    if(flightGeneration !== navigationGeneration) return true;
    var k = Math.min(1, (t - t0) / dur);
    var ease = k < 0.5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2) / 2;
    orbitQuat.copy(from).slerp(to, ease); syncObserver();
    if (d1 !== d0){ camDist = d0 + (d1 - d0) * ease; bindNow(true); }
    render();
    if (k < 1) return false;
    if (done && flightGeneration === navigationGeneration) done();
    return true;
  });
  runAnims();
  bumpIdle();
}

var freeViewBtn=document.getElementById('freeViewBtn');
if(freeViewBtn) freeViewBtn.onclick=function(){setObserverMode(observerMode==='free'?'orbit':'free');};
var returnEarthBtn=document.getElementById('returnEarthBtn');
if(returnEarthBtn) returnEarthBtn.onclick=returnToEarth;
Array.prototype.forEach.call(document.querySelectorAll('[data-observer-axis]'),function(b){
  b.onclick=function(){var delta=[0,0,0];delta[+b.dataset.observerAxis]=+b.dataset.sign*Math.max(0.1,(camDist-1)*0.12);translateObserver(delta[0],delta[1],delta[2]);};
});
window.addEventListener('keydown',function(ev){
  if(observerMode!=='free' || /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
  if(/^(KeyW|KeyA|KeyS|KeyD|KeyQ|KeyE)$/.test(ev.code)){ev.preventDefault();observerKeys[ev.code]=true;}
});
window.addEventListener('keyup',function(ev){delete observerKeys[ev.code];});
window.addEventListener('blur',function(){observerKeys={};});
window.__cgtObserver={state:function(){syncObserver();return {mode:observerMode,position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),earthRadii:camDist,frame:'Earth-fixed X Greenwich, Y north, Z west',skyDate:skyDate&&skyDate.toISOString(),skyAvailable:skyAvailable};},mode:setObserverMode,move:translateObserver,returnEarth:returnToEarth,look:function(yaw,pitch){setObserverMode('free');camera.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw));camera.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),pitch));syncObserver();render();},bodies:function(){return bodyPositions;}};

// ---------- pointer ----------
var dragging = false, lastX = 0, lastY = 0, moved = 0, shifted = false;
var velX = 0, velY = 0, lastMoveT = 0, spinDir = 1;
var AX = new THREE.Vector3(1,0,0), AY = new THREE.Vector3(0,1,0), AZ = new THREE.Vector3(0,0,1);
var qTmp = new THREE.Quaternion(), qTmp2 = new THREE.Quaternion();
var touchPoints = {}, pinchDistance = 0;

canvas.addEventListener('pointerdown', function(ev){
  touchPoints[ev.pointerId]=[ev.clientX,ev.clientY];
  var points=Object.keys(touchPoints).map(function(id){return touchPoints[id];});
  if(points.length===2){pinchDistance=Math.hypot(points[0][0]-points[1][0],points[0][1]-points[1][1]);moved=100;velX=velY=0;canvas.setPointerCapture(ev.pointerId);return;}
  ANIMS.length=0; dragging = true; moved = 0; lastX = ev.clientX; lastY = ev.clientY; shifted = ev.shiftKey;
  velX = 0; velY = 0; lastMoveT = clockNow();
  canvas.classList.add('drag'); canvas.setPointerCapture(ev.pointerId); bumpIdle();
});
canvas.addEventListener('pointermove', function(ev){
  if(touchPoints[ev.pointerId]) touchPoints[ev.pointerId]=[ev.clientX,ev.clientY];
  var points=Object.keys(touchPoints).map(function(id){return touchPoints[id];});
  if(points.length===2){
    var distance=Math.hypot(points[0][0]-points[1][0],points[0][1]-points[1][1]);
    if(pinchDistance>0 && distance>0) setObserverDistance(camDist*pinchDistance/distance);
    pinchDistance=distance;moved=100;lastX=ev.clientX;lastY=ev.clientY;bindNow(true);render();return;
  }
  var rect = canvas.getBoundingClientRect();
  if (dragging){
    var dx = ev.clientX - lastX, dy = ev.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy); lastX = ev.clientX; lastY = ev.clientY;
    var k = Math.min(0.008,0.0042 * (camDist / 3.9));
    if(observerMode==='free'){
      var yaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-dx*0.003);
      var pitch=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-dy*0.003);
      camera.quaternion.premultiply(yaw).multiply(pitch); syncObserver(); render(); return;
    }
    if (shifted){
      qTmp.setFromAxisAngle(AZ, -dx * k); orbitQuat.premultiply(qTmp); syncObserver();
    } else {
      qTmp.setFromAxisAngle(AY, dx * k); qTmp2.setFromAxisAngle(AX, dy * k);
      orbitQuat.premultiply(qTmp).premultiply(qTmp2); syncObserver();
      var now = clockNow(), dt = Math.max(1, now - lastMoveT); lastMoveT = now;
      velX = 0.6 * velX + 0.4 * (dx * k) * (1000 / dt); velY = 0.6 * velY + 0.4 * (dy * k) * (1000 / dt);
    }
    render(); bumpIdle(); return;
  }
  var mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
  var hit = pick(mx, my);
  if (!hit){
    var sky = skyLabelAt(mx, my);
    if (sky !== hoveredSky){
      hoveredSky = sky;
      var stip = document.getElementById('tip');
      if (sky){
        var fact = SKYFACTS[sky.name] || '';
        var line = sky.kind === 'constellation' ? 'CONSTELLATION' : sky.kind.toUpperCase() + (sky.ly ? ' · ' + fmtLy(sky.ly) + ' AWAY — YOU SEE IT AS IT WAS ' + agoText(sky.ly) : '');
        stip.querySelector('.tt').textContent = sky.name + (fact ? ' — ' + fact : '');
        stip.querySelector('.ty').textContent = line;
        stip.style.left = sky._sx + 'px'; stip.style.top = (sky._sy + 44) + 'px';
        stip.classList.add('on'); canvas.style.cursor = 'help';
      } else if (!hovered){ stip.classList.remove('on'); canvas.style.cursor = ''; }
    }
    if (sky) return;
  } else if (hoveredSky){ hoveredSky = null; }
  if (hit !== hovered){
    hovered = hit;
    var tip = document.getElementById('tip');
    if (hit){
      tip.querySelector('.tt').textContent = hit.title;
      // say what the "+N" chip on this card means, in words, at the moment someone is looking at it
      var alsoHere = hit.folded && hit.folded.length
        ? ' · ' + hit.folded.length + ' MORE WITHIN ' + FOLD_KM + ' KM — CLICK TO SEE THEM'
        : '';
      tip.querySelector('.ty').textContent =
        whenLabel(hit) + ' · ' + hit.place.toUpperCase() + alsoHere;
      tip.style.left = hit._sx + 'px'; tip.style.top = hit._sy + 'px';
      tip.classList.add('on'); canvas.style.cursor = 'pointer';
    } else { tip.classList.remove('on'); canvas.style.cursor = ''; }
  }
});
function endDrag(ev){
  delete touchPoints[ev.pointerId];
  var remaining=Object.keys(touchPoints);
  if(remaining.length){lastX=touchPoints[remaining[0]][0];lastY=touchPoints[remaining[0]][1];moved=100;pinchDistance=0;return;}
  pinchDistance=0;
  if (!dragging) return;
  dragging = false; canvas.classList.remove('drag');
  if (clockNow() - lastMoveT > 80){ velX = 0; velY = 0; }   // held still before release: no throw, keep turning
  if (moved < 5){ velX = 0; velY = 0;
    var rect = canvas.getBoundingClientRect();
    var hit = pick(ev.clientX - rect.left, ev.clientY - rect.top);
    if (hit) selectEvent(hit); else closePanel();
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', function(){ touchPoints={};pinchDistance=0;dragging=false;velX=velY=0;canvas.classList.remove('drag'); });
canvas.addEventListener('pointerleave', function(){ hovered = null; document.getElementById('tip').classList.remove('on'); });
canvas.addEventListener('wheel', function(ev){
  ev.preventDefault();
  ANIMS.length=0; setObserverDistance(camDist * Math.exp(Math.max(-0.22,Math.min(0.22,ev.deltaY*0.001))));   // the floor comes from the Earth texture (see minCamDist)
  hovered = null; document.getElementById('tip').classList.remove('on');
  bindNow(true); render(); if (SOUND.on) updateSound();   // zooming does not stop the globe turning; it changes the mix
}, { passive:false });

// ---------- idle spin ----------
function bumpIdle(){ idle = false; clearTimeout(idleTimer); idleTimer = setTimeout(function(){ idle = true; }, 4500); }
var kb = { tex:null };
function kenBurns(t){
  // every photo card drifts and breathes a little (a still made to move); the selected one moves more
  var any = false;
  for (var i = 0; i < shown.length; i++){
    var e = shown[i];
    if (!e.holder || !e.holder.visible || e._sx == null || !photoFor(e)) continue;
    var tex = CARD_TEX[cardTextureKey(e)];
    if (!tex || tex === e.holder.userData.card.material.map && false) continue;
    if (tex !== e.holder.userData.card.material.map) continue;      // a live clip or glyph is showing instead
    var ph = (e.id * 0.61803) % 1 * Math.PI * 2, sel = selected && selected.id === e.id;
    var amp = sel ? 0.06 : 0.035, spd = sel ? 1 : 0.6;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    var z = (sel ? 0.82 : 0.88) + amp * 0.6 * Math.sin(t / 2600 * spd + ph);
    tex.repeat.set(z, z); tex.offset.set((1 - z) / 2 + amp * Math.sin(t / 3100 * spd + ph), (1 - z) / 2 + amp * Math.cos(t / 4300 * spd + ph));
    any = true;
  }
  return any;
}
function tick(){
  if (VIRTUAL_MS == null) tickOnce();                  // under a frozen clock the recorder steps the app itself
  requestAnimationFrame(tick);
}
function tickOnce(){
  runAnims(); tickTicker();
  var moving = MONTHLY ? false : kenBurns(clockNow()); tickPlay(clockNow()); if (selected || moving) render();
  if (!MONTHLY && updateLiveGlyphs(clockNow()) && !selected) render();
  if (SOUND.on) updateSound();
  if (liveClips){ updateLive(); if (!selected) render(); }
  var tickNow=clockNow(),seconds=observerTickLast==null ? 0 : Math.max(0,Math.min(0.1,(tickNow-observerTickLast)/1000));
  observerTickLast=tickNow; tickObserver(seconds);
  if(!dragging && observerMode==='orbit' && !ANIMS.length){
    if(Math.abs(velX)>1e-6) spinDir=velX<0?-1:1;
    var x=GTObserver.coast(velX,spinDir*spinSpeed*60,seconds),y=GTObserver.coast(velY,0,seconds);
    velX=x.velocity;velY=y.velocity;
    if(Math.abs(x.angle)>1e-8 || Math.abs(y.angle)>1e-8){
      qTmp.setFromAxisAngle(AY,x.angle);qTmp2.setFromAxisAngle(AX,y.angle);
      orbitQuat.premultiply(qTmp).premultiply(qTmp2);syncObserver();render();
    }
  }
}

// ---------- spin speed (left) and time playback (right) ----------
var spinSpeed = 0.00045;
var spinRange = document.getElementById('spinRange'), spinVal = document.getElementById('spinVal');
function spinFromSlider(v){ return v === 0 ? 0 : 0.00015 * Math.pow(1.03, v); }     // 0 .. ~0.0029 rad/frame; 30 -> 0.00036
function setSpin(v){
  spinSpeed = spinFromSlider(v);
  var secPerTurn = spinSpeed > 0 ? (2 * Math.PI / spinSpeed) / 60 : 0;
  spinVal.textContent = spinSpeed === 0 ? 'STILL' : 'ONE TURN\nIN ' + (secPerTurn >= 60 ? Math.round(secPerTurn / 60) + ' MIN' : Math.round(secPerTurn) + ' S');
  try { localStorage.setItem('gt-spin-v2', String(v)); } catch (e) {}
}
if (spinRange){
  var savedSpin = null; try { savedSpin = localStorage.getItem('gt-spin-v2'); } catch (e) {}   // 'STILL' unless the person chose otherwise
  if (savedSpin !== null) spinRange.value = savedSpin;
  spinRange.oninput = function(){ setSpin(+spinRange.value); };
  setSpin(+spinRange.value);
}
// Playback rate and direction are independent; every entry path shares the same bounds.
var SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4, 8, 16, 60];
var playDir = 0, lastPlayDir = 1, speedIx = 3, playLast = 0, playing = false;
var playVal = document.getElementById('playVal');
var playBtn = document.getElementById('playBtn'), rewBtn = document.getElementById('rewBtn'), ffBtn = document.getElementById('ffBtn');
var toStartBtn = document.getElementById('toStartBtn'), toEndBtn = document.getElementById('toEndBtn');
var speedSelect = document.getElementById('speedSelect');
var footageSeek = document.getElementById('footageSeek'), returnHistory = document.getElementById('returnHistory');
function boundedTime(t){ return MONTHLY ? TIME.monthStart(TIME.clamp(t,ERAS[0].from,ERAS[ERAS.length-1].to)) : TIME.clamp(t, ERAS[0].from, presentTime()); }
function yearsPerSecNow(){
  var era = ERAS[WINDOWS[wi].era];
  return (era.slider ? 1 / 24 : era.step / 4) * SPEEDS[speedIx];
}
function clipClock(seconds){ seconds=Math.max(0,seconds||0);return Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0'); }
function showSpeed(){
  if(MONTHLY){
    var state=FOOTAGE && FOOTAGE.player && FOOTAGE.player.state(), locked=!!selected;
    document.getElementById('rail').classList.toggle('month-held',locked);
    if(playBtn){playBtn.innerHTML=!locked && playDir?'&#10074;&#10074;':'&#9654;';playBtn.setAttribute('aria-pressed',!locked && !!playDir?'true':'false');playBtn.setAttribute('aria-label',playDir&&!locked?'Pause monthly browsing':'Play monthly browsing');}
    [playBtn,rewBtn,ffBtn,toStartBtn,toEndBtn,document.getElementById('monthInput'),document.getElementById('monthDuration')].forEach(function(el){if(el)el.disabled=locked;});
    var prev=document.getElementById('previousMonth'), next=document.getElementById('nextMonth');
    if(prev)prev.disabled=locked || wi===0;if(next)next.disabled=locked || wi===WINDOWS.length-1;
    if(playVal)playVal.textContent=locked?'MONTH HELD':monthLoading?'WAITING FOR DATA':(playDir<0?'REVERSE':playDir>0?'FORWARD':'PAUSED')+' · '+secondsPerMonth+' SEC / MONTH';
    document.getElementById('transportPhase').textContent='Monthly Earth';
    if(returnHistory)returnHistory.hidden=true;if(footageSeek)footageSeek.hidden=true;
    document.getElementById('footageNote').hidden=true;
    if(state){
      var clock=document.getElementById('eventClock'), play=document.getElementById('eventPlay'), seek=document.getElementById('eventSeek');
      if(clock)clock.textContent=clipClock(state.position)+' / '+clipClock(state.duration);
      if(play){play.textContent=state.direction?'❚❚ Pause':'▶ Play';play.setAttribute('aria-label',state.direction?'Pause event':'Play event');}
      if(seek){seek.max=state.duration;if(document.activeElement!==seek)seek.value=state.position;}
    }
    syncEventSound();return;
  }
  document.getElementById('rail').classList.toggle('footage-mode',!!FOOTAGE);
  var phaseLabel = document.getElementById('transportPhase');
  if (phaseLabel) phaseLabel.textContent = FOOTAGE ? 'Event footage · '+clipClock(FOOTAGE.live.position)+' / '+clipClock(FOOTAGE.live.duration) : 'History';
  if (returnHistory) returnHistory.hidden = !FOOTAGE;
  if (footageSeek){ footageSeek.hidden=!FOOTAGE; if(FOOTAGE){footageSeek.max=FOOTAGE.live.duration;footageSeek.value=FOOTAGE.live.position;} }
  var note=document.getElementById('footageNote');if(note){note.hidden=!FOOTAGE;if(FOOTAGE && !FOOTAGE.live.seeker.error())note.textContent='Recording day held at '+dayLabel(FOOTAGE.recordingDate)+'. Rewinding past the start of this clip returns to history.';}

  if (playBtn){ playBtn.innerHTML = playDir ? '&#10074;&#10074;' : '&#9654;'; playBtn.setAttribute('aria-pressed', playDir ? 'true' : 'false'); }
  if (speedSelect) speedSelect.value = String(SPEEDS[speedIx]);
  if (playVal){
    var rate = yearsPerSecNow(), text = rate < 1 ? (rate * TIME.daysInYear(Math.floor(nowT))).toFixed(1) + ' DAYS / S' : rate.toLocaleString(undefined,{maximumFractionDigits:1}) + ' YEARS / S';
    if (FOOTAGE) text = SPEEDS[speedIx] + '× CLIP SPEED';
    playVal.textContent = (playDir === 0 ? 'PAUSED' : playDir < 0 ? 'REVERSE' : 'FORWARD') + ' · ' + text;
  }
}
function setPlayDir(dir){
  if(MONTHLY && FOOTAGE && FOOTAGE.player){
    if(dir)lastPlayDir=dir;
    FOOTAGE.player.setDirection(dir);playLast=clockNow();return;
  }
  nowT = boundedTime(nowT);
  if(MONTHLY && selected)dir=0;
  if (!FOOTAGE && (dir > 0 && nowT >= (MONTHLY?ERAS[ERAS.length-1].to:presentTime()) - 1e-8 || dir < 0 && nowT <= ERAS[0].from)) dir = 0;
  if(MONTHLY && dir && dir!==lastPlayDir)monthElapsed=0;
  if (dir) lastPlayDir = dir < 0 ? -1 : 1;
  if (FOOTAGE && dir > 0 && FOOTAGE.live.position >= FOOTAGE.live.duration) dir = 0;
  playDir = dir; playing = dir !== 0; playLast = clockNow(); showSpeed();
  if (!dir || dir < 0 || FOOTAGE) silenceTransportSound();
  if (!dir && skyCatalogPoints){
    setSkyDate(dateOfNow()); syncHeader(); placeHandle(); writeHash(); render();
  }
}
function setSpeed(rate){ if(MONTHLY && FOOTAGE && FOOTAGE.player){FOOTAGE.player.setRate(+rate);return;}var i = SPEEDS.indexOf(+rate); if (i >= 0){ speedIx = i; showSpeed(); } }
if (speedSelect) speedSelect.onchange = function(){ setSpeed(this.value); };
function runToward(dir){ setPlayDir(dir); }
if (playBtn) playBtn.onclick = function(){ setPlayDir(playDir ? 0 : lastPlayDir); };
if (rewBtn) rewBtn.onclick = function(){ runToward(-1); };
if (ffBtn) ffBtn.onclick = function(){ runToward(1); };
if (toStartBtn) toStartBtn.onclick = function(){ setPlayDir(0); if(FOOTAGE && FOOTAGE.player){FOOTAGE.player.seek(0);}else if(FOOTAGE){FOOTAGE.live.position=0;FOOTAGE.live.seeker.seek(0);showSpeed();}else goToMoment(ERAS[0].from); };
if (toEndBtn) toEndBtn.onclick = function(){ setPlayDir(0); if(FOOTAGE){if(FOOTAGE.player)FOOTAGE.player.seek(FOOTAGE.live.duration);else{FOOTAGE.live.position=FOOTAGE.live.duration;FOOTAGE.live.seeker.seek(FOOTAGE.live.position);showSpeed();}}else goToMoment(MONTHLY?ERAS[0].to:presentTime()); };
if(returnHistory) returnHistory.onclick=function(){exitFootage(false);};
if(footageSeek) footageSeek.oninput=function(){if(!FOOTAGE)return;var position=+this.value;setPlayDir(0);FOOTAGE.live.position=Math.max(0,Math.min(FOOTAGE.live.duration,position));FOOTAGE.live.seeker.seek(FOOTAGE.live.position);showSpeed();};
showSpeed();
function setPlaying(on){ setPlayDir(on ? 1 : 0); }
var lastDayShown = '', lastSkyAt = -Infinity;
function tickPlay(now){
  var dt = Math.min(0.25, Math.max(0, (now - playLast) / 1000)); playLast = now;
  if(MONTHLY){
    clipFrameSeconds=!document.hidden && !selected ? dt : 0;
    if(document.hidden)return;
    if(FOOTAGE && FOOTAGE.player){FOOTAGE.player.tick(dt);return;}
    if(!playDir || selected || monthLoading)return;
    var step=MONTHLY.stepIndex(wi,monthElapsed,dt,playDir,secondsPerMonth,WINDOWS.length);
    monthElapsed=step.elapsed;
    if(step.index!==wi){nowT=WINDOWS[step.index].end;setWindow(step.index,true);}
    if(step.ended)setPlayDir(0);
    return;
  }
  clipFrameSeconds = playDir ? dt : 0;
  if (!playDir) return;
  if (FOOTAGE){
    var L=FOOTAGE.live, step=window.GTMediaTransport.advance(L.position,L.duration,dt,playDir,SPEEDS[speedIx],false);
    L.position=step.position; L.seeker.seek(L.position); showSpeed();
    if(step.boundary==='end'){setPlayDir(0);return;}
    if(step.boundary==='start'){
      exitFootage(true);dt=step.remaining;clipFrameSeconds=dt;
      if(!dt || !playDir)return;
    }else return;
  }
  var era = ERAS[WINDOWS[wi].era], proposed = era.slider
    ? TIME.addDays(nowT, dt * yearsPerSecNow() * TIME.daysInYear(Math.floor(nowT)) * playDir)
    : nowT + dt * yearsPerSecNow() * playDir;
  nowT = boundedTime(proposed);
  if (nowT !== proposed || nowT <= ERAS[0].from || nowT >= presentTime() - 1e-8) setPlayDir(0);
  var index = windowIndexFor(nowT);
  if (index !== wi) setWindow(index, true); else bindNow();
  var day = Math.floor(TIME.toDay(nowT));
  if (day !== lastDayShown){ lastDayShown = day; syncHeader(); placeHandle(); resetTicker(); }
  if (now - lastSkyAt >= 100){ lastSkyAt = now; setSkyDate(dateOfNow()); }
  render();
}
function dateOfNow(){ return TIME.toDate(nowT); }

// ---------- rail ----------
var track = document.getElementById('track');
var handle = null;
function buildRail(){
  track.innerHTML = '';
  track.classList.toggle('slider', !!ERAS[0].slider);
  if(MONTHLY){
    track.classList.add('month-track');
    WINDOWS.forEach(function(w,index){var button=document.createElement('button');button.type='button';button.className='month-tick';button.textContent=MONTHS[TIME.parts(w.end).month-1];button.setAttribute('aria-label',monthLabel(w.end));button.onclick=function(){if(selected)return;setPlayDir(0);setWindow(index);};track.appendChild(button);});
    handle=document.createElement('div');handle.id='handle';handle.hidden=true;track.appendChild(handle);return;
  }
  if (ERAS[0].slider){
    var era = ERAS[0], span = era.to - era.from;
    for (var y = era.from; y <= era.to; y++){
      var t = document.createElement('div'); t.className = 'tick' + (y % era.tick === 0 ? ' major' : '');
      t.style.left = ((y - era.from) / span * 100) + '%';
      if (y % era.tick === 0 && y < era.to) t.innerHTML = '<span>' + y + '</span>';
      track.appendChild(t);
    }
  } else {
    ERAS.forEach(function(era){
      var d = document.createElement('div'); d.className = 'era';
      d.innerHTML = '<span class="yr">' + era.label + '</span>' + (era.name ? '<span class="nm">' + era.name + '</span>' : '');
      track.appendChild(d);
    });
  }
  handle = document.createElement('div'); handle.id = 'handle'; track.appendChild(handle);
}
buildRail();
function placeHandle(){
  if(MONTHLY){Array.prototype.forEach.call(track.querySelectorAll('.month-tick'),function(button,i){button.setAttribute('aria-current',i===wi?'date':'false');button.disabled=!!selected;});return;}
  var w = WINDOWS[wi], era = ERAS[w.era];
  if (era.slider){
    var span = era.to - era.from;
    var leftPct = (nowT - era.from) / span * 100;
    handle.style.left = leftPct + '%';
    handle.style.width = (STEP / span * 100) + '%';                                            // the month on the globe
    handle.innerHTML = '<span class="hnow' + (leftPct > 88 ? ' before' : '') + '">' + monthLabel(w.end) + '</span>';
    return;
  }
  var segW = 100 / ERAS.length;
  var within = (wi - era.first) / era.count;
  handle.style.left = (w.era * segW + within * segW) + '%';
  handle.style.width = (segW / era.count) + '%';
  handle.textContent = '';
}
function railSet(clientX){
  var rect = track.getBoundingClientRect(), f = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  if (ERAS[0].slider){ goToMoment(ERAS[0].from + f * (presentTime() - ERAS[0].from)); return; }
  var ef = Math.min(ERAS.length - 1e-8, f * ERAS.length), era = ERAS[Math.floor(ef)];
  goToMoment(era.from + (ef - Math.floor(ef)) * (era.to - era.from));
}

var railDrag = false;
track.addEventListener('pointerdown', function(ev){ if(MONTHLY)return;if (playing) setPlaying(false); railDrag = true; track.setPointerCapture(ev.pointerId); railSet(ev.clientX, true); });
track.addEventListener('pointermove', function(ev){ if (railDrag) railSet(ev.clientX); });
track.addEventListener('pointerup', function(){ railDrag = false; });
window.addEventListener('keydown', function(ev){
  if(ev.key==='Escape'){closePanel();return;}
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName)) return;
  if(MONTHLY && selected){
    if(FOOTAGE && FOOTAGE.player && (ev.key==='ArrowLeft'||ev.key==='ArrowRight')){FOOTAGE.player.seek(FOOTAGE.player.state().position+(ev.key==='ArrowLeft'?-1:1));ev.preventDefault();}
    if(FOOTAGE && ev.key===' ' && ev.target===document.body){setPlayDir(playDir?0:1);ev.preventDefault();}
    return;
  }
  if(FOOTAGE && (ev.key==='ArrowLeft'||ev.key==='ArrowRight')){setPlayDir(0);FOOTAGE.live.position=Math.max(0,Math.min(FOOTAGE.live.duration,FOOTAGE.live.position+(ev.key==='ArrowLeft'?-1:1)*(ev.shiftKey?5:1)));FOOTAGE.live.seeker.seek(FOOTAGE.live.position);showSpeed();ev.preventDefault();return;}
  var stepN = ERAS[0].slider && ev.shiftKey ? Math.round(1 / ERAS[0].step) : 1;     // shift + arrow: a whole year
  if (ev.key === 'ArrowLeft'){ setWindow(wi - stepN); ev.preventDefault(); }
  if (ev.key === 'ArrowRight'){ setWindow(wi + stepN); ev.preventDefault(); }
  if (ev.key === 'Escape') closePanel();
  if (ev.key === ' ' && ev.target === document.body && playBtn){ playBtn.onclick(); ev.preventDefault(); }
});
function setWindow(next, keepNow){
  if(MONTHLY && !keepNow)monthElapsed=0;
  if(!keepNow){if(FOOTAGE)closePanel();navigationGeneration++;ANIMS.length=0;pendingEventHash=null;}
  next = Math.max(0, Math.min(WINDOWS.length - 1, next));
  wi = next;
  if (!keepNow) nowT = boundedTime(ERAS[WINDOWS[wi].era].slider ? WINDOWS[wi].end : WINDOWS[wi].start);
  hovered = null; document.getElementById('tip').classList.remove('on'); canvas.style.cursor = '';
  if (selected && !inView(selected, nowT, WINDOWS[wi])) closePanel();
  setSkyDate(dateOfNow());
  bindWindow(); syncHeader(); placeHandle(); render(); writeHash(); resetTicker(); showSpeed();
  ensureYears(WINDOWS[wi].start, WINDOWS[wi].end, function(added){ if (added){ bindWindow(); render(); resetTicker(); } resolvePendingEvent(); });
}

function syncHeader(){
  if(MONTHLY){
    document.getElementById('now').innerHTML='<span class="nowlab">MONTH</span><b>'+monthLabel(nowT)+'</b>';
    document.getElementById('periodLabel').textContent=selected?'Month held while you explore this event':'One calendar month at a time';
    document.getElementById('monthInput').value=MONTHLY.monthKey(nowT,TIME);
    track.setAttribute('aria-label','Choose a month in 2011');track.setAttribute('role','group');
    return;
  }
  var w = WINDOWS[wi], era = ERAS[w.era], b = viewBounds(nowT, w), p = TIME.parts(nowT);
  var nowText = era.slider ? p.day + ' ' + MONTHS[p.month - 1] + ' ' + p.year : rangeLabel(w.start, w.end);
  var detail = FOOTAGE ? 'EVENT FOOTAGE · RECORDING DAY HELD' : era.slider ? (temporalView === 'moment' ? 'MOMENT · events on this date' : 'PERIOD · ' + monthLabel(b.start) + ' — ' + monthLabel(b.end)) : era.name + ' · PERIOD OVERVIEW';
  document.getElementById('now').innerHTML = '<span class="nowlab">' + (era.slider ? 'TIME' : 'PERIOD') + '</span><b>' + nowText + '</b><span class="nowsub">' + detail + '</span>';
  var label = document.getElementById('periodLabel'); if (label) label.textContent = detail;
  track.setAttribute('aria-valuetext', nowText); track.setAttribute('aria-valuemin', String(ERAS[0].from)); track.setAttribute('aria-valuemax', String(presentTime())); track.setAttribute('aria-valuenow', String(nowT));
}
var viewSelect = document.getElementById('viewSelect');
if (viewSelect) viewSelect.onchange = function(){
  if(FOOTAGE) closePanel();
  temporalView = this.value === 'moment' ? 'moment' : 'period';
  if (temporalView === 'period') periodDays = +this.value;
  bindWindow(); syncHeader(); render(); writeHash();
  ensureYears(WINDOWS[wi].start, WINDOWS[wi].end, function(added){ if (added){ bindWindow(); render(); } });
};
var photosOnly = document.getElementById('photosOnly'); if (photosOnly) photosOnly.onchange = function(){ PHOTOS_ONLY = this.checked; bindNow(true); if(MONTHLY)renderMonthList();render(); };
var densitySelect = document.getElementById('densitySelect');
if (densitySelect) densitySelect.onchange = function(){ densityLevel = +this.value; bindNow(true); render(); };
if(MONTHLY){
  document.getElementById('monthInput').onchange=function(){var t=TIME.parseISO(this.value+'-01');if(Number.isFinite(t)){setPlayDir(0);goToMoment(t);}else syncHeader();};
  document.getElementById('previousMonth').onclick=function(){setPlayDir(0);setWindow(wi-1);};
  document.getElementById('nextMonth').onclick=function(){setPlayDir(0);setWindow(wi+1);};
  document.getElementById('monthDuration').onchange=function(){secondsPerMonth=+this.value;monthElapsed=0;showSpeed();};
}

// ---------- filters ----------
var fWrap = document.getElementById('filters');
Object.keys(CATS).forEach(function(k){
  var b = document.createElement('button'); b.className = 'f'; b.setAttribute('aria-pressed', 'true');
  b.innerHTML = '<img src="' + ICON_URL[k] + '" alt="">' + CATS[k].label;
  b.onclick = function(){
    if(FOOTAGE) closePanel();
    off[k] = !off[k]; b.setAttribute('aria-pressed', off[k] ? 'false' : 'true');
    bindWindow(); if (selected && off[selected.cat]) closePanel(); render();
  };
  fWrap.appendChild(b);
});

// ---------- mode switch ----------
function setMode(next, keepYear){
  if (!ERA_SETS[next]) return;
  cancelFootage();navigationGeneration++;ANIMS.length=0;pendingEventHash=null;
  var year = keepYear != null ? keepYear : nowT;
  mode = next; ERAS = ERA_SETS[mode]; buildWindows(); buildRail();
  nowT = boundedTime(year); wi = windowIndexFor(nowT);
  selected = null; document.getElementById('panel').classList.remove('on');
  setWindow(wi, true);
  var control = document.getElementById('eraSelect'); if (control) control.value = mode;
}
var eraSelect = document.getElementById('eraSelect');
if (eraSelect) eraSelect.onchange = function(){ setMode(this.value); };

Array.prototype.forEach.call(document.querySelectorAll('#modes button'), function(b){
  b.onclick = function(){ setMode(b.dataset.mode); };
});

// ---------- URL state: #mode=century&y=1965&e=Apollo_11 ----------
function windowIndexFor(t){
  t = boundedTime(t);
  for (var i = WINDOWS.length - 1; i >= 0; i--){
    var w = WINDOWS[i];
    if (t >= (ERAS[w.era].slider ? w.end : w.start)) return i;
  }
  return 0;
}
function goToMoment(t){
  if(FOOTAGE)closePanel();navigationGeneration++;ANIMS.length=0;pendingEventHash=null;
  nowT = boundedTime(t); var i = windowIndexFor(nowT);
  setWindow(i, true);
}
function writeHash(){
  if(MONTHLY){var monthParts=['month='+MONTHLY.monthKey(nowT,TIME)];var id=pendingEventHash||selected&&selected.stableId;if(id)monthParts.push('event='+encodeURIComponent(id));history.replaceState(null,'','#'+monthParts.join('&'));return;}
  var parts = ['mode=' + mode, 'y=' + String(nowT), 'view=' + (temporalView === 'moment' ? 'moment' : periodDays)];
  var eventId = pendingEventHash || selected && selected.stableId;
  if (eventId) parts.push('event=' + encodeURIComponent(eventId));
  history.replaceState(null, '', '#' + parts.join('&'));
}
var pendingEventHash = null;
function resolvePendingEvent(){
  if (!pendingEventHash) return;
  var e = EVENTS.find(function(x){ return x.stableId === pendingEventHash || x.slug === pendingEventHash; });
  if (!e || !eligibleEvent(e)) return;
  if(MONTHLY && (e.t0<ERAS[0].from || TIME.monthStart(e.t0)>ERAS[0].to)){pendingEventHash=null;return;}
  pendingEventHash = null;
  goToMoment(e.t0);
  selectEvent(e);
}
function readHash(){
  var h = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
  var requestedEvent = h.event || h.e || null;
  if(FOOTAGE)closePanel();
  if(MONTHLY){
    var requested=TIME.parseISO((h.month||'2011-02')+'-01');
    if(Number.isFinite(requested))goToMoment(requested);
    pendingEventHash=requestedEvent;writeHash();resolvePendingEvent();return;
  }
  if (h.view){ temporalView = h.view === 'moment' ? 'moment' : 'period'; if ([30,365,1825].indexOf(+h.view) >= 0) periodDays = +h.view; if (viewSelect) viewSelect.value = temporalView === 'moment' ? 'moment' : String(periodDays); }
  if (h.mode && ERA_SETS[h.mode] && h.mode !== mode) setMode(h.mode, Number.isFinite(+h.y) ? +h.y : nowT);
  if (h.y && Number.isFinite(+h.y)) goToMoment(+h.y);
  pendingEventHash = requestedEvent;
  writeHash();
  resolvePendingEvent();
}
window.addEventListener('hashchange', readHash);

// ---------- 'while this was happening' ticker ----------
function continentOf(e){ return e.normal; }
function family(e){ return e.title.toLowerCase().replace(/^(launch|death|birth|discovery|invention) of /, '').split(' ').slice(0, 3).join(' '); }
// relation -> how the ticker reads it, "A <verb> B"
var REL_TEXT = { P1542:'led to', P828:'was caused by', P1536:'triggered', P1478:'was triggered by', P1479:'fed', P155:'followed', P156:'was followed by', P361:'was part of', P527:'included' };
var LINKS_BY_SLUG = {};
LINKS.forEach(function(l){ (LINKS_BY_SLUG[l[0]] = LINKS_BY_SLUG[l[0]] || []).push(l); });
var TICKER_APART_KM = 2500;
function partnerQuality(e){
  // an event no rule can name (a franchise, a festival) and a headline that is only "name — description" are both
  // signs of a weak line; a real photograph is a sign of a real event
  var q = photoFor(e) ? 2 : 0;
  if (kindOf(e) === KIND_DEFAULT[e.cat]) q -= 2;
  if (/ — | – /.test(e.title)) q -= 2;                // "name — description", or a sub-event ("Fencing at the Olympics – men's foil")
  if (/: [a-z]/.test(e.title)) q -= 1.5;           // "2006 Turkish Grand Prix: Formula One motor race" is a label, not news
  return q;
}
function coincidences(){
  if(MONTHLY)return [];
  // The line under the globe: one calendar day, two things from two distant parts of the world — "28 Dec · X, while
  // Y" — or one thing alone when it is big enough to carry the line (9/11 needs no partner). Only the same day
  // qualifies; a consequence years later belongs to the panel's links, not here. Lines close to NOW come first,
  // so the strip follows the film; each event appears in one line at most.
  // The strip is the news of NOW: only days in the two months up to the NOW mark qualify, so the line moves with
  // the film. A quiet stretch widens to six months, then to the whole window, rather than going blank.
  var w = WINDOWS[wi], now = nowT;
  var reaches = [2 / 12, 6 / 12], lines = [];          // a quiet month shows fewer lines rather than old ones
  for (var r = 0; r < reaches.length && lines.length < 3; r++){
    lines = linesWithin(w, now, reaches[r]);
  }
  return lines;
}
function linesWithin(w, now, reach){
  var byDay = {};
  EVENTS.forEach(function(e){
    if (!e.date || e.datePrecision !== 'day' || e.w < 3 || off[e.cat] || !inWindow(e, w)) return;
    if (e.t0 > now || now - e.t0 > reach) return;        // up to today, and the reach before it
    if (e.title.split(/\s+/).length < 3) return;                   // "Megaclite introduced" is not a line anyone can read
    if (/^\(\d+\)|^\d{4} [A-Z]{2}\d/.test(e.title)) return;         // a catalogue number is not news
    (byDay[e.date] = byDay[e.date] || []).push(e);
  });
  var lines = [];
  Object.keys(byDay).forEach(function(d){
    var arr = byDay[d];
    var recency = now - arr[0].t0 < 10 / 365 ? 3 : now - arr[0].t0 < 0.5 ? 1 : 0;   // the last ten days first
    for (var i = 0; i < arr.length; i++){
      var a = arr[i];
      if (a.w >= 4 && partnerQuality(a) >= 0) lines.push({ a:a, b:null, score:a.w + partnerQuality(a) + recency });   // big enough to stand alone
      for (var j = i + 1; j < arr.length; j++){
        var b = arr[j];
        if (a.slug === b.slug || kmApart(a, b) < TICKER_APART_KM) continue;
        if (family(a) === family(b)) continue;
        if (/^launch of/i.test(a.title) && /^launch of/i.test(b.title)) continue;
        var quality = partnerQuality(a) + partnerQuality(b);
        if (quality < -1) continue;
        lines.push({ a:a, b:b, score:a.w + b.w + quality + recency + (a.cat !== b.cat ? 0.5 : 0) + 1 });   // a pair is the point; it edges out a solo of equal weight
      }
    }
  });
  lines.sort(function(p, q){ return q.score - p.score; });
  // one event per line at most, and no more than three lines led by the same kind of thing, or the strip
  // becomes a season of motor races
  var used = {}, perKind = {}, out = [];
  for (var k = 0; k < lines.length && out.length < 14; k++){
    var p = lines[k];
    if (used[p.a.id] || (p.b && used[p.b.id])) continue;
    var ka = kindOf(p.a), kb = p.b ? kindOf(p.b) : null;
    if ((perKind[ka] || 0) >= 3 || (kb && (perKind[kb] || 0) >= 3)) continue;
    used[p.a.id] = true; if (p.b) used[p.b.id] = true;
    perKind[ka] = (perKind[ka] || 0) + 1; if (kb && kb !== ka) perKind[kb] = (perKind[kb] || 0) + 1;
    out.push(p);
  }
  return out;
}
function shortTitle(e){
  // one line's worth: the headline cut at a word boundary
  var t = e.title.length <= 72 ? e.title : e.name;
  if (t.length > 72) t = t.slice(0, 72).replace(/\s+\S*$/, '') + '…';
  return t;
}
var tickerPairs = [], tickerIndex = 0, tickerShownAt = 0, TICKER_HOLD_MS = 9000;
function tickTicker(){ if (tickerPairs.length > 1 && clockNow() - tickerShownAt >= TICKER_HOLD_MS){ tickerIndex++; showTicker(); tickerShownAt = clockNow(); } }
function tickerSide(e){
  // the place is added only when the headline does not already say it
  var t = shortTitle(e);
  var place = e.place && t.toLowerCase().indexOf(e.place.toLowerCase().split(/[ ,(]/)[0]) < 0 ? e.place : '';
  return '<span class="ts" data-event="' + encodeURIComponent(e.stableId) + '">' + t + (place ? '<em>' + place + '</em>' : '') + '</span>';
}
function showTicker(){
  var el = document.getElementById('ticker');
  if (!tickerPairs.length){ el.classList.remove('on'); return; }
  var p = tickerPairs[tickerIndex % tickerPairs.length];
  el.innerHTML = '<span class="tk">' + dayLabel(p.a.date) + '</span>' + tickerSide(p.a) + (p.b ? '<span class="tw">while</span>' + tickerSide(p.b) : '');
  el.classList.add('on');
  Array.prototype.forEach.call(el.querySelectorAll('.ts'), function(side){
    side.onclick = function(){ selectEvent(decodeURIComponent(side.dataset.event)); };
  });
}
function resetTicker(){
  tickerPairs = coincidences(); tickerIndex = 0; showTicker();
  tickerShownAt = clockNow();                                       // the next line comes TICKER_HOLD_MS later, on the app's clock
}
document.getElementById('aboutCounts').textContent = EVENTS.length.toLocaleString() + ' events · ' + PHOTO_INDEX.size.toLocaleString() + ' events with verified photographs';
document.getElementById('aboutBtn').onclick = function(){ document.getElementById('about').classList.toggle('on'); };
document.getElementById('aboutClose').onclick = function(){ document.getElementById('about').classList.remove('on'); };
window.addEventListener('resize', resize);
var initialHash = location.hash;
nowT = TIME.parseISO(MONTHLY?'2011-02-01':'2014-08-01T12:00:00Z'); wi = windowIndexFor(nowT);
buildSkyStatic(); setSkyDate(dateOfNow());
bindWindow(); syncHeader(); placeHandle(); resize(); tick();
if (initialHash){ history.replaceState(null, '', initialHash); readHash(); }
resetTicker(); setTimeout(placeHandle, 60);
ensureYears(WINDOWS[wi].start, WINDOWS[wi].end, function(added){ if (added){ bindWindow(); render(); resetTicker(); } resolvePendingEvent(); });
function refreshPresentBounds(){
  if(MONTHLY)return;
  var end = presentTime(), previous = ERAS[ERAS.length - 1].to;
  var rebuild = TIME.monthStart(previous) !== TIME.monthStart(end) ||
    mode === 'century' && ERAS[0].from !== Math.floor(end) - 100;
  ERAS[ERAS.length - 1].to = end;
  if (rebuild){
    buildWindows(); nowT = boundedTime(nowT); wi = windowIndexFor(nowT); buildRail(); setWindow(wi, true);
  } else {
    if (nowT > end) goToMoment(end);
    syncHeader(); placeHandle();
  }
  if (!playDir){ setSkyDate(dateOfNow()); render(); }
}
setInterval(refreshPresentBounds, 60000);
window.__gtDensity = function(){ return Object.assign({}, densityStats, {rendered:shown.filter(function(e){return e._sx != null;}).length, renderedPhotos:shown.filter(function(e){return e._sx != null && photoFor(e);}).length, folded:shown.reduce(function(n,e){return n+(e.folded ? e.folded.length : 0);},0)}); };
window.__gtState = function(){ return { time:nowT, date:dateOfNow() && dateOfNow().toISOString(), present:presentTime(), mode:mode, direction:playDir, speed:SPEEDS[speedIx], view:temporalView, periodDays:periodDays, selected:selected && selected.stableId, loaded:EVENTS.length, range:{from:ERAS[0].from,to:ERAS[ERAS.length-1].to,lastMonth:WINDOWS[WINDOWS.length-1].end}, shards:shardLoader && shardLoader.status() }; };
if(MONTHLY){
  window.__gtMonthly=function(){return {month:MONTHLY.monthKey(nowT,TIME),secondsPerMonth:secondsPerMonth,elapsed:monthElapsed,loading:monthLoading,countries:monthSelection.countries,events:monthSelection.events.map(function(e){return {id:e.stableId,title:e.title,date:e.date,country:e.monthCountry};}),held:!!selected,footage:FOOTAGE&&FOOTAGE.player?FOOTAGE.player.state():null};};
  document.addEventListener('visibilitychange',function(){if(document.hidden){setPlayDir(0);Object.keys(LIVE).forEach(function(k){LIVE[k].seeker.cancel();});}});
  syncEventSound();
}
window.__gtControls = { time:goToMoment, mode:setMode, speed:setSpeed, direction:setPlayDir, select:selectEvent, close:closePanel, refreshBounds:refreshPresentBounds, view:function(v){ viewSelect.value = String(v); viewSelect.onchange(); } };
window.__cgtFly = selectEvent;

};
// Load data files, then start the app.
(function(){
  if (window.__GT){ window.__gtStart(); return; }   // playground build: data already inlined
  function get(url){ return fetch(url,{cache:'no-cache'}).then(function(r){ if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
  if(window.GTMonthly){
    Promise.all([get('data/monthly-catalog.json'),get('assets/countries-110m.json'),get('data/event-media.json'),get('data/event-photos.json'),get('data/monthly-coverage-policy.json')]).then(function(res){
      window.__GT={events:res[0].events,images:{},borders:res[1],skyLabels:{stars:[],deep:[],constellations:[]},media:res[2],eventPhotos:res[3],coveragePolicy:res[4],starCatalog:{features:[]},shards:null,links:[],skyFacts:{}};
      window.__gtStart();
    }).catch(function(err){var status=document.getElementById('dataStatus');status.hidden=false;status.disabled=false;status.textContent='Prototype data could not load · Reload';status.onclick=function(){location.reload();};console.error(err);});
    return;
  }
  Promise.all([ get('data/events.json'), get('data/images.json'), get('assets/countries-110m.json'), get('assets/skylabels.json'),
                get('data/event-media.json'), get('data/index.json').catch(function(){ return null; }), get('data/links.json').catch(function(){ return []; }),
                get('data/skyfacts.json').catch(function(){ return {}; }), get('assets/stars-catalog.json'), get('data/event-photos.json') ])
    .then(function(res){
      window.__GT = { events:res[0], images:res[1], borders:res[2], skyLabels:res[3], media:res[4], shards: res[5] && res[5].years ? { years:res[5].years, dir:'data/y/' } : null, links:res[6], skyFacts:res[7], eventPhotos:res[9], starCatalog:res[8] };
      window.__gtStart();
    })
    .catch(function(err){ document.getElementById('dataStatus').hidden = false; document.getElementById('dataStatus').textContent = 'Could not load events. Reload to retry.'; console.error(err); });
})();
