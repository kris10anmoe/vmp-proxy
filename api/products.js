import { getProducts } from 'vinmonopolet-ts';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, pageSize = 30, sortBy } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing parameter: q' });

  try {
    const { products } = await getProducts({
      query: q,
      limit: parseInt(pageSize)
    });

    // Sorter på årgang hvis sortBy er oppgitt
    if (sortBy === 'vintage_asc' || sortBy === 'vintage_desc') {
      const extractYear = name => {
        const m = (name || '').match(/\b(19|20)\d{2}\b/);
        return m ? parseInt(m[0]) : null;
      };
      products.sort((a, b) => {
        const ya = a.vintage || extractYear(a.name);
        const yb = b.vintage || extractYear(b.name);
        if (ya == null && yb == null) return 0;
        if (ya == null) return 1;
        if (yb == null) return -1;
        return sortBy === 'vintage_asc' ? ya - yb : yb - ya;
      });
    }

    return res.status(200).json({ products });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
