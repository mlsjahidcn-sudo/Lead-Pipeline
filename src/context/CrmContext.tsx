import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Employee,
  LeadSource,
  LostReason,
  Lead,
  LeadActivity,
  FollowUpTask,
  OfficeVisit,
  Payment,
  StageHistory,
  LeadStage,
  LeadTemperature,
  ActivityType,
  ActivityOutcome,
  VisitStatus,
  TaskPriority,
} from '../types';
import {
  INITIAL_EMPLOYEES,
  INITIAL_SOURCES,
  INITIAL_LOST_REASONS,
  INITIAL_LEADS,
  INITIAL_ACTIVITIES,
  INITIAL_TASKS,
  INITIAL_VISITS,
  INITIAL_PAYMENTS,
  INITIAL_STAGE_HISTORY,
} from '../data/mockData';
import {
  normalizeBdPhone,
  calculateLeadScore,
  calculateLeadScoreWeight,
  checkDuplicateLead,
} from '../utils/crm-logic';
import { LeadScoreWeightResult } from '../types';

interface CrmContextType {
  currentEmployee: Employee;
  setCurrentEmployee: (employee: Employee) => void;
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  sources: LeadSource[];
  lostReasons: LostReason[];
  leads: Lead[];
  activities: LeadActivity[];
  tasks: FollowUpTask[];
  visits: OfficeVisit[];
  payments: Payment[];
  stageHistory: StageHistory[];

  // Action methods
  createLead: (leadData: Partial<Lead>) => { success: boolean; leadId?: string; isDuplicate?: boolean; message?: string; matchedLead?: Lead };
  updateLead: (id: string, updates: Partial<Lead>, stageChangeNote?: string) => boolean;
  logInteraction: (data: {
    leadId: string;
    activityType: ActivityType;
    direction: 'outbound' | 'inbound';
    outcome: ActivityOutcome;
    summary: string;
    nextActionAt: string;
    nextActionNote?: string;
    taskIdToComplete?: string;
  }) => void;
  completeTask: (taskId: string, outcomeNote?: string) => void;
  reopenTask: (taskId: string) => void;
  updateTaskPriority: (taskId: string, priority: TaskPriority) => void;
  addQuickNote: (leadId: string, noteText: string) => void;
  scheduleFollowUpTask: (data: {
    leadId: string;
    assignedTo?: string;
    taskType: string;
    title: string;
    dueAt: string;
    priority?: TaskPriority;
    cadenceStep?: number;
  }) => FollowUpTask;
  batchScheduleFollowUpTasks: (
    tasksToCreate: Array<{
      leadId: string;
      assignedTo?: string;
      taskType: string;
      title: string;
      dueAt: string;
      priority?: TaskPriority;
      cadenceStep?: number;
    }>
  ) => number;
  bookOfficeVisit: (data: {
    leadId: string;
    scheduledAt: string;
    durationMin?: number;
    mode: 'office' | 'video';
    attendees: string;
    counsellorId: string;
    notes?: string;
  }) => void;
  updateVisitStatus: (visitId: string, status: VisitStatus, outcomeNote?: string) => void;
  recordPayment: (data: {
    leadId: string;
    package: 'guidance' | 'complete_admission';
    paymentType: 'package_fee' | 'deposit' | 'instalment';
    amount: number;
    currency?: string;
    method: string;
    receiptRef: string;
  }) => void;
  verifyPayment: (paymentId: string) => boolean;
  reassignLead: (leadId: string, newOwnerId: string) => void;
  toggleCounsellorAcceptingLeads: (employeeId: string) => void;
  mergeLeads: (survivingLeadId: string, duplicateLeadId: string) => void;
  simulateInboundLead: (channel: 'website_assessment' | 'webinar' | 'facebook_ads') => Lead;
  resetToDefaultData: () => void;
  getLeadScoreWeight: (lead: Lead) => LeadScoreWeightResult;
  calculateLeadWeight: (lead: Lead) => number;
}

const CrmContext = createContext<CrmContextType | undefined>(undefined);

