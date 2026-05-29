import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ShieldCheck, ArrowRight, AlertTriangle, Info } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { runGuardrails } from '../../services/complianceEngine';
import { buildSnapshot } from '../../services/guardrailSnapshot';

const SEV = {
  critical: { ring: 'border-red-500/30 bg-red-500/5', dot: 'text-red-400', Icon: ShieldAlert },
  high: { ring: 'border-amber-500/30 bg-amber-500/5', dot: 'text-amber-400', Icon: AlertTriangle },
  medium: { ring: 'border-blue-500/30 bg-blue-500/5', dot: 'text-blue-400', Icon: Info },
  info: { ring: 'border-dark-600 bg-dark-700/30', dot: 'text-dark-300', Icon: Info },
};

/**
 * Compact compliance banner for the Dashboard. Surfaces the top guardrail
 * alerts (critical/high) and links to the full Compliance Guard page.
 * Shows a positive "all clear" state when nothing is flagged.
 */
export default function GuardrailAlerts({ max = 3 }) {
  const { state } = useData();
  const alerts = useMemo(() => runGuardrails(buildSnapshot(state)), [state]);
  const serious = alerts.filter((a) => a.severity === 'critical' || a.severity === 'high');
  const show = (serious.length ? serious : alerts).slice(0, max);

  if (!alerts.length) {
    return (
      <div className="glass-card p-4 flex items-center gap-3 border-accent/20">
        <ShieldCheck className="w-5 h-5 text-accent flex-shrink-0" />
        <p className="text-sm text-dark-200">No compliance issues detected. <span className="text-dark-400">44ADA, Schedule FA, RCM and GST checks are clear.</span></p>
        <Link to="/guardrails" className="ml-auto text-xs text-accent hover:underline whitespace-nowrap">Open Guard</Link>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-accent" /> Compliance Guard
          <span className="badge bg-red-500/10 text-red-400 ml-1">{serious.length} to review</span>
        </h3>
        <Link to="/guardrails" className="text-xs text-accent hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-2">
        {show.map((a) => {
          const s = SEV[a.severity] || SEV.info;
          const Icon = s.Icon;
          return (
            <div key={a.id} className={`flex items-start gap-3 rounded-lg border p-3 ${s.ring}`}>
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${s.dot}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-dark-50">{a.title}</p>
                <p className="text-xs text-dark-300 mt-0.5 line-clamp-2">{a.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
