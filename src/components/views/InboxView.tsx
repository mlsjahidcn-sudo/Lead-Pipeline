import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Lead, LeadStage } from '../../types';
import {
  calculateSlaInfo,
  isNextActionOverdue,
  getStageLabel,
} from '../../utils/crm-logic';
import { getLeadLastContacted, calculateDaysDormant } from '../../utils/automated-scheduling';
import { exportLeadsCsv } from '../../utils/csv';
import { Download } from 'lucide-react';
import {
  DEFAULT_FILTERS,
  InboxFilters,
  SortKey,
  SortState,
  Density,
  STAGE_SORT_ORDER,
  PAGE_SIZE,
  LeadRowData,
} from './inbox/types';
import LeadTableToolbar from './inbox/LeadTableToolbar';
import LeadTable from './inbox/LeadTable';
import LeadCard from './inbox/LeadCard';
import BulkActionBar from './inbox/BulkActionBar';

interface InboxViewProps {
  onSelectLead: (lead: Lead) => void;
  onOpenWhatsAppScript: (lead: Lead) => void;
  onOpenNewLead: () => void;
}

const DENSITY_STORAGE_KEY = 'mhr_inbox_density';

/** Natural first sort direction per column. */
const DEFAULT_SORT_DIR: Record<SortKey, 'asc' | 'desc'> = {
  name: 'asc',
  intake: 'asc',
  owner: 'asc',
  stage: 'asc',
  weight: 'desc',
  sla: 'desc',
  nextAction: 'asc',
  created: 'desc',
};

