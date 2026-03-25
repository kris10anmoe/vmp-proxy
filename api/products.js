export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Ocp-Apim-Subscription-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const params = new URLSearchParams(req.query);
  const url = `https://apis.vinmonopolet.no/products/v0/details-normal?${params}`;

  try {
    const r = await fetch(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.VINMONOPOLET_API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
