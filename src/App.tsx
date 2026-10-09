import React, { useState } from 'react';
import { CrmProvider, useCrm } from './context/CrmContext';
import { Navbar } from './components/Navbar';
import { InboxView } from './components/views/InboxView';
import { KanbanView } from './components/views/KanbanView';
import { TodayView } from './components/views/TodayView';
import { VisitsView } from './components/views/VisitsView';
import { ManagerView } from './components/views/ManagerView';
import { JahidOversightView } from './components/views/JahidOversightView';
import { ReportsView } from './components/views/ReportsView';
import { NewLeadModal } from './components/modals/NewLeadModal';
import { LeadDetailModal } from './components/modals/LeadDetailModal';
import { WhatsAppScriptModal } from './components/modals/WhatsAppScriptModal';
import { BookVisitModal } from './components/modals/BookVisitModal';
import { RecordPaymentModal } from './components/modals/RecordPaymentModal';
import { SimulateInboundModal } from './components/modals/SimulateInboundModal';
import { AutomatedFollowUpScheduler } from './components/common/AutomatedFollowUpScheduler';
import { Lead } from './types';
import { RotateCcw } from 'lucide-react';

const CrmApp: React.FC = () => {
  const { resetToDefaultData, currentEmployee } = useCrm();

  const [currentTab, setCurrentTab] = useState<string>('inbox');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);

  const [activeWhatsAppLead, setActiveWhatsAppLead] = useState<Lead | null>(null);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);

  const [activeVisitLead, setActiveVisitLead] = useState<Lead | null>(null);
  const [isBookVisitOpen, setIsBookVisitOpen] = useState(false);

  const [activePaymentLead, setActivePaymentLead] = useState<Lead | null>(null);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);

  const [todaySubFilter, setTodaySubFilter] = useState<'pending' | 'imminent' | 'overdue' | 'completed'>('pending');

  const handleNavigateToToday = (subFilter?: 'pending' | 'imminent' | 'overdue' | 'completed') => {
    if (subFilter) {
      setTodaySubFilter(subFilter);
    }
    setCurrentTab('today');
  };

  const handleSelectLead = (lead: Lead) => {
    setSelectedLeadId(lead.id);
    setIsDetailOpen(true);
  };

  const handleOpenWhatsApp = (lead: Lead) => {
    setActiveWhatsAppLead(lead);
    setIsWhatsAppOpen(true);
  };

  const handleOpenBookVisit = (lead: Lead) => {
    setActiveVisitLead(lead);
    setIsBookVisitOpen(true);
  };

  const handleOpenRecordPayment = (lead: Lead) => {
    setActivePaymentLead(lead);
    setIsRecordPaymentOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenNewLead={() => setIsNewLeadOpen(true)}
        onOpenSimulate={() => setIsSimulateOpen(true)}
        onNavigateToTodayTab={handleNavigateToToday}
        onSelectLead={handleSelectLead}
        onOpenScheduler={() => setIsSchedulerOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'inbox' && (
          <InboxView
            onSelectLead={handleSelectLead}
            onOpenWhatsAppScript={handleOpenWhatsApp}
            onOpenNewLead={() => setIsNewLeadOpen(true)}
            onOpenSimulate={() => setIsSimulateOpen(true)}
          />
        )}

        {currentTab === 'kanban' && (
          <KanbanView
            onSelectLead={handleSelectLead}
            onOpenWhatsAppScript={handleOpenWhatsApp}
            onOpenBookVisit={handleOpenBookVisit}
            onOpenRecordPayment={handleOpenRecordPayment}
          />
        )}

        {currentTab === 'today' && (
          <TodayView
            onSelectLead={handleSelectLead}
            onOpenWhatsAppScript={handleOpenWhatsApp}
            onOpenBookVisit={handleOpenBookVisit}
            initialFilterTab={todaySubFilter}
          />
        )}

        {currentTab === 'visits' && (
          <VisitsView
            onSelectLead={handleSelectLead}
            onOpenWhatsAppScript={handleOpenWhatsApp}
            onOpenBookVisit={handleOpenBookVisit}
          />
        )}

        {currentTab === 'manager' && (
          <ManagerView
            onSelectLead={handleSelectLead}
            onOpenWhatsAppScript={handleOpenWhatsApp}
          />
        )}

        {currentTab === 'jahid' && (
          <JahidOversightView
            onSelectLead={handleSelectLead}
            onOpenWhatsAppScript={handleOpenWhatsApp}
          />
        )}

        {currentTab === 'reports' && <ReportsView />}
      </main>

      {/* Global Modals */}
      <NewLeadModal
        isOpen={isNewLeadOpen}
        onClose={() => setIsNewLeadOpen(false)}
        onSelectLead={handleSelectLead}
      />

      <LeadDetailModal
        leadId={selectedLeadId}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedLeadId(null);
        }}
        onOpenWhatsAppScript={handleOpenWhatsApp}
        onOpenBookVisit={handleOpenBookVisit}
        onOpenRecordPayment={handleOpenRecordPayment}
      />

      <WhatsAppScriptModal
        lead={activeWhatsAppLead}
        isOpen={isWhatsAppOpen}
        onClose={() => {
          setIsWhatsAppOpen(false);
          setActiveWhatsAppLead(null);
        }}
      />

      <BookVisitModal
        lead={activeVisitLead}
        isOpen={isBookVisitOpen}
        onClose={() => {
          setIsBookVisitOpen(false);
          setActiveVisitLead(null);
        }}
      />

      <RecordPaymentModal
        lead={activePaymentLead}
        isOpen={isRecordPaymentOpen}
        onClose={() => {
          setIsRecordPaymentOpen(false);
          setActivePaymentLead(null);
        }}
      />

      <SimulateInboundModal
        isOpen={isSimulateOpen}
        onClose={() => setIsSimulateOpen(false)}
        onSelectLead={handleSelectLead}
      />

      {/* Automated Follow-up Scheduler Modal */}
      <AutomatedFollowUpScheduler
        isOpenModal={isSchedulerOpen}
        onCloseModal={() => setIsSchedulerOpen(false)}
        onSelectLead={handleSelectLead}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Study In China Academy (SICA)</span>
            <span>·</span>
            <span>Bangladesh Partner Office: Navana Tower, Gulshan-1, Dhaka</span>
          </div>

          <div className="flex items-center gap-4">
            <span>
              Acting as: <strong className="text-slate-800">{currentEmployee.full_name} ({currentEmployee.role})</strong>
            </span>
            <button
              onClick={() => {
                if (confirm('Reset sample leads to original demonstration state?')) {
                  resetToDefaultData();
                }
              }}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors"
              title="Reset data"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Data</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <CrmProvider>
      <CrmApp />
    </CrmProvider>
  );
}
