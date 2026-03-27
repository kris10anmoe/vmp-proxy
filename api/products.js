import { getProducts } from 'vinmonopolet-ts';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://vmp-proxy-4u1l.vercel.app';

// ── Profilscore ───────────────────────────────────────────────────────────────
// Scorer produkter mot brukerprofil: friskhet + syre høyt, fylde + alkohol lavt.
// Bare meningsfull for viner med populerte smaksverdier (0 = ikke tilgjengelig).
function profileScore(p) {
  if (!p.freshness && !p.acid) return 0; // Ikke nok data
  var freshness = p.freshness || 0;      // 0-100, høyt er bra
  var acid      = p.acid      || 0;      // 0-100, høyt er bra
  var fullness  = p.fullness  || 50;     // 0-100, lavt er bra (power 4/10)
  var abv       = p.abv       || 13;     // %, over 13.5 trekker ned

  return (freshness * 0.4)
       + (acid      * 0.4)
       - (fullness  * 0.25)
       - (Math.max(0, abv - 13.5) * 8);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, pageSize = 30, sortBy, foodFilter } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing parameter: q' });

  const extractYear = name => {
    const m = (name || '').match(/\b(19|20)\d{2}\b/);
    return m ? parseInt(m[0]) : null;
  };

  const isSpirit = p => p.mainCategory?.code === 'brennevin';

  const matchesFood = (p, filter) => {
    if (!filter) return true;
    return (p.foodPairing || []).some(f => f.identifier === filter || f.code === filter);
  };

  try {
    let allProducts = [];

    if (sortBy) {
      // Vintage-sortering: hent alt, sorter på årstall
      let page = 1, totalPages = 1;
      do {
        const { products, pagination } = await getProducts({ query: q, limit: 50, page });
        products.forEach(p => { if (!p.vintage) p.vintage = extractYear(p.name); });
        allProducts = allProducts.concat(products);
        totalPages = pagination.totalPages;
        page++;
      } while (page <= totalPages && page <= 20);

      allProducts.sort((a, b) => {
        const ya = a.vintage, yb = b.vintage;
        if (ya == null && yb == null) return 0;
        if (ya == null) return 1;
        if (yb == null) return -1;
        return sortBy === 'vintage_asc' ? ya - yb : yb - ya;
      });
    } else {
      const { products } = await getProducts({ query: q, limit: parseInt(pageSize) });
      products.forEach(p => { if (!p.vintage) p.vintage = extractYear(p.name); });
      allProducts = products;
    }

    // Fjern brennevin
    const withoutSpirits = allProducts.filter(p => !isSpirit(p));
    let products = withoutSpirits.length >= 5 ? withoutSpirits : allProducts;

    // Populer topp 25 for å få smaksverdier
    const toPopulate = products.slice(0, 25);
    const rest       = products.slice(25);
    const populated  = await Promise.all(toPopulate.map(p => p.populate().catch(() => p)));

    // Filtrer på matparing hvis oppgitt
    let scored = populated;
    if (foodFilter) {
      const withFood = populated.filter(p => matchesFood(p, foodFilter));
      scored = withFood.length >= 3 ? withFood : populated;
    }

    // Sorter etter profilscore (høyest først)
    scored.sort((a, b) => profileScore(b) - profileScore(a));

    const final = [...scored, ...rest];
    return res.status(200).json({ products: final });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
