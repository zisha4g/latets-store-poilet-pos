import React from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Phone, Clock, ListTree, Voicemail, PhoneForwarded, LayoutDashboard, History, Music } from 'lucide-react';
import BusinessHoursManager from '@/components/pos/pbx/BusinessHoursManager';
import IVRManager from '@/components/pos/pbx/IVRManager';
import GreetingsManager from '@/components/pos/pbx/GreetingsManager';
import ExtensionsManager from '@/components/pos/pbx/ExtensionsManager';
import PbxDashboard from '@/components/pos/pbx/PbxDashboard';
import CallLogsView from '@/components/pos/pbx/CallLogsView';
import VoicemailsView from '@/components/pos/pbx/VoicemailsView';

const PBXView = ({ pbxData, handlers, onSimulateCall }) => {
  const { businessHours, ivrMenus, audioFiles, extensions, callLogs, voicemails } = pbxData;

  return (
    <motion.div
      key="pbx"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full p-6 flex flex-col"
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-3xl font-bold text-primary flex items-center">
          <Phone className="w-8 h-8 mr-3" />
          PBX Phone System
        </h2>
      </div>
      <Tabs defaultValue="dashboard" className="flex-grow flex flex-col">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard"><LayoutDashboard className="w-4 h-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="call_logs"><History className="w-4 h-4 mr-2" />Call Logs</TabsTrigger>
          <TabsTrigger value="voicemails"><Voicemail className="w-4 h-4 mr-2" />Voicemails</TabsTrigger>
          <TabsTrigger value="hours"><Clock className="w-4 h-4 mr-2" />Business Hours</TabsTrigger>
          <TabsTrigger value="greetings"><Music className="w-4 h-4 mr-2" />Greetings & Audio</TabsTrigger>
          <TabsTrigger value="ivr"><ListTree className="w-4 h-4 mr-2" />IVR Menus</TabsTrigger>
          <TabsTrigger value="extensions"><PhoneForwarded className="w-4 h-4 mr-2" />Extensions</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="flex-grow">
          <PbxDashboard pbxData={pbxData} onSimulateCall={onSimulateCall} />
        </TabsContent>
        <TabsContent value="call_logs" className="flex-grow">
          <CallLogsView callLogs={callLogs} />
        </TabsContent>
        <TabsContent value="voicemails" className="flex-grow">
          <VoicemailsView handlers={handlers.pbx.voicemails} />
        </TabsContent>
        <TabsContent value="hours" className="flex-grow">
          <BusinessHoursManager businessHours={businessHours} onUpdate={handlers.pbx.business_hours.upsert} />
        </TabsContent>
        <TabsContent value="greetings" className="flex-grow">
          <GreetingsManager audioFiles={audioFiles} handlers={handlers.pbx.audio_files} />
        </TabsContent>
        <TabsContent value="ivr" className="flex-grow">
          <IVRManager audioFiles={audioFiles} extensions={extensions} handlers={handlers.pbx.ivr_menus} />
        </TabsContent>
        <TabsContent value="extensions" className="flex-grow">
          <ExtensionsManager extensions={extensions} handlers={handlers.pbx.extensions} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default PBXView;