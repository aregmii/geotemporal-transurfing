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
  return { id:i, title:r[0], lat:r[1], lon:r[2], start:r[3], end:r[4], cat:r[5], w:r[6], place:r[7], desc:r[8], slug:r[9],
           date:(typeof r[10] === 'string' && /^-?\d{1,6}-\d{2}-\d{2}$/.test(r[10]) && !/-01-01$/.test(r[10])) ? r[10] : null, who:r[11] || null };
}
var EVENTS = RAW.map(parseRow);
// Large builds keep only the top events per year in events.json and the rest in data/y/<year>.json shards,
// listed in data/index.json; a window loads the shards it touches on demand (not in the playground build).
var SHARDS = window.__GT.shards || null;   // { years:[...], dir:'data/y/' }
var loadedYears = {};

// Two rails. "century" = calendar decades with 5-year windows; "all" = eleven eras from the first stone tools.
var ERA_SETS = {
  // a slider: the window is `width` years wide and moves one year at a time across from..to
  recent:  [ {name:'', label:'', from:2000, to:2026, step:1, width:5,  slider:true, tick:5} ],
  century: [ {name:'', label:'', from:1926, to:2026, step:1, width:10, slider:true, tick:10} ],
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
    var n = era.slider ? (era.to - era.from - width) / era.step + 1 : Math.ceil((era.to - era.from) / era.step);
    era.first = WINDOWS.length; era.count = n;
    for (var k = 0; k < n; k++){
      var a = era.from + k * era.step;
      WINDOWS.push({ start:a, end:Math.min(a + width, era.to), era:ei });
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
  return a + '–' + b;
}

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

var tex = new THREE.TextureLoader().load(EARTH_SRC, function(){ render(); });
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
                { obj:sunSprite, text:'SUN · 150 M KM', prio:98 }];
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
function shownCap(){ return Math.round(Math.max(48, Math.min(MAX_SHOWN, 48 * Math.pow(3.9 / camDist, 2)))); }

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
  var card = new THREE.Sprite(new THREE.SpriteMaterial({ map:SPRITE_TEX.con, transparent:true, depthTest:true, depthWrite:false }));
  holder.add(beam); holder.add(base); holder.add(card);
  holder.visible = false; holder.userData = { beam:beam, base:base, card:card };
  POOL.push(holder); markers.add(holder);
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
  var need = SHARDS.years.filter(function(y){ return y >= start && y <= end && !loadedYears[y]; });
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

