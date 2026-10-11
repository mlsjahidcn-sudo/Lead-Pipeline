import React, { useMemo, useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Lead, LeadStage } from '../../types';
import {
  isNextActionOverdue,
  formatBdDateTime,
  getStageLabel,
} from '../../utils/crm-logic';
import { getLeadLastContacted, calculateDaysDormant } from '../../utils/automated-scheduling';
import { ScoreWeightBadge, TemperaturePill } from '../common/badges';
import { SavedViewMenu } from '../common/SavedViewMenu';
import { loadSavedViews, persistSavedView, deleteSavedView, SavedView } from '../../utils/saved-views';
import {
  MapPin,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Phone,
  MessageSquare,
  Search,
  Filter,
  X,
  Sparkles,
  Users,
} from 'lucide-react';

interface KanbanViewProps {
  onSelectLead: (lead: Lead) => void;
  onOpenWhatsAppScript: (lead: Lead) => void;
  onOpenBookVisit: (lead: Lead) => void;
  onOpenRecordPayment: (lead: Lead) => void;
}

interface ColumnDef {
  id: LeadStage;
  label: string;
  description: string;
  highlight?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { id: 'new', label: 'New Inbound', description: '2h SLA Clock Active' },
  { id: 'contacted', label: 'Contacted', description: 'First call/WA made' },
  { id: 'qualified', label: 'Qualified', description: 'Academic fit checked' },
  { id: 'consultation_booked', label: 'Consultation', description: 'Free 1-on-1 scheduled' },
  { id: 'office_visit_booked', label: 'Office Visit Booked', description: 'Goal: Meet parents', highlight: true },
  { id: 'office_visit_done', label: 'Visit Completed', description: '24h decision follow-up' },
  { id: 'paid', label: 'Paid Student', description: 'Deposit / Package fee' },
  { id: 'enrolled', label: 'Enrolled', description: 'Visa / Application submitted' },
  { id: 'lost', label: 'Lost / Closed', description: 'Documented exit reason' },
];

