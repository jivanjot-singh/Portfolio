/* Portfolio app: routing (#home, #edits, #contact), players, curled arrows, starring.
   Data comes from data/site.js and data/videos.js. No build step, no dependencies. */
(function () {
  'use strict';

  var SITE = window.SITE || {};
  var CATS = SITE.categories || [];
  var VIDEOS = (window.VIDEOS || []).slice();

  /* ---------- helpers ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  var mediaBase = SITE.mediaBase || '';
  if (mediaBase && !/\/$/.test(mediaBase)) mediaBase += '/';
  function url(p) {
    if (!p) return '';
    if (/^(https?:)?\/\//.test(p) || /^(data|blob):/.test(p) || p.charAt(0) === '/') return p;
    return mediaBase + p;
  }
  function fmtDur(s) {
    s = Math.round(s); var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  var PLAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 2.8v18.4a1 1 0 0 0 1.5.86l15.2-9.2a1 1 0 0 0 0-1.72L6.5 1.94A1 1 0 0 0 5 2.8z"/></svg>';
  var STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6L2.5 9.5l6.6-.8z"/></svg>';

  /* ---------- owner mode (stars are saved in the owner's browser until videos.js is updated) ---------- */
  var owner = store.get('ps_owner') === '1';
  var overrides = {};
  try { overrides = JSON.parse(store.get('ps_stars') || '{}') || {}; } catch (e) { overrides = {}; }

  function effective() {
    return VIDEOS.map(function (v) {
      if (owner && Object.prototype.hasOwnProperty.call(overrides, v.category)) {
        var c = {}; for (var k in v) c[k] = v[k];
        c.starred = overrides[v.category] === v.id;
        return c;
      }
      return v;
    });
  }
  function inCat(cat) { return effective().filter(function (v) { return v.category === cat; }); }
  function pick(cat) {
    var list = inCat(cat);
    for (var i = 0; i < list.length; i++) if (list[i].starred) return list[i];
    return list[0] || null;
  }

  /* ---------- player ---------- */
  var current = null;
  function pauseCurrent() { if (current) { current.stop(); } }

  function makePlayer(v, opts) {
    opts = opts || {};
    var fig = el('figure', 'player');
    fig.dataset.id = v.id;
    fig.style.setProperty('--ar', v.aspect || '16/9');

    if (v.poster) {
      var img = el('img', 'poster');
      img.alt = '';
      img.decoding = 'async';
      img.loading = opts.eager ? 'eager' : 'lazy';
      img.src = url(v.poster);
      fig.appendChild(img);
    }

    var btn = el('button', 'play');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Play ' + v.title);
    btn.innerHTML = '<span class="play-icon">' + PLAY_SVG + '</span>';
    fig.appendChild(btn);

    if (opts.tag) fig.appendChild(el('span', 'pill', opts.tag));
    if (v.duration) fig.appendChild(el('span', 'dur', fmtDur(v.duration)));

    var video = null;
    function ensure() {
      if (video) return video;
      video = document.createElement('video');
      video.preload = 'metadata';          // only the first few KB until the visitor asks to play
      video.controls = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.hidden = true;
      video.src = url(v.src);
      video.addEventListener('play', function () {
        if (current && current !== api) current.stop();
        current = api;
      });
      video.addEventListener('error', function () {
        fig.classList.remove('is-playing');
        video.hidden = true;
        if (!$('.player-error', fig)) {
          fig.appendChild(el('p', 'player-error', "This video didn't load. Check its path in data/videos.js and the mediaBase value in data/site.js."));
        }
      });
      fig.appendChild(video);
      return video;
    }
    var api = { stop: function () { if (video) video.pause(); } };

    // warm up metadata when the visitor shows intent, so playback starts faster
    ['pointerenter', 'focusin', 'touchstart'].forEach(function (ev) {
      fig.addEventListener(ev, ensure, { once: true, passive: true });
    });

    btn.addEventListener('click', function () {
      var vid = ensure();
      if (current && current !== api) current.stop();
      current = api;
      fig.classList.add('is-playing');
      vid.hidden = false;
      var p = vid.play();
      if (p && p.catch) p.catch(function () { /* autoplay refused: the native controls stay visible */ });
    });

    return fig;
  }

  function starNode(v) {
    if (owner) {
      var b = el('button', 'star');
      b.type = 'button';
      b.innerHTML = STAR_SVG;
      b.setAttribute('aria-pressed', v.starred ? 'true' : 'false');
      b.setAttribute('aria-label', (v.starred ? 'Remove star from ' : 'Star ') + v.title);
      b.title = v.starred ? 'Starred: shows on the home page' : 'Star to show on the home page';
      b.addEventListener('click', function () { toggleStar(v); });
      return b;
    }
    if (v.starred) {
      var s = el('span', 'star');
      s.innerHTML = STAR_SVG;
      s.title = 'Featured on the home page';
      s.setAttribute('role', 'img');
      s.setAttribute('aria-label', 'Featured');
      return s;
    }
    return null;
  }

  function toggleStar(v) {
    var starredNow = overrides.hasOwnProperty(v.category)
      ? overrides[v.category] === v.id
      : !!v.starred;
    overrides[v.category] = starredNow ? null : v.id;
    store.set('ps_stars', JSON.stringify(overrides));
    renderEdits();
    updateOwnerBar();
  }

  /* ---------- home ---------- */
  var arrowSeq = 0;
  function renderHome() {
    var stage = $('#hero-stage');
    $$('.hero-card', stage).forEach(function (n) { n.remove(); });
    CATS.forEach(function (cat) {
      var card = el('div', 'hero-card ' + cat.id);
      card.dataset.cat = cat.id;
      var v = pick(cat.id);
      if (v) {
        card.appendChild(makePlayer(v, { tag: cat.label, eager: true }));
      } else {
        var empty = el('div', 'player is-empty', 'Star a ' + cat.label.toLowerCase() + ' edit and it appears here');
        empty.style.setProperty('--ar', cat.id === 'short' ? '9/16' : '16/9');
        card.appendChild(empty);
      }
      card.appendChild(el('p', 'cap', cat.caption));
      stage.appendChild(card);
    });
  }

  // A curl: heading bends along a gentle arch, then makes one full loop mid-way.
  // The raw path is scaled and rotated so it starts at S and ends exactly at E.
  function curl(S, E, side, loopFrac) {
    var dx = E.x - S.x, dy = E.y - S.y, L = Math.hypot(dx, dy), base = Math.atan2(dy, dx);
    var N = 140, A = 0.9, ls = 0.5 - loopFrac / 2, le = 0.5 + loopFrac / 2;
    var pts = [[0, 0]], x = 0, y = 0;
    for (var i = 1; i <= N; i++) {
      var t = (i - 0.5) / N;
      var u = Math.min(1, Math.max(0, (t - ls) / (le - ls)));
      var s = u * u * (3 - 2 * u);
      var th = side * (A * Math.cos(Math.PI * t) - 2 * Math.PI * s);
      x += Math.cos(th); y += Math.sin(th);
      pts.push([x, y]);
    }
    var ex = pts[N][0], ey = pts[N][1];
    var k = L / Math.hypot(ex, ey), rot = base - Math.atan2(ey, ex);
    var c = Math.cos(rot), sn = Math.sin(rot);
    return pts.map(function (p) {
      return { x: S.x + k * (p[0] * c - p[1] * sn), y: S.y + k * (p[0] * sn + p[1] * c) };
    });
  }

  function box(node, origin) {
    var r = node.getBoundingClientRect();
    var b = { l: r.left - origin.left, t: r.top - origin.top, w: r.width, h: r.height };
    b.cx = b.l + b.w / 2; b.cy = b.t + b.h / 2;
    return b;
  }
  function edgePoint(b, toward, pad) {
    var dx = toward.x - b.cx, dy = toward.y - b.cy;
    if (!dx && !dy) return { x: b.cx, y: b.cy };
    var hw = b.w / 2 + pad, hh = b.h / 2 + pad;
    var t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
    return { x: b.cx + dx * t, y: b.cy + dy * t };
  }

  function drawArrows(animate) {
    var view = $('#view-home');
    if (!view || view.hidden) return;
    var stage = $('#hero-stage'), svg = $('#arrows');
    var o = stage.getBoundingClientRect();
    if (!o.width) return;
    svg.setAttribute('viewBox', '0 0 ' + o.width + ' ' + o.height);

    var mobile = window.matchMedia('(max-width: 860px)').matches;
    var nameBox = box($('#hero-name'), o);
    var cards = $$('.hero-card', stage);
    var sides = mobile ? [-1, 1, -1] : [1, -1, 1];

    cards.forEach(function (card, i) {
      var pb = box($('.player', card), o);
      var originBox = (mobile && i > 0) ? box(cards[i - 1], o) : nameBox;
      var S = edgePoint(originBox, { x: pb.cx, y: pb.cy }, 18);
      var E = edgePoint(pb, S, 16);
      var L = Math.hypot(E.x - S.x, E.y - S.y);
      var pts = curl(S, E, sides[i % sides.length], L < 160 ? 0.62 : 0.54);

      var d = 'M' + pts.map(function (p) { return p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' L');
      // arrowhead: two barbs swept back from the tip along the final heading
      var tip = pts[pts.length - 1], back = pts[pts.length - 4];
      var h = Math.atan2(tip.y - back.y, tip.x - back.x), bl = 20;
      [0.55, -0.55].forEach(function (a) {
        d += ' M' + (tip.x - bl * Math.cos(h + a)).toFixed(1) + ' ' + (tip.y - bl * Math.sin(h + a)).toFixed(1) + ' L' + tip.x.toFixed(1) + ' ' + tip.y.toFixed(1);
      });
      // reuse the same <path> so a redraw (resize, fonts loading) never restarts the intro animation
      var path = svg.children[i];
      if (!path) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('pathLength', '1');
        svg.appendChild(path);
      }
      path.setAttribute('d', d);
    });
    while (svg.children.length > cards.length) svg.removeChild(svg.lastChild);

    if (animate) {
      var seq = ++arrowSeq;
      svg.classList.add('is-drawing');
      setTimeout(function () { if (seq === arrowSeq) svg.classList.remove('is-drawing'); }, 2600);
    }
  }

  /* ---------- edits ---------- */
  function renderEdits() {
    var root = $('#edits-root');
    root.textContent = '';
    CATS.forEach(function (cat) {
      var list = inCat(cat.id);
      var sec = el('section', 'cat');
      sec.id = 'cat-' + cat.id;

      var head = el('header', 'cat-head');
      head.appendChild(el('h2', null, cat.caption));
      var meta = el('p', 'cat-meta');
      meta.appendChild(el('span', 'pill', cat.label));
      meta.appendChild(el('span', null, list.length + (list.length === 1 ? ' edit' : ' edits')));
      head.appendChild(meta);
      sec.appendChild(head);

      if (!list.length) {
        sec.appendChild(el('p', 'empty-note', 'No ' + cat.label.toLowerCase() + ' edits yet. Drop files into raw/' + cat.id + '/ and run optimize.py.'));
      } else {
        var grid = el('div', 'grid');
        grid.dataset.cat = cat.id;
        list.forEach(function (v) {
          var card = el('article', 'card');
          var p = makePlayer(v, {});
          var st = starNode(v);
          if (st) p.appendChild(st);
          card.appendChild(p);
          card.appendChild(el('h3', 'card-title', v.title));
          grid.appendChild(card);
        });
        sec.appendChild(grid);
      }
      root.appendChild(sec);
    });
  }

  /* ---------- owner bar ---------- */
  function exportText() {
    var head = '// Managed by optimize.py. You can edit titles, reorder entries, or set\n' +
      '// "starred": true on ONE video per category (it then appears on the home page).\n' +
      '// Keep it valid JSON. Entries marked "sample": true are placeholders and are\n' +
      '// removed automatically the first time optimize.py processes a real video.\n';
    return head + 'window.VIDEOS = ' + JSON.stringify(effective(), null, 2) + ';\n';
  }
  function updateOwnerBar() {
    var bar = $('#owner-bar');
    bar.hidden = !owner;
    document.body.classList.toggle('has-owner-bar', owner);
    if (!owner) return;
    var n = Object.keys(overrides).length;
    $('#owner-msg').textContent = n
      ? 'Owner mode. Star changes are saved in this browser only. Copy videos.js and replace data/videos.js to make them live for everyone.'
      : 'Owner mode. Use the star on any edit to feature it on the home page. Only you see these controls.';
  }
  function setOwner(on) {
    owner = on;
    if (on) store.set('ps_owner', '1'); else store.del('ps_owner');
    updateOwnerBar();
    renderHome();
    renderEdits();
    drawArrows(false);
  }
  $('#owner-copy').addEventListener('click', function () {
    var text = exportText(), out = $('#owner-out'), btn = this;
    function fallback() { out.hidden = false; out.value = text; out.focus(); out.select(); btn.textContent = 'Select and copy below'; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        out.hidden = true; btn.textContent = 'Copied. Replace data/videos.js';
        setTimeout(function () { btn.textContent = 'Copy videos.js'; }, 3500);
      }, fallback);
    } else { fallback(); }
  });
  $('#owner-reset').addEventListener('click', function () {
    overrides = {}; store.del('ps_stars'); renderEdits(); renderHome(); drawArrows(false); updateOwnerBar();
  });
  $('#owner-exit').addEventListener('click', function () {
    overrides = {}; store.del('ps_stars'); setOwner(false);
    try { if (location.hash === '#owner') location.hash = 'edits'; } catch (e) {}
  });

  /* ---------- routing ---------- */
  var VIEWS = { home: $('#view-home'), edits: $('#view-edits'), contact: $('#view-contact') };
  var currentView = null;

  function show(name) {
    if (!VIEWS[name]) name = 'home';
    if (name === currentView) return;
    currentView = name;
    pauseCurrent();
    Object.keys(VIEWS).forEach(function (k) { VIEWS[k].hidden = k !== name; });
    $$('.nav a').forEach(function (a) {
      if (a.dataset.route === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    if (name === 'home') {
      renderHome();
      requestAnimationFrame(function () { requestAnimationFrame(function () { drawArrows(true); }); });
    }
    if (name === 'edits') renderEdits();
  }
  function routeFromHash() {
    var h = (location.hash || '').replace(/^#/, '').toLowerCase();
    if (h === 'owner') { if (!owner) setOwner(true); h = 'edits'; }
    show(h || 'home');
  }
  function go(name) {
    try { if (location.hash !== '#' + name) location.hash = name; } catch (e) {}
    show(name);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-route]');
    if (!a) return;
    e.preventDefault();
    go(a.dataset.route);
  });
  window.addEventListener('hashchange', routeFromHash);

  /* ---------- boot ---------- */
  function boot() {
    document.title = (SITE.name || 'Portfolio') + ' Edits';
    $('#brand').textContent = SITE.name || '';
    $('#hero-name').textContent = SITE.name || '';
    if (SITE.heroPhoto) $('#hero-photo').src = SITE.heroPhoto;

    var wa = SITE.whatsapp || '#';
    if (SITE.whatsappMessage) wa += (wa.indexOf('?') > -1 ? '&' : '?') + 'text=' + encodeURIComponent(SITE.whatsappMessage);
    $('#link-wa').href = wa;
    $('#link-ig').href = SITE.instagram || '#';

    var header = $('.site-header');
    function setHeaderHeight() { document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px'); }
    setHeaderHeight();
    if (window.ResizeObserver) new ResizeObserver(setHeaderHeight).observe(header);

    updateOwnerBar();
    routeFromHash();

    var raf = 0;
    function redraw() { cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { drawArrows(false); }); }
    window.addEventListener('resize', redraw);
    if (window.ResizeObserver) new ResizeObserver(redraw).observe($('#hero-stage'));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
  }
  boot();
})();
