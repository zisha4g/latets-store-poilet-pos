import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { motion } from 'framer-motion';
import {
  LayoutDashboard, History, Voicemail, Clock, Music, ListTree, PhoneForwarded,
  Phone, PhoneIncoming, Users, PhoneCall, PhoneOutgoing, Headphones, Mic, MessageSquare,
  Printer, UserSquare2, Sparkles, BarChart3, ShieldCheck, Wand2, Settings as SettingsIcon,
  Hash, Building2, ArrowLeft, Mail, Inbox,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import DevicesManager from '@/components/pos/pbx/DevicesManager';
import BusinessHoursManager from '@/components/pos/pbx/BusinessHoursManager';
import IVRManager from '@/components/pos/pbx/IVRManager';
import GreetingsManager from '@/components/pos/pbx/GreetingsManager';
import ExtensionsManager from '@/components/pos/pbx/ExtensionsManager';
import PbxDashboard from '@/components/pos/pbx/PbxDashboard';
import CallLogsView from '@/components/pos/pbx/CallLogsView';
import VoicemailsView from '@/components/pos/pbx/VoicemailsView';
import SmsView from '@/components/pos/pbx/SmsView';
import EmailView from '@/components/pos/pbx/EmailView';
import UnifiedInboxView from '@/components/pos/pbx/UnifiedInboxView';
import SoftphoneWorkspace from '@/components/pos/pbx/SoftphoneWorkspace';
import PhoneNumbersSettings from '@/components/pos/settings/PhoneNumbersSettings';

// Each group has a `mode`: 'comm' (day-to-day communication) or 'config'
// (admin configuration). The sidebar shows only one mode at a time, toggled
// by a Communication ↔ Settings switcher in the sidebar header.
const SECTION_GROUPS = [
  // ─── COMMUNICATION ──────────────────────────────────────────────────────
  {
    label: 'Overview',
    mode: 'comm',
    items: [
      { id: 'inbox', name: 'Unified Inbox', icon: Inbox, status: 'live' },
      { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, status: 'live' },
      { id: 'softphone', name: 'Softphone', icon: Phone, status: 'live' },
      { id: 'live', name: 'Live calls', icon: PhoneCall, status: 'planned', phase: 2,
        planned: ['Active calls (caller, agent, duration)', 'Queue depth & wait times', 'Agents online / paused', 'Barge / whisper / monitor'] },
      { id: 'reports', name: 'Reports', icon: BarChart3, status: 'planned', phase: 2,
        planned: ['Call volume by hour/day', 'AHT, abandonment, missed', 'Per-extension / per-DID / per-IVR-path', 'SignalWire cost report', 'CSV / PDF export', 'Wallboard for retail floor'] },
    ],
  },
  {
    label: 'Calls',
    mode: 'comm',
    items: [
      { id: 'logs', name: 'Call logs', icon: History, status: 'live' },
      { id: 'voicemails', name: 'Voicemails', icon: Voicemail, status: 'live' },
    ],
  },
  {
    label: 'Messaging',
    mode: 'comm',
    items: [
      { id: 'sms', name: 'SMS / MMS', icon: MessageSquare, status: 'live' },
      { id: 'email', name: 'Email', icon: Mail, status: 'live' },
      { id: 'fax', name: 'Fax', icon: Printer, status: 'planned', phase: 3,
        planned: ['Inbound fax → PDF in Supabase', 'Email notification', 'Outbound fax via SignalWire Fax API'] },
    ],
  },

  // ─── CONFIGURATION ──────────────────────────────────────────────────────
  {
    label: 'Numbers & Trunks',
    mode: 'config',
    items: [
      { id: 'numbers', name: 'Phone numbers', icon: Hash, status: 'live' },
      { id: 'locations', name: 'Locations', icon: Building2, status: 'planned', phase: 2,
        planned: ['Per-store location config', 'Time zone & holiday calendar per location', 'Local outbound caller ID'] },
    ],
  },
  {
    label: 'Users & Devices',
    mode: 'config',
    items: [
      { id: 'extensions', name: 'Extensions', icon: PhoneForwarded, status: 'live' },
      { id: 'devices', name: 'Phones', icon: Headphones, status: 'live' },
      { id: 'roles', name: 'Roles & permissions', icon: ShieldCheck, status: 'planned', phase: 3,
        planned: ['Admin / manager / agent roles', '2FA for PBX admin', 'Per-extension outbound permissions (local / LD / intl)', 'Audit log of admin changes'] },
    ],
  },
  {
    label: 'Inbound Routing',
    mode: 'config',
    items: [
      { id: 'ivr', name: 'IVR / Auto attendant', icon: ListTree, status: 'live' },
      { id: 'hours', name: 'Business hours', icon: Clock, status: 'live' },
      { id: 'holidays', name: 'Holidays', icon: Clock, status: 'planned', phase: 1,
        planned: ['One-off holiday overrides', 'Recurring annual holidays', 'Per-location holiday calendar'] },
      { id: 'queues', name: 'Queues & ring groups', icon: Users, status: 'planned', phase: 2,
        planned: ['ACD strategies (round-robin, ring-all, least-recent, skill-based)', 'Music on hold + position announce + ETA', 'Agent login / pause / wrap-up', 'Overflow rules', 'SLA & abandonment metrics'] },
      { id: 'screening', name: 'Caller screening', icon: ShieldCheck, status: 'planned', phase: 2,
        planned: ['VIP list (priority routing)', 'Blocklist / spam block', 'Geo / area-code routing', 'Language selection branch'] },
    ],
  },
  {
    label: 'Outbound',
    mode: 'config',
    items: [
      { id: 'click_to_call', name: 'Click-to-call', icon: PhoneOutgoing, status: 'planned', phase: 1,
        planned: ['Dial from any customer card', 'Dial from order / invoice screens', 'Per-extension outbound caller ID', 'Outbound rules (prefix stripping)'] },
    ],
  },
  {
    label: 'Voicemail & Greetings',
    mode: 'config',
    items: [
      { id: 'greetings', name: 'Greetings & audio', icon: Music, status: 'live' },
      { id: 'vm_advanced', name: 'Voicemail features', icon: Voicemail, status: 'planned', phase: 1,
        planned: ['Per-extension + group mailboxes', 'Custom greetings (busy / unavailable / temporary)', 'Voicemail-to-email (audio attachment)', 'Voicemail-to-text transcription', 'Phone access via *97 with PIN'] },
    ],
  },
  {
    label: 'Call Handling',
    mode: 'config',
    items: [
      { id: 'recording', name: 'Call recording', icon: Mic, status: 'planned', phase: 1,
        planned: ['Per-flow / per-extension / manual recording', 'Storage in Supabase pbx_recordings bucket', 'Pause/resume during card capture (PCI)', 'Retention policy & auto-purge', 'Consent prompt'] },
      { id: 'features', name: 'Call features', icon: Wand2, status: 'planned', phase: 1,
        planned: ['Blind & attended transfer', 'Forward (always / busy / no-answer / unavailable)', 'Follow-me / find-me', 'Simultaneous ring', 'Hold + music on hold', 'Call park (701–710)', '3-way call / merge', 'Group pickup *8', 'Do Not Disturb', 'Intercom / paging', 'Feature codes (*97, *72, *78)'] },
      { id: 'conferences', name: 'Conferences', icon: Users, status: 'planned', phase: 3,
        planned: ['Static conference rooms with PINs', 'Ad-hoc conference (drag participants)', 'Moderator controls (mute / kick / lock)', 'Meet-me dial-in numbers'] },
    ],
  },
  {
    label: 'CRM & AI',
    mode: 'config',
    items: [
      { id: 'crm', name: 'CRM integration', icon: UserSquare2, status: 'planned', phase: 1,
        planned: ['Screen pop on inbound call (customer card + order history)', 'Caller-ID lookup against customers (already partial)', 'Auto-create customer on unknown inbound', 'Call notes & disposition (sale / lead / support / no-answer)', 'Link call → sale → invoice activity feed'] },
      { id: 'ai', name: 'AI features', icon: Sparkles, status: 'planned', phase: 3,
        planned: ['AI receptionist (SignalWire AI Agents)', 'Voicemail transcription + summary + sentiment', 'Live call transcription stream', 'Real-time agent assist from product / FAQ KB', 'Spam / robocall detection'] },
    ],
  },
  {
    label: 'Admin',
    mode: 'config',
    items: [
      { id: 'security', name: 'Security & compliance', icon: ShieldCheck, status: 'planned', phase: 3,
        planned: ['HMAC verification (already live)', 'SIP IP allowlist', 'International call cap / fraud rate limit', 'TLS / SRTP (default)', 'PCI: pause recording on DTMF (already live in payment node)', 'Recording retention policies'] },
      { id: 'onboarding', name: 'Onboarding & templates', icon: Wand2, status: 'planned', phase: 1,
        planned: ['Buy-a-number wizard', 'Pre-built IVR templates (retail / restaurant / medical / service)', 'Test-call simulator (already live)', 'Config export / import (JSON)'] },
      { id: 'settings', name: 'PBX settings', icon: SettingsIcon, status: 'planned', phase: 1,
        planned: ['SignalWire credentials & project ID', 'Default outbound caller ID', 'Webhook URLs', 'White-label branding', 'API keys & 3rd-party webhooks'] },
    ],
  },
];

// Default landing section per mode (used when toggling between modes).
const MODE_DEFAULT_ID = { comm: 'dashboard', config: 'numbers' };

const StatusPill = ({ status, phase }) => {
  if (status === 'live') {
    return <Badge variant="default" className="bg-green-600 hover:bg-green-600">Live</Badge>;
  }
  return <Badge variant="outline">Planned · Phase {phase}</Badge>;
};

const PlannedSection = ({ item }) => (
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <item.icon className="w-5 h-5" />
          {item.name}
        </CardTitle>
        <StatusPill status={item.status} phase={item.phase} />
      </div>
      <CardDescription>
        Roadmap for this section.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <ul className="space-y-2 text-sm">
        {(item.planned || []).map((line, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
);

// Softphone section: the full embedded workspace (Google-Voice-style).
// While mounted, the floating SoftphonePanel modal is suppressed so this
// embedded UI owns the call experience on this page.
const SoftphoneSection = ({ callLogs, customers, sales, handlers }) => (
  <SoftphoneWorkspace
    callLogs={callLogs}
    customers={customers}
    sales={sales}
    handlers={handlers}
  />
);

const PbxConsole = ({ pbxData, handlers, customers, sales, onSimulateCall, onReturnToPos, embedded = false }) => {
  const allItems = SECTION_GROUPS.flatMap((g) => g.items).filter((i) => !i.action);

  // When the Softphone section becomes active, ensure the dialer panel is open.
  // (The panel is a global overlay; this just guarantees visibility on nav.)

  const validIds = new Set(allItems.map((i) => i.id));
  const params = useParams();
  const navigate = useNavigate();
  const routeSection = embedded ? null : params?.section;
  const [localActive, setLocalActive] = useState('dashboard');
  const activeId = embedded
    ? localActive
    : (routeSection && validIds.has(routeSection) ? routeSection : 'dashboard');
  const setActiveId = (id) => {
    if (embedded) { setLocalActive(id); return; }
    if (id === 'dashboard') navigate('/pbx');
    else navigate(`/pbx/${id}`);
  };
  const { businessHours, ivrMenus, audioFiles, extensions, callLogs, voicemails } = pbxData;

  // If a stale/unknown section is in the URL, normalise it.
  useEffect(() => {
    if (embedded) return;
    if (routeSection && !validIds.has(routeSection)) navigate('/pbx', { replace: true });
  }, [routeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = allItems.find((i) => i.id === activeId) || allItems[0];

  // The mode (Communication vs Settings) is derived from the active section
  // so deep-links land on the correct sidebar view.
  const activeGroup = SECTION_GROUPS.find((g) => g.items.some((i) => i.id === active.id));
  const activeMode = activeGroup?.mode || 'comm';
  const switchMode = (mode) => {
    if (mode === activeMode) return;
    setActiveId(MODE_DEFAULT_ID[mode]);
  };
  const visibleGroups = SECTION_GROUPS.filter((g) => g.mode === activeMode);

  const renderActive = () => {
    switch (active.id) {
      case 'dashboard':
        return <PbxDashboard pbxData={pbxData} onSimulateCall={onSimulateCall} />;
      case 'softphone':
        return <SoftphoneSection callLogs={callLogs} customers={customers} sales={sales} handlers={handlers} />;
      case 'logs':
        return <CallLogsView callLogs={callLogs} />;
      case 'voicemails':
        return <VoicemailsView handlers={handlers.pbx.voicemails} voicemails={voicemails} />;
      case 'sms':
        return <SmsView />;
      case 'email':
        return <EmailView />;
      case 'inbox':
        return <UnifiedInboxView />;
      case 'hours':
        return <BusinessHoursManager businessHours={businessHours} onUpdate={handlers.pbx.business_hours.upsert} />;
      case 'greetings':
        return <GreetingsManager audioFiles={audioFiles} handlers={handlers.pbx.audio_files} />;
      case 'ivr':
        return <IVRManager ivrMenus={ivrMenus} audioFiles={audioFiles} extensions={extensions} handlers={handlers.pbx.ivr_menus} audioHandlers={handlers.pbx.audio_files} />;
      case 'extensions':
        return <ExtensionsManager extensions={extensions} handlers={handlers.pbx.extensions} />;
      case 'devices':
        return <DevicesManager extensions={extensions} />;
      case 'numbers':
        return <PhoneNumbersSettings hideAdminMode />;
      default:
        return <PlannedSection item={active} />;
    }
  };

  return (
    <motion.div
      key="pbx-console"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col"
    >
      <div className="px-6 pt-4 pb-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onReturnToPos && (
            <Button variant="ghost" size="sm" onClick={onReturnToPos} className="mr-1">
              <ArrowLeft className="w-4 h-4 mr-1" /> POS
            </Button>
          )}
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Phone className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-primary leading-tight">PBX Phone System</h2>
        </div>
        <Button variant="outline" size="sm" onClick={onSimulateCall}>
          <PhoneIncoming className="w-4 h-4 mr-2" /> Simulate incoming call
        </Button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left rail nav */}
        <aside className="w-64 shrink-0 border-r border-border overflow-y-auto py-3">
          {/* Mode switcher: Communication ↔ Settings */}
          <div className="px-3 mb-3">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted">
              <button
                onClick={() => switchMode('comm')}
                className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeMode === 'comm'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <PhoneCall className="w-3.5 h-3.5" />
                Communication
              </button>
              <button
                onClick={() => switchMode('config')}
                className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeMode === 'config'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <SettingsIcon className="w-3.5 h-3.5" />
                Settings
              </button>
            </div>
          </div>

          {visibleGroups.map((group) => (
            <div key={group.label} className="mb-3">
              <div className="px-4 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
              <ul>
                {group.items.map((item) => {
                  const isActive = item.id === activeId && !item.action;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => setActiveId(item.id)}
                        className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                          isActive
                            ? 'bg-primary/10 text-primary border-l-2 border-primary'
                            : 'text-foreground/80 hover:bg-muted border-l-2 border-transparent'
                        }`}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span className="flex-1 text-left truncate">{item.name}</span>
                        {item.status === 'planned' && (
                          <span className="text-[10px] text-muted-foreground">P{item.phase}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </aside>

        {/* Active section */}
        <section className={`flex-1 min-h-0 ${
          active.id === 'softphone' ? 'overflow-hidden' : 'overflow-y-auto p-6'
        }`}>
          {renderActive()}
        </section>
      </div>
    </motion.div>
  );
};

export default PbxConsole;
