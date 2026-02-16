import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SettingsLayout from './settings/SettingsLayout';
import SettingsGeneral from './settings/SettingsGeneral';
import SettingsAppearance from './settings/SettingsAppearance';
import SettingsFinancials from './settings/SettingsFinancials';
import SettingsModules from './settings/SettingsModules';
import SettingsShortcuts from './settings/SettingsShortcuts';

const SettingsView = ({ settings, handlers, taxes, serviceCharges }) => {
  const [activeSection, setActiveSection] = useState('general');

  const renderSection = () => {
    switch (activeSection) {
      case 'general':
        return <SettingsGeneral settings={settings} onUpdate={handlers.settings.update} />;
      case 'appearance':
        return <SettingsAppearance settings={settings} onUpdate={handlers.settings.update} />;
      case 'financials':
        return <SettingsFinancials taxes={taxes} serviceCharges={serviceCharges} handlers={handlers} />;
      case 'modules':
        return <SettingsModules settings={settings} onUpdate={handlers.settings.update} />;
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
      <SettingsLayout activeSection={activeSection} setActiveSection={setActiveSection} settings={settings}>
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

export default SettingsView;