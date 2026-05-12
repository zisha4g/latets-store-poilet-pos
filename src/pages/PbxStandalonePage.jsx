import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import { useDataManagement } from '@/hooks/useDataManagement';
import { Toaster } from '@/components/ui/toaster';
import PbxConsole from '@/components/pos/pbx/PbxConsole';
import CallModal from '@/components/pos/pbx/CallModal';
import IncomingCallPopup from '@/components/pos/pbx/IncomingCallPopup';
import SoftphonePanel from '@/components/pos/pbx/SoftphonePanel';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { applyTheme } from '@/lib/themes';

const PbxStandalonePage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data, handlers, loading: dataLoading, error: dataError } = useDataManagement(
    user || { id: null },
    false
  );

  const [activeCall, setActiveCall] = React.useState(null);
  const { settings, pbxData } = data || {};

  React.useEffect(() => {
    try {
      applyTheme(settings?.theme?.value || 'light');
    } catch (_) { /* ignore */ }
    return () => applyTheme('light');
  }, [settings?.theme?.value]);

  if (!authLoading && !user) {
    return <Navigate to="/login" replace state={{ from: '/pbx' }} />;
  }

  if (authLoading || (dataLoading && !data?.products)) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg animate-pulse">Loading PBX…</p>
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <p className="text-destructive">{dataError}</p>
      </div>
    );
  }

  if (!settings?.enablePBX?.value) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p>The PBX System is not enabled.</p>
        <Button onClick={() => navigate('/app/settings/modules')}>Open Modules settings</Button>
      </div>
    );
  }

  const handleStartCall = async (phoneNumber, direction, customer = null) => {
    let caller = customer;
    if (!caller && direction === 'inbound' && handlers?.customers?.findByPhone) {
      try { caller = await handlers.customers.findByPhone(phoneNumber); } catch (_) { /* ignore */ }
    }
    setActiveCall({ phoneNumber, direction, customer: caller });
  };

  const handleSaveCallLog = async (logData) => {
    if (!handlers?.pbx?.call_logs?.add) return;
    try {
      await handlers.pbx.call_logs.add(logData);
      toast({ title: 'Call Logged' });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to save call log.', variant: 'destructive' });
    }
  };

  return (
    <>
      <Helmet><title>PBX · StorePilot</title></Helmet>
      <div className="min-h-screen h-screen flex flex-col bg-background text-foreground">
        <div className="flex-1 min-h-0">
          <PbxConsole
            pbxData={pbxData}
            handlers={handlers}
            customers={data?.customers || []}
            sales={data?.sales || []}
            onSimulateCall={() => handleStartCall('1-800-555-1234', 'inbound')}
            onReturnToPos={() => navigate('/app/pos')}
          />
        </div>
        <Toaster />
        {/* Mount the softphone UI locally — this route does NOT pass through AppLayout. */}
        <SoftphonePanel />
        <IncomingCallPopup />
        <CallModal
          isOpen={!!activeCall}
          onClose={() => setActiveCall(null)}
          call={activeCall}
          onSaveLog={handleSaveCallLog}
          user={user}
        />
      </div>
    </>
  );
};

export default PbxStandalonePage;
