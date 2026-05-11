import React from 'react';
import { useOutletContext } from 'react-router-dom';
import PurchasingView from '@/components/pos/PurchasingView';

const PurchasingPage = () => {
    const { data, handlers } = useOutletContext();
    const { vendors, products } = data;

    return <PurchasingView vendors={vendors} products={products} handlers={handlers} />;
};

export default PurchasingPage;