export const InboxView: React.FC<InboxViewProps> = ({
  onSelectLead,
  onOpenWhatsAppScript,
  onOpenNewLead,
}) => {
  const {
    leads,
    employees,
    sources,
    updateLead,
    reassignLead,
    currentEmployee,
    getLeadScoreWeight,
    getLeadActivities,
    company,
  } = useCrm();
  const isManagerOrAdmin = currentEmployee.role === 'admin' || currentEmployee.role === 'manager';

  const [filters, setFilters] = useState<InboxFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortState>({ key: 'nextAction', dir: 'asc' });
  const [density, setDensity] = useState<Density>(() =>
    typeof localStorage !== 'undefined' && localStorage.getItem(DENSITY_STORAGE_KEY) === 'compact'
      ? 'compact'
      : 'comfortable'
  );
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const patchFilters = useCallback((patch: Partial<InboxFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters((prev) => ({ ...DEFAULT_FILTERS, activeTab: prev.activeTab }));
  }, []);

  const toggleDensity = useCallback(() => {
    setDensity((prev) => {
      const next = prev === 'comfortable' ? 'compact' : 'comfortable';
      try {
        localStorage.setItem(DENSITY_STORAGE_KEY, next);
      } catch {
        /* storage unavailable (private mode) — preference just won't persist */
      }
      return next;
    });
  }, []);

  // Reset the visible window whenever the result set identity changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters, sort.key, sort.dir]);

  // ---------------------------------------------------------------------
  // Lookup maps — one pass each, reused by filter/sort/rows (perf pattern
  // established by the activitiesByLeadId fix in CrmContext).
  // ---------------------------------------------------------------------
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  const dormantInfoByLeadId = useMemo(() => {
    const map = new Map<string, { daysDormant: number; isDormant: boolean }>();
    for (const lead of leads) {
      const { lastContactedAt } = getLeadLastContacted(lead, getLeadActivities(lead.id));
      const daysDormant = calculateDaysDormant(lastContactedAt);
      map.set(lead.id, {
        daysDormant,
        isDormant: daysDormant >= 3 && !['lost', 'enrolled'].includes(lead.stage),
      });
    }
    return map;
  }, [leads, getLeadActivities]);

  // Score weight for every lead, computed once per data change — replaces
  // the old per-row-per-render getLeadScoreWeight calls.
  const weightByLeadId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getLeadScoreWeight>>();
    for (const lead of leads) map.set(lead.id, getLeadScoreWeight(lead));
    return map;
  }, [leads, getLeadScoreWeight]);

  // ---------------------------------------------------------------------
  // Filter
  // ---------------------------------------------------------------------
  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        if (lead.duplicate_of) return false;

        const { searchQuery, activeTab, filterOwner, filterSource, filterTemp, filterStage, filterWeight } = filters;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = lead.full_name.toLowerCase().includes(q);
          const matchPhone =
            (lead.phone_raw || '').toLowerCase().includes(q) ||
            (lead.phone_e164 || '').toLowerCase().includes(q) ||
            (lead.whatsapp_e164 || '').toLowerCase().includes(q);
          const stageLabel = getStageLabel(lead.stage).toLowerCase();
          const stageRaw = lead.stage.toLowerCase();
          const stageSpaced = lead.stage.replace(/_/g, ' ').toLowerCase();
          const matchStatus = stageLabel.includes(q) || stageRaw.includes(q) || stageSpaced.includes(q);
          const matchCity = lead.city.toLowerCase().includes(q);
          const matchProg =
            lead.target_programme.toLowerCase().includes(q) ||
            lead.target_degree.toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchStatus && !matchCity && !matchProg) return false;
        }

        if (activeTab === 'new' && lead.stage !== 'new') return false;
        if (activeTab === 'hot' && lead.temperature !== 'hot') return false;
        if (activeTab === 'overdue' && !isNextActionOverdue(lead)) return false;
        if (activeTab === 'open' && ['lost', 'enrolled', 'paid'].includes(lead.stage)) return false;
        if (activeTab === 'paid' && lead.stage !== 'paid') return false;

        if (filterOwner !== 'all' && lead.owner_id !== filterOwner) return false;
        if (filterSource !== 'all' && lead.source_id !== filterSource) return false;
        if (filterTemp !== 'all' && lead.temperature !== filterTemp) return false;
        if (filterStage !== 'all' && lead.stage !== filterStage) return false;

        if (filterWeight !== 'all') {
          const w = lead.score_weight || weightByLeadId.get(lead.id)?.weight || 0;
          if (filterWeight === 'high' && w < 8) return false;
          if (filterWeight === 'medium' && (w < 5 || w > 7)) return false;
          if (filterWeight === 'low' && w > 4) return false;
        }

        return true;
      }),
    [leads, filters, weightByLeadId]
  );

  // ---------------------------------------------------------------------
  // Sort
  // ---------------------------------------------------------------------
  const sortedLeads = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const ownerName = (id: string) => employeeById.get(id)?.full_name || '';
    const weightOf = (l: Lead) => l.score_weight ?? weightByLeadId.get(l.id)?.weight ?? 0;

    const comparators: Record<SortKey, (a: Lead, b: Lead) => number> = {
      name: (a, b) => a.full_name.localeCompare(b.full_name) * dir,
      intake: (a, b) => (a.target_intake || '').localeCompare(b.target_intake || '') * dir,
      owner: (a, b) => ownerName(a.owner_id).localeCompare(ownerName(b.owner_id)) * dir,
      stage: (a, b) => ((STAGE_SORT_ORDER[a.stage] ?? 99) - (STAGE_SORT_ORDER[b.stage] ?? 99)) * dir,
      weight: (a, b) => (weightOf(a) - weightOf(b)) * dir,
      sla: (a, b) =>
        (calculateSlaInfo(a.created_at, a.first_contact_at).hoursElapsed -
          calculateSlaInfo(b.created_at, b.first_contact_at).hoursElapsed) *
        dir,
      // Nulls (no next action) always sink to the bottom regardless of direction
      nextAction: (a, b) => {
        const ta = a.next_action_at ? new Date(a.next_action_at).getTime() : null;
        const tb = b.next_action_at ? new Date(b.next_action_at).getTime() : null;
        if (ta === null && tb === null) return 0;
        if (ta === null) return 1;
        if (tb === null) return -1;
        return (ta - tb) * dir;
      },
      created: (a, b) => a.created_at.localeCompare(b.created_at) * dir,
    };

    return [...filteredLeads].sort(comparators[sort.key]);
  }, [filteredLeads, sort, employeeById, weightByLeadId]);

  // ---------------------------------------------------------------------
  // Visible page + precomputed row data (one pass, feeds table & cards)
  // ---------------------------------------------------------------------
  const visibleRows: LeadRowData[] = useMemo(
    () =>
      sortedLeads.slice(0, visibleCount).map((lead) => {
        const owner = employeeById.get(lead.owner_id);
        const dormant = dormantInfoByLeadId.get(lead.id);
        return {
          lead,
          ownerName: owner?.full_name || 'Unassigned',
          ownerRole: owner?.role || '',
          sourceName: sourceById.get(lead.source_id)?.name || 'Direct',
          sla: calculateSlaInfo(lead.created_at, lead.first_contact_at),
          isOverdue: isNextActionOverdue(lead),
          isDormant: dormant?.isDormant ?? false,
          daysDormant: dormant?.daysDormant ?? 0,
          weight:
            weightByLeadId.get(lead.id) ?? {
              weight: lead.score_weight ?? 0,
              exactWeight: lead.score_weight ?? 0,
              activityScore: 0,
              activityCount: 0,
              recentActivityBonus: false,
              sourceScore: 0,
              sourceChannel: '',
              sourceName: '',
              profileScore: 0,
              profileCompletionPercentage: 0,
              completedFieldsCount: 0,
              totalFieldsCount: 0,
              breakdown: [],
            },
        };
      }),
    [sortedLeads, visibleCount, employeeById, sourceById, dormantInfoByLeadId, weightByLeadId]
  );

  // Metrics summary + tab counts — single pass over leads
  const { tabCounts } = useMemo(() => {
    let open = 0,
      hot = 0,
      overdue = 0,
      fresh = 0;
    for (const l of leads) {
      if (!['lost', 'enrolled', 'paid'].includes(l.stage)) open++;
      if (l.temperature === 'hot' && l.stage !== 'lost') hot++;
      if (isNextActionOverdue(l)) overdue++;
      if (l.stage === 'new') fresh++;
    }
    return {
      tabCounts: { all: leads.length, new: fresh, hot, overdue, open, paid: 0 },
      totalOpen: open,
    };
  }, [leads]);

  // ---------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------
  const handleSort = useCallback(
    (key: SortKey) => {
      setSort((prev) =>
        prev.key === key
          ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
          : { key, dir: DEFAULT_SORT_DIR[key] }
      );
    },
    []
  );

  const handleStageChange = useCallback(
    (lead: Lead, stage: LeadStage) => {
      updateLead(lead.id, { stage });
    },
    [updateLead]
  );

  const toggleSelect = useCallback((leadId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }, []);

  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((r) => selectedIds.has(r.lead.id));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const visible = visibleRows.map((r) => r.lead.id);
      const allSelected = visible.length > 0 && visible.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        visible.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...visible]);
    });
  }, [visibleRows]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectedLeads = useMemo(
    () => leads.filter((l) => selectedIds.has(l.id)),
    [leads, selectedIds]
  );

  const handleBulkStage = useCallback(
    (stage: LeadStage) => {
      const ids = [...selectedIds];
      for (const id of ids) {
        updateLead(id, { stage }, `Bulk stage update from Inbox (${ids.length} leads)`);
      }
      clearSelection();
    },
    [selectedIds, updateLead, clearSelection]
  );

  const handleBulkReassign = useCallback(
    (ownerId: string) => {
      const ids = [...selectedIds];
      for (const id of ids) {
        reassignLead(id, ownerId);
      }
      clearSelection();
    },
    [selectedIds, reassignLead, clearSelection]
  );

  const handleExportAll = useCallback(() => {
    exportLeadsCsv(sortedLeads, {
      employees,
      getWeight: (l) => weightByLeadId.get(l.id) ?? getLeadScoreWeight(l),
      companySlug: company.slug,
    });
  }, [sortedLeads, employees, weightByLeadId, getLeadScoreWeight, company.slug]);

  const handleExportSelected = useCallback(() => {
    exportLeadsCsv(selectedLeads, {
      employees,
      getWeight: (l) => weightByLeadId.get(l.id) ?? getLeadScoreWeight(l),
      companySlug: company.slug,
      suffix: 'selected',
    });
  }, [selectedLeads, employees, weightByLeadId, getLeadScoreWeight, company.slug]);

  const activeCounsellors = useMemo(
    () => employees.filter((e) => e.role === 'counsellor' && e.is_active),
    [employees]
  );

  return (
    <div className="space-y-4">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            Lead Inbox & Contact Queue
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rule: 2-hour SLA for first contact · No open lead without next action date
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md">
            <span className="text-slate-500">New Queue:</span>
            <span className="font-mono font-bold text-blue-600 tabular-nums">{tabCounts.new}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-md">
            <span className="text-rose-700">Hot Leads:</span>
            <span className="font-mono font-bold text-rose-700 tabular-nums">{tabCounts.hot}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-md">
            <span className="text-amber-800">Overdue:</span>
            <span className="font-mono font-bold text-amber-800 tabular-nums">
              {tabCounts.overdue}
            </span>
          </div>

          <button
            onClick={handleExportAll}
            title="Download CSV report (current filters & sort)"
            className="flex items-center gap-1 px-2.5 py-1 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Tabs + Search + Filters */}
      <LeadTableToolbar
        filters={filters}
        onPatch={patchFilters}
        onClear={clearFilters}
        tabCounts={tabCounts}
        employees={employees}
        sources={sources}
        showOwnerFilter={isManagerOrAdmin}
        density={density}
        onToggleDensity={toggleDensity}
        filteredCount={filteredLeads.length}
      />

      {/* Bulk actions */}
      <BulkActionBar
        count={selectedIds.size}
        onClear={clearSelection}
        onBulkStage={handleBulkStage}
        onBulkReassign={isManagerOrAdmin ? handleBulkReassign : undefined}
        counsellors={activeCounsellors}
        onExportSelected={handleExportSelected}
      />

      {/* Desktop: sortable sticky-header table */}
      <LeadTable
        rows={visibleRows}
        totalCount={filteredLeads.length}
        sort={sort}
        onSort={handleSort}
        density={density}
        selectedIds={selectedIds}
        allVisibleSelected={allVisibleSelected}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        visibleCount={visibleCount}
        onShowMore={() => setVisibleCount((c) => c + PAGE_SIZE)}
        onSelectLead={onSelectLead}
        onOpenWhatsAppScript={onOpenWhatsAppScript}
        onStageChange={handleStageChange}
        onOpenNewLead={onOpenNewLead}
      />

      {/* Mobile: card list */}
      <div className="sm:hidden space-y-2">
        {visibleRows.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
            No student leads found matching filters.
            <button
              onClick={onOpenNewLead}
              className="block mx-auto mt-3 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold"
            >
              + Create Lead
            </button>
          </div>
        ) : (
          visibleRows.map((data) => (
            <LeadCard
              key={data.lead.id}
              data={data}
              isSelected={selectedIds.has(data.lead.id)}
              onToggleSelect={toggleSelect}
              onSelectLead={onSelectLead}
              onOpenWhatsAppScript={onOpenWhatsAppScript}
              onStageChange={handleStageChange}
            />
          ))
        )}
        {filteredLeads.length > visibleRows.length && (
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="w-full py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs"
          >
            Show 30 more ({visibleRows.length} of {filteredLeads.length})
          </button>
        )}
      </div>
    </div>
  );
};
