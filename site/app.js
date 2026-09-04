window.__gtStart = function(){
"use strict";

var EARTH_SRC = window.__GT.earth || "assets/earth.jpg";
var IMG_DIR = window.__GT.imgDir != null ? window.__GT.imgDir : "img/";
var BORDERS = window.__GT.borders;
var RAW = window.__GT.events;
var IMAGES = window.__GT.images;
var MEDIA = window.__GT.media || {};
var LINKS = window.__GT.links || [];              // [[slugA, relation, slugB], ...] from Wikidata cause/effect properties          // slug -> { file, kind, author, license, licenseUrl, filePage, seconds }
var MEDIA_DIR = window.__GT.mediaDir != null ? window.__GT.mediaDir : "media/";
var DEG = Math.PI / 180;

var CATS = {
  con:{label:'Conflict',        v:'--con'},
  cul:{label:'Culture & belief', v:'--cul'},
  sci:{label:'Science & discovery', v:'--sci'},
  dis:{label:'Disasters',       v:'--dis'}
};

function parseRow(r, i){
  var e = { id:i, title:r[0], lat:r[1], lon:r[2], start:r[3], end:r[4], cat:r[5], w:r[6], place:r[7], desc:r[8], slug:r[9],
            date:(typeof r[10] === 'string' && /^-?\d{1,6}-\d{2}-\d{2}$/.test(r[10]) && !/-01-01$/.test(r[10])) ? r[10] : null, who:r[11] || null,
            endDate:(typeof r[12] === 'string' && /^-?\d{1,6}-\d{2}-\d{2}$/.test(r[12])) ? r[12] : null, name:r[13] || r[0] };
  // time bounds in fractional years: a dated event is a point (or its exact span), a year-only event covers its whole year(s)
  if (e.date){ e.t0 = fracOfDate(e.date); e.t1 = e.endDate ? Math.max(e.t0 + 1 / 365, fracOfDate(e.endDate)) : (e.end > e.start ? e.end + 1 : e.t0 + 1 / 365); }
  else { e.t0 = e.start; e.t1 = e.end + 1; }
  return e;
}
function fracOfDate(iso){ var m = /^(-?\d+)-(\d\d)-(\d\d)$/.exec(iso); return +m[1] + (+m[2] - 1) / 12 + (+m[3] - 1) / 365; }
// Event time. NOW names a month, and the globe shows what was happening in that month: a moment (a day, a
// match, a crash) appears in its own month and is gone the month after; something that runs for months or years
// (a war, a pandemic) stays as long as it runs — loudest when it begins, then at a background level — and goes
// when it ends. Nothing lingers: 9/11 is on the globe in September 2001 and not in October.
var STEP = 1 / 12;                                     // the month
var HEADLINE_YEARS = { 1:0.5, 2:1, 3:2, 4:3 };         // how long a long-running thing stays loud after it begins
var BACKGROUND = 0.42;
var MOMENT = 45 / 365;                                 // shorter than this, an event is a moment
function prominence(e, now){
  var monthEnd = now + STEP;
  if (e.t0 >= monthEnd) return 0;                      // not yet
  if (e.t1 - e.t0 < MOMENT) return e.t0 >= now ? 1 : 0;   // a moment: its month, and only its month
  if (e.t1 <= now) return 0;                           // over
  var since = monthEnd - e.t0, H = HEADLINE_YEARS[e.w] || 1;
  return since < H ? 1 - (1 - BACKGROUND) * (since / H) : BACKGROUND;
}
function inWindow(e, w){
  var era = ERAS[w.era];
  if (era && era.slider) return prominence(e, w.end) > 0.01;                 // the slider rails follow NOW
  return e.t0 < w.end && e.t1 > w.start;                                     // era tabs: anything inside the era
}
function fracYear(y){ return Math.round(y * 12) / 12; }
var EVENTS = RAW.map(parseRow);
// Large builds keep only the top events per year in events.json and the rest in data/y/<year>.json shards,
// listed in data/index.json; a window loads the shards it touches on demand (not in the playground build).
var SHARDS = window.__GT.shards || null;   // { years:[...], dir:'data/y/' }
var loadedYears = {};

// Two rails. "century" = calendar decades with 5-year windows; "all" = eleven eras from the first stone tools.
var ERA_SETS = {
  // a slider: the window is `width` years wide and moves one year at a time across from..to
  recent:  [ {name:'', label:'', from:2000, to:2026, step:1/12, width:1/12, slider:true, tick:5} ],   // one month at a time, from the first month
  century: [ {name:'', label:'', from:1926, to:2026, step:1/12, width:1/12, slider:true, tick:10} ],
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
    {name:'CONTEMPORARY',   label:'1990–2026',        from:1990,     to:2026,    step:12}
  ]
};
var mode = 'recent';
var ERAS = ERA_SETS[mode];
var WINDOWS = [];
function buildWindows(){
  WINDOWS = [];
  ERAS.forEach(function(era, ei){
    var width = era.width || era.step;
    var n = era.slider ? Math.round((era.to - era.from) / era.step) : Math.ceil((era.to - era.from) / era.step);
    era.first = WINDOWS.length; era.count = n;
    for (var k = 0; k < n; k++){
      if (era.slider){
        // a slider window is named by its end, which is NOW: the month on the globe runs from NOW for one step
        var now = fracYear(era.from + k * era.step);
        WINDOWS.push({ start:fracYear(now - width), end:now, era:ei });
      } else {
        var a = era.from + k * era.step;
        WINDOWS.push({ start:a, end:Math.min(a + width, era.to), era:ei });
      }
    }
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
function dayNumber(iso){
  var m = iso.match(/^(-?\d+)-(\d{2})-(\d{2})$/); if (!m) return null;
  return parseInt(m[1], 10) * 365.25 + (parseInt(m[2], 10) - 1) * 30.44 + parseInt(m[3], 10);
}
function whenLabel(e){
  if (e.date) return dayLabel(e.date);
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
function monthLabel(y){ var yr = Math.floor(y + 1e-6), m = Math.round((y - yr) * 12); if (m >= 12){ yr++; m = 0; } return MONTHS[m] + ' ' + yr; }

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
if (wi < 0) wi = WINDOWS.findIndex(function(w){ return w.start <= 2022 && w.end >= 2022; });
if (wi < 0) wi = WINDOWS.length - 1;
var selected = null, hovered = null, idle = true, idleTimer = null;
var off = { con:false, cul:false, sci:false, dis:false };
var camDist = 3.9;

// ---------- three ----------
var wrap = document.getElementById('globewrap');
var canvas = document.getElementById('c');
var renderer = new THREE.WebGLRenderer({ canvas:canvas, antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x05070d, 1);
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 3000);
camera.position.set(0, 0, camDist);

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

// ---------- the real sky ----------
// Everything in the sky is placed in Earth-fixed coordinates: a star at right ascension RA and declination Dec sits
// over longitude RA − GMST (Greenwich sidereal time) and latitude Dec. The sky group is a child of the globe, so it
// turns with the Earth as you spin it and stays correct for the moment shown. Positions come from astronomy-engine.
var SKY_R = 900;                       // stars, far behind everything
var AU_IN_EARTH_RADII = 23455;         // 1 AU / Earth's radius — the Moon lands ~60 R away, its real distance
var sky = new THREE.Group(); globe.add(sky);
var skyDate = new Date();
var skyLabelSprites = [];

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
  // the sky itself: a baked equirectangular photograph-style map (real stars and Milky Way, equatorial coordinates)
  // on the inside of a far sphere. Same longitude mapping as the Earth texture, mirrored because we look from inside.
  var skyTex = new THREE.TextureLoader().load(window.__GT.skyImage || 'assets/sky.jpg', function(){ render(); });
  skyTex.wrapS = THREE.RepeatWrapping; skyTex.repeat.x = -1;
  skySphere = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 64, 40), new THREE.MeshBasicMaterial({ map:skyTex, side:THREE.BackSide, depthWrite:false }));
  skySphere.renderOrder = -10; sky.add(skySphere);

  // the Moon: a lit sphere at its true distance and size, so its phase and apparent size are right
  moonMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2727, 32, 24), new THREE.MeshLambertMaterial({ color:0xd9d9d2 }));
  sky.add(moonMesh);

  // the Sun: a bright sprite far out, plus the directional light comes from it
  var sc = document.createElement('canvas'); sc.width = sc.height = 256; var sctx = sc.getContext('2d');
  var grad = sctx.createRadialGradient(128, 128, 0, 128, 128, 128); grad.addColorStop(0, 'rgba(255,255,250,1)'); grad.addColorStop(0.38, 'rgba(255,253,240,1)'); grad.addColorStop(0.40, 'rgba(255,240,205,.55)'); grad.addColorStop(0.7, 'rgba(255,225,170,.12)'); grad.addColorStop(1, 'rgba(255,220,150,0)');
  sctx.fillStyle = grad; sctx.fillRect(0, 0, 256, 256);
  sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(sc), transparent:true, depthTest:false }));
  sunSprite.scale.set(700 * 0.0093 * 2.6, 700 * 0.0093 * 2.6, 1); sky.add(sunSprite);   // disc is 0.53° wide; the glare around it about 2.6× that

  // planets visible to the eye: small warm points with labels
  ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].forEach(function(name){
    var pc = document.createElement('canvas'); pc.width = pc.height = 32; var pctx = pc.getContext('2d');
    pctx.beginPath(); pctx.arc(16, 16, 6, 0, 2 * Math.PI); pctx.fillStyle = name === 'Mars' ? '#ffb28a' : '#fff4d6'; pctx.fill();
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(pc), transparent:true, depthTest:false, sizeAttenuation:false }));
    sp.scale.set(0.014, 0.014, 1); sky.add(sp);
    planetSprites[name] = sp;
  });
  // sky label candidates — the picker below shows the dozen most important ones on screen each frame
  SKYLABELS.stars.forEach(function(st){
    var ll = skyLonLat(st[1], st[2], 0);
    var text = st[0].toUpperCase() + ' · STAR' + (st[4] ? ' · ' + fmtLy(st[4]) : '');
    LABEL_CANDIDATES.push({ text:text, pos:toVec(ll[0], ll[1], SKY_R - 20), prio: 6 - st[3] });
  });
  SKYLABELS.dsos.forEach(function(d){
    var ll = skyLonLat(d[1], d[2], 0);
    var text = d[0].toUpperCase() + ' · ' + String(d[4]).toUpperCase() + (d[5] ? ' · ' + fmtLy(d[5]) : '');
    LABEL_CANDIDATES.push({ text:text, pos:toVec(ll[0], ll[1], SKY_R - 20), prio: 5.5 - (d[3] || 5) });
  });
  SKYLABELS.constellations.forEach(function(cn){
    var ll = skyLonLat(cn[1], cn[2], 0);
    LABEL_CANDIDATES.push({ text:cn[0].toUpperCase(), pos:toVec(ll[0], ll[1], SKY_R - 20), prio: cn[3] === 1 ? 2.5 : cn[3] === 2 ? 1.5 : 0.5, dim:true });
  });
  for (var li = 0; li < LABEL_POOL_SIZE; li++){
    var lb = makeTextSprite('', 0.026); lb.visible = false; sky.add(lb); LABEL_POOL.push(lb);
  }
}
var LABEL_CANDIDATES = [], LABEL_POOL = [], LABEL_POOL_SIZE = 14, LABEL_TEX = {};
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
function pickSkyLabels(){
  // project every candidate; keep the ones on screen and clear of the Earth's disc; show the top few
  if (!LABEL_CANDIDATES.length) return;
  var earthPx = Math.asin(Math.min(1, 1 / camDist)) / (camera.fov * DEG / 2) * (H / 2);
  var cx = W / 2, cy = H / 2, chosen = [];
  var bodies = [{ obj:moonMesh, text:'MOON · ' + Math.round(moonMesh.position.length() * 6371).toLocaleString() + ' KM', prio:99 },
                { obj:sunSprite, text:'SUN · 150 M KM · ½° WIDE FROM HERE, AS IT IS FROM EARTH', prio:98 }];
  Object.keys(planetSprites).forEach(function(n){ bodies.push({ obj:planetSprites[n], text:n.toUpperCase() + ' · PLANET', prio:90 }); });
  var all = bodies.map(function(b){ return { text:b.text, pos:b.obj.position, prio:b.prio }; }).concat(LABEL_CANDIDATES);
  for (var i = 0; i < all.length; i++){
    var c = all[i];
    _lw.copy(c.pos).applyEuler(sky.rotation).applyQuaternion(globe.quaternion);
    if (_lw.z < 0 && c.prio < 90) { /* behind the camera plane is fine for far sky; projection handles it */ }
    _lw.project(camera);
    if (_lw.z > 1) continue;
    var sx = (_lw.x + 1) / 2 * W, sy = (1 - _lw.y) / 2 * H;
    if (sx < 30 || sx > W - 30 || sy < 30 || sy > H - 30) continue;
    if (Math.hypot(sx - cx, sy - cy) < earthPx + 24 && c.prio < 90) continue;   // hidden behind the Earth
    c._sx = sx; c._sy = sy; chosen.push(c);
  }
  chosen.sort(function(a, b){ return b.prio - a.prio; });
  var used = [];
  var n = 0;
  for (var k = 0; k < chosen.length && n < LABEL_POOL_SIZE; k++){
    var c2 = chosen[k], ok = true;
    for (var u = 0; u < used.length; u++){ if (Math.abs(used[u].x - c2._sx) < 150 && Math.abs(used[u].y - c2._sy) < 22){ ok = false; break; } }
    if (!ok) continue;
    used.push({ x:c2._sx, y:c2._sy });
    var lb = LABEL_POOL[n++];
    lb.material.map = labelTexture(c2.text, !!c2.dim); lb.material.needsUpdate = true;
    lb.scale.set(0.026 * 12, 0.026, 1);
    lb.position.copy(c2.pos); lb.visible = true;
  }
  for (; n < LABEL_POOL_SIZE; n++) LABEL_POOL[n].visible = false;
}