export const CrmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('sica_crm_employees');
    return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
  });

  const [currentEmployee, setCurrentEmployee] = useState<Employee>(() => {
    return employees.find((e) => e.id === 'emp-jahid') || employees[0];
  });

  const [sources] = useState<LeadSource[]>(INITIAL_SOURCES);
  const [lostReasons] = useState<LostReason[]>(INITIAL_LOST_REASONS);

  const [leads, setLeads] = useState<Lead[]>(() => {
    const saved = localStorage.getItem('sica_crm_leads');
    const rawLeads: Lead[] = saved ? JSON.parse(saved) : INITIAL_LEADS;
    return rawLeads.map((l) => {
      const w = calculateLeadScoreWeight(l, INITIAL_ACTIVITIES, INITIAL_SOURCES).weight;
      return {
        ...l,
        score_weight: l.score_weight || w,
      };
    });
  });

  const [activities, setActivities] = useState<LeadActivity[]>(() => {
    const saved = localStorage.getItem('sica_crm_activities');
    return saved ? JSON.parse(saved) : INITIAL_ACTIVITIES;
  });

  const [tasks, setTasks] = useState<FollowUpTask[]>(() => {
    const saved = localStorage.getItem('sica_crm_tasks');
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [visits, setVisits] = useState<OfficeVisit[]>(() => {
    const saved = localStorage.getItem('sica_crm_visits');
    return saved ? JSON.parse(saved) : INITIAL_VISITS;
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    const saved = localStorage.getItem('sica_crm_payments');
    return saved ? JSON.parse(saved) : INITIAL_PAYMENTS;
  });

  const [stageHistory, setStageHistory] = useState<StageHistory[]>(() => {
    const saved = localStorage.getItem('sica_crm_stage_history');
    return saved ? JSON.parse(saved) : INITIAL_STAGE_HISTORY;
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('sica_crm_leads', JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    localStorage.setItem('sica_crm_activities', JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    localStorage.setItem('sica_crm_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('sica_crm_visits', JSON.stringify(visits));
  }, [visits]);

  useEffect(() => {
    localStorage.setItem('sica_crm_payments', JSON.stringify(payments));
  }, [payments]);

  useEffect(() => {
    localStorage.setItem('sica_crm_stage_history', JSON.stringify(stageHistory));
  }, [stageHistory]);

  useEffect(() => {
    localStorage.setItem('sica_crm_employees', JSON.stringify(employees));
  }, [employees]);

  // Round-robin assignment helper
  const getNextCounsellorId = (): string => {
    const eligible = employees.filter((e) => e.is_active && e.accepts_new_leads && e.role === 'counsellor');
    if (eligible.length === 0) {
      // Fallback to manager or first employee
      return employees[0].id;
    }
    // Sort by oldest last_assigned_at (nulls first)
    eligible.sort((a, b) => {
      if (!a.last_assigned_at) return -1;
      if (!b.last_assigned_at) return 1;
      return new Date(a.last_assigned_at).getTime() - new Date(b.last_assigned_at).getTime();
    });

    const selected = eligible[0];
    const nowIso = new Date().toISOString();
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === selected.id ? { ...emp, last_assigned_at: nowIso } : emp))
    );
    return selected.id;
  };

  // Create lead with phone normalisation, duplicate check & round-robin
  const createLead = (leadData: Partial<Lead>): { success: boolean; leadId?: string; isDuplicate?: boolean; message?: string; matchedLead?: Lead } => {
    const rawPhone = leadData.phone_raw || '';
    const norm = normalizeBdPhone(rawPhone);
    const phoneE164 = norm.e164 || (rawPhone.startsWith('+') ? rawPhone : null);
    const whatsappE164 = leadData.whatsapp_e164
      ? normalizeBdPhone(leadData.whatsapp_e164).e164 || leadData.whatsapp_e164
      : phoneE164;

    // Check duplicate
    const dupCheck = checkDuplicateLead(
      { phone: phoneE164 || undefined, whatsapp: whatsappE164 || undefined, email: leadData.email },
      leads
    );

    const now = new Date();
    const nowIso = now.toISOString();

    if (dupCheck.isDuplicate && dupCheck.matchedLead) {
      const existing = dupCheck.matchedLead;
      // If matching open lead: do not create new. Add re-enquiry activity, elevate temp, keep owner
      if (!['lost', 'nurture'].includes(existing.stage)) {
        const reEnquiryActivity: LeadActivity = {
          id: `act-${Date.now()}`,
          lead_id: existing.id,
          employee_id: currentEmployee.id,
          activity_type: 'system',
          outcome: 'replied',
          summary: `Re-enquiry inbound from ${leadData.full_name || 'student'}. Source: ${leadData.source_id || 'Direct'}`,
          occurred_at: nowIso,
          created_at: nowIso,
        };
        setActivities((prev) => [reEnquiryActivity, ...prev]);

        // Elevate temperature if cold
        const newTemp: LeadTemperature = existing.temperature === 'cold' ? 'warm' : existing.temperature;
        setLeads((prev) =>
          prev.map((l) => (l.id === existing.id ? { ...l, temperature: newTemp, updated_at: nowIso } : l))
        );

        return {
          success: true,
          leadId: existing.id,
          isDuplicate: true,
          matchedLead: existing,
          message: `Re-enquiry matched existing lead "${existing.full_name}". Timeline updated!`,
        };
      } else {
        // Match on Lost or Nurture: reopen to contacted
        const reopenActivity: LeadActivity = {
          id: `act-${Date.now()}`,
          lead_id: existing.id,
          employee_id: currentEmployee.id,
          activity_type: 'system',
          outcome: 'replied',
          summary: `Previously ${existing.stage.toUpperCase()} lead re-enquired! Reopened to Contacted stage.`,
          occurred_at: nowIso,
          created_at: nowIso,
        };
        setActivities((prev) => [reopenActivity, ...prev]);

        const nextActionIso = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        setLeads((prev) =>
          prev.map((l) =>
            l.id === existing.id
              ? {
                  ...l,
                  stage: 'contacted',
                  temperature: 'hot',
                  next_action_at: nextActionIso,
                  next_action_note: 'Reopened lead: Urgent follow-up needed',
                  updated_at: nowIso,
                }
              : l
          )
        );

        setStageHistory((prev) => [
          {
            id: `hist-${Date.now()}`,
            lead_id: existing.id,
            from_stage: existing.stage,
            to_stage: 'contacted',
            changed_by: currentEmployee.id,
            changed_at: nowIso,
            note: 'Reopened due to re-enquiry',
          },
          ...prev,
        ]);

        return {
          success: true,
          leadId: existing.id,
          isDuplicate: true,
          matchedLead: existing,
          message: `Reopened previous ${existing.stage} lead "${existing.full_name}" to Contacted.`,
        };
      }
    }

    // New lead creation
    const ownerId = leadData.owner_id || getNextCounsellorId();
    const scoreResult = calculateLeadScore(leadData);
    const newId = `lead-${Date.now()}`;

    // SLA clock starts: next_action_at = now + 2 working hours
    const defaultSlaNextAction = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const newLead: Lead = {
      id: newId,
      full_name: leadData.full_name || 'Anonymous Student',
      phone_raw: rawPhone,
      phone_e164: phoneE164 || '',
      whatsapp_e164: whatsappE164 || phoneE164 || '',
      email: leadData.email ? leadData.email.trim().toLowerCase() : '',
      city: leadData.city || 'Dhaka',
      country: leadData.country || 'BD',
      source_id: leadData.source_id || 'src-assessment',
      source_ref: leadData.source_ref || `manual_entry_${Date.now()}`,
      owner_id: ownerId,
      stage: 'new',
      temperature: scoreResult.temperature,
      score: scoreResult.score,
      education_level: leadData.education_level || 'HSC',
      last_result: leadData.last_result || 'GPA 4.50',
      target_degree: leadData.target_degree || 'Bachelor',
      target_programme: leadData.target_programme || 'Computer Science / Engineering',
      target_intake: leadData.target_intake || 'March 2027',
      english_level: leadData.english_level || 'Medium of Instruction',
      funding_confirmed: leadData.funding_confirmed ?? false,
      parent_involved: leadData.parent_involved ?? false,
      has_passport: leadData.has_passport ?? false,
      first_contact_at: null,
      next_action_at: leadData.next_action_at || defaultSlaNextAction,
      next_action_note: leadData.next_action_note || 'Initial call & WhatsApp (2h SLA)',
      created_at: nowIso,
      updated_at: nowIso,
    };

    const initialWeightResult = calculateLeadScoreWeight(newLead, [], sources);
    newLead.score_weight = initialWeightResult.weight;

    setLeads((prev) => [newLead, ...prev]);

    // Cadence Tasks Generation (Day 0, Day 1, Day 3)
    const cadenceTasks: FollowUpTask[] = [
      {
        id: `task-${Date.now()}-0`,
        lead_id: newId,
        assigned_to: ownerId,
        task_type: 'call',
        cadence_step: 0,
        due_at: defaultSlaNextAction,
        status: 'open',
        priority: 'high',
        title: 'Day 0: First call & WhatsApp attempt (SLA: 2 hours)',
        created_at: nowIso,
      },
      {
        id: `task-${Date.now()}-1`,
        lead_id: newId,
        assigned_to: ownerId,
        task_type: 'whatsapp',
        cadence_step: 1,
        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'open',
        priority: 'medium',
        title: 'Day 1: Free Consultation & Webinar invitation',
        created_at: nowIso,
      },
      {
        id: `task-${Date.now()}-3`,
        lead_id: newId,
        assigned_to: ownerId,
        task_type: 'call',
        cadence_step: 3,
        due_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        status: 'open',
        priority: 'medium',
        title: 'Day 3: University matching & Scholarship deadlines check',
        created_at: nowIso,
      },
    ];
    setTasks((prev) => [...cadenceTasks, ...prev]);

    // Record stage history
    setStageHistory((prev) => [
      {
        id: `hist-${Date.now()}`,
        lead_id: newId,
        from_stage: null,
        to_stage: 'new',
        changed_by: currentEmployee.id,
        changed_at: nowIso,
        note: 'Lead captured & assigned via round-robin',
      },
      ...prev,
    ]);

    return { success: true, leadId: newId, isDuplicate: false };
  };

  // Update lead
  const updateLead = (id: string, updates: Partial<Lead>, stageChangeNote?: string): boolean => {
    const existing = leads.find((l) => l.id === id);
    if (!existing) return false;

    const merged = { ...existing, ...updates };
    const scoreResult = calculateLeadScore(merged);
    const nowIso = new Date().toISOString();

    const stageChanged = updates.stage && updates.stage !== existing.stage;
    const newStage = updates.stage || existing.stage;

    // Record stage history if changed
    if (stageChanged && updates.stage) {
      setStageHistory((prev) => [
        {
          id: `hist-${Date.now()}`,
          lead_id: id,
          from_stage: existing.stage,
          to_stage: updates.stage as LeadStage,
          changed_by: currentEmployee.id,
          changed_at: nowIso,
          note: stageChangeNote || `Stage moved to ${updates.stage}`,
        },
        ...prev,
      ]);
    }

    setLeads((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          const updatedCandidate: Lead = {
            ...merged,
            score: scoreResult.score,
            temperature: updates.temperature || scoreResult.temperature,
            stage: newStage,
            updated_at: nowIso,
          };
          const dynamicWeight = calculateLeadScoreWeight(updatedCandidate, activities, sources).weight;
          return {
            ...updatedCandidate,
            score_weight: dynamicWeight,
          };
        }
        return l;
      })
    );

    return true;
  };

  // Log interaction (Outcome & Next Action are required by system rules)
  const logInteraction = (data: {
    leadId: string;
    activityType: ActivityType;
    direction: 'outbound' | 'inbound';
    outcome: ActivityOutcome;
    summary: string;
    nextActionAt: string;
    nextActionNote?: string;
    taskIdToComplete?: string;
  }) => {
    const nowIso = new Date().toISOString();
    const newActivity: LeadActivity = {
      id: `act-${Date.now()}`,
      lead_id: data.leadId,
      employee_id: currentEmployee.id,
      activity_type: data.activityType,
      direction: data.direction,
      outcome: data.outcome,
      summary: data.summary,
      next_action_at: data.nextActionAt,
      next_action_note: data.nextActionNote,
      occurred_at: nowIso,
      created_at: nowIso,
    };

    setActivities((prev) => [newActivity, ...prev]);

    // Update lead's next action & first contact timestamp if in 'new'
    const lead = leads.find((l) => l.id === data.leadId);
    if (lead) {
      const isFirstContact = !lead.first_contact_at && data.direction === 'outbound';
      const newStage = lead.stage === 'new' && isFirstContact ? 'contacted' : lead.stage;

      setLeads((prev) =>
        prev.map((l) => {
          if (l.id === data.leadId) {
            const nextCandidate: Lead = {
              ...l,
              stage: newStage,
              first_contact_at: isFirstContact ? nowIso : l.first_contact_at,
              next_action_at: data.nextActionAt,
              next_action_note: data.nextActionNote || l.next_action_note,
              updated_at: nowIso,
            };
            const dynamicWeight = calculateLeadScoreWeight(
              nextCandidate,
              [newActivity, ...activities],
              sources
            ).weight;
            return {
              ...nextCandidate,
              score_weight: dynamicWeight,
            };
          }
          return l;
        })
      );

      if (newStage !== lead.stage) {
        setStageHistory((prev) => [
          {
            id: `hist-${Date.now()}`,
            lead_id: data.leadId,
            from_stage: lead.stage,
            to_stage: newStage,
            changed_by: currentEmployee.id,
            changed_at: nowIso,
            note: 'First contact attempt logged',
          },
          ...prev,
        ]);
      }
    }

    // Complete task if specified
    if (data.taskIdToComplete) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === data.taskIdToComplete ? { ...t, status: 'done', completed_at: nowIso, activity_id: newActivity.id } : t
        )
      );
    }
  };

  // Mark a task as completed directly with 1-click
  const completeTask = (taskId: string, outcomeNote?: string) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    const nowIso = new Date().toISOString();
    const actId = `act-${Date.now()}`;
    const activitySummary = outcomeNote
      ? `Completed follow-up task "${targetTask.title}": ${outcomeNote}`
      : `Completed follow-up task: "${targetTask.title}"`;

    const newActivity: LeadActivity = {
      id: actId,
      lead_id: targetTask.lead_id,
      employee_id: currentEmployee.id,
      activity_type: (targetTask.task_type as any) || 'call',
      direction: 'outbound',
      outcome: 'connected',
      summary: activitySummary,
      next_action_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      next_action_note: 'Routine cadence follow-up',
      occurred_at: nowIso,
      created_at: nowIso,
    };

    setActivities((prev) => [newActivity, ...prev]);

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: 'done',
              completed_at: nowIso,
              activity_id: actId,
            }
          : t
      )
    );

    // Update lead's next action date if currently pointing to this task
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id === targetTask.lead_id) {
          return {
            ...l,
            next_action_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            next_action_note: 'Routine cadence follow-up',
            updated_at: nowIso,
          };
        }
        return l;
      })
    );
  };

  // Reopen a previously completed task (undo)
  const reopenTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'open', completed_at: undefined } : t))
    );
  };

  // Update a task priority (Low, Medium, High)
  const updateTaskPriority = (taskId: string, priority: TaskPriority) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, priority } : t))
    );
  };

  // Add quick internal note to lead
  const addQuickNote = (leadId: string, noteText: string) => {
    if (!noteText.trim()) return;
    const nowIso = new Date().toISOString();
    const newActivity: LeadActivity = {
      id: `note-${Date.now()}`,
      lead_id: leadId,
      employee_id: currentEmployee.id,
      activity_type: 'note',
      direction: undefined,
      outcome: undefined,
      summary: noteText.trim(),
      occurred_at: nowIso,
      created_at: nowIso,
    };
    setActivities((prev) => [newActivity, ...prev]);
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, updated_at: nowIso } : l))
    );
  };

  // Schedule a follow-up task (automated or manual)
  const scheduleFollowUpTask = (data: {
    leadId: string;
    assignedTo?: string;
    taskType: string;
    title: string;
    dueAt: string;
    priority?: TaskPriority;
    cadenceStep?: number;
  }): FollowUpTask => {
    const targetLead = leads.find((l) => l.id === data.leadId);
    const assignedTo = data.assignedTo || targetLead?.owner_id || currentEmployee.id;
    const nowIso = new Date().toISOString();
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const newTask: FollowUpTask = {
      id: taskId,
      lead_id: data.leadId,
      assigned_to: assignedTo,
      task_type: data.taskType,
      title: data.title,
      due_at: data.dueAt,
      status: 'open',
      priority: data.priority || 'medium',
      cadence_step: data.cadenceStep ?? 3,
      created_at: nowIso,
    };

    setTasks((prev) => [newTask, ...prev]);

    // Also update lead's next action date and note so pipeline view is consistent
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id === data.leadId) {
          return {
            ...l,
            next_action_at: data.dueAt,
            next_action_note: data.title,
            updated_at: nowIso,
          };
        }
        return l;
      })
    );

    // Record system activity audit log
    const newActivity: LeadActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      lead_id: data.leadId,
      employee_id: currentEmployee.id,
      activity_type: 'system',
      summary: `Automated Cadence: Scheduled follow-up "${data.title}" due ${new Date(data.dueAt).toLocaleString()}`,
      next_action_at: data.dueAt,
      next_action_note: data.title,
      occurred_at: nowIso,
      created_at: nowIso,
    };
    setActivities((prev) => [newActivity, ...prev]);

    return newTask;
  };

  // Batch schedule multiple follow-up tasks (e.g. 1-click auto-schedule all dormant suggestions)
  const batchScheduleFollowUpTasks = (
    tasksToCreate: Array<{
      leadId: string;
      assignedTo?: string;
      taskType: string;
      title: string;
      dueAt: string;
      priority?: TaskPriority;
      cadenceStep?: number;
    }>
  ): number => {
    if (!tasksToCreate.length) return 0;
    const nowIso = new Date().toISOString();
    const createdTasks: FollowUpTask[] = [];
    const createdActivities: LeadActivity[] = [];
    const leadUpdatesMap = new Map<string, { dueAt: string; note: string }>();

    tasksToCreate.forEach((t, idx) => {
      const targetLead = leads.find((l) => l.id === t.leadId);
      const assignedTo = t.assignedTo || targetLead?.owner_id || currentEmployee.id;
      const taskId = `task-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`;

      createdTasks.push({
        id: taskId,
        lead_id: t.leadId,
        assigned_to: assignedTo,
        task_type: t.taskType,
        title: t.title,
        due_at: t.dueAt,
        status: 'open',
        priority: t.priority || 'medium',
        cadence_step: t.cadenceStep ?? 3,
        created_at: nowIso,
      });

      createdActivities.push({
        id: `act-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        lead_id: t.leadId,
        employee_id: currentEmployee.id,
        activity_type: 'system',
        summary: `Automated Cadence: Auto-scheduled follow-up "${t.title}" due ${new Date(t.dueAt).toLocaleString()}`,
        next_action_at: t.dueAt,
        next_action_note: t.title,
        occurred_at: nowIso,
        created_at: nowIso,
      });

      leadUpdatesMap.set(t.leadId, { dueAt: t.dueAt, note: t.title });
    });

    setTasks((prev) => [...createdTasks, ...prev]);
    setActivities((prev) => [...createdActivities, ...prev]);
    setLeads((prev) =>
      prev.map((l) => {
        const update = leadUpdatesMap.get(l.id);
        if (update) {
          return {
            ...l,
            next_action_at: update.dueAt,
            next_action_note: update.note,
            updated_at: nowIso,
          };
        }
        return l;
      })
    );

    return createdTasks.length;
  };

  // Book office visit
  const bookOfficeVisit = (data: {
    leadId: string;
    scheduledAt: string;
    durationMin?: number;
    mode: 'office' | 'video';
    attendees: string;
    counsellorId: string;
    notes?: string;
  }) => {
    const nowIso = new Date().toISOString();
    const newVisit: OfficeVisit = {
      id: `visit-${Date.now()}`,
      lead_id: data.leadId,
      counsellor_id: data.counsellorId,
      scheduled_at: data.scheduledAt,
      duration_min: data.durationMin || 45,
      mode: data.mode,
      attendees: data.attendees,
      status: 'booked',
      outcome_note: data.notes,
      created_at: nowIso,
    };

    setVisits((prev) => [newVisit, ...prev]);

    // Update lead stage to office_visit_booked and elevate temperature to Hot
    updateLead(
      data.leadId,
      {
        stage: 'office_visit_booked',
        temperature: 'hot',
        next_action_at: data.scheduledAt,
        next_action_note: `Office visit with ${data.attendees}`,
      },
      `Office visit scheduled for ${new Date(data.scheduledAt).toLocaleString()}`
    );

    // Create follow-up task
    setTasks((prev) => [
      {
        id: `task-${Date.now()}`,
        lead_id: data.leadId,
        assigned_to: data.counsellorId,
        task_type: 'office_visit',
        due_at: data.scheduledAt,
        status: 'open',
        priority: 'high',
        title: `Conduct ${data.mode} visit with ${data.attendees}`,
        created_at: nowIso,
      },
      ...prev,
    ]);

    // Log activity
    setActivities((prev) => [
      {
        id: `act-${Date.now()}`,
        lead_id: data.leadId,
        employee_id: currentEmployee.id,
        activity_type: 'office_visit',
        direction: 'inbound',
        outcome: 'booked',
        summary: `Booked office visit for ${new Date(data.scheduledAt).toLocaleDateString('en-GB')}. Attendees: ${data.attendees}`,
        next_action_at: data.scheduledAt,
        next_action_note: `Prepare university list for meeting`,
        occurred_at: nowIso,
        created_at: nowIso,
      },
      ...prev,
    ]);
  };

  // Update visit status (Attended, No-Show, Confirmed, etc.)
  const updateVisitStatus = (visitId: string, status: VisitStatus, outcomeNote?: string) => {
    const nowIso = new Date().toISOString();
    const targetVisit = visits.find((v) => v.id === visitId);
    if (!targetVisit) return;

    setVisits((prev) =>
      prev.map((v) => (v.id === visitId ? { ...v, status, outcome_note: outcomeNote || v.outcome_note } : v))
    );

    if (status === 'attended') {
      // Rule: After every visit, set decision follow-up within 24 hours
      const decisionDueIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      updateLead(
        targetVisit.lead_id,
        {
          stage: 'office_visit_done',
          temperature: 'hot',
          next_action_at: decisionDueIso,
          next_action_note: '24-hour post-visit decision follow-up',
        },
        'Office visit attended successfully'
      );

      // Create decision task
      setTasks((prev) => [
        {
          id: `task-${Date.now()}`,
          lead_id: targetVisit.lead_id,
          assigned_to: targetVisit.counsellor_id,
          task_type: 'call',
          due_at: decisionDueIso,
          status: 'open',
          priority: 'high',
          title: '24-hour decision follow-up with student/parent',
          created_at: nowIso,
        },
        ...prev,
      ]);
    } else if (status === 'no_show') {
      // No-show recovery: message within 30 mins, offer 2 new slots
      const recoveryTaskIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      setTasks((prev) => [
        {
          id: `task-${Date.now()}`,
          lead_id: targetVisit.lead_id,
          assigned_to: targetVisit.counsellor_id,
          task_type: 'whatsapp',
          due_at: recoveryTaskIso,
          status: 'open',
          priority: 'high',
          title: 'No-show recovery: Send missed visit message on WhatsApp',
          created_at: nowIso,
        },
        ...prev,
      ]);
    }
  };

  // Record payment
  const recordPayment = (data: {
    leadId: string;
    package: 'guidance' | 'complete_admission';
    paymentType: 'package_fee' | 'deposit' | 'instalment';
    amount: number;
    currency?: string;
    method: string;
    receiptRef: string;
  }) => {
    const nowIso = new Date().toISOString();
    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      lead_id: data.leadId,
      package: data.package,
      payment_type: data.paymentType,
      amount: data.amount,
      currency: data.currency || 'BDT',
      paid_at: nowIso,
      method: data.method,
      receipt_ref: data.receiptRef,
      recorded_by: currentEmployee.id,
      verified_by: currentEmployee.role === 'admin' || currentEmployee.role === 'manager' ? currentEmployee.id : undefined,
      verified_at: currentEmployee.role === 'admin' || currentEmployee.role === 'manager' ? nowIso : undefined,
    };

    setPayments((prev) => [newPayment, ...prev]);

    // Move lead to paid stage
    updateLead(
      data.leadId,
      {
        stage: 'paid',
        temperature: 'hot',
        next_action_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        next_action_note: 'Submit application dossier to university portal',
      },
      `Payment received: ${data.amount} BDT for ${data.package} package (${data.receiptRef})`
    );
  };

  // Verify payment (Manager/Admin only)
  const verifyPayment = (paymentId: string): boolean => {
    if (currentEmployee.role !== 'admin' && currentEmployee.role !== 'manager') {
      return false;
    }
    const nowIso = new Date().toISOString();
    setPayments((prev) =>
      prev.map((p) => (p.id === paymentId ? { ...p, verified_by: currentEmployee.id, verified_at: nowIso } : p))
    );
    return true;
  };

  // Reassign lead
  const reassignLead = (leadId: string, newOwnerId: string) => {
    const nowIso = new Date().toISOString();
    const newOwner = employees.find((e) => e.id === newOwnerId);
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, owner_id: newOwnerId, updated_at: nowIso } : l))
    );
    // Reassign open tasks
    setTasks((prev) =>
      prev.map((t) => (t.lead_id === leadId && t.status === 'open' ? { ...t, assigned_to: newOwnerId } : t))
    );
    // Log reassignment activity
    setActivities((prev) => [
      {
        id: `act-${Date.now()}`,
        lead_id: leadId,
        employee_id: currentEmployee.id,
        activity_type: 'system',
        summary: `Lead reassigned to ${newOwner?.full_name || 'new counsellor'} by ${currentEmployee.full_name}`,
        occurred_at: nowIso,
        created_at: nowIso,
      },
      ...prev,
    ]);
  };

  // Toggle accepting leads
  const toggleCounsellorAcceptingLeads = (employeeId: string) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === employeeId ? { ...e, accepts_new_leads: !e.accepts_new_leads } : e))
    );
  };

  // Merge leads (Admin/Manager action)
  const mergeLeads = (survivingLeadId: string, duplicateLeadId: string) => {
    const nowIso = new Date().toISOString();
    // Move all child records
    setActivities((prev) =>
      prev.map((a) => (a.lead_id === duplicateLeadId ? { ...a, lead_id: survivingLeadId } : a))
    );
    setTasks((prev) =>
      prev.map((t) => (t.lead_id === duplicateLeadId ? { ...t, lead_id: survivingLeadId } : t))
    );
    setVisits((prev) =>
      prev.map((v) => (v.lead_id === duplicateLeadId ? { ...v, lead_id: survivingLeadId } : v))
    );
    setPayments((prev) =>
      prev.map((p) => (p.lead_id === duplicateLeadId ? { ...p, lead_id: survivingLeadId } : p))
    );

    // Mark duplicate lead
    setLeads((prev) =>
      prev.map((l) =>
        l.id === duplicateLeadId
          ? { ...l, duplicate_of: survivingLeadId, stage: 'lost', lost_reason_id: 6, lost_note: `Merged into ${survivingLeadId}`, updated_at: nowIso }
          : l
      )
    );

    setActivities((prev) => [
      {
        id: `act-${Date.now()}`,
        lead_id: survivingLeadId,
        employee_id: currentEmployee.id,
        activity_type: 'system',
        summary: `Merged duplicate lead record (${duplicateLeadId}) into this lead.`,
        occurred_at: nowIso,
        created_at: nowIso,
      },
      ...prev,
    ]);
  };

  // Simulate Inbound Lead (for live demonstration)
  const simulateInboundLead = (channel: 'website_assessment' | 'webinar' | 'facebook_ads'): Lead => {
    const mockNames = [
      'Tanvir Hasan Chowdhury',
      'Fariha Noshin',
      'Md. Shakil Mia',
      'Ayesha Siddiqua',
      'Tasnim Mahmud Niloy',
      'Raihan Kabir',
    ];
    const mockCities = ['Dhaka (Uttara)', 'Chittagong', 'Sylhet', 'Rajshahi', 'Comilla'];
    const mockDegrees = ['MBBS (Clinical Medicine)', 'B.Sc in Software Engineering', 'Civil Engineering (Tongji)', 'International Business'];
    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
    const randomCity = mockCities[Math.floor(Math.random() * mockCities.length)];
    const randomDegree = mockDegrees[Math.floor(Math.random() * mockDegrees.length)];
    const randomNum = Math.floor(10000000 + Math.random() * 90000000);
    const phoneRaw = `017${randomNum.toString().substring(0, 8)}`;

    const sourceId =
      channel === 'website_assessment' ? 'src-assessment' : channel === 'webinar' ? 'src-webinar' : 'src-meta';

    const leadData: Partial<Lead> = {
      full_name: randomName,
      phone_raw: phoneRaw,
      whatsapp_e164: `+880${phoneRaw.substring(1)}`,
      email: `${randomName.toLowerCase().replace(/[^a-z]/g, '')}${Math.floor(Math.random() * 99)}@gmail.com`,
      city: randomCity,
      country: 'BD',
      source_id: sourceId,
      source_ref: `${channel}_sim_${Date.now()}`,
      education_level: 'HSC Science 2026',
      last_result: 'GPA 5.00',
      target_degree: randomDegree,
      target_programme: 'English Medium Programme',
      target_intake: 'March 2027',
      funding_confirmed: true,
      parent_involved: true,
      has_passport: true,
    };

    const res = createLead(leadData);
    const created = leads.find((l) => l.id === res.leadId) || ({} as Lead);
    return created;
  };

  // Dynamic Lead Scoring Algorithm (1-10 weight based on activity frequency, lead source, and profile completion)
  const getLeadScoreWeight = (lead: Lead): LeadScoreWeightResult => {
    return calculateLeadScoreWeight(lead, activities, sources);
  };

  const calculateLeadWeight = (lead: Lead): number => {
    return calculateLeadScoreWeight(lead, activities, sources).weight;
  };

  // Reset to default
  const resetToDefaultData = () => {
    localStorage.removeItem('sica_crm_leads');
    localStorage.removeItem('sica_crm_activities');
    localStorage.removeItem('sica_crm_tasks');
    localStorage.removeItem('sica_crm_visits');
    localStorage.removeItem('sica_crm_payments');
    localStorage.removeItem('sica_crm_stage_history');
    localStorage.removeItem('sica_crm_employees');

    const initialWithWeights = INITIAL_LEADS.map((l) => ({
      ...l,
      score_weight: calculateLeadScoreWeight(l, INITIAL_ACTIVITIES, INITIAL_SOURCES).weight,
    }));

    setLeads(initialWithWeights);
    setActivities(INITIAL_ACTIVITIES);
    setTasks(INITIAL_TASKS);
    setVisits(INITIAL_VISITS);
    setPayments(INITIAL_PAYMENTS);
    setStageHistory(INITIAL_STAGE_HISTORY);
    setEmployees(INITIAL_EMPLOYEES);
    setCurrentEmployee(INITIAL_EMPLOYEES[0]);
  };

  return (
    <CrmContext.Provider
      value={{
        currentEmployee,
        setCurrentEmployee,
        employees,
        setEmployees,
        sources,
        lostReasons,
        leads,
        activities,
        tasks,
        visits,
        payments,
        stageHistory,
        createLead,
        updateLead,
        logInteraction,
        completeTask,
        reopenTask,
        updateTaskPriority,
        addQuickNote,
        scheduleFollowUpTask,
        batchScheduleFollowUpTasks,
        bookOfficeVisit,
        updateVisitStatus,
        recordPayment,
        verifyPayment,
        reassignLead,
        toggleCounsellorAcceptingLeads,
        mergeLeads,
        simulateInboundLead,
        resetToDefaultData,
        getLeadScoreWeight,
        calculateLeadWeight,
      }}
    >
      {children}
    </CrmContext.Provider>
  );
};

export const useCrm = () => {
  const context = useContext(CrmContext);
  if (!context) {
    throw new Error('useCrm must be used within a CrmProvider');
  }
  return context;
};
