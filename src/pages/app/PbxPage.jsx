import React from 'react';
import { useOutletContext } from 'react-router-dom';
import PbxConsole from '@/components/pos/pbx/PbxConsole';

const PbxPage = () => {
    const { data, handlers, handleStartCall } = useOutletContext();
    const { pbxData, settings } = data;
    
    if (!settings.enablePBX?.value) {
        return <div className="p-8">The PBX System is not enabled. Please enable it in the settings.</div>;
    }
    
    return <PbxConsole pbxData={pbxData} handlers={handlers} customers={data?.customers || []} sales={data?.sales || []} onSimulateCall={() => handleStartCall('1-800-555-1234', 'inbound')} />;
};

export default PbxPage;