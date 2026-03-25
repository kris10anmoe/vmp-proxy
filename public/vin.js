// vin.js – datalag mot Vinmonopolet-proxyer
// Samler alle API-kall og normaliserer data til et stabilt format.

export async function searchProducts(query) {
  const r = await fetch(`/api/products?q=${encodeURIComponent(query)}`);
  if (!r.ok) throw new Error(`Søk feilet: HTTP ${r.status}`);
  const data = await r.json();
  const raw = data?.productSearchResult?.products || [];
  return raw.map(normalizeProduct);
}

export async function getStock(productCode) {
  const r = await fetch(`/api/stock?productCode=${encodeURIComponent(productCode)}`);
  if (!r.ok) throw new Error(`Lagersøk feilet: HTTP ${r.status}`);
  const data = await r.json();
  return normalizeStock(data);
}

// ── Normalisering ─────────────────────────────────────────────────────────────

function normalizeProduct(p) {
  return {
    id:          p.code,
    name:        p.name,
    mainCategory: p.main_category?.name,
    subCategory: p.main_sub_category?.name,
    country:     p.main_country?.name,
    region:      p.district?.name,
    subRegion:   p.sub_District?.name,
    price:       p.price?.value,
    volume:      p.volume?.value,          // liter, f.eks. 0.75
    abv:         p.alcohol?.value,
    vintage:     p.vintage,
    grapes:      p.grapes?.map(g => g.grapeVariety).join(', ') || null,
    importer:    p.distributor || null,
    url:         p.url ? `https://www.vinmonopolet.no${p.url}` : null,
  };
}

function normalizeStock(data) {
  const stores = data?.stores || data?.pointOfServices || [];
  return stores
    .map(s => ({
      name:  s.displayName || s.name,
      city:  s.address?.town || s.address?.postalAddresses?.[0]?.town || '',
      stock: s.stockInfo?.stockLevel ?? s.stockLevel ?? 0,
    }))
    .filter(s => s.stock > 0)
    .sort((a, b) => b.stock - a.stock);
}
