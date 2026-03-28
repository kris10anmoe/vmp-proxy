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
'  "maxPrice": 500,\n' +
'  "search_targets": [\n' +
'    {"q": "søkestreng", "type": "producer"},\n' +
'    {"q": "regionsnavn stil", "type": "region", "sortBy": "vintage_asc"}\n' +
'  ]\n' +
'}\n\n' +
'maxPrice (valgfritt): sett kun når bruker oppgir et eksplisitt pristak (f.eks. "under 300 kr",\n' +
'"maks 500 kr"). Verdien er kroner. Utelat feltet når ingen prisgrense er oppgitt.\n\n' +
'type=producer: spesifikk produsent, henter 30 resultater (f.eks. "Trediberri", "Jamet", "Rostaing")\n' +
'type=region: appellation/region/drue, henter 100 resultater (f.eks. "Barolo", "Chablis Premier Cru", "Pinot Noir")\n' +
'sortBy (valgfritt): "vintage_asc" = eldste årganger først (bruk ved "eldste", "moden", "klar nå"),\n' +
'                    "vintage_desc" = nyeste årganger først (bruk ved "nyeste", "siste årgang").\n' +
'Utelat sortBy ved vanlige spørsmål.\n\n' +
'SØKESTRATEGI:\n' +
'Søkene skal dekke hva brukeren faktisk spør om – ikke filtreres gjennom smaksprofilen.\n' +
'Profilen brukes i rangeringen, ikke til å begrense søkene.\n\n' +
'Ved åpne spørsmål: bruk brede, relevante kategorier og presise apellasjoner.\n' +
'Eksempel "gave til 600 kr": søk på Riesling, Loire hvit, Chablis, Alsace, Jura, \n' +
'ikke bare profilregioner. Brukeren vil ha variasjon, ikke bare din smak.\n' +
'Foretrekk smale apellasjoner fremfor brede: "Chablis Premier Cru" fremfor "Burgund".\n' +
'type=producer kun når bruker nevner produsent/vin direkte.\n\n' +
'KRITISK: Vinmonopolets søk matcher kun produktnavn og produsentnavn – ikke beskrivende ord.\n' +
'"Barolo tradisjonell", "Chablis grower", "Barolo biologisk" gir 0 treff.\n' +
'Søk KUN på rene produsent-/regionnavn, appellation, drue eller vintype.\n' +
'KRITISK: search_targets er søk i Vinmonopolets produktkatalog.\n' +
'Verdiene MÅ være vinnavn, produsentnavn, regionsnavn eller vintyper – aldri matnavn.\n' +
'Feil: "and i appelsinsaus" Riktig: "Pinot Noir Burgund", "Riesling trocken", "Gewurztraminer"\n' +
'For matspørsmål: oversett retten til passende vinstiler FØR du fyller inn search_targets.\n' +
'VED MATSPØRSMÅL – søk på de faglig riktige klassiske pairingregionene:\n' +
'Brukerens profil gjelder rangering, aldri søkevalg. Bruk din vinkunskap til å identifisere\n' +
'de anerkjente klassiske pairingene for retten – uavhengig av brukerens favorittregioner.\n\n' +
'VED NATURVIN/BIODYNAMISK-SPØRSMÅL:\n' +
'"Naturvin" er ikke et søkbart ord i Vinmonopolets katalog – søk i stedet på regioner og\n' +
'druer der naturvin dominerer: Beaujolais (Gamay), Loire (Gamay, Pineau d\'Aunis, Chenin),\n' +
'Jura (Poulsard, Trousseau, Savagnin), Sicilia, Slovenien, Auvergne.\n' +
'Søk gjerne på kjente naturvinprodusenter direkte (type=producer): f.eks. Lapierre,\n' +
'Foillard, Breton, Overnoy, Tissot, Gravner, Radikon, COS.\n' +
'Inkluder minst 2 producer-søk og 2 region-søk for å dekke bredden.\n\n' +
'Maks 6 søk. Ved matspørsmål: minst 4 ulike pairingregioner.\n' +
'KRITISK: maks 1 søk per drue eller stil. Ikke søk på "Riesling Mosel" og "Riesling Pfalz"\n' +
'separat – bruk ett bredt søk ("Riesling") og fordel de resterende søkene på andre druer/stiler.\n' +
'Målet er diversitet: 4 ulike druer er bedre enn 4 ulike regioner av samme drue.\n' +
'FARGEKRAV ved matspørsmål:\n' +
'For kjøtt, fugl og vilt (herunder and, kylling, lam, biff, vilt): planen MÅ ha MINST\n' +
'1 søk etter rød stillvin (f.eks. Pinot Noir, Syrah, Nebbiolo, Bordeaux) OG minst 1 hvit.\n' +
'Dette er absolutt – ikke erstattet av Champagne eller rosé.\n' +
'Champagne kan inkluderes som ett (1) ekstra søk, men erstatter IKKE rødvinsøket.\n' +
'Maks 1 Champagne-søk per plan – ikke søk på individuelle Champagne-appellasjoner.\n' +
'Søk IKKE på Crémant, Cava, Prosecco, Sekt ved matspørsmål.\n\n' +
'VED KJELLERSPØRSMÅL – når bruker spør om "kjelleren", "har jeg hjemme", "fra min samling",\n' +
'"hva har jeg", "åpne i kveld" eller lignende:\n' +
'Inkluder søk med type: "cellar" i search_targets. Søketeksten beskriver stilen/regionen.\n' +
'Eksempel "vin fra kjelleren til biff": [{"q": "Bordeaux Barolo Nebbiolo biff", "type": "cellar"}]\n' +
'Eksempel "har jeg noen moden Champagne?": [{"q": "Champagne", "type": "cellar"}]\n' +
'Kombiner gjerne med type: "region" hvis bruker vil kjøpe mer i tillegg til kjellerviner.\n' +
'Maks 2 cellar-søk per plan.\n\n' +
'INGEN SØKEBEHOV – bruk search_targets: [] når spørsmålet:\n' +
'- ber om rangering/sammenligning av allerede nevnte viner\n' +
'- er en oppfølging uten behov for nye produkter (f.eks. "hvilken er best?", "ranger disse")\n' +
'- spør om en spesifikk vin agenten allerede har funnet\n\n';

