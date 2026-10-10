import React from 'react';
import {
  Inbox,
  Kanban,
  CheckSquare,
  Calendar,
  Users,
  ShieldAlert,
  BarChart3,
  Plus,
  Sparkles,
  Settings,
  LogOut,
  RotateCcw,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useOverdueTasks } from '../hooks/useOverdueTasks';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  managerOnly?: boolean;
  badge?: number;
  highlight?: boolean;
}

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenNewLead: () => void;
  onOpenCompanySettings: () => void;
  onNavigateToToday: (subFilter?: 'pending' | 'imminent' | 'overdue' | 'completed') => void;
  onSelectLead?: (id: string) => void;
  onOpenScheduler?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const initials = (name: string): string => {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
};

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenNewLead,
  onOpenCompanySettings,
  onNavigateToToday,
  onOpenScheduler,
  mobileOpen = false,
  onMobileClose,
}) => {
  const { currentEmployee, company, signOut, resetToDefaultData } = useCrm();
  const { overdue, upcoming } = useOverdueTasks('all');
  const role = currentEmployee.role;

  const workspace: NavItem[] = [
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'kanban', label: 'Pipeline', icon: Kanban },
    { id: 'today', label: 'Today', icon: CheckSquare, badge: overdue.length + upcoming.length, highlight: overdue.length > 0 },
    { id: 'visits', label: 'Visits', icon: Calendar },
  ];
  const team: NavItem[] = [
    { id: 'manager', label: 'Manager', icon: Users, managerOnly: true },
    { id: 'jahid', label: 'Executive Oversight', icon: ShieldAlert, managerOnly: true },
  ];
  const insights: NavItem[] = [
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  const handleClick = (id: string) => {
    if (id === 'today') onNavigateToToday('pending');
    else setCurrentTab(id);
    onMobileClose?.();
  };

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = currentTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => handleClick(item.id)}
        className={`group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          active
            ? 'bg-slate-900 text-white shadow-sm'
            : item.highlight
            ? 'text-rose-700 hover:bg-rose-50'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
        }`}
        title={item.label}
      >
        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : item.highlight ? 'text-rose-600' : 'text-slate-500 group-hover:text-slate-700'}`} />
        <span className="truncate flex-1 text-left">{item.label}</span>
        {item.badge && item.badge > 0 ? (
          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
            active
              ? 'bg-white/20 text-white'
              : item.highlight
              ? 'bg-rose-600 text-white animate-pulse'
              : 'bg-slate-200 text-slate-700'
          }`}>
            {item.badge}
          </span>
        ) : null}
      </button>
    );
  };

  const renderGroup = (label: string, items: NavItem[]) => {
    const visible = items.filter((i) => !i.managerOnly || role === 'admin' || role === 'manager');
    if (!visible.length) return null;
    return (
      <div className="mb-4">
        <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </div>
        <div className="space-y-0.5">
          {visible.map(renderItem)}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          className="lg:hidden fixed inset-0 bg-slate-900/50 z-40"
          aria-hidden
        />
      )}
      <aside
        className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col h-screen transform transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="px-4 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shrink-0">
              <Building2 className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm text-slate-900 truncate">{company.name}</div>
              <div className="text-[10px] font-mono text-slate-400 truncate">
                {company.portal_subdomain || `${company.slug}.omnileads.io`}
              </div>
            </div>
            <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono uppercase">
              {company.plan_tier}
            </span>
          </div>
        </div>

        {/* Nav scroll area */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {renderGroup('Workspace', workspace)}
          {renderGroup('Team', team)}
          {renderGroup('Insights', insights)}

          {/* Quick actions (only when admin can simulate) */}
          {role === 'admin' && onOpenScheduler ? (
            <div className="mt-6 pt-4 border-t border-slate-200 space-y-1">
              <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Automation
              </div>
              <button
                onClick={() => { onOpenScheduler(); onMobileClose?.(); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-slate-500" />
                <span className="truncate">Auto-Scheduler</span>
              </button>
            </div>
          ) : null}
        </nav>

        {/* User card */}
        <div className="border-t border-slate-200 p-3 shrink-0">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {initials(currentEmployee.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 truncate">{currentEmployee.full_name}</div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{currentEmployee.role}</div>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={onOpenCompanySettings}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
              title="Company settings"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
            <button
              onClick={() => {
                if (confirm('Reset sample leads and company settings to original demonstration state?')) {
                  resetToDefaultData();
                }
              }}
              className="px-2 py-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              title="Reset data"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { if (confirm('Sign out?')) signOut(); }}
              className="px-2 py-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

// Quick action buttons rendered in the topbar (exported so App.tsx can place them)
export const PrimaryActions: React.FC<{
  onOpenNewLead: () => void;
  role: string;
}> = ({ onOpenNewLead, role }) => (
  <div className="flex items-center gap-2">
    <button
      onClick={onOpenNewLead}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-sm transition-colors"
    >
      <Plus className="w-3.5 h-3.5" />
      <span>New Lead</span>
    </button>
  </div>
);
