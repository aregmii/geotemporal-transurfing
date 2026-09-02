window.__atlasStart = function(){
"use strict";

var EARTH_SRC = window.__ATLAS.earth || "assets/earth.jpg";
var IMG_DIR = window.__ATLAS.imgDir != null ? window.__ATLAS.imgDir : "img/";
var BORDERS = window.__ATLAS.borders;
var RAW = window.__ATLAS.events;
var IMAGES = window.__ATLAS.images;
var DEG = Math.PI / 180;

var CATS = {
  con:{label:'Conflict',        v:'--con'},
  cul:{label:'Culture & belief', v:'--cul'},
  sci:{label:'Science & discovery', v:'--sci'},
  dis:{label:'Disasters',       v:'--dis'}
};

var EVENTS = RAW.map(function(r, i){
  return { id:i, title:r[0], lat:r[1], lon:r[2], start:r[3], end:r[4], cat:r[5], w:r[6], place:r[7], desc:r[8], slug:r[9],
           date:(typeof r[10] === 'string' && /^-?\d{1,6}-\d{2}-\d{2}$/.test(r[10]) && !/-01-01$/.test(r[10])) ? r[10] : null, who:r[11] || null };
});

// Two rails. "century" = calendar decades with 5-year windows; "all" = eleven eras from the first stone tools.
var ERA_SETS = {
  recent: [
    {name:'', label:'2000–05', from:2000, to:2005, step:5},
    {name:'', label:'2005–10', from:2005, to:2010, step:5},
    {name:'', label:'2010–15', from:2010, to:2015, step:5},
    {name:'', label:'2015–20', from:2015, to:2020, step:5},
    {name:'', label:'2020–25', from:2020, to:2026, step:6}
  ],
  century: [
    {name:'', label:'1926–30', from:1926, to:1930, step:4},
    {name:'', label:'1930s', from:1930, to:1940, step:5},
    {name:'', label:'1940s', from:1940, to:1950, step:5},
    {name:'', label:'1950s', from:1950, to:1960, step:5},
    {name:'', label:'1960s', from:1960, to:1970, step:5},
    {name:'', label:'1970s', from:1970, to:1980, step:5},
    {name:'', label:'1980s', from:1980, to:1990, step:5},
    {name:'', label:'1990s', from:1990, to:2000, step:5},
    {name:'', label:'2000s', from:2000, to:2010, step:5},
    {name:'', label:'2010s', from:2010, to:2020, step:5},
    {name:'', label:'2020s', from:2020, to:2026, step:6}
  ],
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
    var n = Math.ceil((era.to - era.from) / era.step);
    era.first = WINDOWS.length; era.count = n;
    for (var k = 0; k < n; k++){
      var a = era.from + k * era.step;
      WINDOWS.push({ start:a, end:Math.min(a + era.step, era.to), era:ei });
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
var wi = WINDOWS.findIndex(function(w){ return w.start <= 2022 && w.end >= 2022; });
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

function makeTextSprite(text, size){
  var c = document.createElement('canvas'); c.width = 256; c.height = 64;
  var ctx = c.getContext('2d'); ctx.font = '500 26px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(232,236,244,.85)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 32);
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(c), transparent:true, depthTest:false }));
  sp.scale.set(size * 4, size, 1); return sp;
}

var skySphere, moonMesh, sunSprite, planetSprites = {};
function buildSkyStatic(){
  // the sky itself: a baked equirectangular photograph-style map (real stars and Milky Way, equatorial coordinates)
  // on the inside of a far sphere. Same longitude mapping as the Earth texture, mirrored because we look from inside.
  var skyTex = new THREE.TextureLoader().load(window.__ATLAS.skyImage || 'assets/sky.jpg', function(){ render(); });
  skyTex.wrapS = THREE.RepeatWrapping; skyTex.repeat.x = -1;
  skySphere = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 64, 40), new THREE.MeshBasicMaterial({ map:skyTex, side:THREE.BackSide, depthWrite:false }));
  skySphere.renderOrder = -10; sky.add(skySphere);

  // the Moon: a lit sphere at its true distance and size, so its phase and apparent size are right
  moonMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2727, 32, 24), new THREE.MeshLambertMaterial({ color:0xd9d9d2 }));
  sky.add(moonMesh);
  var moonLabel = makeTextSprite('MOON', 2.2); moonMesh.add(moonLabel); moonLabel.position.set(0, 1.2, 0); skyLabelSprites.push(moonLabel);

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
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(pc), transparent:true, depthTest:false }));
    sp.scale.set(5, 5, 1); sky.add(sp);
    var lb = makeTextSprite(name.toUpperCase(), 2.0); sp.add(lb); lb.position.set(0, 1.4, 0); skyLabelSprites.push(lb);
    planetSprites[name] = sp;
  });
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
  Object.keys(planetSprites).forEach(function(name){ planetSprites[name].position.copy(place(name, SKY_R - 10).v); });
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
  var beam = new THREE.Mesh(BEAM_GEO, new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.28, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }));
  var base = new THREE.Sprite(new THREE.SpriteMaterial({ map:BASE_TEX, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }));
  base.scale.set(0.03, 0.03, 1);
  var card = new THREE.Sprite(new THREE.SpriteMaterial({ map:SPRITE_TEX.con, transparent:true, depthTest:true, depthWrite:false }));
  holder.add(beam); holder.add(base); holder.add(card);
  holder.visible = false; holder.userData = { beam:beam, base:base, card:card };
  POOL.push(holder); markers.add(holder);
}
var Y_AXIS = new THREE.Vector3(0, 1, 0);
EVENTS.forEach(function(e){
  e.normal = toVec(e.lat, e.lon, 1);
  e.foot = toVec(e.lat, e.lon, 1.002);
  e.pos = e.foot.clone();                                     // card position, set per frame from the stack height
  e.size = 0.75 + e.w * 0.18;                                 // 0.93 .. 1.47 — scales the card
  e.baseH = 0.045 + e.w * 0.018;                              // beam height before stacking
  e.quat = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, e.normal.clone().normalize());
});