// ── Batchrangering prompt ─────────────────────────────────────────────────────
var BATCH_SYSTEM =
'Du er en sommelier som rangerer viner for en bruker med denne profilen:\n' +
PROFILE + '\n\n' +
'Du får en liste kandidater. Velg de BESTE – opptil 6, men gjerne færre.\n' +
'Velg ALDRI en vin bare for å fylle opp til 6 hvis resterende kandidater er generiske\n' +
'kommersielle viner, billigvin uten identitet, eller bag-in-box. 3 gode > 6 med svake.\n' +
'ALDRI velg mer enn 1 vin per produsent – velg alltid den beste flasken fra produsenten.\n' +
'ALDRI velg mer enn 2 viner fra samme appellation (f.eks. maks 2 Côte-Rôtie, maks 2 Barolo).\n' +
'Svar KUN med JSON: {"selected": ["id1", "id2", ...]}\n\n' +
'PRODUSENTKVALITET – bruk producer_tier fra data som primærsignal:\n' +
'Hvert kandidat-objekt har et producer_tier felt (3–5) hvis produsenten er i kvalitetsdatabasen:\n' +
'  tier 5 = benchmark (DRC, Leroy, Rousseau, Conterno, Jamet, Coche-Dury og tilsvarende)\n' +
'  tier 4 = anerkjent grower/domaine med tydelig terroir-identitet og faglig omdømme\n' +
'  tier 3 = solid produsent, men ikke toppsjiktet\n' +
'  null   = ikke i databasen – bruk din kunnskap; kan godt være fremragende\n' +
'Ranger tier 5 > tier 4 > tier 3 > null når vinene ellers er sammenlignbare.\n' +
'Store kommersielle volumprodusenter (Marchesi di Barolo, Antinori volume-linjer, Ruffino,\n' +
'Zonin, Cavit, Louis Jadot generics) vil typisk mangle tier eller ha tier 3.\n' +
'Disse velges IKKE når tier-4/5-alternativer finnes i samme liste.\n\n' +
'APPELLASJONSDATA – bruk pairing_tags fra data ved matspørsmål:\n' +
'Hvert kandidat-objekt kan ha pairing_tags fra appellasjonsbasen.\n' +
'Eksempel: Barolo har pairing_tags: ["truffle","game","braises"] – sterk match til trøffelrisotto.\n' +
'Eksempel: Pauillac har pairing_tags: ["lamb","beef","venison"] – kanonisk til biff.\n' +
'Eksempel: Chablis har pairing_tags: ["oysters","shellfish","white fish"] – ikke til kremete retter.\n' +
'Match rettens hovedelementer mot pairing_tags. Appellasjon med matchende tags prioriteres.\n' +
'Bruk din faglige kunnskap for å vurdere matchkvalitet; tags er veiledende, ikke absolutt.\n\n' +
'VED MATSPØRSMÅL – følg dette hierarkiet strengt:\n' +
'1. Kanonisk pairingkvalitet: bruk din faglige vinkunskap til å vurdere hvor klassisk og\n' +
'   anerkjent koblingen mellom vin og rett er. "Kan fungere" er ikke nok – prioriter de\n' +
'   pairingene som er faglig etablerte og logiske gitt rettens tekstur, intensitet og smaksprofil.\n' +
'2. Produsent-kvalitet: innenfor viner som fungerer til retten, foretrekk anerkjente produsenter.\n' +
'3. Brukerprofilen brukes KUN til å rangere mellom viner som allerede er gode pairings.\n' +
'   Profilen skal IKKE styre hvilke viner som velges – kun hvilken av de gode pairingene\n' +
'   brukeren vil foretrekke.\n\n' +
'VED MATPARING – tanninmatch mot saus:\n' +
'Smørbaserte sauser (béarnaise, hollandaise, fløte) tåler lite tannin – velg viner med\n' +
'silkemyk, integrert tannin. Kraftige braises og rødtomatbaserte retter tåler mer tannin.\n' +
'Bruk din vinkunskap om typisk tanninstruktur per appellation som signal her.\n\n' +
'HVIS BRUKEREN SPØR OM "eldste" eller "nyeste" viner:\n' +
'Ranger primært etter årgangstall (eldst/nyest først). Kvalitet og profil er sekundært.\n\n' +
'HVIS BRUKEREN SPESIFISERER "drikke nå", "moden", "klar til å drikkes" eller lignende:\n' +
'Drikkevindu-match er absolutt primærkriterie – over produsentkvalitet og profil.\n' +
'En vin som ikke er klar nå skal IKKE velges, uavhengig av produsentnavn eller kvalitetsnivå.\n' +
'Vurder årgangen mot din kunnskap om typisk utvikling for stilen.\n' +
'Eks: Bordeaux venstrekyst 2020 er generelt ikke klar nå (2026) – 2015/2016/2017 kan være det.\n\n' +
'VED ANDRE SPØRSMÅL:\n' +
'RANGERING:\n' +
'1. Din faglige vurdering av produsent og faktisk vinkvalitet\n' +
'2. Årgangskvalitet og drikkevindu\n' +
'3. Match mot brukerprofilen (tiebreaker mellom likeverdige)\n' +
'4. Pris/kvalitet-ratio (lavest vekt) – normaliser alltid til 75 cl ved sammenligning\n' +
'   (magnum à 1500 ml til 600 kr = 300 kr/75 cl, ikke 600 kr)\n' +
'Enklere vin fra topprodusent > toppvin fra middelmådig produsent ved samme prispunkt.';

