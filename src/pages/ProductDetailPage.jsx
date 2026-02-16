import React, { useState, useEffect, useCallback } from 'react';
    import { Helmet } from 'react-helmet-async';
    import { useParams, Link, useOutletContext } from 'react-router-dom';
    import { motion } from 'framer-motion';
    import { Button } from '@/components/ui/button';
    import { useCart } from '@/hooks/useCart';
    import { useToast } from '@/components/ui/use-toast';
    import { ShoppingCart, Loader2, ArrowLeft, CheckCircle, Minus, Plus, XCircle } from 'lucide-react';

    const placeholderImage = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTFmMmY1Ii8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iI2E1YjRjYyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K";

    function ProductDetailPage() {
      const { id } = useParams();
      const { products } = useOutletContext();
      const [product, setProduct] = useState(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [quantity, setQuantity] = useState(1);
      const { addToCart } = useCart();
      const { toast } = useToast();

      useEffect(() => {
        setLoading(true);
        if (products) {
          const foundProduct = products.find(p => p.id === id);
          if (foundProduct) {
            setProduct(foundProduct);
          } else {
            setError('Product not found.');
          }
          setLoading(false);
        }
      }, [id, products]);

      const handleAddToCart = useCallback(async () => {
        if (product) {
          const variant = { id: product.ecom_variant_id };
          try {
            await addToCart(product, variant, quantity);
            toast({
              title: "Added to Cart! 🛒",
              description: `${quantity} x ${product.name} added.`,
            });
          } catch (error) {
            toast({
              variant: "destructive",
              title: "Oh no! Something went wrong.",
              description: error.message,
            });
          }
        }
      }, [product, quantity, addToCart, toast]);

      const handleQuantityChange = useCallback((amount) => {
        setQuantity(prevQuantity => {
            const newQuantity = prevQuantity + amount;
            if (newQuantity < 1) return 1;
            return newQuantity;
        });
      }, []);

      if (loading) {
        return (
          <div className="flex justify-center items-center h-[60vh]">
            <Loader2 className="h-16 w-16 text-primary animate-spin" />
          </div>
        );
      }

      if (error || !product) {
        return (
          <div className="max-w-5xl mx-auto">
            <Link to="/store" className="inline-flex items-center gap-2 text-foreground hover:text-primary transition-colors mb-6">
              <ArrowLeft size={16} />
              Go back
            </Link>
            <div className="text-center text-destructive p-8 bg-card rounded-2xl border">
              <XCircle className="mx-auto h-16 w-16 mb-4" />
              <p className="mb-6">{error || 'Product could not be loaded.'}</p>
            </div>
          </div>
        );
      }

      const price = `$${Number(product.price).toFixed(2)}`;
      const availableStock = product.stock;
      const canAddToCart = quantity <= availableStock;

      return (
        <>
          <Helmet>
            <title>{product.name} - Our Store</title>
            <meta name="description" content={product.description?.substring(0, 160) || product.name} />
          </Helmet>
          <div className="max-w-5xl mx-auto">
            <Link to="/store" className="inline-flex items-center gap-2 text-foreground hover:text-primary transition-colors mb-6">
              <ArrowLeft size={16} />
              Back to Store
            </Link>
            <div className="grid md:grid-cols-2 gap-8 bg-card p-8 rounded-2xl border">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="relative">
                <div className="relative overflow-hidden rounded-lg shadow-lg h-96 md:h-[500px]">
                  <img
                    src={product.image_url || placeholderImage}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="flex flex-col">
                <h1 className="text-4xl font-bold text-foreground mb-2">{product.name}</h1>
                <p className="text-lg text-muted-foreground mb-4">{product.brand}</p>

                <div className="flex items-baseline gap-3 mb-6">
                  <span className="text-4xl font-bold text-primary">{price}</span>
                </div>

                <div className="prose prose-sm max-w-none text-muted-foreground mb-6" dangerouslySetInnerHTML={{ __html: product.description || '' }} />

                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center border border-border rounded-full p-1">
                    <Button onClick={() => handleQuantityChange(-1)} variant="ghost" size="icon" className="rounded-full h-8 w-8"><Minus size={16} /></Button>
                    <span className="w-10 text-center font-bold">{quantity}</span>
                    <Button onClick={() => handleQuantityChange(1)} variant="ghost" size="icon" className="rounded-full h-8 w-8"><Plus size={16} /></Button>
                  </div>
                </div>

                <div className="mt-auto">
                  <Button onClick={handleAddToCart} size="lg" className="w-full py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed" disabled={!canAddToCart || availableStock <= 0}>
                    <ShoppingCart className="mr-2 h-5 w-5" /> {availableStock > 0 ? 'Add to Cart' : 'Out of Stock'}
                  </Button>

                  {canAddToCart && availableStock > 0 && (
                    <p className="text-sm text-green-600 mt-3 flex items-center justify-center gap-2">
                      <CheckCircle size={16} /> {availableStock} in stock!
                    </p>
                  )}

                  {!canAddToCart && availableStock > 0 && (
                     <p className="text-sm text-yellow-600 mt-3 flex items-center justify-center gap-2">
                      <XCircle size={16} /> Not enough stock. Only {availableStock} left.
                    </p>
                  )}

                  {availableStock <= 0 && (
                      <p className="text-sm text-red-600 mt-3 flex items-center justify-center gap-2">
                        <XCircle size={16} /> Currently unavailable
                      </p>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </>
      );
    }

    export default ProductDetailPage;