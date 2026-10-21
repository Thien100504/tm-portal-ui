import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Workflow, Plus, Zap, ChevronDown, Trash2, Pencil,
  ToggleLeft, ArrowRight, X, Loader2,
  CheckSquare, Flag, UserCheck, AlertCircle, RefreshCw,
  Sparkles, Copy, Check, MessageSquare, Clock, Unlock, Bot, UserPlus, Bell
} from 'lucide-react';
import { toast } from 'sonner';
import automationService from '@/services/automationService';
import projectService from '@/services/projectService';
import sprintService from '@/services/sprintService';

import { Card, MotionCard } from '@/components/ui/Card';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Modal } from '@/components/ui/Modal';

// ── Config ────────────────────────────────────────────────────────────────────

const TRIGGERS = [
  {
    id: 'task.created',
    labelKey: 'automationPage.triggers.task.created',
    icon: Plus,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    hasValue: false,
  },
  {
    id: 'task.status_changed',
    labelKey: 'automationPage.triggers.task.status_changed',
    icon: RefreshCw,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    hasValue: true,
    valueType: 'status',
    conditionKey: 'to_status',
  },
  {
    id: 'task.assigned',
    labelKey: 'automationPage.triggers.task.assigned',
    icon: UserCheck,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    hasValue: false,
  },
  {
    id: 'task.priority_changed',
    labelKey: 'automationPage.triggers.task.priority_changed',
    icon: Flag,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    hasValue: true,
    valueType: 'priority',
    conditionKey: 'to_priority',
  },
  {
    id: 'task.unblocked',
    labelKey: 'automationPage.triggers.task.unblocked',
    icon: Unlock,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    hasValue: false,
  },
  {
    id: 'task.due_soon',
    labelKey: 'automationPage.triggers.task.due_soon',
    icon: Clock,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    hasValue: false,
  },
  {
    id: 'task.overdue',
    labelKey: 'automationPage.triggers.task.overdue',
    icon: AlertCircle,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    hasValue: false,
  },
  {
    id: 'task.stale',
    labelKey: 'automationPage.triggers.task.stale',
    icon: RefreshCw,
    color: 'text-muted-foreground',
    bg: 'bg-muted/10',
    hasValue: false,
  },
];

const ACTIONS = [
  {
    id: 'set_status',
    labelKey: 'automationPage.actions.set_status',
    icon: CheckSquare,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    hasValue: true,
    valueType: 'status',
  },
  {
    id: 'set_priority',
    labelKey: 'automationPage.actions.set_priority',
    icon: Flag,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    hasValue: true,
    valueType: 'priority',
  },
  {
    id: 'assign_to_sprint',
    labelKey: 'automationPage.actions.assign_to_sprint',
    icon: Zap,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    hasValue: true,
    valueType: 'sprint',
  },
  {
    id: 'remove_from_sprint',
    labelKey: 'automationPage.actions.remove_from_sprint',
    icon: X,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    hasValue: false,
  },
  {
    id: 'add_comment',
    labelKey: 'automationPage.actions.add_comment',
    icon: MessageSquare,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    hasValue: true,
    valueType: 'text',
  },
  {
    id: 'reassign',
    labelKey: 'automationPage.actions.reassign',
    icon: UserPlus,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    hasValue: true,
    valueType: 'user',
  },
  {
    id: 'ai_generate_subtasks',
    labelKey: 'automationPage.actions.ai_generate_subtasks',
    icon: Bot,
    color: 'text-[color:var(--color-ai)]',
    bg: 'bg-[color:var(--color-ai)]/10',
    hasValue: false,
  },
  {
    id: 'ai_auto_estimate',
    labelKey: 'automationPage.actions.ai_auto_estimate',
    icon: Bot,
    color: 'text-[color:var(--color-ai)]',
    bg: 'bg-[color:var(--color-ai)]/10',
    hasValue: false,
  },
  {
    id: 'set_deadline',
    labelKey: 'automationPage.actions.set_deadline',
    icon: Clock,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    hasValue: true,
    valueType: 'number',
  },
  {
    id: 'send_custom_notification',
    labelKey: 'automationPage.actions.send_custom_notification',
    icon: Bell,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    hasValue: true,
    valueType: 'text',
  },
];

