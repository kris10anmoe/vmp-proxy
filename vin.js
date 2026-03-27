// vin.js – datalag mot Vinmonopolet-proxiene
// Eksponeres som window.Vin

window.Vin = (function () {

  async function searchProducts(query, pageSize, sortBy, mode) {
    var ps = pageSize ? '&pageSize=' + pageSize : '';
    var sb = sortBy ? '&sortBy=' + sortBy : '';
    var md = mode ? '&mode=' + encodeURIComponent(mode) : '';
    const r = await fetch('/api/products?q=' + encodeURIComponent(query) + ps + sb + md);
    if (!r.ok) throw new Error('Søk feilet (HTTP ' + r.status + ')');
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    const raw = data?.products || data?.productSearchResult?.products || [];
    return raw.map(normalizeProduct);
  }

  async function getStock(productCode, city) {
    const r = await fetch('/api/stock?productCode=' + encodeURIComponent(productCode) + (city ? '&city=' + encodeURIComponent(city) : ''));
    if (!r.ok) throw new Error('Lagersøk feilet (HTTP ' + r.status + ')');
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    return normalizeStock(data);
  }

function normalizeProduct(p) {
  return {
    id:           p.code || p.productCode || p.id || null,
    name:         p.name || null,
    mainCategory: p.mainCategory?.name || p.category || null,
    subCategory:  p.mainSubCategory?.name || p.subCategory || null,
    country:      p.mainCountry?.name || p.country || null,
    region:       p.district?.name || p.region || null,
    subRegion:    p.subDistrict?.name || p.subRegion || null,
    price:        p.price || null,
    volume:       typeof p.volume === 'string'
  ? p.volume
  : typeof p.volume === 'number'
    ? String(p.volume)
    : p.volume?.formattedValue || (p.volume?.value ? p.volume.value + ' ' + (p.volume.unit || 'cl') : null),
    abv:          p.abv ?? p.alcohol ?? null,
    vintage:      p.vintage || extractVintage(p.name) || null,
    grapes:       Array.isArray(p.rawMaterial)
      ? p.rawMaterial.map(function (r) { return r.rawMaterial || r.name || null; }).filter(Boolean).join(', ')
      : Array.isArray(p.grapes)
        ? p.grapes.join(', ')
        : null,
    importer:     p.distributor || p.importer || null,
    available:    p.productAvailability?.storeAvailability?.available ?? null,
    url:          p.url ? (p.url.indexOf('http') === 0 ? p.url : 'https://www.vinmonopolet.no' + p.url) : null,
  };
}

  function normalizeStock(data) {
    const stores = data?.stores || data?.pointOfServices || [];
    return stores
      .map(function (s) {
        // Ny struktur: { pointOfService: { displayName, address }, stockInfo: { stockLevel } }
        // Gammel struktur: { displayName, address, stockLevel }
        var pos   = s.pointOfService || s;
        var stock = s.stockInfo?.stockLevel ?? pos.stockInfo?.stockLevel ?? s.stockLevel ?? 0;
        var addr  = pos.address || {};
        var city  = addr.town || (addr.formattedAddress || '').split(',').pop().trim() || '';
        return {
          name:  pos.displayName || pos.name || s.displayName || s.name || '',
          city:  city,
          stock: stock,
        };
      })
      .filter(function (s) { return s.stock > 0; })
      .sort(function (a, b) { return (b.stock || 0) - (a.stock || 0); });
  }

  function extractVintage(name) {
    if (!name) return null;
    const match = name.match(/\b(19|20)[0-9]{2}\b/);
    return match ? parseInt(match[0]) : null;
  }

  return { searchProducts, getStock };

})();
