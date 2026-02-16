import React from 'react';
import { AlertCircle, Terminal } from 'lucide-react';

const PaymentGatewaySettings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Payment Gateway</h2>
        <p className="text-muted-foreground">Payment gateway integrations are disabled.</p>
      </div>

      <div className="border border-border rounded-lg p-6 bg-card">
        <div className="flex items-center space-x-3 mb-4">
          <Terminal className="w-6 h-6 text-primary" />
          <h3 className="text-lg font-semibold">Gateway Disabled</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Device pairing and payment gateway actions were removed when external APIs were disabled.
        </p>
      </div>

      <div className="border border-border rounded-lg p-4 bg-muted/50">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Next step</p>
            <p className="text-xs text-muted-foreground">Re-enable a backend or Supabase function if you want device pairing again.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentGatewaySettings;