const STATUS_OPTIONS = [
  { value: 'todo',        labelKey: 'dashboard.status.todo',       dot: 'bg-muted-foreground/40' },
  { value: 'in_progress', labelKey: 'dashboard.status.in_progress',  dot: 'bg-[color:var(--color-ai)]' },
  { value: 'review',      labelKey: 'dashboard.status.review',       dot: 'bg-amber-500' },
  { value: 'done',        labelKey: 'dashboard.status.done',         dot: 'bg-emerald-500' },
];

const PRIORITY_OPTIONS = [
  { value: 'low',    labelKey: 'kanban.card.priority.low',       dot: 'bg-emerald-500' },
  { value: 'medium', labelKey: 'kanban.card.priority.medium', dot: 'bg-amber-500' },
  { value: 'high',   labelKey: 'kanban.card.priority.high',        dot: 'bg-red-500' },
];

const TEMPLATES = [
  {
    name: 'Task done → Lower priority', nameKey: 'automationPage.tpl_done_low_priority',
    trigger_event: 'task.status_changed',
    conditions: { to_status: 'done' },
    actions: { type: 'set_priority', value: 'low' },
  },
  {
    name: 'Task assigned → Move to In Progress', nameKey: 'automationPage.tpl_assigned_in_progress',
    trigger_event: 'task.assigned',
    conditions: null,
    actions: { type: 'set_status', value: 'in_progress' },
  },
  {
    name: 'New task → Remove from sprint', nameKey: 'automationPage.tpl_created_remove_sprint',
    trigger_event: 'task.created',
    conditions: null,
    actions: { type: 'remove_from_sprint' },
  },
  {
    name: 'High priority → Move to Review', nameKey: 'automationPage.tpl_high_to_review',
    trigger_event: 'task.priority_changed',
    conditions: { to_priority: 'high' },
    actions: { type: 'set_status', value: 'review' },
  },
];

// ── Small helpers ─────────────────────────────────────────────────────────────

function getTrigger(id) { return TRIGGERS.find(t => t.id === id); }
function getAction(id) { return ACTIONS.find(a => a.id === id); }

function triggerLabel(rule, t) {
  const trig = getTrigger(rule.trigger_event);
  if (!trig) return rule.trigger_event;
  const cond = rule.conditions || {};
  if (trig.conditionKey && cond[trig.conditionKey]) {
    const val = cond[trig.conditionKey];
    const opt = [...STATUS_OPTIONS, ...PRIORITY_OPTIONS].find(o => o.value === val);
    return `${t(trig.labelKey)} "${opt ? t(opt.labelKey) : val}"`;
  }
  return t(trig.labelKey);
}

function actionLabel(rule, members = [], sprints = [], t) {
  const a = getAction(rule.actions?.type);
  if (!a) return rule.actions?.type || '?';
  const val = rule.actions?.value;
  if (!val) return t(a.labelKey);
  
  if (a.valueType === 'user') {
    const mem = members.find(m => m.user_id === val);
    return `${t(a.labelKey)} "${mem?.user?.full_name || mem?.user?.email || 'User'}"`;
  }
  if (a.valueType === 'sprint') {
    const sprint = sprints.find(s => s.id === val);
    return `${t(a.labelKey)} "${sprint?.name || 'Sprint'}"`;
  }
  if (a.valueType === 'number') {
    return `${t(a.labelKey)} ${val}`;
  }
  if (a.valueType === 'text') {
    return `${t(a.labelKey)} "${val}"`;
  }
  
  const opt = [...STATUS_OPTIONS, ...PRIORITY_OPTIONS].find(o => o.value === val);
  return `${t(a.labelKey)} "${opt ? t(opt.labelKey) : val}"`;
}

