// agent.js – agentlogikk, systemprompt og tool-løkke
// Avhenger av: vin.js (window.Vin)
// Eksponeres som window.Agent

window.Agent = (function () {

  const SYSTEM = `Du er en kunnskapsrik sommelier og vinrådgiver for Vinmonopolet i Norge.

REGLER FOR VERKTØYBRUK:
- Du skal ALLTID bruke search_vinmonopolet-verktøyet når brukeren spør om viner, produsenter eller anbefalinger.
- Du skal ALDRI oppgi pris, lagerstatus eller produktdetaljer uten å hente det fra API-et først.
- Du skal ALDRI finne på produkter eller gi generelle råd basert på egne antagelser – kun faktiske søkeresultater.
- Hvis søket returnerer 0 treff eller feil, si NØYAKTIG det: "Søket på '[søkeord]' ga 0 treff." Ikke lag forklaringer.
- Prøv alternative stavemåter ved 0 treff – gjør opptil 3 søk før du gir opp.
- Hvis ALLE søk feiler teknisk (ikke 0 treff, men faktisk feil), si: "Søketjenesten svarte ikke – prøv igjen."

SØKESTRATEGI:
Bruk fagkunnskapen din til å utlede riktig søkeord. Eksempler:
- "Felsina" → søk "Felsina", prøv også "Fèlsina"
- "Angerville i Jura" → søk "Pélican" OG "Pelican"
- "DRC" → søk "Romanee-Conti" OG "Romanée-Conti"
- "Coche" → søk "Coche-Dury"
- "sjømat under 200" → søk "hvitvin" eller "Sauvignon Blanc" eller "Albariño"
- Navn med aksenter: søk alltid med OG uten aksent

SVAR:
- Basér deg utelukkende på faktiske søkeresultater
- Presenter 2–5 anbefalinger med navn, varenummer og pris
- Forklar kort hvorfor disse passer
- Svar alltid på norsk`;

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

  async function run(history, onStatus) {
    const MAX_ITERATIONS = 8;
    let allProducts = [];
    let allStores   = [];
    let finalText   = '';

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const toolChoice = i === 0 ? { type: 'any' } : { type: 'auto' };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          system: SYSTEM,
          tools: TOOLS,
          tool_choice: toolChoice,
          messages: history
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error('API-feil ' + res.status + ': ' + errText);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const toolBlocks = (data.content || []).filter(b => b.type === 'tool_use');
      const textBlock  = (data.content || []).find(b => b.type === 'text');

      if (toolBlocks.length === 0) {
        finalText = textBlock?.text || 'Beklager, noe gikk galt.';
        history.push({ role: 'assistant', content: finalText });
        break;
      }

      history.push({ role: 'assistant', content: data.content });

      const toolResults = [];
      for (const tb of toolBlocks) {
        try {
          if (tb.name === 'search_vinmonopolet') {
            onStatus('Søker etter «' + tb.input.q + '»...');
            const products = await window.Vin.searchProducts(tb.input.q);
            allProducts = allProducts.concat(products);
            // Send alltid faktisk antall tilbake – modellen skal ikke gjette
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tb.id,
              content: JSON.stringify({
                query: tb.input.q,
                found: products.length,
                products: products
              })
            });
          } else if (tb.name === 'get_store_stock') {
            onStatus('Sjekker butikkbeholdning...');
            const stores = await window.Vin.getStock(tb.input.productCode);
            allStores = stores;
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tb.id,
              content: JSON.stringify({ storesWithStock: stores.length, stores: stores })
            });
          }
        } catch (e) {
          // Send faktisk feilmelding tilbake til modellen
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tb.id,
            content: JSON.stringify({ error: e.message, found: 0, products: [] })
          });
        }
      }

      history.push({ role: 'user', content: toolResults });
    }

    const seen = new Set();
    const uniqueProducts = allProducts.filter(p => {
      if (!p.id || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    return { text: finalText, products: uniqueProducts, stores: allStores };
  }

  return { run };
})();
