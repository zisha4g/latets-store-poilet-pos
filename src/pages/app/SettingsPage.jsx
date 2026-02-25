import React from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SettingsLayout from '@/components/pos/settings/SettingsLayout';
import SettingsGeneral from '@/components/pos/settings/SettingsGeneral';
import SettingsUsers from '@/components/pos/settings/SettingsUsers';
import SettingsAppearance from '@/components/pos/settings/SettingsAppearance';
import SettingsFinancials from '@/components/pos/settings/SettingsFinancials';
import SettingsModules from '@/components/pos/settings/SettingsModules';
import SettingsShortcuts from '@/components/pos/settings/SettingsShortcuts';
import PBXSettings from '@/components/pos/settings/PBXSettings';
import PaymentGatewaySettings from '@/components/pos/settings/PaymentGatewaySettings';
import SettingsCalendar from '@/components/pos/settings/SettingsCalendar';

const SettingsPage = () => {
    const { data, handlers } = useOutletContext();
    const { settings, taxes, serviceCharges, pbxData } = data;
    const { section: activeSection = 'general' } = useParams();

    const renderSection = () => {
        switch (activeSection) {
            case 'general':
                return <SettingsGeneral settings={settings} onUpdate={handlers.settings.update} />;
            case 'users':
                return <SettingsUsers />;
            case 'appearance':
                return <SettingsAppearance settings={settings} onUpdate={handlers.settings.update} />;
            case 'payment-gateway':
                return <PaymentGatewaySettings />;
            case 'financials':
                return <SettingsFinancials taxes={taxes} serviceCharges={serviceCharges} handlers={handlers} />;
            case 'modules':
                return <SettingsModules settings={settings} onUpdate={handlers.settings.update} />;
            case 'pbx':
                return settings.enablePBX?.value ? <PBXSettings settings={settings} onUpdate={handlers.settings.update} pbxData={pbxData} /> : <p>PBX Module is disabled. Enable it in the Modules tab.</p>;
            case 'calendar':
                return <SettingsCalendar settings={settings} onUpdate={handlers.settings.update} />;
            case 'shortcuts':
                return <SettingsShortcuts />;
            default:
                return <SettingsGeneral settings={settings} onUpdate={handlers.settings.update} />;
        }
    };

    return (
        <motion.div
            key="settings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="h-full flex flex-col"
        >
            <SettingsLayout settings={settings}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeSection}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {renderSection()}
                    </motion.div>
                </AnimatePresence>
            </SettingsLayout>
        </motion.div>
    );
};

export default SettingsPage;