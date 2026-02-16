import React from 'react';
import { useOutletContext } from 'react-router-dom';
import CustomersView from '@/components/pos/CustomersView';

const CustomersPage = () => {
    const { customersWithStats, handlers, handleStartCall } = useOutletContext();

    return <CustomersView customers={customersWithStats} handlers={handlers} onStartCall={handleStartCall} />;
};

export default CustomersPage;