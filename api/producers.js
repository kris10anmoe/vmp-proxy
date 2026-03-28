import { getProducts } from 'vinmonopolet-ts';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://vmp-proxy-4u1l.vercel.app';
const isSpirit = p => p.mainCategory?.code === 'brennevin';
const extractYear = name => {
  const m = (name || '').match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0], 10) : null;
};
const compact = p => ({
  id:        p.code || p.id || null,
  name:      p.name || null,
  price:     p.price || null,
  vintage:   p.vintage || extractYear(p.name) || null,
  country:   p.mainCountry?.name || null,
  region:    p.district?.name || null,
  subRegion: p.subDistrict?.name || null,
  grapes:    (p.rawMaterial || []).map(g => g.rawMaterial || g.name || null).filter(Boolean),
  abv:       p.abv || null,
  acid:      p.acid || null,
  freshness: p.freshness || null,
  fullness:  p.fullness || null,
  tannins:   p.tannins || null,
  storable:  p.storable || null,
  volume:    (v => {
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return v + ' cl';
    return v.formattedValue || (v.value != null ? v.value + ' ' + (v.unit || 'cl') : null);
  })(p.volume),
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { producers } = req.query;
  if (!producers) return res.status(400).json({ error: 'Missing: producers' });

  const terms = producers.split(',').map(p => p.trim()).filter(Boolean).slice(0, 40);

  try {
    const seen = new Set();
    const allProducts = [];
    const CONCURRENCY = 8;

    for (let i = 0; i < terms.length; i += CONCURRENCY) {
      const batch = terms.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(async term => {
        try {
          const { products } = await getProducts({ query: term, limit: 30 });
          products.forEach(p => { if (!p.vintage) p.vintage = extractYear(p.name); });
          const hits = products.filter(p => !isSpirit(p));
          const toPopulate = hits.slice(0, 15);
          return await Promise.all(toPopulate.map(p => p.populate().catch(() => p)));
        } catch (e) { return []; }
      }));
      results.forEach(products => {
        products.forEach(p => {
          const id = p.code || p.id;
          if (id && !seen.has(id)) {
            seen.add(id);
            allProducts.push(p);
          }
        });
      });
    }

    return res.status(200).json({ products: allProducts.map(compact) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
