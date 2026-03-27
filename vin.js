// vin.js – datalag mot Vinmonopolet-proxiene
// Eksponeres som window.Vin

window.Vin = (function () {

  async function searchProducts(query, pageSize, sortBy) {
    var ps = pageSize ? '&pageSize=' + pageSize : '';
    var sb = sortBy ? '&sortBy=' + sortBy : '';
    const r = await fetch('/api/products?q=' + encodeURIComponent(query) + ps + sb);
    if (!r.ok) throw new Error('Søk feilet (HTTP ' + r.status + ')');
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    const raw = data.products || [];
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
      id:           p.code,
      name:         p.name,
      mainCategory: p.mainCategory?.name,
      subCategory:  p.mainSubCategory?.name,
      country:      p.mainCountry?.name,
      region:       p.district?.name,
      subRegion:    p.subDistrict?.name,
      price:        p.price,
      volume:       p.volume?.formattedValue || (p.volume?.value ? p.volume.value + ' ' + (p.volume.unit || 'cl') : null),
      abv:          p.abv,
      vintage:      p.vintage || extractVintage(p.name) || null,
      grapes:       p.rawMaterial?.map(function (r) { return r.rawMaterial; }).join(', ') || null,
      importer:     p.distributor || null,
      available:    p.productAvailability?.storeAvailability?.available ?? null,
      url:          p.url ? 'https://www.vinmonopolet.no' + p.url : null,
    };
  }

  function normalizeStock(data) {
    const stores = data?.stores || data?.pointOfServices || [];
    return stores
      .map(function (s) {
        return {
          name:  s.displayName || s.name,
          city:  s.address?.town || s.address?.postalAddresses?.[0]?.town || '',
          stock: s.stockInfo?.stockLevel ?? s.stockLevel ?? 0,
        };
      })
      .filter(function (s) { return s.stock > 0; })
      .sort(function (a, b) { return b.stock - a.stock; });
  }

  function extractVintage(name) {
    if (!name) return null;
    const match = name.match(/\b(19|20)[0-9]{2}\b/);
    return match ? parseInt(match[0]) : null;
  }

  return { searchProducts, getStock };

})();
