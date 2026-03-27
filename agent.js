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
'  "search_targets": [\n' +
'    {"q": "søkestreng", "type": "producer"},\n' +
'    {"q": "regionsnavn stil", "type": "region"}\n' +
'  ]\n' +
'}\n\n' +
'type=producer: spesifikk produsent, henter 30 resultater (f.eks. "Trediberri", "Jamet", "Rostaing")\n' +
'type=region: appellation/region/drue, henter 100 resultater (f.eks. "Barolo", "Chablis Premier Cru", "Pinot Noir")\n\n' +
'SØKESTRATEGI:\n' +
'Ved åpne spørsmål (matparing, stil, anledning): bruk type=region med presise apellasjoner.\n' +
'Foretrekk smale apellasjoner fremfor brede: "Gevrey Chambertin" fremfor "Bourgogne Rouge",\n' +
'"Chablis Premier Cru" fremfor "Chablis", "Barolo" fremfor "Piemonte".\n' +
'Bruk type=producer kun unntaksvis ved åpne spørsmål – f.eks. hvis en enkeltprodusent\n' +
'er særlig relevant for en spesifikk stil og brukeren sannsynligvis kjenner dem.\n' +
'Ved spesifikke spørsmål (produsent/vin nevnt): bruk type=producer direkte.\n\n' +
'KRITISK: Vinmonopolets søk matcher kun produktnavn og produsentnavn – ikke beskrivende ord.\n' +
'"Barolo tradisjonell", "Chablis grower", "Barolo biologisk" gir 0 treff.\n' +
'Søk KUN på rene produsent-/regionnavn, appellation, drue eller vintype.\n' +
'KRITISK: search_targets er søk i Vinmonopolets produktkatalog.\n' +
'Verdiene MÅ være vinnavn, produsentnavn, regionsnavn eller vintyper – aldri matnavn.\n' +
'Feil: "and i appelsinsaus" Riktig: "Pinot Noir Burgund", "Riesling trocken", "Gewurztraminer"\n' +
'For matspørsmål: oversett retten til passende vinstiler FØR du fyller inn search_targets.\n' +
'Maks 6 søk. Ved matspørsmål: minst 4 ulike vinstiler/regioner.\n\n' +
'INGEN SØKEBEHOV – bruk search_targets: [] når spørsmålet:\n' +
'- ber om rangering/sammenligning av allerede nevnte viner\n' +
'- er en oppfølging uten behov for nye produkter (f.eks. "hvilken er best?", "ranger disse")\n' +
'- spør om en spesifikk vin agenten allerede har funnet\n\n';

// ── Batchrangering prompt ─────────────────────────────────────────────────────
var BATCH_SYSTEM =
'Du er en sommelier som rangerer viner for en bruker med denne profilen:\n' +
PROFILE + '\n\n' +
'Du får en liste kandidater. Velg de 6 beste som passer brukerprofilen.\n' +
'Svar KUN med JSON: {"selected": ["id1", "id2", ...]}\n\n' +
'VED MATSPØRSMÅL: matmatch er primærkriterium.\n' +
'Gjør semantisk vurdering – tilberedning, saus og intensitet teller, ikke bare tags.\n\n' +
'UNIVERSELLE PRINSIPPER:\n' +
'1. Produsentkvalitet – enkeltprodusenter over kooperativer og handelshusnavn\n' +
'2. Stilmatch innenfor vinens egne premisser – friskhet, presisjon og balanse\n' +
'   er universelle, men hva det betyr for Barolo vs Saumur er forskjellig\n' +
'3. Årgangskvalitet og drikkevindu\n' +
'4. Pris/kvalitet-ratio (lavest vekt)\n' +
'Enklere vin fra topprodusent > toppvin fra middelmådig produsent ved samme prispunkt.';

