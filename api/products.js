import { getProducts } from 'vinmonopolet-ts';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, pageSize = 30, sortBy } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing parameter: q' });

  const extractYear = name => {
    const m = (name || '').match(/\b(19|20)\d{2}\b/);
    return m ? parseInt(m[0]) : null;
  };

  try {
    let allProducts = [];

    if (sortBy) {
      // Hent alle sider for å kunne sortere på tvers
      let page = 1;
      let totalPages = 1;
      do {
        const { products, pagination } = await getProducts({ query: q, limit: 50, page });
        products.forEach(p => { if (!p.vintage) p.vintage = extractYear(p.name); });
        allProducts = allProducts.concat(products);
        totalPages = pagination.totalPages;
        page++;
      } while (page <= totalPages && page <= 20); // maks 20 sider = 1000 produkter

      if (sortBy === 'vintage_asc' || sortBy === 'vintage_desc') {
        allProducts.sort((a, b) => {
          const ya = a.vintage, yb = b.vintage;
          if (ya == null && yb == null) return 0;
          if (ya == null) return 1;
          if (yb == null) return -1;
          return sortBy === 'vintage_asc' ? ya - yb : yb - ya;
        });
      }
    } else {
      const { products } = await getProducts({ query: q, limit: parseInt(pageSize) });
      products.forEach(p => { if (!p.vintage) p.vintage = extractYear(p.name); });
      allProducts = products;
    }

    return res.status(200).json({ products: allProducts });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
