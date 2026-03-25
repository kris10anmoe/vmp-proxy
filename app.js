// app.js – UI-logikk og rendering
// Kobler brukerinput til agent og renderer svar + produktkort.

import { runAgent } from './agent.js';

let history = [];

// ── Oppstart ──────────────────────────────────────────────────────────────────

document.getElementById('inp').addEventListener('keydown', e => {
  if (e.key === 'Enter') send();
});

// ── Send melding ──────────────────────────────────────────────────────────────

export async function send() {
  const inp = document.getElementById('inp');
  const msg = inp.value.trim();
  if (!msg) return;

  inp.value = '';
  document.getElementById('chips')?.remove();
  addUserMsg(msg);
  setSending(true);

  history.push({ role: 'user', content: msg });

  const statusEl = addThinking();

  try {
    const { text, products, stores } = await runAgent(
      history,
      status => updateThinking(statusEl, status)
    );
    statusEl.remove();
    addBotMsg(text, products, stores);
  } catch (e) {
    statusEl.remove();
    addBotMsg(`En feil oppstod: ${e.message}`);
  } finally {
    setSending(false);
  }
}

// Eksporter for bruk fra inline onclick i HTML
window.send = send;
window.qs   = msg => { document.getElementById('inp').value = msg; send(); };

// ── UI-hjelpere ───────────────────────────────────────────────────────────────

function setSending(active) {
  const btn = document.getElementById('sbtn');
  btn.disabled    = active;
  btn.textContent = active ? '...' : 'Send';
}

function addUserMsg(text) {
  const d = document.createElement('div');
  d.className   = 'mu';
  d.textContent = text;
  append(d);
}

function addThinking() {
  const d = document.createElement('div');
  d.className = 'mb';
  const t = document.createElement('div');
  t.className   = 'mb-text thinking';
  t.textContent = 'Tenker...';
  d.appendChild(t);
  append(d);
  return d;
}

function updateThinking(el, status) {
  const t = el.querySelector('.mb-text');
  if (t) t.textContent = status;
}

function addBotMsg(text, products, stores) {
  const d = document.createElement('div');
  d.className = 'mb';

  if (text) {
    const t = document.createElement('div');
    t.className   = 'mb-text';
    t.textContent = text;
    d.appendChild(t);
  }

  if (products?.length) {
    const row = document.createElement('div');
    row.className = 'cards';
    products.forEach(p => row.appendChild(makeCard(p)));
    d.appendChild(row);
  }

  if (stores?.length) {
    d.appendChild(makeStoreList(stores));
  }

  append(d);
}

function append(el) {
  const chat = document.getElementById('chat');
  chat.appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

// ── Produktkort ───────────────────────────────────────────────────────────────

function makeCard(p) {
  const loc = [p.country, p.region, p.subRegion].filter(Boolean).join(', ');
  const vol = p.volume ? Math.round(p.volume * 100) + ' cl' : '';

  const a = document.createElement('a');
  a.className = 'card';
  if (p.url) { a.href = p.url; a.target = '_blank'; a.rel = 'noopener'; }

  a.innerHTML = [
    p.mainCategory ? `<div class="c-type">${esc(p.mainCategory)}</div>` : '',
    `<div class="c-name">${esc(p.name)}</div>`,
    p.id    ? `<div class="c-id">${esc(p.id)}</div>`         : '',
    loc     ? `<div class="c-origin">${esc(loc)}</div>`       : '',
    p.abv   ? `<div class="c-abv">${esc(p.abv)} %</div>`      : '',
    p.price != null
      ? `<div class="c-price">
           <span class="c-pval">Kr ${Number(p.price).toLocaleString('nb', { minimumFractionDigits: 2 })}</span>
           ${vol ? `<span class="c-vol">${vol}</span>` : ''}
         </div>`
      : ''
  ].join('');

  return a;
}

// ── Butikkliste ───────────────────────────────────────────────────────────────

function makeStoreList(stores) {
  const div = document.createElement('div');
  div.className = 'store-list';

  stores.forEach(s => {
    const row = document.createElement('div');
    row.className = 'store-row';
    row.innerHTML = `
      <span>
        ${esc(s.name)}
        ${s.city ? `<span class="store-city">${esc(s.city)}</span>` : ''}
      </span>
      <span class="store-qty">${s.stock != null ? s.stock + ' stk' : ''}</span>
    `;
    div.appendChild(row);
  });

  return div;
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
