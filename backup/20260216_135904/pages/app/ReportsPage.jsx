import React from 'react';
import { useOutletContext } from 'react-router-dom';
import ReportsView from '@/components/pos/ReportsView';

const ReportsPage = () => {
    const { data } = useOutletContext();
    const { sales, products, customers, settings } = data;

    return <ReportsView sales={sales} products={products} customers={customers} settings={settings} />;
};

export default ReportsPage;