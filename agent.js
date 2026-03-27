// agent.js – hjernen i appen
// Eksponeres som window.Agent

window.Agent = (function () {

// ── Smaksprofil ───────────────────────────────────────────────────────────────
var PROFILE =
'Brukerprofil: friskhet (10/10), syre (10/10), presisjon (9/10), terroirtransparens (9/10). ' +
'Liker: syrlige, minerale, elegante, transparente stiler. ' +
'Unngår: overmodne, jammy, tungt eika, høy alkohol/lav syre. ' +
'Toppregioner: Champagne, Chablis, hvit Burgund, tysk Riesling, rød Burgund, Nord-Rhône, Piemonte. ' +
'Rødvin: rødfrukt, frisk, parfymert, fine tanniner, transparens over masse. ' +
'Pinot: friske røde stiler. Nebbiolo: eleganse og energi. Syrah: Nord-Rhône-stil. Bordeaux: klassisk venstrekyst.';

// ── Planleggingsprompt ────────────────────────────────────────────────────────
var PLAN_SYSTEM =
'Du er en sommelier som planlegger vinsøk for en bruker med denne profilen:\n' +
PROFILE + '\n\n' +
'Lag en søkeplan som JSON. Svar KUN med JSON, ingen annen tekst.\n\n' +
'Format:\n' +
'{\n' +
'  "reasoning": "kort faglig begrunnelse",\n' +
'  "search_targets": ["søkestreng1", "søkestreng2", ...],\n' +
'  "food_pairing_filter": "identifier eller null"\n' +
'}\n\n' +
'Regler:\n' +
'- Ved matspørsmål: ALLTID minst 4 ulike stiler/regioner\n' +
'- For rødvin til kjøtt: alltid Barolo/Barbaresco, Bordeaux, Nord-Rhône, Burgund\n' +
'- Maks 6 søkestrenger\n' +
'- Søk på produsent eller regionsnavn\n\n' +
'food_pairing_filter: mutton, beef, pork, poultry, small_game, large_game, ' +
'fish, shellfish, pasta, cheese, dessert, aperitif, spicy_food';

// ── Agentprompt ───────────────────────────────────────────────────────────────
var AGENT_SYSTEM =
'Du er en personlig sommelier og vinrådgiver for Vinmonopolet i Norge.\n\n' +
PROFILE + '\n\n' +
'REGLER:\n' +
'- Basér deg utelukkende på faktiske søkeresultater. Finn aldri på produkter.\n' +
'- Svar kort og konkret på norsk.\n' +
'- Filtrer bort viner som ikke passer profilen.\n' +
'- Aldri mer enn 2 anbefalinger fra samme region.\n\n' +
'ARBEIDSFLYT:\n' +
'1. Utfør alle søk fra planen\n' +
'2. Gå gjennom ALLE søkeresultater og ranger dem mot brukerprofilen\n' +
'3. Kall recommend_products med de 6-12 beste varenumrene i rangert rekkefølge\n' +
'4. Skriv en kort, konkret anbefaling med begrunnelse\n\n' +
'recommend_products MÅ alltid kalles som siste steg – kortene brukeren ser ' +
'er utelukkende basert på din rangering, ikke søkeresultatene direkte.\n\n' +
'BUTIKKBEHOLDNING:\n' +
'Bruk get_store_stock KUN ved eksplisitt lagerspørsmål. Maks 10 kall.\n' +
'Trekk by fra samtalen (standard: Oslo).\n' +
'List alltid: "Oslo, Vinderen: 7 stk".\n\n' +
'SVARFORMAT:\n' +
'- 3–6 anbefalinger fra MINST 3 ulike regioner/druer\n' +
'- Navn, varenummer, pris og stilbegrunnelse';

// ── Tools ─────────────────────────────────────────────────────────────────────
var TOOLS = [
  {
    name: 'search_vinmonopolet',
    description: 'Søk i Vinmonopolets produktkatalog.',
    input_schema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Søketekst – produsent eller regionsnavn.' },
        foodFilter: { type: 'string', description: 'Matparing-identifier, f.eks. "mutton".' }
      },
      required: ['q']
    }
  },
  {
    name: 'recommend_products',
    description: 'Kall dette som SISTE steg etter alle søk. Sender din rangerte liste av anbefalte varenumre. Disse blir kortene brukeren ser.',
    input_schema: {
      type: 'object',
      properties: {
        productCodes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Rangert liste av varenumre (best først). Maks 12.'
        }
      },
      required: ['productCodes']
    }
  },
  {
    name: 'get_store_stock',
    description: 'Henter butikker med produktet på lager.',
    input_schema: {
      type: 'object',
      properties: {
        productCode: { type: 'string' },
        city: { type: 'string', description: 'Standard: "Oslo".' }
      },
      required: ['productCode']
    }
  }
];