function setSkyDate(date){
  if (typeof Astronomy === 'undefined'){ return; }
  skyDate = date;
  var gmstDeg = Astronomy.SiderealTime(date) * 15;
  // the static sky was built at GMST 0 — turn it about the Earth's axis (three.js +Y) by −GMST
  sky.rotation.set(0, -gmstDeg * DEG, 0);
  function place(body, radius){
    var eq = Astronomy.EquatorFromVector(Astronomy.GeoVector(body, date, true));
    var ll = skyLonLat(eq.ra * 15, eq.dec, 0);   // GMST 0 frame, the group rotation adds the time
    return { v: toVec(ll[0], ll[1], radius), distAU: eq.dist };
  }
  var moon = place('Moon', 1); moonMesh.position.copy(moon.v.multiplyScalar(moon.distAU * AU_IN_EARTH_RADII));
  var sun = place('Sun', 700); sunSprite.position.copy(sun.v);
  // light the Earth (and the Moon) from the Sun's real direction; ambient keeps the night side readable
  var sunWorld = sun.v.clone().applyEuler(sky.rotation).applyQuaternion(globe.quaternion).normalize();
  sunLight.position.copy(sunWorld.multiplyScalar(50));
  Object.keys(planetSprites).forEach(function(name){ var v = place(name, SKY_R - 10).v; planetSprites[name].position.copy(v); });
  document.getElementById('skyDate').textContent = 'SKY FOR ' + date.toISOString().slice(0, 10) + ' ' + date.toISOString().slice(11, 16) + ' UTC';
}
function updateSunLight(){
  // the Sun sprite lives in the sky group (a child of the globe); re-derive the world-space light direction after any spin
  if (!sunSprite) return;
  var w = sunSprite.position.clone().applyEuler(sky.rotation).applyQuaternion(globe.quaternion).normalize();
  sunLight.position.copy(w.multiplyScalar(50));
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
var PHOTO_BOOST = 1.6;                         // 4^0.7 / 3^0.7 = 1.22, so this lifts a photo one weight class and a bit
function shownCap(){ return Math.round(Math.max(90, Math.min(MAX_SHOWN, 90 * Math.pow(3.9 / camDist, 2)))); }

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
var shardLoads = 0;
function ensureYears(start, end, done){
  // fetch the shards a window touches, append their rows to EVENTS, then call done(true) if anything new arrived
  if (!SHARDS){ done(false); return; }
  var need = SHARDS.years.filter(function(y){ return y >= Math.floor(start) && y <= Math.floor(end + STEP) && !loadedYears[y]; });   // the years the month touches
  if (!need.length){ done(false); return; }
  need.forEach(function(y){ loadedYears[y] = 'loading'; });
  var gen = ++shardLoads;
  Promise.all(need.map(function(y){
    return fetch(SHARDS.dir + y + '.json').then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });
  })).then(function(lists){
    lists.forEach(function(rows, k){
      loadedYears[need[k]] = true;
      rows.forEach(function(r){ var e = parseRow(r, EVENTS.length); prepareEvent(e); EVENTS.push(e); });
    });
    done(true, gen === shardLoads);
  });
}