// ── Mini Dropdown ─────────────────────────────────────────────────────────────

function MiniSelect({ value, onChange, options, placeholder, t }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card text-[12px] text-foreground hover:bg-muted/50 transition-colors min-w-[110px] w-full"
      >
        {selected && <span className={`w-2 h-2 rounded-full shrink-0 ${selected.dot || ''}`} />}
        <span className="flex-1 text-left truncate">{selected ? (selected.label || t(selected.labelKey)) : placeholder}</span>
        <ChevronDown className={`w-3 h-3 text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 mt-1 w-full bg-card border border-border rounded-xl shadow-xl z-50 py-1 min-w-[140px]"
            onMouseLeave={() => setOpen(false)}
          >
            {options.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-left hover:bg-muted/50 transition-colors ${
                  o.value === value ? 'text-[color:var(--color-ai)] font-semibold' : 'text-foreground'
                }`}
              >
                {o.dot && <span className={`w-2 h-2 rounded-full ${o.dot}`} />}
                {o.label || (o.labelKey ? t(o.labelKey) : o.value)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Rule Builder Modal ────────────────────────────────────────────────────────

function RuleModal({ rule, sprints = [], members = [], onClose, onSave, isSaving }) {
  const { t } = useTranslation();
  const isEdit = !!rule?.id;

  const [name, setName] = useState(rule?.name || '');
  const [triggerId, setTriggerId] = useState(rule?.trigger_event || 'task.status_changed');
  const [triggerValue, setTriggerValue] = useState(() => {
    if (!rule?.conditions) return '';
    const triggerObj = getTrigger(rule.trigger_event);
    return triggerObj?.conditionKey ? (rule.conditions[triggerObj.conditionKey] || '') : '';
  });
  const [actionId, setActionId] = useState(rule?.actions?.type || 'set_status');
  const [actionValue, setActionValue] = useState(rule?.actions?.value || '');

  const trigger = getTrigger(triggerId);
  const action = getAction(actionId);

  const generateDefaultName = () => {
    let tStr = trigger?.labelKey ? t(trigger.labelKey) : '';
    if (trigger?.hasValue && triggerValue) {
      const opts = trigger.valueType === 'status' ? STATUS_OPTIONS : PRIORITY_OPTIONS;
      const opt = opts.find(o => o.value === triggerValue);
      if (opt) tStr += ` ${t(opt.labelKey)}`;
    }
    
    let aStr = action?.labelKey ? t(action.labelKey) : '';
    if (action?.hasValue && actionValue) {
      if (action.valueType === 'status' || action.valueType === 'priority') {
        const opts = action.valueType === 'status' ? STATUS_OPTIONS : PRIORITY_OPTIONS;
        const opt = opts.find(o => o.value === actionValue);
        if (opt) aStr += ` ${t(opt.labelKey)}`;
      } else if (action.valueType === 'user') {
        const mem = members.find(m => m.user_id === actionValue);
        if (mem) aStr += ` ${mem.user?.full_name || mem.user?.email || 'User'}`;
      } else if (action.valueType === 'number') {
        aStr += ` ${actionValue}`;
      } else if (action.valueType === 'text') {
        aStr += ` "${actionValue}"`;
      }
    }
    
    if (!tStr || !aStr) return t('automationPage.rule_name');
    return `${tStr} → ${aStr}`;
  };

  const handleTriggerId = (id) => {
    setTriggerId(id);
    setTriggerValue('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalName = name.trim() || generateDefaultName();
    if (trigger?.hasValue && !triggerValue) { toast.error(t('automationPage.pick_trigger_value', 'Choose a trigger value')); return; }
    if (action?.hasValue && !actionValue) { toast.error(t('automationPage.pick_action_value', 'Choose an action value')); return; }

    const conditions = {};
    if (trigger?.conditionKey && triggerValue) conditions[trigger.conditionKey] = triggerValue;

    const actions = { type: actionId };
    if (action?.hasValue && actionValue) actions.value = actionValue;

    onSave({
      name: finalName,
      trigger_event: triggerId,
      conditions: Object.keys(conditions).length ? conditions : null,
      actions,
    });
  };

  return (
    <Modal
      title={isEdit ? t('automationPage.edit_rule') : t('automationPage.create_rule')}
      icon={<Workflow className="w-4 h-4 text-[color:var(--color-ai)]" />}
      onClose={onClose}
      maxWidth="max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="automation-rule-form"
            disabled={isSaving}
            size="sm"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isEdit ? t('automationPage.save') : t('automationPage.create')}
          </Button>
        </div>
      }
    >
        <form id="automation-rule-form" onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Rule name */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              {t('automationPage.rule_name')}
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="..."
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ai)]/30 focus:border-[color:var(--color-ai)]/50"
            />
          </div>

          {/* IF block */}
          <div className="rounded-xl border border-border">
            <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2 rounded-t-xl">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">IF</span>
              <span className="text-[11px] text-muted-foreground">— {t('automationPage.trigger')}</span>
            </div>
            <div className="p-4 space-y-3">
              {/* Trigger selector */}
              <div className="grid grid-cols-2 gap-2">
                {TRIGGERS.map(tg => (
                  <button
                    key={tg.id}
                    type="button"
                    onClick={() => handleTriggerId(tg.id)}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all ${
                      triggerId === t.id
                        ? 'border-[color:var(--color-ai)]/50 bg-[color:var(--color-ai)]/5 ring-1 ring-[color:var(--color-ai)]/20'
                        : 'border-border hover:border-border/80 hover:bg-muted/30'
                    }`}
                  >
                    <div className={`mt-0.5 p-1 rounded-md shrink-0 ${tg.bg}`}>
                      <tg.icon className={`w-3 h-3 ${tg.color}`} />
                    </div>
                    <span className="text-[11px] font-medium text-foreground leading-tight">{t(tg.labelKey)}</span>
                  </button>
                ))}
              </div>

              {/* Trigger value */}
              {trigger?.hasValue && (
                <div>
                  <MiniSelect
                    value={triggerValue}
                    onChange={setTriggerValue}
                    options={trigger.valueType === 'status' ? STATUS_OPTIONS : PRIORITY_OPTIONS}
                    placeholder="..."
                    t={t}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Connector */}
          <div className="flex items-center justify-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[color:var(--color-ai)]/10 border border-[color:var(--color-ai)]/20">
              <ArrowRight className="w-3 h-3 text-[color:var(--color-ai)]" />
              <span className="text-[10px] font-bold text-[color:var(--color-ai)] uppercase tracking-wide">THEN</span>
            </div>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* THEN block */}
          <div className="rounded-xl border border-border">
            <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2 rounded-t-xl">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">THEN</span>
              <span className="text-[11px] text-muted-foreground">— {t('automationPage.action')}</span>
            </div>
            <div className="p-4 space-y-3">
              {/* Action selector */}
              <div className="grid grid-cols-2 gap-2">
                {ACTIONS.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { setActionId(a.id); setActionValue(''); }}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all ${
                      actionId === a.id
                        ? 'border-[color:var(--color-ai)]/50 bg-[color:var(--color-ai)]/5 ring-1 ring-[color:var(--color-ai)]/20'
                        : 'border-border hover:border-border/80 hover:bg-muted/30'
                    }`}
                  >
                    <div className={`mt-0.5 p-1 rounded-md shrink-0 ${a.bg}`}>
                      <a.icon className={`w-3 h-3 ${a.color}`} />
                    </div>
                    <span className="text-[11px] font-medium text-foreground leading-tight">{t(a.labelKey)}</span>
                  </button>
                ))}
              </div>

              {/* Action value */}
              {action?.hasValue && (
                <div>
                  {action.valueType === 'text' ? (
                    <textarea
                      value={actionValue}
                      onChange={e => setActionValue(e.target.value)}
                      placeholder="..."
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ai)]/30 min-h-[80px] resize-none"
                    />
                  ) : action.valueType === 'number' ? (
                    <input
                      type="number"
                      value={actionValue}
                      onChange={e => setActionValue(e.target.value)}
                      placeholder="..."
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ai)]/30"
                    />
                  ) : action.valueType === 'user' ? (
                    <MiniSelect
                      value={actionValue}
                      onChange={setActionValue}
                      options={members.map(m => ({ value: m.user_id, label: m.user?.full_name || m.user?.email || 'Unknown User' }))}
                      placeholder="..."
                      t={t}
                    />
                  ) : action.valueType === 'sprint' ? (
                    <MiniSelect
                      value={actionValue}
                      onChange={setActionValue}
                      options={sprints.map(s => ({ value: s.id, label: s.name }))}
                      placeholder="..."
                      t={t}
                    />
                  ) : (
                    <MiniSelect
                      value={actionValue}
                      onChange={setActionValue}
                      options={action.valueType === 'status' ? STATUS_OPTIONS : PRIORITY_OPTIONS}
                      placeholder="..."
                      t={t}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

        </form>
    </Modal>
  );
}

