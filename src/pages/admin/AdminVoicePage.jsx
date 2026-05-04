import React from 'react';
import VoiceOrderingSettings from '@/components/pos/settings/VoiceOrderingSettings';

const AdminVoicePage = () => (
  <div className="space-y-6 max-w-6xl">
    <div>
      <h1 className="text-2xl font-bold">Voice Ordering</h1>
      <p className="text-muted-foreground">Configure IVR flows and voice ordering per tenant.</p>
    </div>
    <VoiceOrderingSettings />
  </div>
);

export default AdminVoicePage;