// hologram card texture: the photo (or category glyph) with a tinted frame, scanlines and a badge
var CARD_TEX = {};
function cardTexture(e, onReady){
  var key = (IMAGES[e.slug] ? e.slug : 'glyph:' + e.cat) + (MEDIA[e.slug] ? '|m' : '');
  if (CARD_TEX[key] && onReady !== 'painter') return CARD_TEX[key];
  var cw = 256, ch = 192, col = css(CATS[e.cat].v);
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
      ctx.save(); ctx.translate(cw / 2 - 50, ch / 2 - 50); ctx.globalAlpha = 0.9; drawGlyph(ctx, e.cat, 100); ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    for (var y = 0; y < ch; y += 4) ctx.fillRect(0, y, cw, 1.5);
    ctx.lineWidth = 5; ctx.strokeStyle = col; ctx.strokeRect(2.5, 2.5, cw - 5, ch - 5);
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.strokeRect(8, 8, cw - 16, ch - 16);
    ctx.beginPath(); ctx.arc(cw - 26, ch - 26, 18, 0, 2 * Math.PI); ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.save(); ctx.translate(cw - 26 - 12, ch - 26 - 12); drawGlyph(ctx, e.cat, 24); ctx.restore();
    if (MEDIA[e.slug]){   // a clip: play badge, bottom-left
      ctx.beginPath(); ctx.arc(26, ch - 26, 16, 0, 2 * Math.PI); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(21, ch - 34); ctx.lineTo(21, ch - 18); ctx.lineTo(34, ch - 26); ctx.closePath(); ctx.fillStyle = '#0b1220'; ctx.fill();
    }
    if (canvas) return c;                                   // live frame: caller owns the texture
    var tex = new THREE.CanvasTexture(c); CARD_TEX[key] = tex; return tex;
  }
  if (onReady === 'painter') return paint;                    // used by the live (video) cards
  var im = IMAGES[e.slug];
  if (!im) return paint(null);
  var img = new Image();
  img.onload = function(){ onReady(paint(img)); };
  img.src = IMG_DIR + im.file;
  return null;
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

