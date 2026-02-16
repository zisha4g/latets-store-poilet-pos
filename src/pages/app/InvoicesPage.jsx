import React from 'react';
import { useOutletContext } from 'react-router-dom';
import InvoicesView from '@/components/pos/InvoicesView';

const InvoicesPage = () => {
    const { data, handlers } = useOutletContext();
    const { invoices, customers, products, settings, taxes, serviceCharges } = data;

    if (!settings.enableInvoicing?.value) {
        return <div className="p-8">Invoicing is not enabled. Please enable it in the settings.</div>;
    }

    return <InvoicesView invoices={invoices} customers={customers} products={products} handlers={handlers} settings={settings} taxes={taxes} serviceCharges={serviceCharges} />;
};

export default InvoicesPage;