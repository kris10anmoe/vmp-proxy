const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://vmp-proxy-4u1l.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, pageSize = 30 } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query parameter q' });

  const params = new URLSearchParams({ fields: 'FULL', query: q, pageSize });
  const url = `https://www.vinmonopolet.no/vmpws/v2/vmp/search?${params}`;

  try {
    const r = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