// ── Agentprompt ───────────────────────────────────────────────────────────────
var AGENT_SYSTEM =
'Du er en personlig sommelier og vinrådgiver for Vinmonopolet i Norge.\n\n' +
PROFILE + '\n\n' +
'REGLER:\n' +
'- Basér deg utelukkende på faktiske søkeresultater. Finn aldri på produkter.\n' +
'- KRITISK – bruk alltid eksakt produktnavn og data fra listen du fikk. Beskriv aldri en vin\n' +
'  under et annet navn eller med detaljer du ikke har fått i produktdataene. Sjekk at\n' +
'  varenummeret i teksten matcher produktet du faktisk har data for.\n' +
'- Søtvin/dessertvin (Sauternes, Barsac, Monbazillac, Tokaji, TBA, BA, Eiswein osv.)\n' +
'  inkluderes ABSOLUTT IKKE med mindre bruker eksplisitt ber om søtvin eller dessertvin.\n' +
'  Dette gjelder selv om de dukker opp i søkeresultatene for Bordeaux eller andre regioner.\n' +
'  Sjekk varetypefeltet eller regionsnavn – utelat alle søtviner fra recommend_products.\n' +
'- Svar kort og konkret på norsk.\n' +
'- MAKS 1 anbefaling per produsent i recommend_products – dette er absolutt og gjelder\n' +
'  hele listen inkl. kort 7-12. Sjekk produsentnavn nøye – "Marchesi di Barolo Cannubi"\n' +
'  og "Marchesi di Barolo Barolo" er SAMME produsent, bare én skal inkluderes.\n' +
'- MAKS 2 anbefalinger fra samme appellation (f.eks. maks 2 Chablis, maks 2 Chambolle-Musigny).\n' +
'- MAKS 12 produkter totalt i recommend_products. Sett inn 8-12 for å fylle kortvisningen.\n\n' +
'RANGERING – ved matparing:\n' +
'Pairingmatch er eneste utvelgelseskriterium. Brukerprofilen brukes kun til å rangere\n' +
'mellom viner som allerede er gode pairings – ikke til å velge hvilke viner som er med.\n\n' +
'RANGERING – generelt:\n' +
'Produktdataene inkluderer producer_tier (5=benchmark, 4=excellent, 3=god, null=ukjent) og\n' +
'pairing_tags fra appellasjonsbasen. Bruk disse som primærsignal – de reflekterer kurert\n' +
'faglig kunnskap om produsent og appellation.\n' +
'Din sommelier-kunnskap supplerer der tier eller tags mangler, og avgjør tiebreakers.\n' +
'Ranger alltid tier 5 > 4 > 3 > null. Aldri velg kommersiell volumprodusent\n' +
'(null/tier 3) foran en anerkjent grower (tier 4/5) ved samme prisnivå.\n\n' +
'ARBEIDSFLYT:\n' +
'1. Utfør søkene fra planen\n' +
'2. Kandidatene er allerede batch-rangert – du ser bare finalistene\n' +
'3. Hvis bruker nevnte en bestemt butikk: kall get_store_stock for toppkandidatene\n' +
'   og bruk lagerstatus som primærfilter i rangeringen\n' +
'4. Før du kaller recommend_products:\n' +
'   a) Sjekk manuelt at ingen produsent er med mer enn én gang – behold kun den beste.\n' +
'   b) Fjern alle søtviner/dessertviner (Sauternes, Barsac, Monbazillac, Tokaji osv.)\n' +
'      med mindre bruker eksplisitt ba om det.\n' +
'   c) Sjekk at ingen appellation er representert med mer enn 2 viner. Er det 3+ fra\n' +
'      samme appellation (f.eks. 3 Côte-Rôtie), fjern de svakeste til maks 2 gjenstår.\n' +
'   d) Fjern eksplisitt Marchesi di Barolo og andre kjente kommersielle volumprodusenter\n' +
'      (Zonin, Cavit, Ruffino, Antinori volume-linjer) hvis bedre alternativer finnes.\n' +
'   e) Sikre at listen har 8-12 produkter fra minst 3 ulike regioner/appellasjoner.\n' +
'5. Kall recommend_products med 8-12 viner i rangert rekkefølge (beste først).\n' +
'   Kortene vises i eksakt denne rekkefølgen – ranger nøye.\n' +
'6. I teksten: beskriv de 6 beste. Nevn ikke vinene som bare er med som kort (7–12).\n' +
'7. Marker hvilke som er på lager i butikken hvis butikk ble nevnt.\n\n' +
'KJELLERVINER (source: "cellar"):\n' +
'Kandidater med source="cellar" er fra brukerens private kjeller – ikke Vinmonopolet.\n' +
'- IKKE kall recommend_products med cellar-ID-er (varenummer finnes ikke i katalogen)\n' +
'- Beskriv kjellerviner i teksten med: navn, årgang, antall flasker (qty), CT-score hvis tilgjengelig\n' +
'- Marker dem tydelig: "Fra din kjeller:" eller "Du har X fl. av..."\n' +
'- Vurder drikkevindu basert på din kunnskap om vin og årgangen\n' +
'- Hvis både kjellerviner og VMP-viner finnes: presenter kjellerviner FØRST\n' +
'- Kall recommend_products kun for VMP-viner (uten source: "cellar")\n\n' +
'TEKSTSTIL – anta at brukeren er ekspert:\n' +
'IKKE forklar hva Barolo, Côte-Rôtie, Gevrey eller andre kjente appellasjoner er.\n' +
'Stilbeskrivelser er fine, men bruk dem som kontekst – ikke som erstatning for konkret info.\n' +
'PRIORITER: årgangsspesifikk karakter (f.eks. "2022 er en varm Burgund-årgang – mer kropp enn normalt for Matrot"),\n' +
'produsentens stilling i regionen eller avvik fra normen, konkret drikkevinduestimat (f.eks. "drikk 2025–2030").\n\n' +
'BUTIKKBEHOLDNING:\n' +
'Når brukeren nevner en spesifikk butikk (f.eks. "Røa", "Aker Brygge", "Vinderen"):\n' +
'1. Finn de beste kandidatene som normalt\n' +
'2. Kall get_store_stock for ALLE toppkandidater mot den butikken (maks 10 kall)\n' +
'3. Prioriter viner som faktisk finnes der i recommend_products\n' +
'4. Merk tydelig i teksten hvilke som er på lager i den butikken\n' +
'5. Du kan nevne alternativer som må bestilles, men fremhev de fysisk tilgjengelige\n' +
'By-navn til get_store_stock: bruk eksakt butikknavn bruker nevnte (f.eks. "røa", "aker brygge")\n\n' +
'SVARFORMAT:\n' +
'Start ALLTID med én setning som svarer direkte på spørsmålet brukeren stilte\n' +
'(f.eks. "Burgund gir mer presisjon og terroirtransparens – ny verden mer frukt og volum på dette prisnivået.").\n' +
'Deretter 1–2 setninger som forklarer søkestrategien: hvilke profiler du lette etter og hvorfor.\n' +
'For matparing: beskriv hva i retten som driver vinvalget (fett, syre, intensitet, saus, tilberedning).\n' +
'Løft frem én stil som klar favoritt og forklar HVORFOR den dominerer retten.\n' +
'Presenter øvrige stiler som alternativer med kortere begrunnelse.\n' +
'Intro-setningene MÅ nevne ALLE vinstiler/druer du inkluderer – ikke bare de fremste.\n\n' +
'- Beskriv de 6 beste vinene i teksten. Fra MINST 3 ulike regioner/druer.\n' +
'  KRITISK: ikke 6 viner av samme drue (f.eks. all-Riesling). Spre over minst 2 ulike stiler/farger\n' +
'  når retten tillater det. Brukerprofil er tiebreaker, ikke filter som eliminerer alternativene.\n' +
'- Navn, varenummer, pris (og flaskestørrelse hvis det avviker fra 75 cl)\n' +
'- Ved uvanlig volum (halvflaske, magnum osv.): nevn normalisert pris per 75 cl\n' +
'- Per vin: 2–3 setninger.\n' +
'  (1) Konkret smaksprofil for akkurat denne vinen og årgangen – ikke generiske stilbeskrivelser.\n' +
'  (2) Hva som gjør denne produsenten eller flasken interessant: posisjon, stil, avvik fra norm.\n' +
'  (3) Drikkevinduestimat. Ved matparing: legg til én setning om hvordan vinen spiller mot retten.';

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

