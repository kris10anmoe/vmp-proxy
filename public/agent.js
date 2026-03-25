// agent.js – agentlogikk, systemprompt og tool-løkke
import { searchProducts, getStock } from './vin.js';

const SYSTEM = `Du er en kunnskapsrik sommelier og vinrådgiver for Vinmonopolet i Norge.

REGLER FOR VERKTØYBRUK:
- Du skal ALLTID bruke search_vinmonopolet-verktøyet når brukeren spør om viner, produsenter eller anbefalinger.
- Du skal ALDRI oppgi pris, lagerstatus eller produktdetaljer uten å hente det fra API-et først.
- Du skal ALDRI finne på produkter som ikke finnes i søkeresultatene.
- Hvis søket gir svake treff, prøv alternative stavemåter eller søk etter delstrenger.
- Maks 4 søk per spørsmål.

SØKESTRATEGI:
Bruk fagkunnskapen din til å utlede riktig søkeord. Eksempler:
- "Felsina" → prøv "Felsina" OG "Fèlsina" OG "Fontalloro"
- "Angerville i Jura" → produsentnavnet er "Domaine du Pélican" → søk "Pélican" OG "Pelican"
- "DRC" → søk "Romanee-Conti" OG "Romanée-Conti"
- "Coche" → søk "Coche-Dury"
- "Pingus" / "Peter Sisseck" → søk "Pingus"
- "Unico" → søk "Vega Sicilia"
- Navn med aksenter: søk alltid med OG uten aksent siden APIet kan matche ulikt

Søket er fritekst mot produktnavn og produsent. Gjør gjerne 2–3 søk for å dekke ulike stavemåter.

BUTIKKBEHOLDNING:
Hvis brukeren spør hvilke butikker som har en vin, bruk get_store_stock med produktets varenummer.
Presenter en liste over butikker med antall på lager.

SVAR:
- Basér deg utelukkende på faktiske søkeresultater – finn aldri på produkter
- Presenter 2–5 anbefalinger med navn, varenummer og pris
- Bruk din fagkunnskap til å forklare kort hvorfor du anbefaler akkurat disse
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
    description: 'Henter hvilke Vinmonopol-butikker som har et bestemt produkt på lager, med antall enheter per butikk.',
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

// ── Agentløkke ────────────────────────────────────────────────────────────────

export async function runAgent(history, onStatus) {
  const MAX_ITERATIONS = 8;
  let allProducts = [];
  let allStores   = [];
  let finalText   = '';

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // Første runde: tving modellen til å bruke et verktøy (ingen gjetting).
    // Påfølgende runder: "auto" slik at den kan velge å svare med tekst.
    const toolChoice = i === 0 ? { type: 'any' } : { type: 'auto' };

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20251001',
        max_tokens: 1500,
        system: SYSTEM,
        tools: TOOLS,
        tool_choice: toolChoice,
        messages: history
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API-feil ${res.status}: ${errText}`);
    }

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

    const toolResults = [];
    for (const tb of toolBlocks) {
      try {
        if (tb.name === 'search_vinmonopolet') {
          onStatus('Søker...');
          const products = await searchProducts(tb.input.q);
          allProducts = [...allProducts, ...products];
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tb.id,
            content: JSON.stringify({ found: products.length, products })
          });
        } else if (tb.name === 'get_store_stock') {
          onStatus('Sjekker butikkbeholdning...');
          const stores = await getStock(tb.input.productCode);
          allStores = stores;
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tb.id,
            content: JSON.stringify({ storesWithStock: stores.length, stores })
          });
        }
      } catch (e) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tb.id,
          content: `Feil: ${e.message}`
        });
      }
    }

    history.push({ role: 'user', content: toolResults });
  }

  // Dedupliser produkter på tvers av søk
  const seen = new Set();
  const uniqueProducts = allProducts.filter(p => {
    if (!p.id || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return { text: finalText, products: uniqueProducts, stores: allStores };
}
