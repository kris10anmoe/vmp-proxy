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
'  "search_targets": ["søkestreng1", "søkestreng2", ...]\n' +
'}\n\n' +
'KRITISK: Regionssøk alene gir kooperativer og masseproduenter øverst.\n' +
'Kombiner alltid regionsnavn med produsenttype eller kjennetegn, f.eks.:\n' +
'"Barolo biologisk", "Barolo tradisjonell", "Cote-Rotie grower", "Gevrey premier cru".\n' +
'Bruk fagkunnskapen din om hvilke produsenter som finnes i sortimentet.\n' +
'Maks 6 søkestrenger. Ved matspørsmål: minst 4 ulike stiler/regioner.\n\n' +
'';

// ── Agentprompt ───────────────────────────────────────────────────────────────
var AGENT_SYSTEM =
'Du er en personlig sommelier og vinrådgiver for Vinmonopolet i Norge.\n\n' +
PROFILE + '\n\n' +
'REGLER:\n' +
'- Basér deg utelukkende på faktiske søkeresultater. Finn aldri på produkter.\n' +
'- Svar kort og konkret på norsk.\n' +
'- Filtrer bort viner som ikke passer profilen.\n' +
'- Aldri mer enn 2 anbefalinger fra samme region.\n' +
'- Aldri mer enn 1 anbefaling fra samme produsent.\n\n' +
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
'RANGERING – recommend_products:\n' +
'\n' +
'VED MATSPØRSMÅL – matmatch er primærkriteriet:\n' +
'Gjør en semantisk vurdering av hvor godt hver vin passer til retten – ikke bare sjekk tags.\n' +
'Ta hensyn til: tilberedningsmetode, saus, intensitet, fett, og syrebalanse i retten.\n' +
'foodPairing-tags fra API-et er ett datapunkt, men din faglige vurdering veier tyngre.\n' +
'Eksempel: grillet lam med urter passer bedre til en frisk, strukturert rødvin enn til en tung,\n' +
'selv om begge har "mutton"-tag. Langtidsbrasert lam tåler mer tannin og fylde.\n' +
'Ranger etter: (1) grad av matmatch, (2) stilmatch mot profil, (3) produsentkvalitet.\n' +
'\n' +
'UNIVERSELLE RANGERINGSPRINSIPPER:\n' +
'1. Produsentkvalitet og presisjon – enkeltprodusenter over kooperativer og handelshusnavn\n' +
'2. Stilmatch mot profil innenfor vinens egne premisser:\n' +
'   Vurder hver vin i sin kategori: hva er friskhet, presisjon og balanse for denne stilen?\n' +
'   En frisk Dão vinner over et tungt Alentejo. En mineralsk Saumur rouge vinner over en fet Côtes du Rhône.\n' +
'   En tradisjonell Barolo med god syre og tanninstruktur vinner over en moderne, myk Barolo.\n' +
'   Fellesnevnerne gjelder alltid: friskhet, presisjon, terroirklarhet og balanse – uansett kategori.\n' +
'3. Årgangskvalitet og drikkevindu\n' +
'4. Pris/kvalitet-ratio (lavest vekt) – tiebreaker, aldri primærkriterium\n' +
'\n' +
'Enklere vin fra topprodusent > toppvin fra middelmådig produsent ved samme prispunkt.\n\n' +
'TEKSTSTIL – anta at brukeren er ekspert:\n' +
'IKKE forklar hva Barolo, Côte-Rôtie eller Gevrey er – det vet brukeren.\n' +
'IKKE skriv "klassisk nebbiolo-stil" eller "typisk for regionen" – det er meningsløst.\n' +
'SKRIV i stedet: årgangsspesifikk karakter, produsentens avvik fra regionsnormen, \n' +
'konkret drikkevindusestimat, hva som gjør akkurat denne flasken interessant akkurat nå.\n' +
'Eksempel på bra tekst: "2021 er en kjølig og syrefrisk årgang i Piemonte – mer nervøs struktur\n' +
'enn 2019. Denne produsenten ligger nær grensen til Serralunga – forventer fastere tanniner."\n' +
'Eksempel på dårlig tekst: "Elegant nebbiolo med god struktur – klassisk Barolo-stil."\n\n' +
'SVARFORMAT:\n' +
'- 3–6 anbefalinger fra MINST 3 ulike regioner/druer\n' +
'- Navn, varenummer, pris\n' +
'- Én konkret setning per vin: årgangsvurdering eller produsentspesifikk observasjon';

// ── Tools ─────────────────────────────────────────────────────────────────────
var TOOLS = [
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
          var products = await window.Vin.searchProducts(tb.input.q);
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