export const KanbanView: React.FC<KanbanViewProps> = ({
  onSelectLead,
  onOpenWhatsAppScript,
  onOpenBookVisit,
  onOpenRecordPayment,
}) => {
  const { leads, employees, lostReasons, updateLead, getLeadScoreWeight, getLeadActivities, currentEmployee } = useCrm();
  const isManagerOrAdmin = currentEmployee.role === 'admin' || currentEmployee.role === 'manager';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [filterTemp, setFilterTemp] = useState<string>('all');
  const [filterWeight, setFilterWeight] = useState<string>('all');

  // Drag-and-drop state (native HTML5 DnD)
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Lost-reason prompt for drops/advances onto the lost column (audit rule)
  const [lostTarget, setLostTarget] = useState<Lead | null>(null);
  const [lostReasonId, setLostReasonId] = useState<number>(1);
  const [lostNote, setLostNote] = useState('');

  // Saved filter views (per device)
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => loadSavedViews('kanban'));
  const handleSaveView = (name: string) => {
    persistSavedView({
      name,
      surface: 'kanban',
      payload: { searchQuery, filterStage, filterOwner, filterTemp, filterWeight },
    });
    setSavedViews(loadSavedViews('kanban'));
  };
  const handleApplyView = (view: SavedView) => {
    const p = view.payload as Partial<{
      searchQuery: string; filterStage: string; filterOwner: string; filterTemp: string; filterWeight: string;
    }>;
    setSearchQuery(p.searchQuery ?? '');
    setFilterStage(p.filterStage ?? 'all');
    setFilterOwner(p.filterOwner ?? 'all');
    setFilterTemp(p.filterTemp ?? 'all');
    setFilterWeight(p.filterWeight ?? 'all');
  };
  const handleDeleteView = (id: string) => {
    deleteSavedView(id);
    setSavedViews(loadSavedViews('kanban'));
  };

  const handleAdvance = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    const stageOrder: LeadStage[] = [
      'new',
      'contacted',
      'qualified',
      'consultation_booked',
      'office_visit_booked',
      'office_visit_done',
      'paid',
      'enrolled',
    ];

    const currentIndex = stageOrder.indexOf(lead.stage);
    if (currentIndex >= 0 && currentIndex < stageOrder.length - 1) {
      applyStageChange(lead, stageOrder[currentIndex + 1]);
    }
  };

  // Stage change with the same gates as the detail modal: visit booking and
  // payment open their dedicated flows, lost requires an exit reason.
  const applyStageChange = (lead: Lead, nextStage: LeadStage) => {
    if (nextStage === lead.stage) return;
    if (nextStage === 'office_visit_booked') {
      onOpenBookVisit(lead);
    } else if (nextStage === 'paid') {
      onOpenRecordPayment(lead);
    } else if (nextStage === 'lost') {
      setLostReasonId(lostReasons[0]?.id ?? 1);
      setLostNote('');
      setLostTarget(lead);
    } else {
      updateLead(lead.id, { stage: nextStage }, `Stage moved to ${nextStage.replace(/_/g, ' ')} on Kanban board`);
    }
  };

  const handleConfirmLost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lostTarget) return;
    const reason = lostReasons.find((r) => r.id === lostReasonId);
    updateLead(
      lostTarget.id,
      {
        stage: 'lost',
        lost_reason_id: lostReasonId,
        lost_note: lostNote,
        next_action_at: null,
      },
      `Marked Lost: ${reason?.label || 'Unknown reason'}${lostNote ? ` - "${lostNote}"` : ''}`
    );
    setLostTarget(null);
  };

  // Native HTML5 drag-and-drop: cards set the lead id, columns accept drops.
  const handleDropOnColumn = (e: React.DragEvent, targetStage: LeadStage) => {
    e.preventDefault();
    setDragOverColumn(null);
    setDraggingLeadId(null);
    const leadId = e.dataTransfer.getData('text/plain');
    if (!leadId) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    applyStageChange(lead, targetStage);
  };

  // Score weight for every lead, computed once per data change (same pattern
  // as InboxView) — replaces per-card-per-render getLeadScoreWeight calls.
  const weightByLeadId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getLeadScoreWeight>>();
    for (const lead of leads) map.set(lead.id, getLeadScoreWeight(lead));
    return map;
  }, [leads, getLeadScoreWeight]);

  // Lead match evaluation for global search & filters
  const matchLead = (lead: Lead): boolean => {
    if (lead.duplicate_of) return false;

    // Search query (name, phone number, current pipeline status, city, programme)
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

      if (!matchName && !matchPhone && !matchStatus && !matchCity && !matchProg) {
        return false;
      }
    }

    // Pipeline status / stage filter dropdown
    if (filterStage !== 'all') {
      if (filterStage === 'consultation_booked') {
        if (lead.stage !== 'consultation_booked' && lead.stage !== 'consultation_done') return false;
      } else if (filterStage === 'lost') {
        if (lead.stage !== 'lost' && lead.stage !== 'nurture') return false;
      } else if (lead.stage !== filterStage) {
        return false;
      }
    }

    // Counsellor filter
    if (filterOwner !== 'all' && lead.owner_id !== filterOwner) return false;

    // Temperature filter
    if (filterTemp !== 'all' && lead.temperature !== filterTemp) return false;

    // Lead Score Weight filter (1-10)
    if (filterWeight !== 'all') {
      const w = lead.score_weight || weightByLeadId.get(lead.id)?.weight || 0;
      if (filterWeight === 'high' && w < 8) return false;
      if (filterWeight === 'medium' && (w < 5 || w > 7)) return false;
      if (filterWeight === 'low' && w > 4) return false;
    }

    return true;
  };

  const totalNonDuplicate = useMemo(() => leads.filter((l) => !l.duplicate_of).length, [leads]);
  // Run the filter ONCE and reuse for every column + the counter below.
  // Previously matchLead executed for every lead × 8 columns (plus the count
  // and the top-score metric) on every render, each call potentially scoring
  // the lead against the whole activities array.
  const matchingLeads = useMemo(
    () => leads.filter(matchLead),
    [leads, searchQuery, filterStage, filterOwner, filterTemp, filterWeight, weightByLeadId] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const totalMatchingLeads = matchingLeads.length;
  const topScoreCount = useMemo(
    () => leads.filter((l) => !l.duplicate_of && (l.score_weight || weightByLeadId.get(l.id)?.weight || 0) >= 8).length,
    [leads, weightByLeadId]
  );
  const hotLeadCount = useMemo(
    () => leads.filter((l) => !l.duplicate_of && l.temperature === 'hot' && l.stage !== 'lost').length,
    [leads]
  );
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const dormantInfoByLeadId = useMemo(() => {
    const map = new Map<string, number>();
    for (const lead of leads) {
      const { lastContactedAt } = getLeadLastContacted(lead, getLeadActivities(lead.id));
      map.set(lead.id, calculateDaysDormant(lastContactedAt));
    }
    return map;
  }, [leads, getLeadActivities]);
  // Group matching leads per column in ONE pass (was 9 re-filters/render).
  // consultation_done folds into the consultation column; nurture into lost.
  const leadsByColumn = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const col of COLUMNS) map.set(col.id, []);
    for (const l of matchingLeads) {
      if (l.stage === 'consultation_done') map.get('consultation_booked')!.push(l);
      else if (l.stage === 'nurture') map.get('lost')!.push(l);
      else if (map.has(l.stage)) map.get(l.stage)!.push(l);
    }
    return map;
  }, [matchingLeads]);

  const isFilterActive =
    searchQuery.trim() !== '' ||
    filterStage !== 'all' ||
    filterOwner !== 'all' ||
    filterTemp !== 'all' ||
    filterWeight !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStage('all');
    setFilterOwner('all');
    setFilterTemp('all');
    setFilterWeight('all');
  };

  return (
    <div className="space-y-4">
      {/* Header & Pipeline Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            Admissions Pipeline Kanban
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Stage progression requires exit criteria · Office visits are the primary conversion driver
          </p>
        </div>

        {/* Quick summary metrics */}
        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
          <div className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md">
            <span className="text-slate-500 font-sans mr-1.5">Total Pipeline:</span>
            <strong className="text-slate-900">{totalNonDuplicate}</strong>
          </div>
          <div className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-md">
            <span className="text-indigo-700 font-sans mr-1.5">Top Score (8-10):</span>
            <strong className="text-indigo-900">{topScoreCount}</strong>
          </div>
          <div className="px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-md">
            <span className="text-rose-700 font-sans mr-1.5">Hot Leads:</span>
            <strong className="text-rose-800">{hotLeadCount}</strong>
          </div>
        </div>
      </div>

      {/* Global Search & Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Global Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone (+880...), or pipeline status..."
              className="w-full text-xs pl-9 pr-8 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear search query"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Saved filter views */}
          <SavedViewMenu
            views={savedViews}
            onSave={handleSaveView}
            onApply={handleApplyView}
            onDelete={handleDeleteView}
          />

          {/* Quick Filter Selectors */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Pipeline Status Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-slate-500 font-medium text-[11px]">Status:</span>
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="bg-transparent font-medium text-slate-800 focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Pipeline Statuses</option>
                <option value="new">New Inbound</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="consultation_booked">Consultation Booked</option>
                <option value="office_visit_booked">Office Visit Booked</option>
                <option value="office_visit_done">Visit Completed</option>
                <option value="paid">Paid Student</option>
                <option value="lost">Lost / Closed</option>
              </select>
            </div>

            {/* Counsellor Filter (managers/admins only — counsellor data is already self-scoped) */}
            {isManagerOrAdmin && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                <span className="text-slate-500 font-medium text-[11px]">Counsellor:</span>
                <select
                  value={filterOwner}
                  onChange={(e) => setFilterOwner(e.target.value)}
                  className="bg-transparent font-medium text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Counsellors</option>
                  {employees
                    .filter((e) => e.role === 'counsellor' || e.role === 'manager')
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name} ({e.role})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Urgency Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-slate-500 font-medium text-[11px]">Urgency:</span>
              <select
                value={filterTemp}
                onChange={(e) => setFilterTemp(e.target.value)}
                className="bg-transparent font-medium text-slate-800 focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Urgencies</option>
                <option value="hot">Hot (Score 70+)</option>
                <option value="warm">Warm (Score 40–69)</option>
                <option value="cold">Cold (&lt;40)</option>
              </select>
            </div>

            {/* Score Weight Filter (1-10) */}
            <div className="flex items-center gap-1.5 bg-indigo-50/70 border border-indigo-200 rounded-lg px-2 py-1">
              <span className="text-indigo-700 font-medium text-[11px]">Score Weight:</span>
              <select
                value={filterWeight}
                onChange={(e) => setFilterWeight(e.target.value)}
                className="bg-transparent font-semibold text-indigo-900 focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Weights (1-10)</option>
                <option value="high">High Priority (8–10)</option>
                <option value="medium">Medium Priority (5–7)</option>
                <option value="low">Low Priority (1–4)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filter Feedback Strip */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
            <span>
              Showing <strong className="text-slate-900">{totalMatchingLeads}</strong> of {totalNonDuplicate} leads across 8 pipeline columns
            </span>
            {isFilterActive && (
              <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-sans text-[11px] font-medium">
                Active Filter Applied
              </span>
            )}
          </div>

          {isFilterActive && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded text-xs font-medium border border-rose-200 transition-colors"
            >
              <X className="w-3 h-3" />
              <span>Clear filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Columns Container */}
      <div className="flex gap-4 overflow-x-auto pb-6 pt-1">
        {COLUMNS.map((col) => {
          const colLeads = leadsByColumn.get(col.id) ?? [];

          // Check if this column is explicitly selected or matches the stage filter
          const isColumnMatched =
            filterStage === 'all' ||
            (filterStage === 'consultation_booked' && col.id === 'consultation_booked') ||
            (filterStage === 'lost' && col.id === 'lost') ||
            col.id === filterStage;

          const isDropTarget = dragOverColumn === col.id && draggingLeadId !== null;

          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverColumn !== col.id) setDragOverColumn(col.id);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (dragOverColumn === col.id) setDragOverColumn(null);
              }}
              onDrop={(e) => handleDropOnColumn(e, col.id)}
              className={`w-72 shrink-0 flex flex-col rounded-xl border transition-all ${
                isDropTarget
                  ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-300 scale-[1.01]'
                  : !isColumnMatched && filterStage !== 'all'
                  ? 'opacity-60 bg-slate-50 border-slate-200'
                  : col.highlight
                  ? 'bg-blue-50/40 border-blue-200 shadow-xs ring-1 ring-blue-300'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              {/* Column Header */}
              <div className="p-3 border-b border-slate-200/80 bg-white/70 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">{col.label}</span>
                  <span
                    className={`font-mono text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                      colLeads.length > 0
                        ? 'bg-blue-100 text-blue-800 font-bold'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {colLeads.length}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{col.description}</p>
              </div>

              {/* Cards list */}
              <div className="p-2 space-y-2.5 flex-1 min-h-[500px] overflow-y-auto max-h-[70vh]">
                {colLeads.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    {isFilterActive ? 'No leads match filters' : 'No leads in this stage'}
                  </div>
                ) : (
                  colLeads.map((lead) => {
                    const owner = employeeById.get(lead.owner_id);
                    const isOverdue = isNextActionOverdue(lead);
                    const wResult =
                      weightByLeadId.get(lead.id) ??
                      getLeadScoreWeight(lead);

                    const daysDormant = dormantInfoByLeadId.get(lead.id) ?? 0;
                    const isDormant = daysDormant >= 3 && !['lost', 'enrolled'].includes(lead.stage);

                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', lead.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggingLeadId(lead.id);
                        }}
                        onDragEnd={() => {
                          setDraggingLeadId(null);
                          setDragOverColumn(null);
                        }}
                        onClick={() => onSelectLead(lead)}
                        className={`bg-white p-3 rounded-lg border border-slate-200 shadow-2xs hover:shadow-xs hover:border-blue-400 transition-all cursor-pointer group space-y-2 ${
                          draggingLeadId === lead.id ? 'opacity-40' : ''
                        }`}
                      >
                        {/* Dormancy Warning Pill */}
                        {isDormant && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <Sparkles className="w-3 h-3 text-blue-600 shrink-0" />
                            <span>{Math.floor(daysDormant)}d idle • Needs Follow-up</span>
                          </div>
                        )}

                        {/* Title & Score Weight (1-10) */}
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <h4 className="font-semibold text-xs text-slate-900 group-hover:text-blue-600 transition-colors">
                              {lead.full_name}
                            </h4>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3" />
                              <span>{lead.city}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end gap-1">
                            {/* Score Weight (1-10) Badge */}
                            <ScoreWeightBadge result={wResult} size="sm" />

                            <div className="flex items-center gap-1">
                              <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                                {lead.score}pt
                              </span>
                              <TemperaturePill temperature={lead.temperature} className="text-center" />
                            </div>
                          </div>
                        </div>

                        {/* Phone Number Display for Search Verification */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono bg-slate-50/60 px-2 py-1 rounded border border-slate-100">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{lead.phone_e164 || lead.phone_raw}</span>
                        </div>

                        {/* Target Degree */}
                        <div className="text-xs text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-100 font-medium">
                          <div className="line-clamp-1">{lead.target_degree}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {lead.target_intake}
                          </div>
                        </div>

                        {/* Scoring Breakdown Factors (Activity, Source, Profile) */}
                        <div
                          className="flex items-center justify-between text-[10px] text-slate-500 font-mono bg-slate-50/80 px-2 py-0.5 rounded border border-slate-100"
                          title={`Score Weight ${wResult.weight}/10:\nActivity: ${wResult.activityScore}/3.5\nSource: ${wResult.sourceScore}/3.0\nProfile: ${wResult.profileScore}/3.5`}
                        >
                          <span>Acts: <strong className="text-slate-700 font-semibold">{wResult.activityCount}</strong></span>
                          <span className="text-slate-300">·</span>
                          <span className="truncate max-w-[85px]">{wResult.sourceChannel.replace('_', ' ')}</span>
                          <span className="text-slate-300">·</span>
                          <span>Prof: <strong className="text-slate-700 font-semibold">{wResult.profileCompletionPercentage}%</strong></span>
                        </div>

                        {/* Next Action */}
                        <div className="text-[11px] pt-1 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Next:</span>
                          <span
                            className={`font-mono text-[11px] ${
                              isOverdue
                                ? 'text-rose-600 font-bold flex items-center gap-1'
                                : 'text-slate-600'
                            }`}
                          >
                            {isOverdue && <AlertTriangle className="w-3 h-3" />}
                            {formatBdDateTime(lead.next_action_at)}
                          </span>
                        </div>

                        {/* Owner & Quick Action footer */}
                        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                          <span className="truncate max-w-[110px]">
                            {owner?.full_name.split(' ')[0] || 'Unassigned'}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenWhatsAppScript(lead);
                              }}
                              className="p-1 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 rounded transition-colors"
                              title="Send WhatsApp Script"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                            </button>

                            {col.id !== 'enrolled' && col.id !== 'lost' && (
                              <button
                                type="button"
                                onClick={(e) => handleAdvance(e, lead)}
                                className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
                                title="Advance to next pipeline stage"
                              >
                                <span>Advance</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Lost reason prompt (drop / advance onto Lost) */}
      {lostTarget && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 max-w-md w-full shadow-xl space-y-4 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">
              Mark {lostTarget.full_name} as Lost
            </h3>
            <p className="text-xs text-slate-600">
              Select the primary reason why this lead did not convert — this feeds the daily lost-lead audit.
            </p>

            <form onSubmit={handleConfirmLost} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lost Reason *
                </label>
                <select
                  value={lostReasonId}
                  onChange={(e) => setLostReasonId(Number(e.target.value))}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white"
                >
                  {lostReasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Explanation Note
                </label>
                <textarea
                  rows={2}
                  value={lostNote}
                  onChange={(e) => setLostNote(e.target.value)}
                  placeholder="Specific student feedback..."
                  className="w-full text-xs p-2 border border-slate-200 rounded-md"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLostTarget(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md"
                >
                  Confirm Lost
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
