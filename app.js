// app.js – UI-logikk og rendering
// Avhenger av: vin.js (window.Vin), agent.js (window.Agent)

// ── Last kjelleroversikt og kvalitetsdatabaser ved oppstart ───────────────
window.cellarData = [];
fetch('/cellar.json')
  .then(function(r) { return r.json(); })
  .then(function(data) { window.cellarData = data; })
  .catch(function() { window.cellarData = []; });

// RAG: produsent- og appellasjonsindekser
window.producerIndex    = null;
window.appellationIndex = null;

function normStr(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

Promise.all([
  fetch('/producers_db_v2.json').then(function(r) { return r.json(); }),
  fetch('/appellations_db_v2.json').then(function(r) { return r.json(); })
]).then(function(results) {
  var pIdx = new Map();
  Object.values(results[0]).forEach(function(data) {
    (data.search_terms || []).forEach(function(term) { pIdx.set(normStr(term), data); });
  });
  window.producerIndex = pIdx;

  var aIdx = new Map();
  Object.values(results[1]).forEach(function(data) {
    (data.search_terms || []).forEach(function(term) { aIdx.set(normStr(term), data); });
  });
  window.appellationIndex = aIdx;

  // Bygg region → topprodusenter-index: appellation-søketerm → tier 4/5-produsenter
  // Brukes i runSearches for å injisere produsentsøk og garantere at toppnavn er i kandidatpoolen
  var rToP = new Map();
  Object.values(results[0]).forEach(function(p) {
    if ((p.tier || 0) < 3) return;
    if (!p.availability || (p.availability.polet_presence || 0) < 2) return;
    (p.regions || []).forEach(function(regionKey) {
      var appData = results[1][regionKey];
      if (!appData) return;
      (appData.search_terms || []).forEach(function(term) {
        var k = normStr(term);
        if (!rToP.has(k)) rToP.set(k, []);
        rToP.get(k).push(p);
      });
    });
  });
  window.regionToProducers = rToP;
}).catch(function() {});

(function () {
  var history = [];

  window.newChat = function () {
    history = [];
    var chat = document.getElementById('chat');
    while (chat.firstChild) chat.removeChild(chat.firstChild);
    addWelcome();
  };

  // ── Init ──────────────────────────────────────────────────────────────────
  document.getElementById('inp').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') send();
  });

  window.send = send;
  window.qs   = function (msg) { document.getElementById('inp').value = msg; send(); };

  // ── Send ──────────────────────────────────────────────────────────────────
  async function send() {
    var inp = document.getElementById('inp');
    var msg = inp.value.trim();
    if (!msg) return;

    inp.value = '';
    document.getElementById('chips')?.remove();
    addUserMsg(msg);
    setSending(true);
    history.push({ role: 'user', content: msg });

    var loadingEl = addBotMsg('Tenker...', { thinking: true });

    try {
      var result = await window.Agent.run(history, function (status) {
        updateThinking(loadingEl, status);
      });
      loadingEl.remove();
      addBotMsg(result.text, { products: result.products });
    } catch (e) {
      loadingEl.remove();
      addBotMsg('En feil oppstod: ' + e.message, { isError: true });
    }

    setSending(false);
  }

  // ── UI-helpers ─────────────────────────────────────────────────────────────
  function setSending(active) {
    var btn = document.getElementById('sbtn');
    btn.disabled    = active;
    btn.textContent = active ? '...' : 'Send';
  }

  function addUserMsg(text) {
    var d = document.createElement('div');
    d.className   = 'mu';
    d.textContent = text;
    appendToChat(d);
  }

  function addBotMsg(text, opts) {
    opts = opts || {};
    var d = document.createElement('div');
    d.className = 'mb';

    var t = document.createElement('div');
    t.className = 'mb-text' + (opts.thinking ? ' thinking' : '') + (opts.isError ? ' error' : '');
    t.textContent = text;
    d.appendChild(t);

    if (opts.products && opts.products.length > 0) {
      var all = opts.products;
      var shown = all.slice(0, 12);
      if (all.length > 12) {
        var note = document.createElement('div');
        note.className = 'mb-note';
        note.textContent = 'Fant ' + all.length + ' treff – viser de 12 beste basert på din profil.';
        d.appendChild(note);
      }
      var row = document.createElement('div');
      row.className = 'cards';
      shown.forEach(function (p) { row.appendChild(makeCard(p)); });
      d.appendChild(row);
    }

    appendToChat(d);
    return d;
  }

  function updateThinking(el, status) {
    var t = el.querySelector('.mb-text');
    if (t) t.textContent = status;
  }

  function appendToChat(el) {
    var chat = document.getElementById('chat');
    chat.appendChild(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  // ── Produktkort ────────────────────────────────────────────────────────────
  function makeCard(p) {
    var loc = [p.country, p.region, p.subRegion].filter(Boolean).join(', ');
    var vol = p.volume || '';

    var a = document.createElement('a');
    a.className = 'card';
    if (p.url) { a.href = p.url; a.target = '_blank'; a.rel = 'noopener'; }

    a.innerHTML = [
      (function() {
      var sel = p.productSelection;
      if (!sel) return '';
      var label = sel === 'Basisutvalget' ? 'I butikk' : 'Kan bestilles';
      var cls   = sel === 'Basisutvalget' ? 'c-avail-store' : 'c-avail-order';
      return '<div class="c-avail ' + cls + '">' + label + '</div>';
    })(),
    (p.status === 'utgatt'
      ? '<div class="c-avail c-avail-gone">Kun i butikk</div>'
      : p.status === 'aktiv'
        ? '<div class="c-avail c-avail-ok">Kan bestilles</div>'
        : ''),
    p.mainCategory ? '<div class="c-type">' + esc(p.mainCategory) + '</div>' : '',
      '<div class="c-name">' + esc(p.name) + '</div>',
      p.id      ? '<div class="c-id">'     + esc(p.id)      + '</div>' : '',
      loc       ? '<div class="c-origin">' + esc(loc)        + '</div>' : '',
      p.vintage ? '<div class="c-vintage">'+ esc(p.vintage)  + '</div>' : '',
      p.abv     ? '<div class="c-abv">'    + esc(p.abv)      + ' %</div>' : '',
      p.price != null
        ? '<div class="c-price"><span class="c-pval">Kr ' +
          Number(p.price).toLocaleString('nb', { minimumFractionDigits: 2 }) +
          '</span>' + (vol ? '<span class="c-vol">' + vol + '</span>' : '') + '</div>'
        : ''
    ].join('');

    return a;
  }

  // ── Utils ──────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

})();
