import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Receipt, Settings as SettingsIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import InvoicesView from '@/components/pos/InvoicesView';

const InvoicesPage = () => {
    const ctx = useOutletContext();
    const { data, handlers, isLoading } = ctx;
    const { settings, taxes } = data;

    if (!settings?.enableInvoicing?.value) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-muted p-2">
                                <Receipt className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <CardTitle>Invoicing is disabled</CardTitle>
                                <CardDescription className="mt-1">
                                    Enable invoicing to send branded invoices, track payments, and manage receivables.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Button asChild>
                            <Link to="/app/settings">
                                <SettingsIcon className="h-4 w-4 mr-2" />
                                Go to settings
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6">
            <InvoicesView
                data={data}
                handlers={handlers}
                settings={settings}
                taxes={taxes}
                isLoading={isLoading}
            />
        </div>
    );
};

export default InvoicesPage;