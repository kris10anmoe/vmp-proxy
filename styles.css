// agent.js – hjernen i appen
// Systemprompt, tool-definisjoner og agent-løkken.
// Fri på vinforståelse, stram på fakta og verktøybruk.

import { searchProducts, getStock } from './vin.js';

// ── Systemprompt ──────────────────────────────────────────────────────────────

const SYSTEM = `Du er en kunnskapsrik sommelier og vinrådgiver for Vinmonopolet i Norge.

REGLER:
- Du baserer deg utelukkende på faktiske søkeresultater. Finn aldri på produkter.
- Pris, varenummer og tilgjengelighet må alltid komme fra API-et – aldri gjett.
- Bruk alltid søkeverktøyet før du anbefaler noe konkret.
- Maks 4 søk per forespørsel. Stopp når treffene er gode nok.
- Svar kort og konkret på norsk.

SØKELOGIKK:
Bruk fagkunnskapen din til å utlede riktig søkenavn FØR du søker.
Eksempler:
- "Angerville i Jura" → produsentnavnet er Domaine du Pélican → søk "Pélican" OG "Pelican"
- "DRC" → søk "Romanee-Conti" OG "Romanée-Conti"
- "Coche" → søk "Coche-Dury"
- "Pingus" / "Peter Sisseck" → søk "Pingus"
- "Unico" → søk "Vega Sicilia"
- Navn med aksenter: søk alltid med og uten aksent (to søk)

BUTIKKBEHOLDNING:
Bruk get_store_stock når brukeren spør hvilke butikker som har en bestemt vin.
Presenter resultatet som en sortert liste med butikknavn og antall.

SVARFORMAT:
- 2–5 anbefalinger med navn, varenummer og pris
- Kort begrunnelse for hvert valg basert på din fagkunnskap`;

// ── Tool-definisjoner ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'search_vinmonopolet',
    description: 'Søk i Vinmonopolets produktkatalog med fritekst mot produktnavn og produsent.',
    input_schema: {
      type: 'object',
      properties: {
        q: {
          type: 'string',
          description: 'Søketekst – produktnavn, produsent eller kombinasjon. Søk med og uten aksenter ved usikkerhet.'
        }
      },
      required: ['q']
    }
  },
  {
    name: 'get_store_stock',
    description: 'Henter hvilke Vinmonopol-butikker som har et bestemt produkt på lager, med antall per butikk.',
    input_schema: {
      type: 'object',
      properties: {
        productCode: {
          type: 'string',
          description: 'Vinmonopolets varenummer, f.eks. "19921901".'
        }
      },
      required: ['productCode']
    }
  }
];

// ── Agent-løkke ───────────────────────────────────────────────────────────────

export async function runAgent(history, onStatus) {
  let allProducts = [];
  let allStores   = [];
  let finalText   = '';

  for (let i = 0; i < 8; i++) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:     'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system:    SYSTEM,
        tools:     TOOLS,
        messages:  history
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const toolBlocks = data.content?.filter(b => b.type === 'tool_use') || [];
    const textBlock  = data.content?.find(b => b.type === 'text');

    if (toolBlocks.length === 0) {
      finalText = textBlock?.text || 'Beklager, noe gikk galt.';
      history.push({ role: 'assistant', content: finalText });
      break;
    }

    history.push({ role: 'assistant', content: data.content });
    const results = [];

    for (const tb of toolBlocks) {
      try {
        if (tb.name === 'search_vinmonopolet') {
          onStatus?.('Søker...');
          const products = await searchProducts(tb.input.q);
          allProducts = [...allProducts, ...products];
          results.push({
            type: 'tool_result',
            tool_use_id: tb.id,
            content: JSON.stringify({ found: products.length, products })
          });

        } else if (tb.name === 'get_store_stock') {
          onStatus?.('Sjekker butikkbeholdning...');
          const stores = await getStock(tb.input.productCode);
          allStores = stores;
          results.push({
            type: 'tool_result',
            tool_use_id: tb.id,
            content: JSON.stringify({ storesWithStock: stores.length, stores })
          });
        }
      } catch (e) {
        results.push({
          type: 'tool_result',
          tool_use_id: tb.id,
          content: `Feil: ${e.message}`
        });
      }
    }

    history.push({ role: 'user', content: results });
  }

  // Dedupliser produkter
  const seen    = new Set();
  const unique  = allProducts.filter(p => {
    if (!p.id || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return { text: finalText, products: unique, stores: allStores };
}
