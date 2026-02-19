import React from 'react';
import { useOutletContext } from 'react-router-dom';
import InventoryView from '@/components/pos/InventoryView';

const InventoryPage = () => {
    const { data, handlers } = useOutletContext();
    const { products, categories, sales } = data;

    return <InventoryView products={products} categories={categories} handlers={handlers} sales={sales} />;
};

export default InventoryPage;