var shown = [];   // events currently bound to pool holders
var windowTotal = 0;
function bindWindow(){
  var w = WINDOWS[wi];
  var list = EVENTS.filter(function(e){ return !off[e.cat] && inWindow(e, w); });
  var now = w.end, slider = ERAS[w.era] && ERAS[w.era].slider;
  list.forEach(function(e){ e._p = slider ? prominence(e, now) : 1; });
  // What gets a card: loudness now, weighted by importance (w^0.7). A fresh small event beats a faded big one,
  // which is what "the news at this moment" means; a war at its background level still outranks minor items.
  // A real photograph is worth more on the globe than a glyph: an event with one ranks as if it were about one
  // weight class bigger, so most of the cards in view are pictures of the thing itself.
  function rank(e){ return Math.pow(e.w, 0.7) * e._p * (IMAGES[e.slug] ? PHOTO_BOOST : 1); }
  list.sort(function(a, b){ return (rank(b) - rank(a)) || (b.t0 - a.t0); });
  windowTotal = list.length;
  shown = list.slice(0, shownCap());
  // While a panel is open, the event and its "meanwhile" partners always have a card, whatever their rank,
  // so the pairing the panel lists is the pairing the globe shows.
  if (selected){
    var pinned = [selected].concat(contextFor(selected)).filter(function(e){ return !off[e.cat] && inWindow(e, w); });
    var rest = shown.filter(function(e){ return pinned.indexOf(e) < 0; });
    shown = pinned.concat(rest).slice(0, Math.max(shownCap(), pinned.length));
  }
  EVENTS.forEach(function(e){ e.holder = null; e._sx = null; });
  shown.forEach(function(e, i){
    var h = POOL[i], u = h.userData;
    var tex = cardTexture(e, function(t){ if (e.holder === h){ u.card.material.map = t; u.card.material.needsUpdate = true; render(); } });
    var live = liveFor2(e);
    u.card.material.map = tex || live.tex; u.card.material.needsUpdate = true;
    u.badge.material.map = BADGE_LIVE[liveKey(e)].tex; u.badge.material.needsUpdate = true;
    u.hasPhoto = !!tex;
    u.beam.material.color.set(css(CATS[e.cat].v));
    h.position.copy(e.foot); h.quaternion.copy(e.quat);
    e.holder = h; e.stackH = 0;
  });
  for (var j = shown.length; j < MAX_SHOWN; j++){ POOL[j].visible = false; }
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
globe.quaternion.copy(targetQuat(22, 18));

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
  var list = shown;
  var ctxEls = selected ? contextFor(selected) : [];
  var behind = 0;
  // A card's size is set in world units, so left alone it grows on screen exactly as fast as the Earth does and
  // zooming in reveals nothing — the same cards, larger. Scaling the world size with camDist cancels that out:
  // the card stays about the same number of pixels while the ground beneath it spreads apart, so coming in on a
  // country pulls its events out of one another. The exponent leaves cards a little larger up close, where you
  // are reading them, than they are with the whole Earth in frame.
  var zoomBoost = Math.max(0.30, Math.min(1.6, 0.86 * Math.pow(camDist / 3.9, 0.55)));
  var pxPerUnit = cardPixels();
  var placed = [];      // {x, y, hw, hh} of cards already laid out this frame, in px
  var hiddenCount = 0;
  // The Earth's silhouette in pixels. The camera sits on +Z looking at the origin, so the globe's centre is the
  // centre of the canvas; the edge is where the line of sight grazes a sphere of radius 1 at camDist away.
  // A card may climb only while it stays inside this circle — past it, it is standing on stars.
  var globeCX = W / 2, globeCY = H / 2;
  var limbPx = (H / 2) * Math.tan(Math.asin(Math.min(0.999, 1 / camDist))) / Math.tan(camera.fov * DEG / 2);
  // lay out by importance so the biggest events claim their spot first
  // ---- pass 1: measure every event and group the ones that stand on the same ground ----
  // The list is in importance order, so the first event at a place leads its group and the anchor is its spot.
  var groups = [];
  list.forEach(function(e){
    var h = e.holder; if (!h) return;
    var front = worldNormal(e).z > 0.12;
    h.visible = front;
    e.folded = null; e._sx = null;
    if (!front){ behind++; return; }
    var prom = e._p == null ? 1 : e._p;              // loudness now
    var scale = e.size * zoomBoost * (0.80 + 0.20 * prom);
    e._cw = CARD_W * scale; e._chh = CARD_H * scale; e._prom = prom;
    e._hw = e._cw * pxPerUnit / CARD_H * 0.5; e._hh = e._chh * pxPerUnit / CARD_H * 0.5;
    _v.copy(e.normal).multiplyScalar(1.002 + HOVER).applyQuaternion(globe.quaternion).project(camera);
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
    _v.copy(e.normal).multiplyScalar(1.002 + height).applyQuaternion(globe.quaternion).project(camera);
    return [(_v.x + 1) / 2 * W, (1 - _v.y) / 2 * H];
  }
  function clear(sx, sy, hw, hh, isSel){
    if (isSel) return true;
    if (Math.hypot(sx - globeCX, sy - globeCY) + hh * 0.55 > limbPx) return false;
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
    if (u.hasPhoto && MEDIA[e.slug] == null){
      var bs = chh * 0.34;
      u.badge.visible = true; u.badge.position.set(0, height, 0); u.badge.scale.set(bs, bs, 1);
      u.badge.center.set(0.5 + (cw / 2 - bs * 0.62) / bs, 0.5 + (chh / 2 - bs * 0.62) / bs);
    } else u.badge.visible = false;
    u.base.scale.set(0.02, 0.02, 1);
    var dim = selected && selected.id !== e.id && ctxEls.indexOf(e) < 0;
    var fade = 0.62 + 0.38 * e._prom;                            // headline bright, background dimmer, afterglow fading
    var tall = height > HOVER * 1.5;
    // with a panel open, everything but the event and its same-day partners steps back to a quarter
    u.card.material.opacity = (dim ? 0.25 : 0.96) * fade; u.badge.material.opacity = (dim ? 0.2 : 1) * fade;
    u.beam.material.opacity = dim ? 0.05 : (tall ? 0.4 : 0.22);  // a long beam has to be seen to be believed
    u.base.material.opacity = dim ? 0.2 : 0.9;
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
        if (clear(at[0], at[1], e._hw, e._hh, sel)){ show(e, height, at[0], at[1], group); done = true; }
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
  camera.position.z = camDist;
  // The near clipping plane has to stay in front of the Earth's surface, which sits camDist - 1 away. At the old
  // fixed 0.1 anything closer than 1.1 sliced the planet open and left you looking at stars. It is only pulled in
  // when it has to be, because a very small near plane costs depth precision everywhere else.
  var wantNear = Math.min(0.1, Math.max(0.02, (camDist - 1) * 0.4));
  if (Math.abs(camera.near - wantNear) > wantNear * 0.15){ camera.near = wantNear; camera.updateProjectionMatrix(); }

  if (selected && selected.holder){
    selRing.position.copy(selected.pos);
    var sz = CARD_W * selected.size * zoomBoost * 1.35; selRing.scale.set(sz, sz, 1);
    selRing.visible = worldNormal(selected).z > 0.12;
  } else selRing.visible = false;
  ctxRings.forEach(function(r, i){
    var e = ctxEls[i];
    if (!e || !e.holder){ r.visible = false; return; }
    r.position.copy(e.pos);
    var s2 = CARD_W * e.size * zoomBoost * 1.3; r.scale.set(s2, s2, 1);
    r.visible = worldNormal(e).z > 0.12;
  });

  updateSunLight();
  pickSkyLabels();
  renderer.render(scene, camera);
  // one line: what is on screen out of what is in the window. The rest was true and nobody read it.
  document.getElementById('count').innerHTML =
    (windowTotal > list.length ? 'TOP ' + list.length + ' OF ' + windowTotal + ' — ZOOM IN FOR MORE' : list.length + ' EVENT' + (list.length === 1 ? '' : 'S') + ' THIS MONTH');
}

function pick(mx, my){
  var best = null, bestD = 28;
  visibleEvents().forEach(function(e){
    if (e._sx == null) return;
    var d = Math.hypot(e._sx - mx, e._sy - my);
    if (d < bestD){ bestD = d; best = e; }
  });
  return best;
}
function spanYears(e){ return e.t1 - e.t0; }
function dayOrdinal(iso){
  // exact day count for CE dates ("2001-09-11" -> days since epoch); null for anything else
  var m = iso && iso.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return null;
  return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
}
var MEANWHILE_MAX = 6, MEANWHILE_APART_KM = 1200, MEANWHILE_DAYS = 3;
var meanwhileCache = { key:null, list:[] };
function contextFor(e){
  // "Meanwhile": what else happened on the very same day, in other parts of the world. The anchor is the
  // event's date — for something that ran for months or years, the day it began. Picks are the biggest events of
  // that day, spread out so no two stand within MEANWHILE_APART_KM of each other or of the event itself; when the
  // day has fewer than three, events one to three days either side fill in, each labelled with its gap. Nothing
  // further away in time is ever shown: a two-year overlap is not "at the same time".
  var key = e.id + '|' + EVENTS.length + '|' + Object.keys(off).filter(function(k){ return off[k]; }).join(',');
  if (meanwhileCache.key === key) return meanwhileCache.list;
  var out = [];
  var day0 = dayOrdinal(e.date);
  if (day0 != null){
    var cands = [];
    for (var i = 0; i < EVENTS.length; i++){
      var o = EVENTS[i];
      if (o.id === e.id || o.slug === e.slug || !o.date || off[o.cat]) continue;
      var od = dayOrdinal(o.date); if (od == null) continue;
      var gap = od - day0; if (gap < -MEANWHILE_DAYS || gap > MEANWHILE_DAYS) continue;
      if (kmApart(e, o) < MEANWHILE_APART_KM) continue;
      cands.push({ e:o, gap:gap, score:(gap === 0 ? 100 : 0) + o.w * 10 + (IMAGES[o.slug] ? 3 : 0) + (o.date === e.date ? 0 : -Math.abs(gap)) });
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
function skyDateFor(e){
  // a dated event within the ephemeris' reliable range shows the sky of that day at noon UTC
  if (e && e.date){ var y = parseInt(e.date, 10); if (y > 1600 && y < 2200){ var d = new Date(e.date + 'T12:00:00Z'); if (!isNaN(d)) return d; } }
  return new Date();
}
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
  selected = e;
  if (typeof setPlayDir === 'function' && playDir) setPlayDir(0);   // opening something stops the film, as in any player
  setSkyDate(skyDateFor(e));
  bindWindow(); render();                  // pin the event and its same-day partners onto the globe, then lay out
  var p = document.getElementById('panel');
  var ctxEls = contextFor(e);
  var when = whenLabel(e);
  var html = '<button class="pclose" id="pclose" aria-label="Close">✕</button>';
  html += '<div class="pcat"><img src="' + ICON_URL[e.cat] + '" alt="">' + CATS[e.cat].label + '</div>';
  var im = IMAGES[e.slug], md = MEDIA[e.slug];
  // the hero: the clip (or the photo, kept moving) magnified
  var centre = md
    ? (md.kind === 'video' ? '<video src="' + MEDIA_DIR + md.file + '" controls autoplay muted loop playsinline preload="metadata"></video>'
                           : (im ? '<img class="kb" src="' + IMG_DIR + im.file + '" alt="">' : '') + '<audio src="' + MEDIA_DIR + md.file + '" controls autoplay preload="metadata"></audio>')
    : im ? '<img class="kb" src="' + IMG_DIR + im.file + '" alt="">' : '<div class="imgslot"><img src="' + ICON_URL[e.cat] + '" alt="" style="width:44px;height:44px;opacity:.7"></div>';
  var credit = (md ? (md.title ? md.title + ' · ' : '') + (md.author ? md.author + ' · ' : '') + '<a href="' + (md.filePage || md.source || '#') + '" target="_blank" rel="noopener">' + (md.license || 'source') + '</a>'
                   : im ? (im.author ? im.author + ' · ' : '') + '<a href="' + im.filePage + '" target="_blank" rel="noopener">' + (im.license || 'Commons') + '</a>' : '');
  html += '<div class="hero">' + centre + '</div>';
  if (credit) html += '<div class="mcredit">' + credit + '</div>';
  html += '<h2>' + e.title + '</h2>';
  html += '<div class="pmeta">' + when + (e.endDate ? ' – ' + dayLabel(e.endDate) : '') + (e.who ? '<br>BY ' + e.who : '') + '<br>' + e.place + '</div>';
  html += '<p class="pdesc">' + tinyDesc(e) + '</p>';
  html += '<a class="plink" target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/' + e.slug + '">Read more →</a>';
  // the events standing on the same spot, which the "+N" chip on the globe counts. Biggest first, so the list
  // opens with the ones a reader is most likely to have been looking for.
  if (e.folded && e.folded.length){
    var here = e.folded.slice().sort(function(a, b){ return (b.w - a.w) || (b.t0 - a.t0); });
    html += '<div class="concurrent"><p>' + here.length + ' more event' + (here.length === 1 ? '' : 's') + ' within ' + FOLD_KM + ' km</p><div class="crow">';
    here.slice(0, 12).forEach(function(o){
      var th = IMAGES[o.slug] ? '<img class="kb" src="' + IMG_DIR + IMAGES[o.slug].file + '" alt="">' : '<img class="ic" src="' + ICON_URL[o.cat] + '" alt="">';
      html += '<button class="nb" data-id="' + o.id + '">' + th + '<b>' + o.title + '</b><span>' + o.place + ' · ' + (o.date ? dayLabel(o.date) : yearLabel(o.start)) + '</span></button>';
    });
    html += '</div></div>';
  }
  // meanwhile: the same day, elsewhere on the globe — "while this was happening here, that was happening there".
  // Place leads each row, so the pairing reads as geography; the same events are lit up on the globe.
  if (ctxEls.length){
    var began = spanYears(e) >= 45 / 365 || e.endDate;
    html += '<div class="concurrent meanwhile"><p>' + (began ? 'The day it began, elsewhere' : 'Meanwhile, elsewhere') + ' · ' + dayLabel(e.date) + '</p>';
    ctxEls.forEach(function(o){
      var thumb = IMAGES[o.slug] ? '<img class="kb" src="' + IMG_DIR + IMAGES[o.slug].file + '" alt="">' : '<img class="ic" src="' + ICON_URL[o.cat] + '" alt="">';
      var gapText = o._gap === 0 ? 'same day' : Math.abs(o._gap) + (Math.abs(o._gap) === 1 ? ' day ' : ' days ') + (o._gap > 0 ? 'later' : 'earlier');
      html += '<button class="mw" data-id="' + o.id + '">' + thumb + '<span class="mwt">' + (o.place ? '<em>' + o.place + '</em>' : '') + '<i>' + gapText + '</i><b>' + o.title + '</b></span></button>';
    });
    html += '</div>';
  }
  p.innerHTML = html;
  p.classList.add('on');
  writeHash();
  document.getElementById('pclose').onclick = closePanel;
  Array.prototype.forEach.call(p.querySelectorAll('.ew, .nb, .mw'), function(b){
    b.onclick = function(){ var t = EVENTS[+b.dataset.id]; spinTo(t); openPanel(t); };
  });
  resize();
}
function closePanel(){
  selected = null;
  setSkyDate(new Date());
  bindWindow();                            // unpin
  document.getElementById('panel').classList.remove('on');
  resize(); writeHash();
}

// ---------- live cards: a video clip plays (muted) inside its hologram, so a hurricane loops on the globe ----------
// The few biggest on-screen cards with a video clip get a canvas texture repainted from the video every frame.
var LIVE = {}, LIVE_MAX = 4;
function liveMax(){ return camDist < 2 ? 8 : LIVE_MAX; }   // close in, more of the cards on screen are worth running as video
var liveClips = Object.keys(MEDIA).some(function(k){ return MEDIA[k].kind === 'video'; });
function liveFor(e){
  var L = LIVE[e.slug];
  if (L) return L;
  var v = document.createElement('video');
  v.src = MEDIA_DIR + MEDIA[e.slug].file; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
  var canvas = document.createElement('canvas');
  var tex = new THREE.CanvasTexture(canvas);
  L = { video:v, canvas:canvas, tex:tex, paint:cardTexture(e, 'painter'), on:false, ready:false };
  v.addEventListener('loadeddata', function(){ L.ready = true; });
  LIVE[e.slug] = L; return L;
}
function updateLive(){
  var cands = [];
  for (var i = 0; i < shown.length; i++){
    var e = shown[i], md = MEDIA[e.slug];
    if (!md || md.kind !== 'video' || e._sx == null || !e.holder) continue;
    cands.push(e);
  }
  cands.sort(function(a, b){ return (b._px || 0) - (a._px || 0); });
  var keep = {};
  cands.slice(0, liveMax()).forEach(function(e){
    var L = liveFor(e); keep[e.slug] = true;
    if (!L.on){ L.on = true; L.video.play().catch(function(){ L.on = false; }); }
    if (L.ready && !L.video.paused){
      L.paint(L.video, L.canvas); L.tex.needsUpdate = true;
      var u = e.holder.userData;
      if (u.card.material.map !== L.tex){ u.card.material.map = L.tex; u.card.material.needsUpdate = true; }
    }
  });
  Object.keys(LIVE).forEach(function(slug){
    var L = LIVE[slug];
    if (L.on && !keep[slug]){
      L.on = false; L.video.pause();
      var e = EVENTS.find(function(x){ return x.slug === slug && x.holder; });
      if (e){ var u = e.holder.userData; var t = cardTexture(e, function(){}); if (t){ u.card.material.map = t; u.card.material.needsUpdate = true; } }
    }
  });
}

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
  if (SOUND.ctx && SOUND.master) SOUND.master.gain.setTargetAtTime(volume, SOUND.ctx.currentTime, 0.08);
  try { localStorage.setItem('gt-vol', String(Math.round(volume * 100))); } catch (err) {}
}
function soundNode(e){
  var n = SOUND.nodes[e.slug];
  if (n) return n;
  var md = MEDIA[e.slug];
  var el = document.createElement(md.kind === 'video' ? 'video' : 'audio');
  el.src = MEDIA_DIR + md.file; el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
  var src = SOUND.ctx.createMediaElementSource(el), gain = SOUND.ctx.createGain(), pan = SOUND.ctx.createStereoPanner ? SOUND.ctx.createStereoPanner() : null;
  gain.gain.value = 0;
  var out = masterGain();
  if (pan){ src.connect(gain); gain.connect(pan); pan.connect(out); } else { src.connect(gain); gain.connect(out); }
  n = { el:el, gain:gain, pan:pan, playing:false };
  SOUND.nodes[e.slug] = n; return n;
}
function updateSound(){
  if (!SOUND.on || !SOUND.ctx) return;
  if (!shown.length){ updateAmbient(0); return; }
  var cands = [];
  for (var i = 0; i < shown.length; i++){
    var e = shown[i];
    if (!MEDIA[e.slug] || e._sx == null) continue;
    cands.push(e);
  }
  if (selected && MEDIA[selected.slug] && cands.indexOf(selected) < 0) cands.push(selected);
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
  SOUND.on = on;
  var b = document.getElementById('soundBtn');
  // the button is an icon: the CSS shows the waves when it is on and the cross when it is off
  if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (on){
    if (!SOUND.ctx) SOUND.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (SOUND.ctx.state === 'suspended') SOUND.ctx.resume();
    updateSound();
  } else {
    Object.keys(SOUND.nodes).forEach(function(k){ var n = SOUND.nodes[k]; n.el.pause(); n.playing = false; n.gain.gain.value = 0; });
    if (SOUND.ambient) SOUND.ambient.out.gain.setTargetAtTime(0, SOUND.ctx.currentTime, 0.3);
  }
}
// Sharing a moment: the URL hash already carries the mode, the month and the open event, so the address bar is
// the share button. The header button is gone — it was taking a slot next to the categories to do what Cmd-L does.
window.__cgtSound = SOUND; window.__cgtEvents = EVENTS; window.__cgtShown = function(){ return shown; }; window.__cgtImages = IMAGES; window.__cgtOpen = openPanel; window.__cgtContext = contextFor; window.__cgtTickNext = function(){ tickerIndex++; showTicker(); }; window.__cgtSpin = function(e){ globe.quaternion.copy(targetQuat(e.lat, e.lon)); }; window.__cgtCam = function(){ return camDist.toFixed(2); }; window.__cgtNow = function(){ return WINDOWS[wi].end; }; window.__cgtGoto = function(y){ var i = WINDOWS.findIndex(function(w){ return Math.abs(w.end - y) < 0.05; }); if (i >= 0) setWindow(i); };   // debugging hooks
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
var spinAnim = null;
function spinTo(e){
  var from = globe.quaternion.clone(), to = targetQuat(e.lat, e.lon);
  var t0 = performance.now(), dur = 700;
  if (spinAnim) cancelAnimationFrame(spinAnim);
  (function step(t){
    var k = Math.min(1, (t - t0) / dur);
    var ease = k < 0.5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2) / 2;
    globe.quaternion.copy(from).slerp(to, ease);
    render();
    if (k < 1) spinAnim = requestAnimationFrame(step);
  })(t0);
  bumpIdle();
}

// ---------- pointer ----------
var dragging = false, lastX = 0, lastY = 0, moved = 0, shifted = false;
var velX = 0, velY = 0, lastMoveT = 0, spinDir = 1;
var AX = new THREE.Vector3(1,0,0), AY = new THREE.Vector3(0,1,0), AZ = new THREE.Vector3(0,0,1);
var qTmp = new THREE.Quaternion(), qTmp2 = new THREE.Quaternion();

canvas.addEventListener('pointerdown', function(ev){
  dragging = true; moved = 0; lastX = ev.clientX; lastY = ev.clientY; shifted = ev.shiftKey;
  velX = 0; velY = 0; lastMoveT = performance.now();
  canvas.classList.add('drag'); canvas.setPointerCapture(ev.pointerId); bumpIdle();
});
canvas.addEventListener('pointermove', function(ev){
  var rect = canvas.getBoundingClientRect();
  if (dragging){
    var dx = ev.clientX - lastX, dy = ev.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy); lastX = ev.clientX; lastY = ev.clientY;
    var k = 0.0042 * (camDist / 3.9);
    if (shifted){
      qTmp.setFromAxisAngle(AZ, -dx * k); globe.quaternion.premultiply(qTmp);
    } else {
      qTmp.setFromAxisAngle(AY, dx * k); qTmp2.setFromAxisAngle(AX, dy * k);
      globe.quaternion.premultiply(qTmp).premultiply(qTmp2);
      var now = performance.now(), dt = Math.max(1, now - lastMoveT); lastMoveT = now;
      velX = 0.6 * velX + 0.4 * (dx * k) * (16 / dt); velY = 0.6 * velY + 0.4 * (dy * k) * (16 / dt);
    }
    render(); bumpIdle(); return;
  }
  var mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
  var hit = pick(mx, my);
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
  if (!dragging) return;
  dragging = false; canvas.classList.remove('drag');
  if (performance.now() - lastMoveT > 80){ velX = spinDir * spinSpeed; velY = 0; }   // held still before release: no throw, keep turning
  if (moved < 5){ velX = spinDir * spinSpeed; velY = 0;
    var rect = canvas.getBoundingClientRect();
    var hit = pick(ev.clientX - rect.left, ev.clientY - rect.top);
    if (hit) openPanel(hit); else closePanel();
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', function(){ dragging = false; canvas.classList.remove('drag'); });
canvas.addEventListener('pointerleave', function(){ hovered = null; document.getElementById('tip').classList.remove('on'); });
canvas.addEventListener('wheel', function(ev){
  ev.preventDefault();
  camDist = Math.max(minCamDist, Math.min(140, camDist * (ev.deltaY > 0 ? 1.07 : 0.93)));   // the floor comes from the Earth texture (see minCamDist)
  hovered = null; document.getElementById('tip').classList.remove('on');
  bindWindow(); render(); if (SOUND.on) updateSound();   // zooming does not stop the globe turning; it changes the mix
}, { passive:false });

// ---------- idle spin ----------
function bumpIdle(){ idle = false; clearTimeout(idleTimer); idleTimer = setTimeout(function(){ idle = true; }, 4500); }
var kb = { tex:null };
function kenBurns(t){
  // every photo card drifts and breathes a little (a still made to move); the selected one moves more
  var any = false;
  for (var i = 0; i < shown.length; i++){
    var e = shown[i];
    if (!e.holder || !e.holder.visible || e._sx == null || !IMAGES[e.slug]) continue;
    var tex = CARD_TEX[e.slug + (MEDIA[e.slug] ? '|m' : '')];
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
  var moving = kenBurns(performance.now()); tickPlay(performance.now()); if (selected || moving) render();
  if (updateLiveGlyphs(performance.now()) && !selected) render();
  if (SOUND.on) updateSound();
  if (liveClips){ updateLive(); if (!selected) render(); }
  if (!dragging){
    // The globe moves when you move it. A flick carries on with momentum and settles; it does not resume a
    // spin of its own. The SPIN slider still exists for anyone who wants the old always-turning behaviour —
    // at zero, which is the default, the target is rest.
    if (Math.abs(velX) > 1e-6) spinDir = velX < 0 ? -1 : 1;
    var target = spinDir * spinSpeed;
    velX = target + (velX - target) * 0.955;
    velY *= 0.955;
    if (Math.abs(velX) > 1e-7 || Math.abs(velY) > 0.0003){
      qTmp.setFromAxisAngle(AY, velX); qTmp2.setFromAxisAngle(AX, velY);
      globe.quaternion.premultiply(qTmp).premultiply(qTmp2);
      render();
    }
  }
  requestAnimationFrame(tick);
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
// Time is a film. It runs from the moment the page opens and keeps running until you stop it; the transport at
// the bottom is the one from a video player. ⏪ and ⏩ set the direction and go a step faster each press
// (1x 2x 4x 8x 16x of a month every two seconds); ▶ / ⏸ stops and starts at the current speed; ⏮ and ⏭ jump to
// the ends. Running backwards is not a rewind of the picture: cards fade in and out exactly as they do going
// forwards, so you can sit on a month, walk back through what led to it, and stop.
var SPEEDS = [1, 2, 4, 8, 16];
var BASE_MONTHS_PER_SEC = 0.5;                                   // 1x: a month every two seconds
var playDir = 0, speedIx = 0, playAcc = 0, playLast = 0;
var playVal = document.getElementById('playVal');
var playBtn = document.getElementById('playBtn'), rewBtn = document.getElementById('rewBtn'), ffBtn = document.getElementById('ffBtn');
var toStartBtn = document.getElementById('toStartBtn'), toEndBtn = document.getElementById('toEndBtn');
function yearsPerSecNow(){ return BASE_MONTHS_PER_SEC * SPEEDS[speedIx] / 12; }
function showSpeed(){
  if (playBtn){ playBtn.innerHTML = playDir ? '&#10074;&#10074;' : '&#9654;'; playBtn.setAttribute('aria-pressed', playDir ? 'true' : 'false'); }
  if (playVal){
    var secPerMonth = 1 / (BASE_MONTHS_PER_SEC * SPEEDS[speedIx]);
    var rate = secPerMonth >= 1 ? 'A MONTH / ' + (secPerMonth >= 10 ? Math.round(secPerMonth) : secPerMonth.toFixed(1)) + ' S' : Math.round(1 / secPerMonth) + ' MONTHS / S';
    playVal.textContent = playDir === 0 ? 'PAUSED · ' + SPEEDS[speedIx] + '×' : (playDir < 0 ? '◀ ' : '▶ ') + SPEEDS[speedIx] + '× · ' + rate;
  }
}
function setPlayDir(dir){
  playDir = dir; playAcc = 0; playLast = performance.now();
  showSpeed();
}
// a press in the running direction goes one step faster; a press the other way turns round at 1x
function runToward(dir){
  if (playDir === dir) speedIx = Math.min(SPEEDS.length - 1, speedIx + 1);
  else speedIx = 0;
  if (dir > 0 && wi >= WINDOWS.length - 1) setWindow(0);
  if (dir < 0 && wi <= 0) setWindow(WINDOWS.length - 1);
  setPlayDir(dir);
}
if (playBtn){
  playBtn.onclick = function(){
    if (playDir) { setPlayDir(0); return; }
    if (wi >= WINDOWS.length - 1) setWindow(0);                       // at the far end: start over from the beginning
    setPlayDir(1);
  };
}
if (rewBtn) rewBtn.onclick = function(){ runToward(-1); };
if (ffBtn) ffBtn.onclick = function(){ runToward(1); };
if (toStartBtn) toStartBtn.onclick = function(){ setWindow(0); };
if (toEndBtn) toEndBtn.onclick = function(){ setWindow(WINDOWS.length - 1); };
showSpeed();
var playing = false;                                                // kept for the rail drag, which stops the clock
function setPlaying(on){ if (!on) setPlayDir(0); }
function tickPlay(now){
  playing = playDir !== 0;
  if (!playDir) return;
  playAcc += (now - playLast) / 1000 * yearsPerSecNow(); playLast = now;
  var step = ERAS[WINDOWS[wi].era].slider ? ERAS[WINDOWS[wi].era].step : (WINDOWS[wi].end - WINDOWS[wi].start);
  while (playAcc >= step){                                          // a while loop: at 16x a frame can cross several months
    playAcc -= step;
    var next = wi + playDir;
    if (next < 0 || next >= WINDOWS.length){ setPlayDir(0); return; }
    setWindow(next);
  }
}

// ---------- rail ----------
var track = document.getElementById('track');
var handle = null;
function buildRail(){
  track.innerHTML = '';
  track.classList.toggle('slider', !!ERAS[0].slider);
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
  var w = WINDOWS[wi], era = ERAS[w.era];
  if (era.slider){
    var span = era.to - era.from;
    var leftPct = (w.end - era.from) / span * 100;
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
var grabOffset = null;   // years between the pointer and the window start while dragging the slider
function railSet(clientX, first){
  var rect = track.getBoundingClientRect();
  var f = Math.max(0, Math.min(0.9999, (clientX - rect.left) / rect.width));
  if (ERAS[0].slider){
    var era = ERAS[0], width = era.width, yearAt = era.from + f * (era.to - era.from);
    var w = WINDOWS[wi];
    if (first) grabOffset = (yearAt >= w.start && yearAt <= w.end) ? yearAt - w.start : width / 2;
    setWindow(Math.round((yearAt - grabOffset - era.from) / era.step));
    return;
  }
  var ei = Math.floor(f * ERAS.length), within = f * ERAS.length - ei, era2 = ERAS[ei];
  setWindow(era2.first + Math.min(era2.count - 1, Math.floor(within * era2.count)));
}
var railDrag = false;
track.addEventListener('pointerdown', function(ev){ if (playing) setPlaying(false); railDrag = true; track.setPointerCapture(ev.pointerId); railSet(ev.clientX, true); });
track.addEventListener('pointermove', function(ev){ if (railDrag) railSet(ev.clientX); });
track.addEventListener('pointerup', function(){ railDrag = false; });
window.addEventListener('keydown', function(ev){
  var stepN = ERAS[0].slider && ev.shiftKey ? Math.round(1 / ERAS[0].step) : 1;     // shift + arrow: a whole year
  if (ev.key === 'ArrowLeft'){ setWindow(wi - stepN); ev.preventDefault(); }
  if (ev.key === 'ArrowRight'){ setWindow(wi + stepN); ev.preventDefault(); }
  if (ev.key === 'Escape') closePanel();
  if (ev.key === ' ' && ev.target === document.body && playBtn){ playBtn.onclick(); ev.preventDefault(); }
});
function setWindow(next){
  next = Math.max(0, Math.min(WINDOWS.length - 1, next));
  if (next === wi) return;
  wi = next;
  hovered = null; document.getElementById('tip').classList.remove('on'); canvas.style.cursor = '';
  if (selected && !inWindow(selected, WINDOWS[wi])) closePanel();
  else if (selected) openPanel(selected);
  bindWindow(); syncHeader(); placeHandle(); render(); writeHash(); resetTicker();   // the globe keeps turning while the slider moves
  ensureYears(WINDOWS[wi].start, WINDOWS[wi].end, function(added, latest){ if (added && latest){ bindWindow(); render(); resetTicker(); } });
}
function syncHeader(){
  var w = WINDOWS[wi], era = ERAS[w.era];
  var span = w.end - w.start;
  var stepLabel = span >= 1000000 ? (span/1000000) + ' MILLION-YEAR' : span >= 1000 ? (span/1000) + ',000-YEAR' : Math.round(span) + '-YEAR';
  var nowText = era.slider ? monthLabel(w.end) : rangeLabel(w.start, w.end);
  document.getElementById('now').innerHTML = '<span class="nowlab">NOW</span><b>' + nowText + '</b>' +
    (era.slider ? '<span class="nowsub">new events are loud · long ones settle into the background · ended ones fade</span>' : (era.name ? '<span class="nowsub">' + era.name + ' · ' + stepLabel + ' WINDOW</span>' : ''));
  track.setAttribute('aria-valuetext', 'now ' + nowText);
}

// ---------- filters ----------
var fWrap = document.getElementById('filters');
Object.keys(CATS).forEach(function(k){
  var b = document.createElement('button'); b.className = 'f'; b.setAttribute('aria-pressed', 'true');
  b.innerHTML = '<img src="' + ICON_URL[k] + '" alt="">' + CATS[k].label;
  b.onclick = function(){
    off[k] = !off[k]; b.setAttribute('aria-pressed', off[k] ? 'false' : 'true');
    bindWindow(); if (selected && off[selected.cat]) closePanel(); render();
  };
  fWrap.appendChild(b);
});

// ---------- mode switch ----------
function setMode(next, keepYear){
  if (next === mode) return;
  var year = keepYear != null ? keepYear : WINDOWS[wi].start;
  mode = next; ERAS = ERA_SETS[mode]; buildWindows(); buildRail();
  wi = WINDOWS.findIndex(function(w){ return Math.abs(w.start - year) < 0.02; });
  if (wi < 0) wi = WINDOWS.findIndex(function(w){ return w.start <= year && w.end > year; });
  if (wi < 0) wi = WINDOWS.length - 1;
  Array.prototype.forEach.call(document.querySelectorAll('#modes button'), function(b){ b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false'); });
  closePanel(); bindWindow(); syncHeader(); placeHandle(); render(); writeHash(); resetTicker();
  ensureYears(WINDOWS[wi].start, WINDOWS[wi].end, function(added, latest){ if (added && latest){ bindWindow(); render(); resetTicker(); } });
}
Array.prototype.forEach.call(document.querySelectorAll('#modes button'), function(b){
  b.onclick = function(){ setMode(b.dataset.mode); };
});

// ---------- URL state: #mode=century&y=1965&e=Apollo_11 ----------
function writeHash(){
  var parts = ['mode=' + mode, 'y=' + (Math.round(WINDOWS[wi].start * 100) / 100)];
  if (selected) parts.push('e=' + encodeURIComponent(selected.slug));
  history.replaceState(null, '', '#' + parts.join('&'));
}
function readHash(){
  var h = {}; location.hash.slice(1).split('&').forEach(function(p){ var kv = p.split('='); if (kv[0]) h[kv[0]] = decodeURIComponent(kv[1] || ''); });
  if (h.mode && ERA_SETS[h.mode] && h.mode !== mode) setMode(h.mode, h.y ? +h.y : null);
  else if (h.y){ var y = +h.y; var i = WINDOWS.findIndex(function(w){ return Math.abs(w.start - y) < 0.02; }); if (i < 0) i = WINDOWS.findIndex(function(w){ return w.start <= y && w.end > y; }); if (i >= 0 && i !== wi){ wi = i; bindWindow(); syncHeader(); placeHandle(); resetTicker(); } }
  if (h.e){
    var w = WINDOWS[wi];
    var matches = EVENTS.filter(function(x){ if (x.slug === h.e) return true; try { return decodeURIComponent(x.slug) === h.e; } catch (err){ return false; } });
    var e = matches.find(function(x){ return inWindow(x, w); }) || matches[0];
    if (e){
      if (!inWindow(e, w)){ var i = WINDOWS.findIndex(function(win){ return inWindow(e, win); }); if (i >= 0) wi = i; }
      bindWindow(); syncHeader(); placeHandle(); spinTo(e); openPanel(e);
    }
  }
}

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
  var q = IMAGES[e.slug] ? 2 : 0;
  if (kindOf(e) === KIND_DEFAULT[e.cat]) q -= 2;
  if (/ — | – /.test(e.title)) q -= 2;                // "name — description", or a sub-event ("Fencing at the Olympics – men's foil")
  if (/: [a-z]/.test(e.title)) q -= 1.5;           // "2006 Turkish Grand Prix: Formula One motor race" is a label, not news
  return q;
}
function coincidences(){
  // The line under the globe: one calendar day, two things from two distant parts of the world — "28 Dec · X, while
  // Y" — or one thing alone when it is big enough to carry the line (9/11 needs no partner). Only the same day
  // qualifies; a consequence years later belongs to the panel's links, not here. Lines close to NOW come first,
  // so the strip follows the film; each event appears in one line at most.
  // The strip is the news of NOW: only days in the two months up to the NOW mark qualify, so the line moves with
  // the film. A quiet stretch widens to six months, then to the whole window, rather than going blank.
  var w = WINDOWS[wi], now = w.end;
  var reaches = [2 / 12, 6 / 12, 5], lines = [];
  for (var r = 0; r < reaches.length && lines.length < 3; r++){
    lines = linesWithin(w, now, reaches[r]);
  }
  return lines;
}
function linesWithin(w, now, reach){
  var byDay = {};
  EVENTS.forEach(function(e){
    if (!e.date || e.w < 3 || off[e.cat] || !inWindow(e, w)) return;
    if (e.t0 >= now + STEP || now + STEP - e.t0 > reach) return;   // the month on the globe and the reach before it
    if (e.title.split(/\s+/).length < 3) return;                   // "Megaclite introduced" is not a line anyone can read
    (byDay[e.date] = byDay[e.date] || []).push(e);
  });
  var lines = [];
  Object.keys(byDay).forEach(function(d){
    var arr = byDay[d];
    var recency = arr[0].t0 >= now ? 3 : now - arr[0].t0 < 0.5 ? 1 : 0;   // this very month first
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
var tickerPairs = [], tickerIndex = 0, tickerTimer = null;
function tickerSide(e){
  // the place is added only when the headline does not already say it
  var t = shortTitle(e);
  var place = e.place && t.toLowerCase().indexOf(e.place.toLowerCase().split(/[ ,(]/)[0]) < 0 ? e.place : '';
  return '<span class="ts" data-id="' + e.id + '">' + t + (place ? '<em>' + place + '</em>' : '') + '</span>';
}
function showTicker(){
  var el = document.getElementById('ticker');
  if (!tickerPairs.length){ el.classList.remove('on'); return; }
  var p = tickerPairs[tickerIndex % tickerPairs.length];
  el.innerHTML = '<span class="tk">' + dayLabel(p.a.date) + '</span>' + tickerSide(p.a) + (p.b ? '<span class="tw">while</span>' + tickerSide(p.b) : '');
  el.classList.add('on');
  Array.prototype.forEach.call(el.querySelectorAll('.ts'), function(side){
    side.onclick = function(){ var t = EVENTS[+side.dataset.id]; spinTo(t); openPanel(t); };
  });
}
function resetTicker(){
  tickerPairs = coincidences(); tickerIndex = 0; showTicker();
  clearInterval(tickerTimer); tickerTimer = setInterval(function(){ tickerIndex++; showTicker(); }, 9000);
}
document.getElementById('aboutCounts').textContent = EVENTS.length.toLocaleString() + ' events · ' + Object.keys(IMAGES).length.toLocaleString() + ' photographs';
document.getElementById('aboutBtn').onclick = function(){ document.getElementById('about').classList.toggle('on'); };
document.getElementById('aboutClose').onclick = function(){ document.getElementById('about').classList.remove('on'); };
window.addEventListener('resize', resize);
buildSkyStatic(); setSkyDate(new Date());
bindWindow(); syncHeader(); placeHandle(); resize(); tick(); readHash(); resetTicker(); setTimeout(placeHandle, 60);
// The film starts rolling on its own. A link that opens on a particular event stays paused on that moment, since
// whoever shared it meant that month; otherwise time runs forward at 1x from wherever the page opened, and from
// the beginning if it opened at the very end.
if (!selected && !/[#&]e=/.test(location.hash)){
  if (!/[#&]y=/.test(location.hash)){
    // no month asked for: open on January 2020 and roll from there, so the first thing a visitor sees is the
    // pandemic year arriving rather than the last frame of the film
    var opening = WINDOWS.findIndex(function(w){ return Math.abs(w.end - 2020) < 0.02; });   // a window is named by its NOW, its end
    if (opening >= 0) setWindow(opening);
  }
  if (wi >= WINDOWS.length - 1) setWindow(0);
  setPlayDir(1);
}
ensureYears(WINDOWS[wi].start, WINDOWS[wi].end, function(added){ if (added){ bindWindow(); render(); resetTicker(); if (!selected && /[#&]e=/.test(location.hash)) readHash(); } });
setInterval(function(){ if (!selected || !selected.date) setSkyDate(new Date()); }, 60000);
};
// Load data files, then start the app.
(function(){
  if (window.__GT){ window.__gtStart(); return; }   // playground build: data already inlined
  function get(url){ return fetch(url).then(function(r){ if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
  Promise.all([ get('data/events.json'), get('data/images.json'), get('assets/countries-110m.json'), get('assets/skylabels.json'),
                get('data/media.json').catch(function(){ return {}; }), get('data/index.json').catch(function(){ return null; }), get('data/links.json').catch(function(){ return []; }) ])
    .then(function(res){
      window.__GT = { events:res[0], images:res[1], borders:res[2], skyLabels:res[3], media:res[4], shards: res[5] && res[5].years ? { years:res[5].years, dir:'data/y/' } : null, links:res[6] };
      window.__gtStart();
    })
    .catch(function(err){ document.getElementById('note').textContent = 'COULD NOT LOAD DATA — ' + err.message; console.error(err); });
})();
