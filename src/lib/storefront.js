import { supabase } from '@/lib/customSupabaseClient';

export const formatCurrencyCents = (cents, currency = 'USD') => {
  const value = Number(cents || 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);
};

const toCents = (value) => Math.round(Number(value || 0) * 100);

const toStorefrontProduct = (product) => {
  const priceCents = toCents(product.price);
  const saleCents = product.sale_price ? toCents(product.sale_price) : null;
  const currency = product.currency || 'USD';
  const inventory = product.stock ?? product.inventory_quantity ?? 0;

  const variant = {
    id: product.variant_id || `${product.id}-default`,
    title: product.variant_title || 'Default',
    price_in_cents: priceCents,
    sale_price_in_cents: saleCents,
    price_formatted: formatCurrencyCents(priceCents, currency),
    sale_price_formatted: saleCents !== null ? formatCurrencyCents(saleCents, currency) : null,
    inventory_quantity: inventory,
    currency,
  };

  return {
    id: product.id,
    title: product.title || product.name || 'Untitled',
    subtitle: product.subtitle || product.description || '',
    image: product.image_url || product.image || '',
    ribbon_text: product.ribbon_text || '',
    variants: [variant],
    price: priceCents,
    stock: inventory,
  };
};

export const fetchStoreProducts = async () => {
  try {
    const { data, error } = await supabase.from('products').select('*');
    if (error) {
      throw error;
    }
    return (data || []).map(toStorefrontProduct);
  } catch (error) {
    console.error('Failed to fetch storefront products:', error);
    return [];
  }
};
