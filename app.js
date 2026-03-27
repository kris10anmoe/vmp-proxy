// app.js – UI-logikk og rendering
// Avhenger av: vin.js (window.Vin), agent.js (window.Agent)

(function () {
  var history = [];

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
      var row = document.createElement('div');
      row.className = 'cards';
      opts.products.forEach(function (p) { row.appendChild(makeCard(p)); });
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
