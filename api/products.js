export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, pageSize = 30 } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing parameter: q' });

  const params = new URLSearchParams({
    productShortNameContains: q,
    maxResults: pageSize
  });

  const url = `https://apis.vinmonopolet.no/products/v0/details-normal?${params}`;

  try {
    const r = await fetch(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.VINMONOPOLET_API_KEY,
        'Accept': 'application/json'
      }
    });
    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
