window.__atlasStart = function(){
"use strict";

var EARTH_SRC = "assets/earth.jpg";
var IMG_DIR = "img/";
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
  return { id:i, title:r[0], lat:r[1], lon:r[2], start:r[3], end:r[4], cat:r[5], w:r[6], place:r[7], desc:r[8], slug:r[9] };
});

// Two rails. "century" = calendar decades with 5-year windows; "all" = eleven eras from the first stone tools.
var ERA_SETS = {
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
var mode = 'century';
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
var wi = WINDOWS.findIndex(function(w){ return w.start <= 1969 && w.end >= 1969; });
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
var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0, camDist);

scene.add(new THREE.AmbientLight(0xffffff, 0.72));
var sun = new THREE.DirectionalLight(0xffffff, 0.75);
sun.position.set(1.5, 1.0, 2.5);
scene.add(sun);

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

// stars
(function(){
  var n = 1600, pos = new Float32Array(n * 3);
  for (var i = 0; i < n; i++){
    var u = Math.random() * 2 - 1, t = Math.random() * 2 * Math.PI, s = Math.sqrt(1 - u * u);
    pos[i*3] = 40 * s * Math.cos(t); pos[i*3+1] = 40 * u; pos[i*3+2] = 40 * s * Math.sin(t);
  }
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color:0xffffff, size:0.09, transparent:true, opacity:0.55, sizeAttenuation:true })));
})();