// ── Rule Card ─────────────────────────────────────────────────────────────────

function RuleCard({ rule, members, sprints, onToggle, onEdit, onDelete, isDeleting, t }) {
  const trigger = getTrigger(rule.trigger_event);
  const action = getAction(rule.actions?.type);
  const TrigIcon = trigger?.icon || Zap;
  const ActIcon = action?.icon || CheckSquare;

  return (
    <MotionCard
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group transition-all ${
        rule.is_active
          ? 'shadow-sm hover:shadow-md'
          : 'border-border/50 opacity-60'
      }`}
    >
      <div className="p-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1.5 rounded-lg shrink-0 ${rule.is_active ? 'bg-[color:var(--color-ai)]/10' : 'bg-muted'}`}>
              <Workflow className={`w-3.5 h-3.5 ${rule.is_active ? 'text-[color:var(--color-ai)]' : 'text-muted-foreground'}`} />
            </div>
            <span className="text-[13px] font-semibold text-foreground truncate">{rule.name}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(rule)}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              title={t('common.edit', 'Edit')}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(rule)}
              disabled={isDeleting}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
              title={t('common.delete', 'Delete')}
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* IF → THEN visual */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Trigger chip */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium ${trigger?.bg || 'bg-muted'} border-transparent`}>
            <TrigIcon className={`w-3 h-3 ${trigger?.color || 'text-muted-foreground'}`} />
            <span className="text-foreground">{triggerLabel(rule, t)}</span>
          </div>

          {/* Arrow */}
          <div className="flex items-center gap-1">
            <div className="w-4 h-px bg-border" />
            <ArrowRight className="w-3 h-3 text-muted-foreground/60" />
          </div>

          {/* Action chip */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium ${action?.bg || 'bg-muted'} border-transparent`}>
            <ActIcon className={`w-3 h-3 ${action?.color || 'text-muted-foreground'}`} />
            <span className="text-foreground">{actionLabel(rule, members, sprints, t)}</span>
          </div>
        </div>
      </div>

      {/* Footer: toggle */}
      <div className="px-4 py-2.5 border-t border-border/50 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {rule.is_active ? t('automationPage.status.active') : t('automationPage.status.inactive')}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-medium ${rule.is_active ? 'text-[color:var(--color-ai)]' : 'text-muted-foreground/50'}`}>
            {rule.is_active ? t('automationPage.status.turn_on') : t('automationPage.status.turn_off')}
          </span>
          <Switch
            checked={rule.is_active}
            onCheckedChange={() => onToggle(rule)}
          />
        </div>
      </div>
    </MotionCard>
  );
}

// ── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({ tpl, onUse, t }) {
  const trigger = getTrigger(tpl.trigger_event);
  const action = getAction(tpl.actions?.type);
  const TrigIcon = trigger?.icon || Zap;
  const ActIcon = action?.icon || CheckSquare;

  return (
    <Card className="border-dashed bg-muted/20 p-3.5 hover:bg-muted/40 hover:border-border transition-all group cursor-pointer" onClick={() => onUse(tpl)}>
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <p className="text-[12px] font-semibold text-foreground">{t(tpl.nameKey, tpl.name)}</p>
        <button
          onClick={e => { e.stopPropagation(); onUse(tpl); }}
          className="shrink-0 flex items-center gap-1 text-[10px] text-[color:var(--color-ai)] opacity-0 group-hover:opacity-100 transition-opacity font-medium"
        >
          <Copy className="w-3 h-3" />
          {t('common.create')}
        </button>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${trigger?.bg}`}>
          <TrigIcon className={`w-2.5 h-2.5 ${trigger?.color}`} />
          <span className="text-foreground/80">{trigger ? t(trigger.labelKey) : tpl.trigger_event}</span>
        </div>
        <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/50" />
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${action?.bg}`}>
          <ActIcon className={`w-2.5 h-2.5 ${action?.color}`} />
          <span className="text-foreground/80">{action ? t(action.labelKey) : tpl.actions?.type}</span>
        </div>
      </div>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { id: projectId } = useParams();
  const [modalState, setModalState] = useState(null); // null | { mode: 'create'|'edit', rule?: {} }
  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Project data
  const { data: _projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getProjects,
    staleTime: 5 * 60 * 1000,
    select: data => data || [],
  });

  // Sprints for the sprint action value selector
  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintService.getSprints(projectId),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000,
    select: data => data || [],
  });

  // Members for the user action value selector
  const { data: members = [] } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectService.getMembers(projectId),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    select: data => data || [],
  });

  // Rules
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['automation-rules', projectId],
    queryFn: () => automationService.getRules(projectId),
    enabled: !!projectId,
    staleTime: 30 * 1000,
    select: data => data || [],
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['automation-rules', projectId] });

  // Create
  const createMutation = useMutation({
    mutationFn: (data) => automationService.createRule(projectId, data),
    onSuccess: () => { invalidate(); setModalState(null); toast.success(t('automationPage.created', 'Automation rule created')); },
    onError: () => toast.error(t('automationPage.create_failed', 'Could not create the rule')),
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => automationService.updateRule(id, data),
    onSuccess: () => { invalidate(); setModalState(null); toast.success(t('automationPage.updated', 'Rule updated')); },
    onError: () => toast.error(t('automationPage.update_failed', 'Update failed')),
  });

  // Toggle
  const toggleMutation = useMutation({
    mutationFn: (ruleId) => automationService.toggleRule(ruleId),
    onMutate: async (ruleId) => {
      await qc.cancelQueries({ queryKey: ['automation-rules', projectId] });
      const previousRules = qc.getQueryData(['automation-rules', projectId]);
      qc.setQueryData(['automation-rules', projectId], (old) => 
        old?.map(r => r.id === ruleId ? { ...r, is_active: !r.is_active } : r)
      );
      return { previousRules };
    },
    onError: (err, ruleId, context) => { 
      if (context?.previousRules) {
        qc.setQueryData(['automation-rules', projectId], context.previousRules);
      }
      toast.error(t('automationPage.toggle_failed', 'Could not change the status'));
    },
    onSettled: () => invalidate()
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: (ruleId) => automationService.deleteRule(ruleId),
    onMutate: (ruleId) => setDeletingId(ruleId),
    onSuccess: () => { invalidate(); setDeletingId(null); toast.success(t('automationPage.deleted', 'Rule deleted')); },
    onError: () => { toast.error(t('automationPage.delete_failed', 'Delete failed')); setDeletingId(null); },
  });

  const handleSave = (formData) => {
    if (modalState?.mode === 'edit') {
      updateMutation.mutate({ id: modalState.rule.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openCreate = (prefill = null) => {
    setModalState({ mode: 'create', rule: prefill ? { ...prefill, id: null } : null });
  };

  const activeCount = rules.filter(r => r.is_active).length;

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="px-5 pt-6 pb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[color:var(--color-ai)]/10 border border-[color:var(--color-ai)]/20 text-[color:var(--color-ai)]">
              <Workflow className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">{t('automationPage.title')}</h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {t('automationPage.subtitle')}
              </p>
            </div>
          </div>

          <Button
            onClick={() => openCreate()}
            disabled={!projectId}
            className="flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('automationPage.create')}</span>
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="px-5">
        {!projectId ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Workflow className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-[14px] text-muted-foreground">{t('automationPage.pick_project', 'Choose a project to see its automation rules')}</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t('automationPage.total_rules'), value: rules.length, icon: Workflow, color: 'text-[color:var(--color-ai)]', bg: 'bg-[color:var(--color-ai)]/10' },
                { label: t('automationPage.status.active'), value: activeCount, icon: Zap, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: t('automationPage.status.inactive'), value: rules.length - activeCount, icon: ToggleLeft, color: 'text-muted-foreground', bg: 'bg-muted/50' },
              ].map(stat => (
                <MotionCard
                  key={stat.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-3.5"
                >
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                    <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  </div>
                </MotionCard>
              ))}
            </div>

            {/* Rules list */}
            {isLoading ? (
              <div className="space-y-3">
                {[0,1,2].map(i => (
                  <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : rules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/10 py-16 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center border border-border">
                  <Workflow className="w-6 h-6 text-muted-foreground/30" />
                </div>
                <div>
                  <h3 className="text-[14px] font-medium text-foreground mt-4">{t('automationPage.no_rules')}</h3>
                  <p className="text-[12px] text-muted-foreground mt-1 mb-6 text-center max-w-sm">
                    {t('automationPage.no_rules_desc')}
                  </p>
                </div>
                <Button
                  onClick={() => openCreate()}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {t('automationPage.create')}
                </Button>
              </div>
            ) : (
              <div>
                <div className="flex-1 mt-6">
                  <h2 className="text-[13px] font-semibold text-foreground mb-4">
                    {t('automationPage.my_rules')}
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <AnimatePresence mode="popLayout">
                    {rules.map(rule => (
                      <RuleCard
                        key={rule.id}
                        rule={rule}
                        members={members}
                        sprints={sprints}
                        onToggle={(r) => toggleMutation.mutate(r.id)}
                        onEdit={(r) => setModalState({ mode: 'edit', rule: r })}
                        onDelete={(r) => setDeleteTarget(r)}
                        isDeleting={deletingId === rule.id}
                        t={t}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Templates */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  {t('automationPage.templates')}
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TEMPLATES.map((tpl, i) => (
                  <TemplateCard key={i} tpl={tpl} onUse={openCreate} t={t} />
                ))}
              </div>
            </div>

            {/* How it works */}
            <Card className="bg-muted/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                <h3 className="text-[12px] font-semibold text-foreground">{t('automationPage.how_it_works')}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-muted-foreground">
                {[
                  { step: '1', title: t('automationPage.step_1_title'), desc: t('automationPage.step_1_desc') },
                  { step: '2', title: t('automationPage.step_2_title'), desc: t('automationPage.step_2_desc') },
                  { step: '3', title: t('automationPage.step_3_title'), desc: t('automationPage.step_3_desc') },
                ].map(item => (
                  <div key={item.step} className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-ai)]/15 text-[color:var(--color-ai)] text-[10px] font-bold">
                      {item.step}
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalState && (
          <RuleModal
            rule={modalState.rule}
            sprints={sprints}
            members={members}
            onClose={() => setModalState(null)}
            onSave={handleSave}
            isSaving={createMutation.isPending || updateMutation.isPending}
          />
        )}
      </AnimatePresence>

      <ConfirmDeleteDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          deleteMutation.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        title={t('automationPage.delete_title', 'Delete automation rule')}
        description={t('automationPage.delete_desc', { name: deleteTarget?.name, defaultValue: 'Rule "{{name}}" will be permanently deleted.' })}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
