import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const StripeCallbackPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [status, setStatus] = useState('Processing...');

    useEffect(() => {
        const handleCallback = async () => {
            const params = new URLSearchParams(location.search);
            const code = params.get('code');
            const error = params.get('error');

            if (error) {
                setStatus(`Error from Stripe: ${params.get('error_description') || error}`);
                toast({
                    title: 'Stripe Connection Failed',
                    description: params.get('error_description') || error,
                    variant: 'destructive',
                });
                setTimeout(() => navigate('/app/settings/payment-gateway'), 5000);
                return;
            }

            if (!code) {
                setStatus('Invalid callback: No authorization code found.');
                toast({
                    title: 'Stripe Connection Error',
                    description: 'Could not find the authorization code from Stripe.',
                    variant: 'destructive',
                });
                setTimeout(() => navigate('/app/settings/payment-gateway'), 5000);
                return;
            }

            try {
                setStatus('Finalizing connection with Stripe...');
                const { data, error: functionError } = await supabase.functions.invoke('stripe-connect-token-exchange', {
                    body: { code },
                });

                if (functionError) throw functionError;
                if (data.error) throw new Error(data.error);

                setStatus('Connection successful! Redirecting...');
                toast({
                    title: 'Stripe Connected!',
                    description: 'Your account is now linked. You can accept credit card payments.',
                });
                navigate('/app/settings/payment-gateway');

            } catch (err) {
                setStatus(`An error occurred: ${err.message}`);
                toast({
                    title: 'Stripe Connection Failed',
                    description: `An error occurred while finalizing the connection: ${err.message}`,
                    variant: 'destructive',
                });
                setTimeout(() => navigate('/app/settings/payment-gateway'), 5000);
            }
        };

        handleCallback();
    }, [location, navigate]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
            <Loader2 className="w-16 h-16 animate-spin text-primary mb-4" />
            <h1 className="text-2xl font-semibold">Connecting to Stripe</h1>
            <p className="text-muted-foreground mt-2">{status}</p>
        </div>
    );
};

export default StripeCallbackPage;