function toVec(lat, lon, r){
  var theta = (90 - lat) * DEG, phi = (lon + 180) * DEG;
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
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
var POOL = [];
for (var pi = 0; pi < MAX_SHOWN; pi++){
  var ps = new THREE.Sprite(new THREE.SpriteMaterial({ map:SPRITE_TEX.con, transparent:true, depthTest:true, depthWrite:false }));
  ps.visible = false; POOL.push(ps); markers.add(ps);
}
EVENTS.forEach(function(e){
  e.pos = toVec(e.lat, e.lon, 1.012);
  e.normal = toVec(e.lat, e.lon, 1);
  e.size = 0.056 + e.w * 0.009;
});
var PHOTO_TEX = {};   // slug -> CanvasTexture, built lazily
function photoTexture(e, onReady){
  if (PHOTO_TEX[e.slug]) return PHOTO_TEX[e.slug];
  var im = IMAGES[e.slug]; if (!im) return null;
  var img = new Image();
  img.onload = function(){
    var px = 160, c = document.createElement('canvas'); c.width = px; c.height = px;
    var ctx = c.getContext('2d'), r = px / 2;
    // cover-fit the photo into a circle
    var sw = img.width, sh = img.height, side = Math.min(sw, sh);
    ctx.save(); ctx.beginPath(); ctx.arc(r, r, r - 4, 0, 2*Math.PI); ctx.clip();
    ctx.drawImage(img, (sw - side)/2, (sh - side)/2, side, side, 0, 0, px, px); ctx.restore();
    ctx.beginPath(); ctx.arc(r, r, r - 4, 0, 2*Math.PI); ctx.lineWidth = 6; ctx.strokeStyle = css(CATS[e.cat].v); ctx.stroke();
    ctx.beginPath(); ctx.arc(r, r, r - 4, 0, 2*Math.PI); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
    // category badge
    var bx = px - 30, by = px - 30;
    ctx.beginPath(); ctx.arc(bx, by, 22, 0, 2*Math.PI); ctx.fillStyle = css(CATS[e.cat].v); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.save(); ctx.translate(bx - 15, by - 15); drawGlyph(ctx, e.cat, 30); ctx.restore();
    var tex = new THREE.CanvasTexture(c); PHOTO_TEX[e.slug] = tex; onReady(tex);
  };
  img.src = IMG_DIR + im.file;
  return null;
}
var shown = [];   // events currently bound to pool sprites
function bindWindow(){
  var w = WINDOWS[wi];
  var list = EVENTS.filter(function(e){ return !off[e.cat] && e.start <= w.end && e.end >= w.start; });
  list.sort(function(a, b){ return b.w - a.w; });
  windowTotal = list.length;
  shown = list.slice(0, shownCap());
  EVENTS.forEach(function(e){ e.sprite = null; e._sx = null; });
  shown.forEach(function(e, i){
    var s = POOL[i];
    var photo = IMAGES[e.slug] ? photoTexture(e, function(tex){ if (e.sprite === s){ s.material.map = tex; s.material.needsUpdate = true; render(); } }) : null;
    s.material.map = photo || SPRITE_TEX[e.cat]; s.material.needsUpdate = true;
    var sz = IMAGES[e.slug] ? e.size * 1.75 : e.size;
    s.scale.set(sz, sz, 1);
    s.position.copy(e.pos);
    e.sprite = s;
  });
  for (var j = shown.length; j < MAX_SHOWN; j++){ POOL[j].visible = false; }
}
var windowTotal = 0;
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
function toScreen(e){
  var v = e.pos.clone().applyQuaternion(globe.quaternion).project(camera);
  return [ (v.x + 1) / 2 * W, (1 - v.y) / 2 * H ];
}

function render(){
  if (!W) return;
  var list = shown;
  var ctxEls = selected ? contextFor(selected) : [];
  var behind = 0;
  list.forEach(function(e){
    var front = worldNormal(e).z > (IMAGES[e.slug] ? 0.2 : 0.10);
    if (!e.sprite) return;
    e.sprite.visible = front;
    e.sprite.material.opacity = (selected && selected.id !== e.id && ctxEls.indexOf(e) < 0) ? 0.5 : 1;
    if (front){ var p = toScreen(e); e._sx = p[0]; e._sy = p[1]; }
    else { e._sx = null; behind++; }
  });
  window.__borders.visible = WINDOWS[wi].start >= 1900;
  camera.position.z = camDist;

  if (selected){
    selRing.position.copy(selected.pos);
    var sz = selected.size * (IMAGES[selected.slug] ? 2.3 : 1.9); selRing.scale.set(sz, sz, 1);
    selRing.visible = worldNormal(selected).z > 0.1;
  } else selRing.visible = false;
  ctxRings.forEach(function(r, i){
    var e = ctxEls[i];
    if (!e){ r.visible = false; return; }
    r.position.copy(e.pos);
    var s2 = e.size * (IMAGES[e.slug] ? 2.2 : 1.8); r.scale.set(s2, s2, 1);
    r.visible = worldNormal(e).z > 0.1;
  });

  renderer.render(scene, camera);
  document.getElementById('count').innerHTML =
    (windowTotal > list.length ? 'TOP ' + list.length + ' OF ' + windowTotal + ' EVENTS IN THIS WINDOW — ZOOM IN FOR MORE' : list.length + ' EVENT' + (list.length === 1 ? '' : 'S') + ' IN THIS WINDOW') +
    (behind ? '<br>' + behind + ' ON THE FAR SIDE — KEEP SPINNING' : '') +
    (list.length < 4 ? '<br><em>SPARSE — THE PLACEHOLDER DATA THINS OUT HERE</em>' : '');
}

function pick(mx, my){
  var best = null, bestD = 22;
  visibleEvents().forEach(function(e){
    if (e._sx == null) return;
    var d = Math.hypot(e._sx - mx, e._sy - my);
    if (d < bestD){ bestD = d; best = e; }
  });
  return best;
}
function contextFor(e){
  var here = e.normal;
  return visibleEvents()
    .filter(function(o){ return o.id !== e.id && here.angleTo(o.normal) > 0.45; })
    .sort(function(a, b){ return b.w - a.w; })
    .slice(0, 3);
}

// ---------- panel ----------
function openPanel(e){
  selected = e;
  var p = document.getElementById('panel');
  var ctxEls = contextFor(e);
  var when = (e.start === e.end) ? yearLabel(e.start) : rangeLabel(e.start, e.end);
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
  html += '<div class="pmeta">' + when + '<br>' + e.place + '</div>';
  html += '<p class="pdesc">' + e.desc + '</p>';
  html += '<a class="plink" target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/' + e.slug + '">Read more →</a>';
  if (ctxEls.length){
    html += '<div class="elsewhere"><p>Elsewhere, ' + rangeLabel(WINDOWS[wi].start, WINDOWS[wi].end) + '</p>';
    ctxEls.forEach(function(o){
      html += '<button class="ew" data-id="' + o.id + '"><img src="' + ICON_URL[o.cat] + '" alt="">' +
              '<span><b>' + o.title + '</b><span>' + o.place + '</span></span></button>';
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
var AX = new THREE.Vector3(1,0,0), AY = new THREE.Vector3(0,1,0), AZ = new THREE.Vector3(0,0,1);
var qTmp = new THREE.Quaternion(), qTmp2 = new THREE.Quaternion();

canvas.addEventListener('pointerdown', function(ev){
  dragging = true; moved = 0; lastX = ev.clientX; lastY = ev.clientY; shifted = ev.shiftKey;
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
        (hit.start === hit.end ? yearLabel(hit.start) : rangeLabel(hit.start, hit.end)) + ' · ' + hit.place.toUpperCase();
      tip.style.left = hit._sx + 'px'; tip.style.top = hit._sy + 'px';
      tip.classList.add('on'); canvas.style.cursor = 'pointer';
    } else { tip.classList.remove('on'); canvas.style.cursor = ''; }
  }
});
function endDrag(ev){
  if (!dragging) return;
  dragging = false; canvas.classList.remove('drag');
  if (moved < 5){
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
  camDist = Math.max(1.6, Math.min(7, camDist * (ev.deltaY > 0 ? 1.07 : 0.93)));
  bindWindow(); bumpIdle(); render();
}, { passive:false });

// ---------- idle spin ----------
function bumpIdle(){ idle = false; clearTimeout(idleTimer); idleTimer = setTimeout(function(){ idle = true; }, 4500); }
function tick(){
  if (idle && !selected && !dragging){
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
  document.getElementById('railLeft').textContent = mode === 'century' ? '1926' : '4 MILLION YEARS AGO';
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
  if (wi < 0) wi = mode === 'century' ? WINDOWS.findIndex(function(w){ return w.start <= 1969 && w.end >= 1969; }) : WINDOWS.length - 1;
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

document.getElementById('note').textContent = EVENTS.length.toLocaleString() + ' EVENTS · ' + Object.keys(IMAGES).length.toLocaleString() + ' PHOTOS · WIKIDATA + WIKIPEDIA + COMMONS';
window.addEventListener('resize', resize);
bindWindow(); syncHeader(); placeHandle(); resize(); tick(); readHash(); setTimeout(placeHandle, 60);
};
// Load data files, then start the app.
(function(){
  function get(url){ return fetch(url).then(function(r){ if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
  Promise.all([ get('data/events.json'), get('data/images.json'), get('assets/countries-110m.json') ])
    .then(function(res){ window.__ATLAS = { events:res[0], images:res[1], borders:res[2] }; window.__atlasStart(); })
    .catch(function(err){ document.getElementById('note').textContent = 'COULD NOT LOAD DATA — ' + err.message; console.error(err); });
})();
