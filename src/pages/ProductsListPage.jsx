import React from 'react';
import { Helmet } from 'react-helmet-async';
import ProductsList from '@/components/ProductsList';
import { motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';

const ProductsListPage = () => {
  const { products, loading } = useOutletContext();
  return (
    <>
      <Helmet>
        <title>Our Store - StorePilot</title>
        <meta name="description" content="Browse our collection of amazing products." />
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-12">
          <h1 className="text-5xl font-extrabold text-foreground mb-2 tracking-tight">
            Welcome to Our Store
          </h1>
          <p className="text-lg text-muted-foreground">
            Find the best products for your needs.
          </p>
        </div>
        <ProductsList products={products} loading={loading} />
      </motion.div>
    </>
  );
};

export default ProductsListPage;