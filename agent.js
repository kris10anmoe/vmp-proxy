// agent.js – hjernen i appen
// Systemprompt, tool-definisjoner og agent-løkken.
// Eksponeres som window.Agent

window.Agent = (function () {

// ── Systemprompt ──────────────────────────────────────────────────────────────

var SYSTEM = 'Du er en kunnskapsrik sommelier og vinrådgiver for Vinmonopolet i Norge.\n\n' +
'REGLER:\n' +
'- Du baserer deg utelukkende på faktiske søkeresultater. Finn aldri på produkter.\n' +
'- Pris, varenummer og tilgjengelighet må alltid komme fra API-et – aldri gjett.\n' +
'- Bruk alltid søkeverktøyet før du anbefaler noe konkret.\n' +
'- Maks 4 søk per forespørsel. Stopp når treffene er gode nok.\n' +
'- Svar kort og konkret på norsk.\n\n' +
'SØKELOGIKK:\n' +
'Bruk fagkunnskapen din til å utlede riktig søkenavn FØR du søker.\n' +
'Eksempler:\n' +
'- "Angerville i Jura" → produsentnavnet er Domaine du Pélican → søk "Pélican" OG "Pelican"\n' +
'- "DRC" → søk "Romanee-Conti" OG "Romanée-Conti"\n' +
'- "Coche" → søk "Coche-Dury"\n' +
'- "Pingus" / "Peter Sisseck" → søk "Pingus"\n' +
'- "Unico" → søk "Vega Sicilia"\n' +
'- Navn med aksenter: søk alltid med og uten aksent (to søk)\n\n' +
'BUTIKKBEHOLDNING:\n' +
'Bruk get_store_stock når brukeren spør hvilke butikker som har en bestemt vin.\n' +
'Presenter resultatet som en sortert liste med butikknavn og antall.\n\n' +
'SVARFORMAT:\n' +
'- 2–5 anbefalinger med navn, varenummer og pris\n' +
'- Kort begrunnelse for hvert valg basert på din fagkunnskap';

// ── Tool-definisjoner ─────────────────────────────────────────────────────────

var TOOLS = [
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

async function run(history, onStatus) {
  var allProducts = [];
  var allStores   = [];
  var finalText   = '';

  for (var i = 0; i < 8; i++) {
    var res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5-20250929',
        max_tokens: 1500,
        system:     SYSTEM,
        tools:      TOOLS,
        messages:   history
      })
    });

    var data = await res.json();
    if (data.error) throw new Error(data.error.message);

    var toolBlocks = (data.content || []).filter(function (b) { return b.type === 'tool_use'; });
    var textBlock  = (data.content || []).find(function (b) { return b.type === 'text'; });

    if (toolBlocks.length === 0) {
      finalText = (textBlock && textBlock.text) || 'Beklager, noe gikk galt.';
      history.push({ role: 'assistant', content: finalText });
      break;
    }

    history.push({ role: 'assistant', content: data.content });
    var results = [];

    for (var j = 0; j < toolBlocks.length; j++) {
      var tb = toolBlocks[j];
      try {
        if (tb.name === 'search_vinmonopolet') {
          if (onStatus) onStatus('Søker...');
          var products = await window.Vin.searchProducts(tb.input.q);
          allProducts = allProducts.concat(products);
          results.push({
            type: 'tool_result',
            tool_use_id: tb.id,
            content: JSON.stringify({ found: products.length, products: products })
          });

        } else if (tb.name === 'get_store_stock') {
          if (onStatus) onStatus('Sjekker butikkbeholdning...');
          var storeId = tb.input.storeId || null;
          var stores  = await window.Vin.getStock(tb.input.productCode, storeId);
          allStores   = stores;
          results.push({
            type: 'tool_result',
            tool_use_id: tb.id,
            content: JSON.stringify({ storesWithStock: stores.length, stores: stores })
          });
        }
      } catch (e) {
        results.push({
          type: 'tool_result',
          tool_use_id: tb.id,
          content: 'Feil: ' + e.message
        });
      }
    }

    history.push({ role: 'user', content: results });
  }

  // Dedupliser produkter
  var seen   = {};
  var unique = allProducts.filter(function (p) {
    if (!p.id || seen[p.id]) return false;
    seen[p.id] = true;
    return true;
  });

  return { text: finalText, products: unique, stores: allStores };
}

return { run: run };

})();
