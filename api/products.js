import { getProducts } from 'vinmonopolet-ts';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, pageSize = 30 } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing parameter: q' });

  try {
    const { products } = await getProducts({
      query: q,
      limit: parseInt(pageSize)
    });
    return res.status(200).json({ products });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
