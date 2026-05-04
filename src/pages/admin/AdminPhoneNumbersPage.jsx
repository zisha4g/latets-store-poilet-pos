import React from 'react';
import PhoneNumbersSettings from '@/components/pos/settings/PhoneNumbersSettings';

const AdminPhoneNumbersPage = () => (
  <div className="space-y-6 max-w-6xl">
    <div>
      <h1 className="text-2xl font-bold">Phone Numbers</h1>
      <p className="text-muted-foreground">Assign and manage SignalWire numbers across all tenants.</p>
    </div>
    <PhoneNumbersSettings />
  </div>
);

export default AdminPhoneNumbersPage;