// hologram card texture: the photo (or category glyph) with a tinted frame, scanlines and a badge
var CARD_TEX = {};
function cardTexture(e, onReady){
  var key = IMAGES[e.slug] ? e.slug : 'glyph:' + e.cat;
  if (CARD_TEX[key]) return CARD_TEX[key];
  var cw = 256, ch = 192, col = css(CATS[e.cat].v);
  function paint(img){
    var c = document.createElement('canvas'); c.width = cw; c.height = ch; var ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(8,14,26,.72)'; ctx.fillRect(0, 0, cw, ch);
    if (img){
      var sw = img.width, sh = img.height, sc = Math.max(cw / sw, ch / sh);
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
    var tex = new THREE.CanvasTexture(c); CARD_TEX[key] = tex; return tex;
  }
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
  // lay out by importance so the biggest events claim their spot first
  list.forEach(function(e){
    var h = e.holder; if (!h) return;
    var front = worldNormal(e).z > 0.12;
    h.visible = front;
    if (!front){ e._sx = null; behind++; return; }
    var scale = e.size * zoomBoost;
    var cw = CARD_W * scale, chh = CARD_H * scale;
    var hwPx = cw * pxPerUnit / CARD_H * 0.5, hhPx = chh * pxPerUnit / CARD_H * 0.5;
    // start at the base height; raise while overlapping something already placed
    var height = e.baseH * zoomBoost, tries = 0, sx, sy;
    while (true){
      _v.copy(e.normal).multiplyScalar(1.002 + height).applyQuaternion(globe.quaternion).project(camera);
      sx = (_v.x + 1) / 2 * W; sy = (1 - _v.y) / 2 * H;
      var clash = false;
      for (var i = 0; i < placed.length; i++){
        var p = placed[i];
        if (Math.abs(p.x - sx) < p.hw + hwPx && Math.abs(p.y - sy) < p.hh + hhPx){ clash = true; break; }
      }
      if (!clash || tries > 8) break;
      height += chh * 1.15; tries++;
    }
    placed.push({ x:sx, y:sy, hw:hwPx, hh:hhPx });
    e._sx = sx; e._sy = sy; e.stackH = height;
    var u = h.userData;
    u.beam.scale.set(1, height, 1);
    u.card.position.set(0, height, 0);
    u.card.scale.set(cw, chh, 1);
    var dim = selected && selected.id !== e.id && ctxEls.indexOf(e) < 0;
    u.card.material.opacity = dim ? 0.45 : 0.96;
    u.beam.material.opacity = (dim ? 0.10 : 0.30) / (1 + height * 3);
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
  renderer.render(scene, camera);
  document.getElementById('count').innerHTML =
    (windowTotal > list.length ? 'TOP ' + list.length + ' OF ' + windowTotal + ' EVENTS IN THIS WINDOW — ZOOM IN FOR MORE' : list.length + ' EVENT' + (list.length === 1 ? '' : 'S') + ' IN THIS WINDOW') +
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
  camDist = Math.max(1.6, Math.min(40, camDist * (ev.deltaY > 0 ? 1.07 : 0.93)));
  hovered = null; document.getElementById('tip').classList.remove('on');
  bindWindow(); bumpIdle(); render();
}, { passive:false });

// ---------- idle spin ----------
function bumpIdle(){ idle = false; clearTimeout(idleTimer); idleTimer = setTimeout(function(){ idle = true; }, 4500); }
function tick(){
  if (!dragging && (Math.abs(velX) > 0.0003 || Math.abs(velY) > 0.0003)){
    qTmp.setFromAxisAngle(AY, velX); qTmp2.setFromAxisAngle(AX, velY);
    globe.quaternion.premultiply(qTmp).premultiply(qTmp2);
    velX *= 0.965; velY *= 0.965;           // decay: a flick coasts for a second or two, then settles
    render();
  } else if (idle && !selected && !dragging){
    qTmp.setFromAxisAngle(AY, 0.0011); globe.quaternion.premultiply(qTmp); render();
  }
  requestAnimationFrame(tick);
}

// ---------- rail ----------
var track = document.getElementById('track');
var handle = null;
function buildRail(){
  track.innerHTML = '';
  ERAS.forEach(function(era){
    var d = document.createElement('div'); d.className = 'era';
    d.innerHTML = '<span class="yr">' + era.label + '</span>' + (era.name ? '<span class="nm">' + era.name + '</span>' : '');
    track.appendChild(d);
  });
  handle = document.createElement('div'); handle.id = 'handle'; track.appendChild(handle);
  document.getElementById('railLeft').textContent = mode === 'recent' ? '2000' : mode === 'century' ? '1926' : '4 MILLION YEARS AGO';
}
buildRail();
function placeHandle(){
  var era = ERAS[WINDOWS[wi].era], segW = 100 / ERAS.length;
  var within = (wi - era.first) / era.count;
  handle.style.left = (WINDOWS[wi].era * segW + within * segW) + '%';
  handle.style.width = (segW / era.count) + '%';
}
function railSet(clientX){
  var rect = track.getBoundingClientRect();
  var f = Math.max(0, Math.min(0.9999, (clientX - rect.left) / rect.width));
  var ei = Math.floor(f * ERAS.length), within = f * ERAS.length - ei, era = ERAS[ei];
  setWindow(era.first + Math.min(era.count - 1, Math.floor(within * era.count)));
}
var railDrag = false;
track.addEventListener('pointerdown', function(ev){ railDrag = true; track.setPointerCapture(ev.pointerId); railSet(ev.clientX); });
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
  bindWindow(); syncHeader(); placeHandle(); bumpIdle(); render(); writeHash();
}
function syncHeader(){
  var w = WINDOWS[wi], era = ERAS[w.era];
  var span = w.end - w.start;
  var stepLabel = span >= 1000000 ? (span/1000000) + ' MILLION-YEAR' : span >= 1000 ? (span/1000) + ',000-YEAR' : span + '-YEAR';
  document.getElementById('now').innerHTML = '<b>' + rangeLabel(w.start, w.end) + '</b>' + (era.name ? ' · ' + era.name : '') + ' · ' + stepLabel + ' WINDOW';
  document.getElementById('railNow').textContent = rangeLabel(w.start, w.end);
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
  wi = WINDOWS.findIndex(function(w){ return w.start <= year && w.end > year; });
  if (wi < 0) wi = WINDOWS.length - 1;
  Array.prototype.forEach.call(document.querySelectorAll('#modes button'), function(b){ b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false'); });
  closePanel(); bindWindow(); syncHeader(); placeHandle(); render(); writeHash();
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
  else if (h.y){ var y = +h.y; var i = WINDOWS.findIndex(function(w){ return w.start <= y && w.end > y; }); if (i >= 0) wi = i; }
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

document.getElementById('aboutCounts').textContent = EVENTS.length.toLocaleString() + ' events · ' + Object.keys(IMAGES).length.toLocaleString() + ' photographs';
document.getElementById('aboutBtn').onclick = function(){ document.getElementById('about').classList.toggle('on'); };
document.getElementById('aboutClose').onclick = function(){ document.getElementById('about').classList.remove('on'); };
window.addEventListener('resize', resize);
buildSkyStatic(); setSkyDate(new Date());
bindWindow(); syncHeader(); placeHandle(); resize(); tick(); readHash(); setTimeout(placeHandle, 60);
setInterval(function(){ if (!selected || !selected.date) setSkyDate(new Date()); }, 60000);
};
// Load data files, then start the app.
(function(){
  if (window.__ATLAS){ window.__atlasStart(); return; }   // playground build: data already inlined
  function get(url){ return fetch(url).then(function(r){ if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
  Promise.all([ get('data/events.json'), get('data/images.json'), get('assets/countries-110m.json') ])
    .then(function(res){ window.__ATLAS = { events:res[0], images:res[1], borders:res[2] }; window.__atlasStart(); })
    .catch(function(err){ document.getElementById('note').textContent = 'COULD NOT LOAD DATA — ' + err.message; console.error(err); });
})();
