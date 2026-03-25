import { getProductsByStore } from 'vinmonopolet-ts';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { productCode, storeId } = req.query;
  if (!productCode || !storeId) {
    return res.status(400).json({ error: 'Missing parameter: productCode or storeId' });
  }

  try {
    let allProducts = [];
    let currentPage = 1;
    let totalPages = 2;

    while (currentPage <= totalPages) {
      const { pagination, products } = await getProductsByStore(storeId, {
        page: currentPage,
        limit: 100
      });
      allProducts = allProducts.concat(products);
      totalPages = pagination.totalPages;
      currentPage++;
    }

    const found = allProducts.some(p => p.code === productCode);
    return res.status(200).json({ inStock: found, storeId });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
