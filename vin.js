// vin.js – tynt datalag mot Vinmonopolet-proxiene
// Eksponeres som window.Vin

window.Vin = (function () {

  async function searchProducts(query) {
    const r = await fetch('/api/products?q=' + encodeURIComponent(query));
    if (!r.ok) throw new Error('Søk feilet (HTTP ' + r.status + ')');
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    const raw = data.products || [];
    return raw.map(normalizeProduct);
  }

  async function getStock(productCode, storeId) {
    if (!storeId) throw new Error('Ingen butikk valgt');
    const r = await fetch(
      '/api/stock?productCode=' + encodeURIComponent(productCode) +
      '&storeId=' + encodeURIComponent(storeId)
    );
    if (!r.ok) throw new Error('Lagersøk feilet (HTTP ' + r.status + ')');
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  // vinmonopolet-ts BaseProduct-format
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
      vintage:      p.vintage || extractVintage(p.name),
      grapes:       p.rawMaterial?.map(r => r.rawMaterial).join(', ') || null,
      importer:     p.distributor || null,
      available:    p.productAvailability?.storeAvailability?.available ?? null,
      url:          p.url ? 'https://www.vinmonopolet.no' + p.url : null,
    };
  }

  function extractVintage(name) {
    if (!name) return null;
    const match = name.match(/\b(19|20)[0-9]{2}\b/);
    return match ? parseInt(match[0]) : null;
  }

  return { searchProducts, getStock };
})();
