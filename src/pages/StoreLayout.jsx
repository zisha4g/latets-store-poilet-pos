import React, { useState, useMemo, useEffect } from 'react';
    import { Link, Outlet } from 'react-router-dom';
    import { motion, AnimatePresence } from 'framer-motion';
    import { ShoppingCart as ShoppingCartIcon, Rocket, Loader2 } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { useCart } from '@/hooks/useCart.jsx';
    import ShoppingCart from '@/components/ShoppingCart.jsx';
    import { getProducts as getEcomProducts } from '@/api/EcommerceApi.js';
    import { useDataManagement } from '@/hooks/useDataManagement.js';
    import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';


    const StoreLayout = () => {
      const { user } = useAuth();
      const [isCartOpen, setIsCartOpen] = useState(false);
      const { cartItems } = useCart();
      const [loading, setLoading] = useState(true);
      const [allProducts, setAllProducts] = useState([]);
      
      const { data: posData, loading: posLoading } = useDataManagement(user);

      useEffect(() => {
        const fetchAndMergeProducts = async () => {
          if (posLoading || !posData.products) return;

          try {
            setLoading(true);
            const ecomResponse = await getEcomProducts({ limit: '500' });
            const ecomProducts = ecomResponse.products;
            
            const ecomSkuMap = new Map();
            ecomProducts.forEach(p => {
              if (p.variants && p.variants[0] && p.variants[0].sku) {
                ecomSkuMap.set(p.variants[0].sku, p);
              }
            });

            const mergedProducts = posData.products
              .filter(p => p.sku && ecomSkuMap.has(p.sku))
              .map(posProduct => {
                const ecomProduct = ecomSkuMap.get(posProduct.sku);
                const ecomVariant = ecomProduct.variants[0];
                return {
                  ...posProduct, 
                  id: posProduct.id, 
                  ecom_product_id: ecomProduct.id,
                  ecom_variant_id: ecomVariant.id,
                  price: posProduct.price,
                };
              });

            setAllProducts(mergedProducts);
          } catch (error) {
            console.error("Failed to fetch and merge products:", error);
          } finally {
            setLoading(false);
          }
        };

        fetchAndMergeProducts();
      }, [posData.products, posLoading]);

      const totalItems = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems]);

      return (
        <div className="min-h-screen bg-background text-foreground font-sans">
          <header className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
            <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
              <Link to="/store" className="flex items-center space-x-2">
                <Rocket className="w-8 h-8 text-primary" />
                <span className="text-2xl font-bold">StorePilot</span>
              </Link>
              <div className="flex items-center space-x-6">
                <Button asChild variant="ghost">
                    <Link to="/app">Back to POS</Link>
                </Button>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button onClick={() => setIsCartOpen(true)} variant="ghost" className="relative p-2 rounded-full">
                    <ShoppingCartIcon size={24} />
                    <AnimatePresence>
                      {totalItems > 0 && (
                        <motion.span
                          initial={{ scale: 0, y: 10, x: 10 }}
                          animate={{ scale: 1, y: 0, x: 0 }}
                          exit={{ scale: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                          className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center"
                        >
                          {totalItems}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </motion.div>
              </div>
            </nav>
          </header>
          <main className="pt-24 container mx-auto px-6 py-8">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : (
              <Outlet context={{ products: allProducts }} />
            )}
          </main>
          <footer className="bg-secondary border-t border-border mt-16">
            <div className="container mx-auto px-6 py-6 text-center text-muted-foreground">
              <p>&copy; {new Date().getFullYear()} StorePilot Store. All Rights Reserved.</p>
            </div>
          </footer>
          <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />
        </div>
      );
    };

    export default StoreLayout;