// ── Planleggingssteg ──────────────────────────────────────────────────────────
async function makePlan(history) {
  try {
    var res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:    'claude-sonnet-4-5-20250929',
        max_tokens: 400,
        system:   PLAN_SYSTEM,
        messages: history
      })
    });
    var data = await res.json();
    var text = (data.content || []).find(function(b) { return b.type === 'text'; });
    if (!text) return null;
    return JSON.parse(text.text.replace(/```json|```/g, '').trim());
  } catch (e) { return null; }
}

// ── Agent-løkke ───────────────────────────────────────────────────────────────
async function run(history, onStatus) {
  var allProducts      = [];
  var allStores        = [];
  var recommendedCodes = null;
  var finalText        = '';

  // Steg 1: Planlegg
  onStatus && onStatus('Planlegger søk...');
  var plan = await makePlan(history);

  var agentHistory = history.slice();
  if (plan) {
    agentHistory = history.concat([
      { role: 'assistant', content: 'Søkeplan: ' + JSON.stringify(plan) },
      { role: 'user',      content: 'Utfør søkene, ranger alle resultater mot profilen, og avslutt med recommend_products.' }
    ]);
  }

  // Steg 2: Agent-løkke
  for (var i = 0; i < 12; i++) {
    var res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        system:     AGENT_SYSTEM,
        tools:      TOOLS,
        messages:   agentHistory
      })
    });

    var data = await res.json();
    if (data.error) throw new Error(data.error.message);

    var toolBlocks = (data.content || []).filter(function(b) { return b.type === 'tool_use'; });
    var textBlock  = (data.content || []).find(function(b) { return b.type === 'text'; });

    // Ferdig når ingen tools og tekst finnes
    if (toolBlocks.length === 0) {
      finalText = (textBlock && textBlock.text) || 'Beklager, noe gikk galt.';
      history.push({ role: 'assistant', content: finalText });
      break;
    }

    agentHistory.push({ role: 'assistant', content: data.content });
    var results = [];

    for (var j = 0; j < toolBlocks.length; j++) {
      var tb = toolBlocks[j];
      try {
        if (tb.name === 'search_vinmonopolet') {
          onStatus && onStatus('Søker ' + tb.input.q + '...');
          var products = await window.Vin.searchProducts(
            tb.input.q, null, null, tb.input.foodFilter || null
          );
          allProducts = allProducts.concat(products);
          results.push({
            type: 'tool_result',
            tool_use_id: tb.id,
            content: JSON.stringify({ found: products.length, products: products })
          });

        } else if (tb.name === 'recommend_products') {
          onStatus && onStatus('Rangerer anbefalinger...');
          recommendedCodes = tb.input.productCodes || [];
          results.push({
            type: 'tool_result',
            tool_use_id: tb.id,
            content: JSON.stringify({ ok: true, ranked: recommendedCodes.length })
          });

        } else if (tb.name === 'get_store_stock') {
          var city = tb.input.city || 'oslo';
          onStatus && onStatus('Sjekker lager i ' + city + '...');
          var stores = await window.Vin.getStock(tb.input.productCode, city);
          stores.forEach(function(s) {
            var ex = allStores.find(function(e) { return e.name === s.name; });
            if (ex) { ex.stock = (ex.stock || 0) + (s.stock || 0); }
            else { allStores.push(s); }
          });
          allStores.sort(function(a, b) { return (b.stock || 0) - (a.stock || 0); });
          results.push({
            type: 'tool_result',
            tool_use_id: tb.id,
            content: JSON.stringify({ storesWithStock: stores.length, stores: stores })
          });
        }
      } catch (e) {
        results.push({ type: 'tool_result', tool_use_id: tb.id, content: 'Feil: ' + e.message });
      }
    }

    agentHistory.push({ role: 'user', content: results });
  }

  // Bygg produktliste: enten rangert av agenten, eller deduplisert søkeresultat
  var recommended;
  if (recommendedCodes && recommendedCodes.length > 0) {
    // Ranger etter agentens rekkefølge, fyll inn fra allProducts
    var productMap = {};
    allProducts.forEach(function(p) { if (p.id) productMap[p.id] = p; });
    recommended = recommendedCodes
      .map(function(code) { return productMap[code] || null; })
      .filter(Boolean);
    // Legg til eventuelle som agenten fant men ikke eksplisitt rangte (de havner sist)
  } else {
    var seen = {};
    recommended = allProducts.filter(function(p) {
      if (!p.id || seen[p.id]) return false;
      seen[p.id] = true;
      return true;
    });
  }

  return { text: finalText, products: recommended, stores: allStores };
}

return { run: run };

})();
