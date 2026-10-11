import React, { useState, useMemo } from 'react';
import { CrmProvider, useCrm } from './context/CrmContext';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { OverdueDrawer } from './components/OverdueDrawer';
import { findDormantLeadsNeedingFollowUp } from './utils/automated-scheduling';
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
import { CompanySettingsModal } from './components/modals/CompanySettingsModal';
import { ImportLeadsModal } from './components/modals/ImportLeadsModal';
import { GlobalSearchPalette } from './components/GlobalSearchPalette';
import { AutomatedFollowUpScheduler } from './components/common/AutomatedFollowUpScheduler';
import { useGlobalSearch } from './hooks/useGlobalSearch';
import { Lead } from './types';

const CrmApp: React.FC = () => {
  // CrmProvider guarantees currentEmployee is non-null by the time CrmApp mounts
  const { currentEmployee, leads, activities, tasks, employees } = useCrm();
  const { open: isSearchOpen, openPalette, closePalette } = useGlobalSearch();

  // Show a small badge on the topbar "auto-schedule" button when there are
  // any dormant leads needing follow-up. Cheap memoized count.
  const schedulerCount = useMemo(() => {
    return findDormantLeadsNeedingFollowUp(leads, activities, tasks, employees, 3).length;
  }, [leads, activities, tasks, employees]);

  const [currentTab, setCurrentTab] = useState<string>('inbox');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCompanySettingsOpen, setIsCompanySettingsOpen] = useState(false);

  const [activeWhatsAppLead, setActiveWhatsAppLead] = useState<Lead | null>(null);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);

  const [activeVisitLead, setActiveVisitLead] = useState<Lead | null>(null);
  const [isBookVisitOpen, setIsBookVisitOpen] = useState(false);

  const [activePaymentLead, setActivePaymentLead] = useState<Lead | null>(null);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);

  const [todaySubFilter, setTodaySubFilter] = useState<'pending' | 'imminent' | 'overdue' | 'completed'>('pending');

  const [isOverdueOpen, setIsOverdueOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  React.useEffect(() => {
    document.title = `${currentEmployee.full_name} · MHR Lead Pipeline`;
  }, [currentEmployee.full_name]);

  // Defense in depth: counsellors never render the manager/oversight views,
  // even if currentTab somehow lands on one of them.
  React.useEffect(() => {
    if (currentEmployee.role === 'counsellor' && (currentTab === 'manager' || currentTab === 'jahid')) {
      setCurrentTab('inbox');
    }
  }, [currentEmployee.role, currentTab]);

  const isManagerOrAdmin = currentEmployee.role === 'admin' || currentEmployee.role === 'manager';

  const handleNavigateToToday = (subFilter?: 'pending' | 'imminent' | 'overdue' | 'completed') => {
    if (subFilter) setTodaySubFilter(subFilter);
    setCurrentTab('today');
  };

  const handleSelectLead = (lead: Lead) => {
    setSelectedLeadId(lead.id);
    setIsDetailOpen(true);
  };

  const handleSelectLeadById = (leadId: string) => {
    setSelectedLeadId(leadId);
    setIsDetailOpen(true);
  };

  const handleJumpToToday = () => {
    setCurrentTab('today');
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <div className="flex">
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          onOpenNewLead={() => setIsNewLeadOpen(true)}
          onOpenCompanySettings={() => setIsCompanySettingsOpen(true)}
          onNavigateToToday={handleNavigateToToday}
          onOpenScheduler={() => setIsSchedulerOpen(true)}
          mobileOpen={isMobileNavOpen}
          onMobileClose={() => setIsMobileNavOpen(false)}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          <Topbar
            currentTab={currentTab}
            onOpenDrawer={() => setIsOverdueOpen(true)}
            onOpenMobileSidebar={() => setIsMobileNavOpen(true)}
            onOpenNewLead={() => setIsNewLeadOpen(true)}
            onOpenImport={() => setIsImportOpen(true)}
            onOpenSearch={openPalette}
            onOpenScheduler={isManagerOrAdmin ? () => setIsSchedulerOpen(true) : undefined}
            schedulerCount={isManagerOrAdmin ? schedulerCount : undefined}
          />

          <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {currentTab === 'inbox' && (
              <InboxView
                onSelectLead={handleSelectLead}
                onOpenWhatsAppScript={handleOpenWhatsApp}
                onOpenNewLead={() => setIsNewLeadOpen(true)}
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
        </div>
      </div>

      {/* Right-side task alerts drawer */}
      <OverdueDrawer
        open={isOverdueOpen}
        onClose={() => setIsOverdueOpen(false)}
        onOpenWhatsAppScript={handleOpenWhatsApp}
        onSelectLead={(id) => {
          setSelectedLeadId(id);
          setIsDetailOpen(true);
        }}
      />

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

      <AutomatedFollowUpScheduler
        isOpenModal={isSchedulerOpen}
        onCloseModal={() => setIsSchedulerOpen(false)}
        onSelectLead={handleSelectLead}
      />

      <CompanySettingsModal
        isOpen={isCompanySettingsOpen}
        onClose={() => setIsCompanySettingsOpen(false)}
      />

      <ImportLeadsModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />

      <GlobalSearchPalette
        open={isSearchOpen}
        onClose={closePalette}
        onSelectLead={handleSelectLeadById}
        onJumpToToday={handleJumpToToday}
      />
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
