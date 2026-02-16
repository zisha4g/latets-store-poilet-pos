import React from 'react';
import { useOutletContext } from 'react-router-dom';
import PBXView from '@/components/pos/PBXView';

const PbxPage = () => {
    const { data, handlers, handleStartCall } = useOutletContext();
    const { pbxData, settings } = data;
    
    if (!settings.enablePBX?.value) {
        return <div className="p-8">The PBX System is not enabled. Please enable it in the settings.</div>;
    }
    
    return <PBXView pbxData={pbxData} handlers={handlers} onSimulateCall={() => handleStartCall('1-800-555-1234', 'inbound')} />;
};

export default PbxPage;