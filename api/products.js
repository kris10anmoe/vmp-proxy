import { getProducts } from 'vinmonopolet-ts';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://vmp-proxy-4u1l.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, pageSize = 30, sortBy } = req.query;
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

    const withoutSpirits = allProducts.filter(p => !isSpirit(p));
    let products = withoutSpirits.length >= 5 ? withoutSpirits : allProducts;

    // Populer topp 10 for smaksdata til agenten
    const toPopulate = products.slice(0, 10);
    const rest = products.slice(10);
    const populated = await Promise.all(toPopulate.map(p => p.populate().catch(() => p)));

    return res.status(200).json({ products: [...populated, ...rest] });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
