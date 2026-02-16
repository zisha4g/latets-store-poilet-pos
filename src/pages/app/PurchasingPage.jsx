import React from 'react';
import { useOutletContext } from 'react-router-dom';
import PurchasingView from '@/components/pos/PurchasingView';

const PurchasingPage = () => {
    const { data, handlers } = useOutletContext();
    const { vendors, products, settings } = data;

    if (!settings.enableAccounting?.value) {
        return <div className="p-8">Purchasing requires the Accounting module. Please enable it in the settings.</div>;
    }

    return <PurchasingView vendors={vendors} products={products} handlers={handlers} />;
};

export default PurchasingPage;