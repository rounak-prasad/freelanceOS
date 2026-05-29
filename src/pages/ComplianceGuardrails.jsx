import React, { useMemo } from 'react';
import {
  ShieldAlert, ShieldCheck, AlertTriangle, Info, CalendarClock,
  CheckCircle2, BadgeIndianRupee, Scale,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import StatCard from '../components/UI/StatCard';
import { runGuardrails } from '../services/complianceEngine';
import { buildSnapshot } from '../services/guardrailSnapshot';
import {
  SPECIFIED_PROFESSIONS, NON_SPECIFIED_PROFESSIONS, COMPLIANCE_CALENDAR,
  RULES_VERSION, DISCLAIMER,
} from '../config/taxRules';

const PROFESSION_LABELS = {
  information_technology: 'Software / IT (specified)',
  technical_consultancy: 'Technical consultancy (specified)',
  engineering: 'Engineering (specified)',
  accountancy: 'Accountancy (specified)',
  legal: 'Legal (specified)',
  medical: 'Medical (specified)',
  architecture: 'Architecture (specified)',
  interior_decoration: 'Interior decoration (specified)',
  film_artist: 'Film artist (specified)',
  company_secretary: 'Company secretary (specified)',
  content_writing: 'Content writing (NOT 44ADA)',
  graphic_design: 'Graphic design (NOT 44ADA)',
  digital_marketing: 'Digital marketing (NOT 44ADA)',
  social_media: 'Social media (NOT 44ADA)',
  virtual_assistant: 'Virtual assistant (NOT 44ADA)',
  photography_general: 'Photography (NOT 44ADA)',
  video_editing: 'Video editing (NOT 44ADA)',
  translation: 'Translation (NOT 44ADA)',
};

const SEV = {
  critical: { label: 'Critical', cls: 'border-red-500/30 bg-red-500/5', text: 'text-red-400', Icon: ShieldAlert },
  high: { label: 'High', cls: 'border-amber-500/30 bg-amber-500/5', text: 'text-amber-400', Icon: AlertTriangle },
  medium: { label: 'Review', cls: 'border-blue-500/30 bg-blue-500/5', text: 'text-blue-400', Icon: Info },
  info: { label: 'Info', cls: 'border-dark-600 bg-dark-700/30', text: 'text-dark-300', Icon: Info },
};

const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');

export default function ComplianceGuardrails() {
  const { state, dispatch, addToast } = useData();
  const snap = useMemo(() => buildSnapshot(state), [state]);
  const alerts = useMemo(() => runGuardrails(snap), [snap]);

  const settings = state.settings || {};
  const setSetting = (patch) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: patch });
    addToast('Tax profile updated');
  };

  const counts = alerts.reduce((a, x) => ((a[x.severity] = (a[x.severity] || 0) + 1), a), {});

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-accent" /> Compliance Guard
          </h1>
          <p className="text-sm text-dark-300 mt-1">
            Proactive warnings on the India-specific traps no other tool flags — 44ADA, Schedule&nbsp;FA, RCM and GST — read from your own data.
          </p>
        </div>
        <span className="badge bg-dark-700 text-dark-300 self-start">Rules v{RULES_VERSION}</span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShieldAlert} color={counts.critical ? 'red' : 'green'} label="Critical issues" value={counts.critical || 0} />
        <StatCard icon={AlertTriangle} color={counts.high ? 'amber' : 'green'} label="High priority" value={counts.high || 0} />
        <StatCard icon={BadgeIndianRupee} color="accent" label="FY turnover (est.)" value={inr(snap.grossReceipts)} subValue={snap._eligible44ADA ? '44ADA eligible' : 'Not 44ADA-eligible'} />
        <StatCard icon={Scale} color="blue" label="Est. tax liability" value={inr(snap.taxLiability)} subValue={`Taxable ${inr(snap._taxableIncome)}`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Alerts */}
        <div className="lg:col-span-2 space-y-3">
          {alerts.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <ShieldCheck className="w-10 h-10 text-accent mx-auto mb-3" />
              <p className="text-dark-50 font-medium">All clear</p>
              <p className="text-sm text-dark-300 mt-1">No compliance traps detected for your current profile and data.</p>
            </div>
          ) : (
            alerts.map((a) => {
              const s = SEV[a.severity] || SEV.info;
              const Icon = s.Icon;
              return (
                <div key={a.id} className={`glass-card p-4 border ${s.cls}`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${s.text}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-dark-50">{a.title}</h3>
                        <span className={`badge ${s.cls} ${s.text}`}>{s.label}</span>
                      </div>
                      <p className="text-sm text-dark-300 mt-1.5 leading-relaxed">{a.message}</p>
                      {a.action && (
                        <p className="text-sm text-accent mt-2 flex items-start gap-1.5">
                          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> {a.action}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* What we check */}
          <div className="glass-card p-5">
            <h3 className="section-title mb-3">What Compliance Guard checks</h3>
            <ul className="text-sm text-dark-300 space-y-2">
              <li>• <b className="text-dark-100">44ADA eligibility</b> — flags professions that legally cannot use presumptive taxation (writers, designers, marketers, VAs).</li>
              <li>• <b className="text-dark-100">Schedule FA trap</b> — a PayPal/Wise/Payoneer account forces ITR-3, voiding 44ADA simplicity.</li>
              <li>• <b className="text-dark-100">RCM on foreign SaaS</b> — Adobe/Figma/Canva spend triggers GST registration + reverse charge at any turnover.</li>
              <li>• <b className="text-dark-100">GST threshold</b> — alerts as you approach / cross the ₹20L services limit.</li>
              <li>• <b className="text-dark-100">Advance tax</b> — upcoming instalment reminders to avoid 234B/234C interest.</li>
            </ul>
          </div>
        </div>

        {/* Tax profile + calendar */}
        <div className="space-y-6">
          <div className="glass-card p-5">
            <h3 className="section-title mb-4">Your tax profile</h3>
            <div className="space-y-4">
              <div>
                <label className="input-label">Profession</label>
                <select
                  value={snap.professionKey}
                  onChange={(e) => setSetting({ profession: e.target.value })}
                  className="w-full"
                >
                  <optgroup label="Specified (44ADA-eligible)">
                    {SPECIFIED_PROFESSIONS.map((p) => (
                      <option key={p} value={p}>{PROFESSION_LABELS[p] || p}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Not specified (NOT 44ADA)">
                    {NON_SPECIFIED_PROFESSIONS.map((p) => (
                      <option key={p} value={p}>{PROFESSION_LABELS[p] || p}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <Toggle label="I file under Section 44ADA" checked={snap.using44ADA} onChange={(v) => setSetting({ using44ADA: v })} />
              <Toggle label="I am GST registered" checked={snap.gstRegistered} onChange={(v) => setSetting({ gstRegistered: v })} />
              <Toggle label="I have filed an LUT (export zero-rating)" checked={settings.hasLUT ?? false} onChange={(v) => setSetting({ hasLUT: v })} />

              <p className="text-xs text-dark-400 pt-1">
                Foreign accounts are managed on the <span className="text-accent">Cross-Border &amp; FIRA</span> page and feed the Schedule&nbsp;FA check automatically.
              </p>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="section-title mb-3 flex items-center gap-2"><CalendarClock className="w-4 h-4 text-accent" /> Compliance calendar</h3>
            <ul className="space-y-2.5">
              {COMPLIANCE_CALENDAR.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-dark-200">{c.label}</span>
                  <span className="text-dark-400">{c.due}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <p className="text-xs text-dark-500 flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5" /> {DISCLAIMER}
      </p>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 text-left group"
    >
      <span className="text-sm text-dark-200 group-hover:text-dark-50">{label}</span>
      <span className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-accent' : 'bg-dark-600'}`}>
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'left-5' : 'left-1'}`} />
      </span>
    </button>
  );
}