var shown = [];   // events currently bound to pool holders
var windowTotal = 0;
function bindWindow(){
  var w = WINDOWS[wi];
  var list = EVENTS.filter(function(e){ return !off[e.cat] && e.start <= w.end && e.end >= w.start; });
  list.sort(function(a, b){ return b.w - a.w; });
  windowTotal = list.length;
  shown = list.slice(0, shownCap());
  EVENTS.forEach(function(e){ e.holder = null; e._sx = null; });
  shown.forEach(function(e, i){
    var h = POOL[i], u = h.userData;
    var tex = cardTexture(e, function(t){ if (e.holder === h){ u.card.material.map = t; u.card.material.needsUpdate = true; render(); } });
    u.card.material.map = tex || GLYPH_TEX[e.cat]; u.card.material.needsUpdate = true;
    u.beam.material.color.set(css(CATS[e.cat].v));
    h.position.copy(e.foot); h.quaternion.copy(e.quat);
    e.holder = h; e.stackH = 0;
  });
  for (var j = shown.length; j < MAX_SHOWN; j++){ POOL[j].visible = false; }
}
var selRing = new THREE.Sprite(new THREE.SpriteMaterial({ map:RING_TEX, transparent:true, depthTest:false }));
selRing.visible = false; selRing.renderOrder = 5; globe.add(selRing);
var ctxRings = [0,1,2].map(function(){
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
  var zoomBoost = Math.max(1, Math.min(1.25, 3.9 / camDist));
  var pxPerUnit = cardPixels();
  var placed = [];      // {x, y, hw, hh} of cards already laid out this frame, in px
  var hiddenCount = 0;
  // lay out by importance so the biggest events claim their spot first
  list.forEach(function(e){
    var h = e.holder; if (!h) return;
    var front = worldNormal(e).z > 0.12;
    h.visible = front;
    if (!front){ e._sx = null; behind++; return; }
    var scale = e.size * zoomBoost;
    var cw = CARD_W * scale, chh = CARD_H * scale;
    var hwPx = cw * pxPerUnit / CARD_H * 0.5, hhPx = chh * pxPerUnit / CARD_H * 0.5;
    // cards float just above the surface; a card that would overlap a more important one is hidden,
    // leaving only its base dot — zooming in gives it room and it appears
    var height = HOVER, sx, sy;
    _v.copy(e.normal).multiplyScalar(1.002 + height).applyQuaternion(globe.quaternion).project(camera);
    sx = (_v.x + 1) / 2 * W; sy = (1 - _v.y) / 2 * H;
    var clash = false;
    if (!(selected && selected.id === e.id)){
      for (var i = 0; i < placed.length; i++){
        var p = placed[i];
        if (Math.abs(p.x - sx) < p.hw + hwPx && Math.abs(p.y - sy) < p.hh + hhPx){ clash = true; break; }
      }
    }
    var u = h.userData;
    if (clash){
      u.card.visible = false; u.beam.visible = false; u.base.visible = true; u.base.scale.set(0.03, 0.03, 1);
      e._sx = null; e.stackH = 0; e.pos.copy(e.foot); hiddenCount++;
      return;
    }
    placed.push({ x:sx, y:sy, hw:hwPx, hh:hhPx });
    e._sx = sx; e._sy = sy; e._px = hwPx * 2; e.stackH = height;
    u.card.visible = true; u.beam.visible = true; u.base.visible = true;
    u.beam.scale.set(1, height, 1);
    u.card.position.set(0, height, 0);
    u.card.scale.set(cw, chh, 1);
    u.base.scale.set(0.02, 0.02, 1);
    var dim = selected && selected.id !== e.id && ctxEls.indexOf(e) < 0;
    u.card.material.opacity = dim ? 0.45 : 0.96;
    u.beam.material.opacity = dim ? 0.08 : 0.22;
    u.base.material.opacity = dim ? 0.3 : 0.9;
    e.pos.copy(e.normal).multiplyScalar(1.002 + height);
  });
  window.__borders.visible = WINDOWS[wi].start >= 1900;
  camera.position.z = camDist;

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
  document.getElementById('count').innerHTML =
    (windowTotal > list.length ? 'TOP ' + list.length + ' OF ' + windowTotal + ' EVENTS IN THIS WINDOW — ZOOM IN FOR MORE' : list.length + ' EVENT' + (list.length === 1 ? '' : 'S') + ' IN THIS WINDOW') +
    (hiddenCount ? '<br>' + hiddenCount + ' TUCKED UNDER OTHERS — ZOOM IN' : '') +
    (behind ? '<br>' + behind + ' ON THE FAR SIDE — KEEP SPINNING' : '') +
    (list.length < 4 ? '<br><em>SPARSE — THE PLACEHOLDER DATA THINS OUT HERE</em>' : '');
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
function contextFor(e){
  var here = e.normal, d0 = e.date ? dayNumber(e.date) : null;
  var pool = visibleEvents().filter(function(o){ return o.id !== e.id && here.angleTo(o.normal) > 0.45; });
  if (d0 != null){
    var dated = pool.filter(function(o){ return o.date; }).map(function(o){ return { e:o, gap:Math.abs(dayNumber(o.date) - d0) }; });
    dated.sort(function(a, b){ return (a.gap - b.gap) || (b.e.w - a.e.w); });
    var near = dated.filter(function(x){ return x.gap <= 92; }).slice(0, 3).map(function(x){ x.e._gap = Math.round(x.gap); return x.e; });
    if (near.length) return near;
  }
  pool.forEach(function(o){ o._gap = null; });
  return pool.sort(function(a, b){ return b.w - a.w; }).slice(0, 3);
}

// ---------- panel ----------
function skyDateFor(e){
  // a dated event within the ephemeris' reliable range shows the sky of that day at noon UTC
  if (e && e.date){ var y = parseInt(e.date, 10); if (y > 1600 && y < 2200){ var d = new Date(e.date + 'T12:00:00Z'); if (!isNaN(d)) return d; } }
  return new Date();
}
function openPanel(e){
  selected = e;
  setSkyDate(skyDateFor(e));
  var p = document.getElementById('panel');
  var ctxEls = contextFor(e);
  var when = whenLabel(e);
  var html = '<button class="pclose" id="pclose" aria-label="Close">✕</button>';
  html += '<div class="pcat"><img src="' + ICON_URL[e.cat] + '" alt="">' + CATS[e.cat].label + '</div>';
  var im = IMAGES[e.slug];
  if (im){
    html += '<figure class="pimg"><img src="' + IMG_DIR + im.file + '" alt="" loading="lazy"><figcaption>' +
            (im.author ? im.author + ' · ' : '') + '<a href="' + im.filePage + '" target="_blank" rel="noopener">' + (im.license || 'Commons') + '</a></figcaption></figure>';
  } else {
    html += '<div class="imgslot"><img src="' + ICON_URL[e.cat] + '" alt="" style="width:44px;height:44px;opacity:.7"></div>';
  }
  html += '<h2>' + e.title + '</h2>';
  html += '<div class="pmeta">' + when + (e.who ? '<br>BY ' + e.who : '') + '<br>' + e.place + '</div>';
  var md = MEDIA[e.slug];
  if (md){
    html += '<div class="pmedia">' + (md.kind === 'video'
      ? '<video src="' + MEDIA_DIR + md.file + '" controls playsinline preload="metadata"></video>'
      : '<audio src="' + MEDIA_DIR + md.file + '" controls preload="metadata"></audio>') +
      '<div class="mcredit">' + (md.title ? md.title + ' · ' : '') + (md.author ? md.author + ' · ' : '') +
      '<a href="' + (md.filePage || md.source || '#') + '" target="_blank" rel="noopener">' + (md.license || 'source') + '</a></div></div>';
  }
  html += '<p class="pdesc">' + e.desc + '</p>';
  html += '<a class="plink" target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/' + e.slug + '">Read more →</a>';
  if (ctxEls.length){
    var byDate = ctxEls[0]._gap != null;
    html += '<div class="elsewhere"><p>' + (byDate ? 'Elsewhere, within weeks of ' + dayLabel(e.date) : 'Elsewhere, ' + rangeLabel(WINDOWS[wi].start, WINDOWS[wi].end)) + '</p>';
    ctxEls.forEach(function(o){
      var gapText = o._gap != null ? (o._gap === 0 ? 'same day' : o._gap === 1 ? '1 day apart' : o._gap + ' days apart') : '';
      html += '<button class="ew" data-id="' + o.id + '"><img src="' + ICON_URL[o.cat] + '" alt="">' +
              '<span><b>' + o.title + '</b><span>' + (gapText ? gapText + ' · ' : '') + o.place + '</span></span></button>';
    });
    html += '</div>';
  }
  p.innerHTML = html;
  p.classList.add('on');
  writeHash();
  document.getElementById('pclose').onclick = closePanel;
  Array.prototype.forEach.call(p.querySelectorAll('.ew'), function(b){
    b.onclick = function(){ var t = EVENTS[+b.dataset.id]; spinTo(t); openPanel(t); };
  });
  resize();
}
function closePanel(){
  selected = null;
  setSkyDate(new Date());
  document.getElementById('panel').classList.remove('on');
  resize(); writeHash();
}

// ---------- live cards: a video clip plays (muted) inside its hologram, so a hurricane loops on the globe ----------
// The few biggest on-screen cards with a video clip get a canvas texture repainted from the video every frame.
var LIVE = {}, LIVE_MAX = 4;
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
  cands.slice(0, LIVE_MAX).forEach(function(e){
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
var SOUND = { on:false, ctx:null, nodes:{}, active:[] };
var SOUND_MAX = 3, SOUND_QUIET_PX = 45, SOUND_FULL_PX = 220;   // card width on screen: silent below, full above (a big card at max zoom is ~280 px)
function soundNode(e){
  var n = SOUND.nodes[e.slug];
  if (n) return n;
  var md = MEDIA[e.slug];
  var el = document.createElement(md.kind === 'video' ? 'video' : 'audio');
  el.src = MEDIA_DIR + md.file; el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
  var src = SOUND.ctx.createMediaElementSource(el), gain = SOUND.ctx.createGain(), pan = SOUND.ctx.createStereoPanner ? SOUND.ctx.createStereoPanner() : null;
  gain.gain.value = 0;
  if (pan){ src.connect(gain); gain.connect(pan); pan.connect(SOUND.ctx.destination); } else { src.connect(gain); gain.connect(SOUND.ctx.destination); }
  n = { el:el, gain:gain, pan:pan, playing:false };
  SOUND.nodes[e.slug] = n; return n;
}
function updateSound(){
  if (!SOUND.on || !SOUND.ctx) return;
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
  if (b){ b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.textContent = on ? 'Sound on' : 'Sound off'; }
  if (on){
    if (!SOUND.ctx) SOUND.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (SOUND.ctx.state === 'suspended') SOUND.ctx.resume();
    updateSound();
  } else {
    Object.keys(SOUND.nodes).forEach(function(k){ var n = SOUND.nodes[k]; n.el.pause(); n.playing = false; n.gain.gain.value = 0; });
  }
}
window.__cgtSound = SOUND; window.__cgtEvents = EVENTS; window.__cgtCam = function(){ return camDist.toFixed(2); };   // debugging hooks
var soundBtn = document.getElementById('soundBtn');
if (soundBtn){
  if (!Object.keys(MEDIA).length) soundBtn.hidden = true;
  soundBtn.onclick = function(){ setSound(!SOUND.on); };
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
var velX = 0, velY = 0, lastMoveT = 0;
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
      tip.querySelector('.ty').textContent =
        whenLabel(hit) + ' · ' + hit.place.toUpperCase();
      tip.style.left = hit._sx + 'px'; tip.style.top = hit._sy + 'px';
      tip.classList.add('on'); canvas.style.cursor = 'pointer';
    } else { tip.classList.remove('on'); canvas.style.cursor = ''; }
  }
});
function endDrag(ev){
  if (!dragging) return;
  dragging = false; canvas.classList.remove('drag');
  if (performance.now() - lastMoveT > 80){ velX = 0; velY = 0; }   // held still before release: no throw
  if (moved < 5){ velX = 0; velY = 0;
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
  camDist = Math.max(1.6, Math.min(140, camDist * (ev.deltaY > 0 ? 1.07 : 0.93)));
  hovered = null; document.getElementById('tip').classList.remove('on');
  bindWindow(); bumpIdle(); render();
}, { passive:false });

// ---------- idle spin ----------
function bumpIdle(){ idle = false; clearTimeout(idleTimer); idleTimer = setTimeout(function(){ idle = true; }, 4500); }
var kb = { tex:null };
function kenBurns(t){
  var tex = selected && selected.holder && IMAGES[selected.slug] ? CARD_TEX[selected.slug] : null;
  if (kb.tex && kb.tex !== tex){ kb.tex.repeat.set(1, 1); kb.tex.offset.set(0, 0); kb.tex.needsUpdate = true; kb.tex = null; }
  if (!tex) return;
  kb.tex = tex; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  var z = 0.82 + 0.04 * Math.sin(t / 2600);
  tex.repeat.set(z, z); tex.offset.set((1 - z) / 2 + 0.05 * Math.sin(t / 3100), (1 - z) / 2 + 0.05 * Math.cos(t / 4300));
}
function tick(){
  kenBurns(performance.now()); if (selected) render();
  if (SOUND.on) updateSound();
  if (liveClips){ updateLive(); if (!selected) render(); }
  if (!dragging && (Math.abs(velX) > 0.0003 || Math.abs(velY) > 0.0003)){
    qTmp.setFromAxisAngle(AY, velX); qTmp2.setFromAxisAngle(AX, velY);
    globe.quaternion.premultiply(qTmp).premultiply(qTmp2);
    velX *= 0.965; velY *= 0.965;           // decay: a flick coasts for a second or two, then settles
    render();
  } else if (idle && !selected && !dragging){
    qTmp.setFromAxisAngle(AY, 0.00035); globe.quaternion.premultiply(qTmp); render();
  }
  requestAnimationFrame(tick);
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
    handle.style.left = ((w.start - era.from) / span * 100) + '%';
    handle.style.width = ((w.end - w.start) / span * 100) + '%';
    handle.textContent = rangeLabel(w.start, w.end);
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
    setWindow(Math.round(yearAt - grabOffset - era.from));
    return;
  }
  var ei = Math.floor(f * ERAS.length), within = f * ERAS.length - ei, era2 = ERAS[ei];
  setWindow(era2.first + Math.min(era2.count - 1, Math.floor(within * era2.count)));
}
var railDrag = false;
track.addEventListener('pointerdown', function(ev){ railDrag = true; track.setPointerCapture(ev.pointerId); railSet(ev.clientX, true); });
track.addEventListener('pointermove', function(ev){ if (railDrag) railSet(ev.clientX); });
track.addEventListener('pointerup', function(){ railDrag = false; });
window.addEventListener('keydown', function(ev){
  if (ev.key === 'ArrowLeft'){ setWindow(wi - 1); ev.preventDefault(); }
  if (ev.key === 'ArrowRight'){ setWindow(wi + 1); ev.preventDefault(); }
  if (ev.key === 'Escape') closePanel();
});
function setWindow(next){
  next = Math.max(0, Math.min(WINDOWS.length - 1, next));
  if (next === wi) return;
  wi = next;
  hovered = null; document.getElementById('tip').classList.remove('on'); canvas.style.cursor = '';
  if (selected && !(selected.start <= WINDOWS[wi].end && selected.end >= WINDOWS[wi].start)) closePanel();
  else if (selected) openPanel(selected);
  bindWindow(); syncHeader(); placeHandle(); bumpIdle(); render(); writeHash(); resetTicker();
  ensureYears(WINDOWS[wi].start, WINDOWS[wi].end, function(added, latest){ if (added && latest){ bindWindow(); render(); resetTicker(); } });
}
function syncHeader(){
  var w = WINDOWS[wi], era = ERAS[w.era];
  var span = w.end - w.start;
  var stepLabel = span >= 1000000 ? (span/1000000) + ' MILLION-YEAR' : span >= 1000 ? (span/1000) + ',000-YEAR' : span + '-YEAR';
  document.getElementById('now').innerHTML = '<b>' + rangeLabel(w.start, w.end) + '</b>' + (era.name ? ' · ' + era.name : '') + ' · ' + stepLabel + ' WINDOW';
  track.setAttribute('aria-valuetext', rangeLabel(w.start, w.end));
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
  wi = WINDOWS.findIndex(function(w){ return w.start === year; });
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
  var parts = ['mode=' + mode, 'y=' + WINDOWS[wi].start];
  if (selected) parts.push('e=' + encodeURIComponent(selected.slug));
  history.replaceState(null, '', '#' + parts.join('&'));
}
function readHash(){
  var h = {}; location.hash.slice(1).split('&').forEach(function(p){ var kv = p.split('='); if (kv[0]) h[kv[0]] = decodeURIComponent(kv[1] || ''); });
  if (h.mode && ERA_SETS[h.mode] && h.mode !== mode) setMode(h.mode, h.y ? +h.y : null);
  else if (h.y){ var y = +h.y; var i = WINDOWS.findIndex(function(w){ return w.start === y; }); if (i < 0) i = WINDOWS.findIndex(function(w){ return w.start <= y && w.end > y; }); if (i >= 0 && i !== wi){ wi = i; bindWindow(); syncHeader(); placeHandle(); resetTicker(); } }
  if (h.e){
    var w = WINDOWS[wi];
    var matches = EVENTS.filter(function(x){ return x.slug === h.e; });
    var e = matches.find(function(x){ return x.start <= w.end && x.end >= w.start; }) || matches[0];
    if (e){
      if (!(e.start <= w.end && e.end >= w.start)){ var i = WINDOWS.findIndex(function(win){ return e.start <= win.end && e.end >= win.start; }); if (i >= 0) wi = i; }
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
function coincidences(){
  var w = WINDOWS[wi];
  var inWin = EVENTS.filter(function(e){ return e.start <= w.end && e.end >= w.start; });
  var bySlug = {};
  inWin.forEach(function(e){ if (!bySlug[e.slug]) bySlug[e.slug] = e; });
  var pairs = [], seen = {};
  // 1. consequences: pairs Wikidata links by cause / effect / part-of, both ends in this window
  inWin.forEach(function(a){
    (LINKS_BY_SLUG[a.slug] || []).forEach(function(l){
      var b = bySlug[l[2]];
      if (!b || b === a || !REL_TEXT[l[1]]) return;
      var key = a.slug < b.slug ? a.slug + '|' + b.slug : b.slug + '|' + a.slug;
      if (seen[key]) return; seen[key] = true;
      var far = a.normal.angleTo(b.normal) > 0.6;
      pairs.push({ a:a, b:b, rel:REL_TEXT[l[1]], gap:null, score:10 + a.w + b.w + (far ? 2 : 0) + (a.date && b.date ? 1 : 0) });
    });
  });
  // 2. same day, different sides of the world — people and science first
  var byDay = {};
  inWin.forEach(function(e){ if (e.date) (byDay[e.date] = byDay[e.date] || []).push(e); });
  Object.keys(byDay).forEach(function(d){
    var arr = byDay[d];
    for (var i = 0; i < arr.length; i++) for (var j = i + 1; j < arr.length; j++){
      var a = arr[i], b = arr[j];
      if (a.normal.angleTo(b.normal) < 0.6) continue;
      if (family(a) === family(b)) continue;
      if (/^launch of/i.test(a.title) && /^launch of/i.test(b.title)) continue;
      var human = /^(birth|death) of /i, sci = function(e){ return e.cat === 'sci'; };
      var bonus = (human.test(a.title) || human.test(b.title) ? 1.5 : 0) + (sci(a) || sci(b) ? 1 : 0) + (a.cat !== b.cat ? 0.5 : 0);
      pairs.push({ a:a, b:b, rel:null, gap:0, score:a.w + b.w + bonus });
    }
  });
  pairs.sort(function(p, q){ return q.score - p.score; });
  return pairs.slice(0, 14);
}
var tickerPairs = [], tickerIndex = 0, tickerTimer = null;
function showTicker(){
  var el = document.getElementById('ticker');
  if (!tickerPairs.length){ el.classList.remove('on'); return; }
  var p = tickerPairs[tickerIndex % tickerPairs.length];
  if (p.rel){
    var whenA = p.a.date ? dayLabel(p.a.date) : yearLabel(p.a.start);
    el.innerHTML = '<span class="tk">' + whenA + '</span> ' + p.a.title + ' <em>' + p.a.place + '</em> — ' + p.rel + ' — ' + p.b.title + ' <em>' + p.b.place + (p.b.date ? ' · ' + dayLabel(p.b.date) : '') + '</em>';
  } else {
    el.innerHTML = '<span class="tk">' + dayLabel(p.a.date) + '</span> While ' + p.a.title + ' <em>' + p.a.place + '</em> — ' + p.b.title + ' <em>' + p.b.place + '</em>';
  }
  el.classList.add('on');
  el.onclick = function(){ spinTo(p.a); openPanel(p.a); };
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
