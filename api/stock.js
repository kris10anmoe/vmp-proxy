const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://vmp-proxy-4u1l.vercel.app';

const CITY_COORDS = {
  oslo:        { lat: 59.9099584, lon: 10.7258052 },
  bergen:      { lat: 60.3913,    lon: 5.3221 },
  trondheim:   { lat: 63.4305,    lon: 10.3951 },
  stavanger:   { lat: 58.9700,    lon: 5.7331 },
  tromsø:      { lat: 69.6489,    lon: 18.9551 },
  kristiansand:{ lat: 58.1599,    lon: 8.0182 },
  drammen:     { lat: 59.7440,    lon: 10.2045 },
  fredrikstad: { lat: 59.2181,    lon: 10.9298 },
};

const HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.vinmonopolet.no/',
  'Origin': 'https://www.vinmonopolet.no'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { productCode, city = 'oslo' } = req.query;
  if (!productCode) return res.status(400).json({ error: 'Missing productCode' });

  try {
    // Step 1: Get coordinates for city
    let lat, lon;
    const cityKey = city.toLowerCase().split(',')[0].trim();
    if (CITY_COORDS[cityKey]) {
      ({ lat, lon } = CITY_COORDS[cityKey]);
    } else {
      // Dynamic lookup via Vinmonopolet's own userlocation API
      const locR = await fetch(
        `https://www.vinmonopolet.no/vmpws/v2/vmp/search/userlocation?query=${encodeURIComponent(city)}`,
        { headers: HEADERS }
      );
      const locData = await locR.json();
      lat = locData?.latitude ?? 59.9099584;
      lon = locData?.longitude ?? 10.7258052;
    }

    // Step 2: Get stores with stock sorted by distance
    const stockR = await fetch(
      `https://www.vinmonopolet.no/vmpws/v2/vmp/products/${encodeURIComponent(productCode)}/stock?pageSize=20&currentPage=0&fields=BASIC&latitude=${lat}&longitude=${lon}`,
      { headers: HEADERS }
    );

    if (!stockR.ok) {
      const text = await stockR.text();
      return res.status(stockR.status).json({ error: text });
    }

    const data = await stockR.json();
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
