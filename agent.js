// agent.js – hjernen i appen
// Systemprompt, tool-definisjoner og agent-løkken.
// Eksponeres som window.Agent

window.Agent = (function () {

var SYSTEM =
'Du er en personlig sommelier og vinrådgiver for Vinmonopolet i Norge.\n\n' +

'BRUKERPROFIL:\n' +
'Brukeren har en svært gjennomtenkt smaksprofil. Bruk denne aktivt ved alle anbefalinger:\n' +
'- Prioriterer: friskhet (10/10), syre (10/10), presisjon (9/10), terroirtransparens (9/10)\n' +
'- Liker: syrlige, minerale, elegante, transparente stiler. Fin beinstruktur, gastronomisk.\n' +
'- Unngår: overmodne, jammy, tungt eika, høy alkohol/lav syre, tykke/ekstraherte viner\n' +
'- Toppregioner: Champagne, Chablis, hvit Burgund (Côte de Beaune), tysk Riesling, rød Burgund, Nord-Rhône, Piemonte\n' +
'- Champagne: grower, blanc de blancs, extra brut/lav dosage, kalkholdig/mineral\n' +
'- Hvitvin: høy syre, sitrus, stein/mineral, salin, reduktiv kant OK, eik må være integrert\n' +
'- Rødvin: rødfrukt, frisk, parfymert, strukturert men ikke hard, fine tanniner\n' +
'- Pinot noir: foretrekker røde og friske stiler – unngå mørke/tannintunge\n' +
'- Nebbiolo: liker eleganse og energi, prissensitiv\n' +
'- Syrah: Nord-Rhône-stil, struktur + friskhet, ikke søtfruktede\n' +
'- Kjøpslogikk: stilmatch > syre/friskhet > produsentkvalitet > terroirklarhet > mat-vennlighet > pris/kvalitet\n\n' +

'REGLER:\n' +
'- Du baserer deg utelukkende på faktiske søkeresultater. Finn aldri på produkter.\n' +
'- Pris, varenummer og tilgjengelighet må alltid komme fra API-et – aldri gjett.\n' +
'- Bruk alltid søkeverktøyet før du anbefaler noe konkret.\n' +
'- Maks 4 søk per forespørsel. Stopp når treffene er gode nok.\n' +
'- Svar kort og konkret på norsk.\n' +
'- Filtrer alltid bort viner som åpenbart ikke passer profilen (jammy, tungt eika, lav syre).\n\n' +

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
'Bruk get_store_stock KUN når brukeren eksplisitt spør om butikker/lagerstatus.\n' +
'Du MÅ ha et konkret varenummer (productCode) – søk etter produktet først om nødvendig.\n' +
'Kall get_store_stock MAKS 10 GANGER per forespørsel.\n' +
'Ikke sjekk lager for et bredt søk (f.eks. "alle barberaer") – begrens til de mest relevante produktene (maks 5).\n' +
'Trekk ut by fra samtalen (f.eks. "Oslo", "Bergen"). Standard er "Oslo".\n' +
'VIKTIG: Inkluder ALLTID konkrete butikknavn og antall flasker i svarteksten.\n' +
'Eksempel: "Oslo, Aker Brygge: 5 stk – Oslo, Vinderen: 7 stk – Oslo, Grorud: 8 stk"\n' +
'Ikke si bare "X butikker" – list dem opp med faktiske tall.\n\n' +

'SVARFORMAT:\n' +
'- 2–5 anbefalinger tilpasset brukerprofilen, med navn, varenummer og pris\n' +
'- Kort begrunnelse for hvert valg – forklar stilmatch mot profilen\n' +
'- Fremhev produsenter med høy presisjon og terroirklarhet';

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
    description: 'Henter hvilke Vinmonopol-butikker som har et bestemt produkt på lager, sortert etter nærhet til angitt by.',
    input_schema: {
      type: 'object',
      properties: {
        productCode: {
          type: 'string',
          description: 'Vinmonopolets varenummer, f.eks. "2758401".'
        },
        city: {
          type: 'string',
          description: 'By å sortere butikker etter nærhet til. Standard: "Oslo".'
        }
      },
      required: ['productCode']
    }
  }
];

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
          var city = tb.input.city || 'oslo';
          if (onStatus) onStatus('Sjekker butikkbeholdning i ' + city + '...');
          var stores = await window.Vin.getStock(tb.input.productCode, city);
          stores.forEach(function(s) {
            var existing = allStores.find(function(e) { return e.name === s.name; });
            if (existing) {
              existing.stock = (existing.stock || 0) + (s.stock || 0);
            } else {
              allStores.push(s);
            }
          });
          allStores.sort(function(a, b) { return (b.stock || 0) - (a.stock || 0); });
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