// Søk i brukerens kjeller (window.cellarData lastet fra cellar.json)
function searchCellar(q) {
  if (!window.cellarData || !window.cellarData.length) return [];
  var terms = q.toLowerCase().split(/[\s,\/]+/).filter(function(t) { return t.length > 2; });
  return window.cellarData
    .filter(function(w) {
      var haystack = [w.name || '', w.region || '', w.subregion || '', w.country || ''].join(' ').toLowerCase();
      return terms.some(function(t) { return haystack.indexOf(t) >= 0; });
    })
    .map(function(w) {
      var key = (w.name + '_' + (w.vintage || 'NV')).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      return {
        id:        'cellar_' + key,
        name:      w.name,
        vintage:   w.vintage,
        qty:       w.qty,
        ct:        w.ct,
        price:     w.price,
        country:   w.country,
        region:    w.region,
        subRegion: w.subregion,
        source:    'cellar'
      };
    });
}

// RAG-oppslag klientsiden (indekser lastet i app.js)
function normRag(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function ragLookupProducer(name) {
  var idx = window.producerIndex;
  if (!idx) return null;
  var words = normRag(name).split(' ');
  for (var len = Math.min(words.length, 4); len >= 1; len--) {
    var hit = idx.get(words.slice(0, len).join(' '));
    if (hit) return hit;
  }
  return null;
}
function ragLookupAppellation(subRegion) {
  var idx = window.appellationIndex;
  if (!idx || !subRegion) return null;
  return idx.get(normRag(subRegion)) || null;
}

// Komprimer til tynne kandidatobjekter for LLM-screening
function thinCandidate(p) {
  var producerInfo    = p.source === 'cellar' ? null : ragLookupProducer(p.name || '');
  var appellationInfo = p.source === 'cellar' ? null : ragLookupAppellation(p.subRegion || '');
  return {
    id:            p.id || p.code,
    name:          p.name,
    price:         p.price,
    vintage:       p.vintage,
    region:        [p.country, p.region, p.subRegion].filter(Boolean).join(' / '),
    grapes:        p.grapes || null,
    abv:           p.abv   || null,
    acid:          p.acid  || null,
    freshness:     p.freshness || null,
    fullness:      p.fullness  || null,
    tannins:       p.tannins   || null,
    food:          (p.foodPairing || []).map(function(f) { return f.name || f.identifier; }).join(', ') || null,
    storable:      p.storable || null,
    volume:        p.volume   || null,
    producer_tier: producerInfo    ? producerInfo.tier            : null,
    pairing_tags:  appellationInfo ? appellationInfo.pairing_tags : null,
    source:        p.source   || null,
    qty:           p.qty      || null,
    ct_score:      p.ct       || null
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
        model:      'gpt-4o-mini',
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

  var planTargets = (plan.search_targets || []).slice();

  // Steg A: Hent alle tier 4/5-produsenter for hvert regionsøk via server-side OR-søk.
  // /api/producers kjører alle produsentsøk internt i parallell – dekker alle gold standard
  // produsenter i én forespørsel uten begrensning på antall.
  var goldTerms = [];
  var seenGoldTerms = new Set(planTargets.map(function(t) {
    return normRag(typeof t === 'string' ? t : (t.q || ''));
  }));
  planTargets.forEach(function(target) {
    var type   = typeof target === 'object' ? (target.type || 'region') : 'region';
    var sortBy = typeof target === 'object' ? target.sortBy : null;
    if (type !== 'region' || sortBy) return;
    var q = typeof target === 'string' ? target : target.q;
    var producers = (window.regionToProducers || new Map()).get(normRag(q)) || [];
    producers.forEach(function(p) {
      (p.search_terms || []).slice(0, 2).forEach(function(term) {
        var k = normRag(term);
        if (!seenGoldTerms.has(k)) {
          seenGoldTerms.add(k);
          goldTerms.push(term);
        }
      });
    });
  });

  if (goldTerms.length > 0) {
    onStatus && onStatus('Henter gold standard-produsenter...');
    var goldProducts = await window.Vin.fetchProducers(goldTerms);
    goldProducts.forEach(function(p) {
      if (p.id && !seen[p.id]) { seen[p.id] = true; allProducts.push(p); }
    });
  }

  // Steg B: Kjør plan-søkene parallelt i bolker av 5
  function execTarget(target) {
    var q        = typeof target === 'string' ? target : target.q;
    var type     = typeof target === 'object' ? (target.type || 'region') : 'region';
    var sortBy   = typeof target === 'object' ? target.sortBy || null : null;
    var pageSize = type === 'producer' ? 30 : 100;
    if (type === 'cellar') return Promise.resolve(searchCellar(q));
    return window.Vin.searchProducts(q, pageSize, sortBy, 'agent').catch(function() { return []; });
  }

  onStatus && onStatus('Søker etter viner...');
  var CONCURRENCY = 5;
  for (var start = 0; start < planTargets.length; start += CONCURRENCY) {
    var batchT = planTargets.slice(start, start + CONCURRENCY);
    var results = await Promise.all(batchT.map(execTarget));
    results.forEach(function(products, bIdx) {
      var targetType = typeof batchT[bIdx] === 'object' ? (batchT[bIdx].type || 'region') : 'region';

      if (targetType === 'region') {
        // Regionssøk er fallback for produsenter IKKE i databasen.
        // Filtrer ut DB-produsenter (dekkes av fetchProducers) og shuffle resten
        // slik at små håndverksmessige produsenter ikke taper mot popularitetssortering.
        var unknowns = products.filter(function(p) {
          if (!p.id || seen[p.id]) return false;
          return !ragLookupProducer(p.name || ''); // hold bare ikke-DB-produsenter
        });
        // Fisher-Yates shuffle
        for (var j = unknowns.length - 1; j > 0; j--) {
          var k = Math.floor(Math.random() * (j + 1));
          var tmp = unknowns[j]; unknowns[j] = unknowns[k]; unknowns[k] = tmp;
        }
        unknowns.forEach(function(p) {
          seen[p.id] = true; allProducts.push(p);
        });
      } else {
        // Producer- og cellar-søk legges til som de er
        products.forEach(function(p) {
          if (p.id && !seen[p.id]) { seen[p.id] = true; allProducts.push(p); }
        });
      }
    });
  }
  return allProducts;
}

// ── Finalerunde med tools ─────────────────────────────────────────────────────
async function finalRound(finalists, history, userQuery, onStatus, noSearchNeeded, maxPrice) {
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
    var hasCellar = finalists.some(function(p) { return p.source === 'cellar'; });
    var hasVmp    = finalists.some(function(p) { return !p.source; });
    var finalMsg  = hasCellar
      ? 'Ranger finalistene. Kjellerviner (source="cellar") beskrives FØRST i teksten med antall flasker og drikkevindusvurdering – IKKE i recommend_products.' +
        (hasVmp ? ' Kall recommend_products med opptil 12 Vinmonopolet-viner (uten source) i rangert rekkefølge.' : ' Kall IKKE recommend_products.') +
        ' Beskriv 6 beste totalt (kjeller + VMP).'
      : 'Ranger finalistene mot profilen.\n' +
        'ABSOLUTTE REGLER – gjelder alle 12 kort, ikke bare topp 6:\n' +
        '1. MAKS 1 vin per produsent\n' +
        '2. MAKS 2 viner fra samme appellation (f.eks. maks 2 Meursault, maks 2 Côte-Rôtie)\n' +
        '3. EKSKLUDER Marchesi di Barolo, Zonin, Cavit, Ruffino og andre kommersielle volumprodusenter\n' +
        '4. EKSKLUDER alle søtviner/dessertviner (Sauternes, Barsac, TBA osv.)\n' +
        'Kall recommend_products med de beste vinene du finner (8-12 hvis kvaliteten holder).\n' +
        'Fyll IKKE opp til 12 med svake kommersielle viner, billigvin eller bag-in-box.\n' +
        'Ranger beste først. Beskriv de 6 beste i teksten.';
    agentHistory = history.concat([
      {
        role: 'assistant',
        content: 'Batch-rangering fullført. Finalister (' + finalists.length + ' viner):\n' +
                 JSON.stringify(thinList, null, 1)
      },
      {
        role: 'user',
        content: finalMsg
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

  // Bygg endelig produktliste – dedupliser på ID
  var recommended;
  if (recommendedCodes && recommendedCodes.length > 0) {
    var seenRec = {};
    recommended = recommendedCodes
      .map(function(code) { return productMap[code] || null; })
      .filter(function(p) {
        if (!p || !p.id) return false;
        if (seenRec[p.id]) return false;
        seenRec[p.id] = true;
        return true;
      });
  } else {
    recommended = finalists;
  }

  // Fyll opp til 12 kort med gjenværende finalister dersom modellen returnerte færre
  // Ekskluder søtvin/dessertvin (Sauternes, Barsac etc.) med mindre de allerede er med
  var sweetWineKeywords = ['sauternes', 'barsac', 'monbazillac', 'trockenbeerenauslese', 'beerenauslese', 'eiswein', 'tokaji'];
  function isSweetWine(p) {
    var searchStr = ((p.name || '') + ' ' + (p.subRegion || '') + ' ' + (p.region || '')).toLowerCase();
    return sweetWineKeywords.some(function(kw) { return searchStr.indexOf(kw) !== -1; });
  }
  // Fjern søtviner fra recommended med mindre listen er for liten
  recommended = recommended.filter(function(p) { return !isSweetWine(p); });

  if (recommended.length < 12 && finalists.length > recommended.length) {
    var usedIds = {};
    var usedProducers = {};
    recommended.forEach(function(p) {
      if (p.id) usedIds[p.id] = true;
      // Ekstraher produsentnavn: første 2 ord (fornavn + etternavn/merke)
      var words = (p.name || '').replace(/\s+\d{4}.*$/, '').trim().split(/\s+/);
      var producer = words.slice(0, 2).join(' ');
      if (producer) usedProducers[producer.toLowerCase()] = true;
    });
    finalists.forEach(function(p) {
      if (recommended.length >= 12) return;
      if (!p.id || usedIds[p.id]) return;
      if (isSweetWine(p)) return;
      if (maxPrice && p.price != null && p.price > maxPrice) return;
      // Sjekk produsentduplikat (første 2 ord)
      var words = (p.name || '').replace(/\s+\d{4}.*$/, '').trim().split(/\s+/);
      var producer = words.slice(0, 2).join(' ').toLowerCase();
      if (producer && usedProducers[producer]) return;
      recommended.push(p);
      usedIds[p.id] = true;
      if (producer) usedProducers[producer] = true;
    });
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

  // Prisfiltrering – respekter maxPrice fra planen
  if (plan.maxPrice && plan.maxPrice > 0) {
    allProducts = allProducts.filter(function(p) {
      return p.price == null || p.price <= plan.maxPrice;
    });
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
    var seenProducer2 = {};
    var productMap2 = {};
    allProducts.forEach(function(p) { if (p.id) productMap2[p.id] = p; });

    finalists = semifinalistIds
      .filter(function(id) {
        if (!id || seen2[id]) return false;
        seen2[id] = true;
        // Dedupliser på produsentnivå – behold kun beste vin per kjent produsent
        var prod = productMap2[id];
        if (prod) {
          var pInfo = ragLookupProducer(prod.name || '');
          if (pInfo && pInfo.name) {
            if (seenProducer2[pInfo.name]) return false;
            seenProducer2[pInfo.name] = true;
          }
        }
        return true;
      })
      .map(function(id) { return productMap2[id] || null; })
      .filter(Boolean);

    // Cap: maks 4 per subregion OG maks 6 per land
    // Subregion-cap hindrer én appellation (f.eks. Champagne) fra å dominere.
    // Landsnivå-cap hindrer at ett land (f.eks. Tyskland med mange Riesling-regioner) flommer over.
    var regionFinalistCount = {};
    var countryFinalistCount = {};
    finalists = finalists.filter(function(p) {
      var rKey = (p.region  || 'ukjent').toLowerCase();
      var cKey = (p.country || 'ukjent').toLowerCase();
      regionFinalistCount[rKey]  = (regionFinalistCount[rKey]  || 0) + 1;
      countryFinalistCount[cKey] = (countryFinalistCount[cKey] || 0) + 1;
      return regionFinalistCount[rKey] <= 4 && countryFinalistCount[cKey] <= 6;
    });

    // Fallback hvis batch-rangering returnerte ingenting
    if (finalists.length === 0) finalists = allProducts.slice(0, 40);
  }

  // Steg 4: Finalerunde
  // Ved ingen søk: send tom finalistliste – agenten bruker historikken
  return await finalRound(finalists, history, userQuery, onStatus, noSearchNeeded, plan.maxPrice || 0);
}

return { run: run };

})();