// ── Agentprompt ───────────────────────────────────────────────────────────────
var AGENT_SYSTEM =
'Du er en personlig sommelier og vinrådgiver for Vinmonopolet i Norge.\n\n' +
PROFILE + '\n\n' +
'REGLER:\n' +
'- Basér deg utelukkende på faktiske søkeresultater. Finn aldri på produkter.\n' +
'- Svar kort og konkret på norsk.\n' +
'- Aldri mer enn 1 anbefaling fra samme produsent.\n' +
'- Aldri mer enn 2 anbefalinger fra samme region.\n\n' +
'ARBEIDSFLYT:\n' +
'1. Utfør søkene fra planen\n' +
'2. Kandidatene er allerede batch-rangert – du ser bare finalistene\n' +
'3. Kall recommend_products med de beste 6-12 i rangert rekkefølge\n' +
'4. Skriv kort anbefaling per vin\n\n' +
'TEKSTSTIL – anta at brukeren er ekspert:\n' +
'IKKE forklar hva Barolo, Côte-Rôtie eller Gevrey er.\n' +
'SKRIV: årgangsspesifikk karakter, produsentens avvik fra regionsnormen,\n' +
'konkret drikkevindusestimat, hva som gjør akkurat denne flasken interessant nå.\n\n' +
'BUTIKKBEHOLDNING:\n' +
'Bruk get_store_stock KUN ved eksplisitt lagerspørsmål. Maks 10 kall.\n' +
'Trekk by fra samtalen (standard: Oslo). List alltid: "Oslo, Vinderen: 7 stk".\n\n' +
'SVARFORMAT:\n' +
'Ved åpne spørsmål (matparing, stil, anledning): start med én kort innledning (2–3 setninger) som\n' +
'forklarer søkestrategien – hvilke vinprofiler du lette etter og hvorfor de passer.\n' +
'For matparing: beskriv hva i retten som driver vinvalget (fett, syre, intensitet, saus, tilberedning).\n' +
'Eksempel: "Hollandaisen krever syre til å skjære gjennom fettet, og hvitfisken tåler ikke tannin.\n' +
'Jeg har prioritert Chablis og tørr Riesling – mineralitet og høy syre uten å overdøve fisken."\n' +
'Ved direkte spørsmål (spesifikk vin/produsent/sammenligning): hopp over innledning, svar direkte.\n\n' +
'- 3–6 anbefalinger fra MINST 3 ulike regioner/druer\n' +
'- Navn, varenummer, pris\n' +
'- Én konkret setning per vin';

// ── Tools ─────────────────────────────────────────────────────────────────────
var SEARCH_TOOLS = [
  {
    name: 'search_vinmonopolet',
    description: 'Søk i Vinmonopolets produktkatalog.',
    input_schema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Søketekst – produsent eller regionsnavn.' }
      },
      required: ['q']
    }
  }
];

