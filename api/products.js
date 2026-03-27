import { getProducts } from 'vinmonopolet-ts';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://vmp-proxy-4u1l.vercel.app';

const extractYear = name => {
  const m = (name || '').match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0], 10) : null;
};

const isSpirit = p => p.mainCategory?.code === 'brennevin';

// Komprimert format for agentbruk – ingen populate(), bare felt som påvirker rangering
const compactForAgent = p => ({
  id:          p.code || p.id || null,
  name:        p.name || null,
  price:       p.price || null,
  vintage:     p.vintage || extractYear(p.name) || null,
  country:     p.mainCountry?.name || null,
  region:      p.district?.name || null,
  subRegion:   p.subDistrict?.name || null,
  grapes:      (p.rawMaterial || []).map(g => g.rawMaterial || g.name || null).filter(Boolean),
  abv:         p.abv || null,
  sugar:       p.sugar != null ? p.sugar : null,
  acid:        p.acid || null,
  freshness:   p.freshness || null,
  fullness:    p.fullness || null,
  tannins:     p.tannins || null,
  storable:    p.storable || null,
  status:      p.status   || null,
  food:        (p.foodPairing || []).map(f => f.identifier || f.name || null).filter(Boolean),
  category:    p.mainCategory?.name || null,
  url:         p.url ? 'https://www.vinmonopolet.no' + p.url : null
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, pageSize = 30, sortBy, mode } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing parameter: q' });

  try {
    let allProducts = [];

    if (sortBy) {
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
      const limit = Math.min(parseInt(pageSize, 10) || 30, 100);
      const { products } = await getProducts({ query: q, limit });
      products.forEach(p => { if (!p.vintage) p.vintage = extractYear(p.name); });
      allProducts = products;
    }

    const withoutSpirits = allProducts.filter(p => !isSpirit(p));
    const products = withoutSpirits.length >= 5 ? withoutSpirits : allProducts;

    // Populate topp 25 for smaksdata (abv, acid, freshness etc.)
    const popCount  = mode === 'agent' ? 25 : 10;
    const toPopulate = products.slice(0, popCount);
    const rest       = products.slice(popCount);
    const populated  = await Promise.all(toPopulate.map(p => p.populate().catch(() => p)));

    // Agentmodus: returner komprimerte objekter
    if (mode === 'agent') {
      return res.status(200).json({ products: [...populated, ...rest].map(compactForAgent) });
    }

    // UI-modus: returner fulle objekter
    return res.status(200).json({ products: [...populated, ...rest] });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
