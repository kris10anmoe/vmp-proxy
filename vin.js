// vin.js – tynt datalag mot Vinmonopolet-proxiene
// Eksponeres som window.Vin

window.Vin = (function () {

  async function searchProducts(query) {
    const r = await fetch('/api/products?q=' + encodeURIComponent(query));
    if (!r.ok) throw new Error('Søk feilet (HTTP ' + r.status + ')');
    const data = await r.json();
    // Offisielt API returnerer en liste direkte
    const raw = Array.isArray(data) ? data : [];
    return raw.map(normalizeProduct);
  }

  async function getStock(productCode) {
    const r = await fetch('/api/stock?productCode=' + encodeURIComponent(productCode));
    if (!r.ok) throw new Error('Lagersøk feilet (HTTP ' + r.status + ')');
    const data = await r.json();
    return normalizeStock(data);
  }

  function normalizeProduct(p) {
    return {
      id:           p.basic?.productId,
      name:         p.basic?.productLongName || p.basic?.productShortName,
      mainCategory: p.classification?.mainProductTypeCodeName,
      subCategory:  p.classification?.productTypeName,
      country:      p.origins?.country?.name,
      region:       p.origins?.region?.name,
      subRegion:    p.origins?.subRegion?.name,
      price:        p.prices?.[0]?.salesPrice,
      volume:       p.logistics?.volume,
      abv:          p.basic?.alcoholContent,
      vintage:      p.basic?.vintage,
      grapes:       p.grapes?.map(g => g.grapeVariety).join(', ') || null,
      importer:     p.logistics?.distributorName || null,
      url:          p.basic?.productId
                      ? 'https://www.vinmonopolet.no/p/' + p.basic.productId
                      : null,
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

  return { searchProducts, getStock };
})();