var FINAL_TOOLS = [
  {
    name: 'recommend_products',
    description: 'Kall som SISTE steg. Sender rangert liste av varenumre som blir kortene brukeren ser.',
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

// ── Hjelpefunksjoner ──────────────────────────────────────────────────────────

// Komprimer til tynne kandidatobjekter for LLM-screening
function thinCandidate(p) {
  return {
    id:          p.id || p.code,
    name:        p.name,
    price:       p.price,
    vintage:     p.vintage,
    region:      [p.country, p.region, p.subRegion].filter(Boolean).join(' / '),
    grapes:      p.grapes || null,
    abv:         p.abv   || null,
    acid:        p.acid  || null,
    freshness:   p.freshness || null,
    fullness:    p.fullness  || null,
    tannins:     p.tannins   || null,
    food:        (p.foodPairing || []).map(function(f) { return f.name || f.identifier; }).join(', ') || null,
    storable:    p.storable || null
  };
}

// Round-robin shuffle for å spre regionsmangfold på tvers av batcher
function roundRobinBatches(candidates, batchSize) {
  // Grupper etter region
  var groups = {};
  candidates.forEach(function(c) {
    var key = (c.region || 'other').split(' / ')[0] || 'other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });
  var keys = Object.keys(groups);
  var mixed = [];
  var maxLen = Math.max.apply(null, keys.map(function(k) { return groups[k].length; }));
  for (var i = 0; i < maxLen; i++) {
    keys.forEach(function(k) {
      if (groups[k][i]) mixed.push(groups[k][i]);
    });
  }
  // Del i batcher
  var batches = [];
  for (var j = 0; j < mixed.length; j += batchSize) {
    batches.push(mixed.slice(j, j + batchSize));
  }
  return batches;
}

// ── Planleggingssteg ──────────────────────────────────────────────────────────
async function makePlan(history) {
  try {
    // Send kun siste brukermelding – full historikk gjør JSON-output upålitelig
    var lastUser = '';
    for (var i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user' && typeof history[i].content === 'string') {
        lastUser = history[i].content;
        break;
      }
    }
    var res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5-20250929',
        max_tokens: 400,
        system:     PLAN_SYSTEM,
        messages:   [{ role: 'user', content: lastUser }]
      })
    });
    var data = await res.json();
    var text = (data.content || []).find(function(b) { return b.type === 'text'; });
    if (!text) return null;
    // Ekstraher JSON selv om modellen pakker den i tekst
    var raw = text.text.replace(/```json|```/g, '').trim();
    var jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (e) { return null; }
}

// ── Batch-rangering ───────────────────────────────────────────────────────────
async function batchRank(batch, userQuery, onStatus) {
  try {
    var prompt = 'Brukerens spørsmål: "' + userQuery + '"\n\n' +
                 'Kandidater:\n' + JSON.stringify(batch, null, 1);
    var res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5-20250929',
        max_tokens: 200,
        system:     BATCH_SYSTEM,
        messages:   [{ role: 'user', content: prompt }]
      })
    });
    var data = await res.json();
    var text = (data.content || []).find(function(b) { return b.type === 'text'; });
    if (!text) return [];
    var result = JSON.parse(text.text.replace(/```json|```/g, '').trim());
    return result.selected || [];
  } catch (e) { return []; }
}

// ── Søkefase ──────────────────────────────────────────────────────────────────
async function runSearches(plan, onStatus) {
  var allProducts = [];
  var seen = {};

  for (var i = 0; i < (plan.search_targets || []).length; i++) {
    var target = plan.search_targets[i];
    // Støtt både gammelt format (streng) og nytt format (objekt med q og type)
    var q        = typeof target === 'string' ? target : target.q;
    var type     = typeof target === 'object' ? target.type : 'region';
    var pageSize = type === 'producer' ? 30 : 100;

    onStatus && onStatus('Søker ' + q + '...');
    try {
      var products = await window.Vin.searchProducts(q, pageSize, null, 'agent');
      products.forEach(function(p) {
        if (p.id && !seen[p.id]) {
          seen[p.id] = true;
          allProducts.push(p);
        }
      });
    } catch (e) { /* fortsett */ }
  }
  return allProducts;
}

// ── Finalerunde med tools ─────────────────────────────────────────────────────
async function finalRound(finalists, history, userQuery, onStatus, noSearchNeeded) {
  var allStores        = [];
  var recommendedCodes = null;
  var finalText        = '';

  var productMap = {};
  finalists.forEach(function(p) {
    if (p.id)   productMap[p.id]   = p;
    if (p.code) productMap[p.code] = p;
  });

  var thinList = finalists.map(thinCandidate);
  var agentHistory;
  if (noSearchNeeded || finalists.length === 0) {
    // Ingen nye søk – bruk historikken direkte for oppfølgingsspørsmål
    agentHistory = history.concat([{
      role: 'user',
      content: 'Svar basert på vinene vi allerede har diskutert. Kall recommend_products hvis du vil vise kort.'
    }]);
  } else {
    agentHistory = history.concat([
      {
        role: 'assistant',
        content: 'Batch-rangering fullført. Finalister (' + finalists.length + ' viner):\n' +
                 JSON.stringify(thinList, null, 1)
      },
      {
        role: 'user',
        content: 'Ranger finalistene mot profilen, kall recommend_products med de beste, og skriv anbefalingen.'
      }
    ]);
  }

  for (var i = 0; i < 8; i++) {
    var res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        system:     AGENT_SYSTEM,
        tools:      FINAL_TOOLS,
        messages:   agentHistory
      })
    });

    var data = await res.json();
    if (data.error) throw new Error(data.error.message);

    var toolBlocks = (data.content || []).filter(function(b) { return b.type === 'tool_use'; });
    var textBlock  = (data.content || []).find(function(b) { return b.type === 'text'; });

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
        if (tb.name === 'recommend_products') {
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

  // Bygg endelig produktliste
  var recommended;
  if (recommendedCodes && recommendedCodes.length > 0) {
    recommended = recommendedCodes
      .map(function(code) { return productMap[code] || null; })
      .filter(Boolean);
  } else {
    recommended = finalists;
  }

  return { text: finalText, products: recommended, stores: allStores };
}

// ── Hovedfunksjon ─────────────────────────────────────────────────────────────
async function run(history, onStatus) {

  // Hent brukerens siste melding for kontekst i batch-rangering
  var userQuery = '';
  for (var i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'user' && typeof history[i].content === 'string') {
      userQuery = history[i].content;
      break;
    }
  }

  // Steg 1: Plan
  onStatus && onStatus('Planlegger søk...');
  var plan = await makePlan(history);
  if (!plan) {
    return { text: 'Beklager, noe gikk galt under planlegging.', products: [], stores: [] };
  }

  // Steg 2: Søk – hopp over hvis ingen søk er nødvendig
  var allProducts = [];
  var noSearchNeeded = plan && Array.isArray(plan.search_targets) && plan.search_targets.length === 0;

  if (!noSearchNeeded) {
    allProducts = await runSearches(plan, onStatus);
    if (allProducts.length === 0 && !noSearchNeeded) {
      return { text: 'Fant ingen produkter. Prøv et annet søk.', products: [], stores: [] };
    }
  }

  var finalists;

  if (allProducts.length <= 60) {
    // Steg 3a: Direkte finalerunde
    onStatus && onStatus('Rangerer ' + allProducts.length + ' kandidater...');
    finalists = allProducts;

  } else {
    // Steg 3b: Batch-rangering
    onStatus && onStatus('Sorterer ' + allProducts.length + ' kandidater i batcher...');

    var thin = allProducts.map(thinCandidate);
    var batches = roundRobinBatches(thin, 30);
    var semifinalistIds = [];

    for (var b = 0; b < batches.length; b++) {
      onStatus && onStatus('Rangerer batch ' + (b + 1) + ' av ' + batches.length + '...');
      var selected = await batchRank(batches[b], userQuery, onStatus);
      semifinalistIds = semifinalistIds.concat(selected);
    }

    // Dedupliser og bygg liste av fulle produktobjekter
    var seen2 = {};
    var productMap2 = {};
    allProducts.forEach(function(p) { if (p.id) productMap2[p.id] = p; });

    finalists = semifinalistIds
      .filter(function(id) {
        if (!id || seen2[id]) return false;
        seen2[id] = true;
        return true;
      })
      .map(function(id) { return productMap2[id] || null; })
      .filter(Boolean);

    // Fallback hvis batch-rangering returnerte ingenting
    if (finalists.length === 0) finalists = allProducts.slice(0, 40);
  }

  // Steg 4: Finalerunde
  // Ved ingen søk: send tom finalistliste – agenten bruker historikken
  return await finalRound(finalists, history, userQuery, onStatus, noSearchNeeded);
}

return { run: run };

})();
