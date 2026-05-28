// ==========================================
// FreelanceOS — Shareable Client Portal
// ==========================================
import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { formatINR, formatDate } from '../utils/helpers';
import {
  CheckCircle2, Circle, Clock, FileText, Printer,
  ArrowLeft, ShieldAlert, Sparkles, User, Briefcase
} from 'lucide-react';

export default function ClientPortal() {
  const { projectId } = useParams();
  const { state } = useData();

  const project = useMemo(() => {
    return (state.milestoneProjects || []).find(p => p.id === projectId);
  }, [state.milestoneProjects, projectId]);

  // Find client details
  const clientObj = useMemo(() => {
    if (!project) return null;
    return (state.clients || []).find(c => c.id === project.clientId || c.name === project.clientName);
  }, [state.clients, project]);

  // Filter change requests for this project
  const projectCRs = useMemo(() => {
    if (!project) return [];
    return (state.changeRequests || []).filter(cr => cr.projectId === project.id);
  }, [state.changeRequests, project]);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 font-sans text-center px-4">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-bold text-dark-50">Project Portal Not Found</h2>
        <p className="text-sm text-dark-300 max-w-sm">
          The project portal URL is invalid or the project has been deleted.
        </p>
        <Link to="/" className="btn-primary text-xs flex items-center gap-1.5 mt-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const milestones = project.milestones || [];
  const completedCount = milestones.filter(m => m.status !== 'Pending').length;
  const totalCount = milestones.length;
  
  const pct = project.completionPercent !== null && project.completionPercent !== undefined 
    ? project.completionPercent 
    : (totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0);

  const businessName = state.settings?.businessName || state.settings?.yourName || 'Freelance Partner';
  const contactEmail = state.settings?.email || 'partner@example.com';

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 font-sans antialiased text-dark-100">
      
      {/* Top Standalone Bar */}
      <div className="flex justify-between items-center no-print">
        <Link to="/milestones" className="text-xs text-dark-300 hover:text-dark-100 flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Milestones
        </Link>
        <button
          onClick={() => window.print()}
          className="btn-secondary py-1.5 px-3 flex items-center gap-1.5 text-xs bg-dark-800 border-dark-600/40 text-dark-100 hover:text-dark-50 hover:bg-dark-700 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" /> Print / Save PDF
        </button>
      </div>

      {/* Main Client facing Card Container */}
      <div className="glass-card overflow-hidden bg-gradient-to-b from-[#1E1E1E] to-[#121212] border border-[#2A2A2A] shadow-2xl rounded-2xl">
        
        {/* Portal Header */}
        <div className="p-6 sm:p-8 border-b border-dark-600/30 flex flex-col md:flex-row md:justify-between md:items-start gap-4 bg-dark-950/20">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-accent/10 border border-accent/20 text-accent font-semibold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                Client Project Portal
              </span>
              <span className="text-[10px] text-dark-400">• Realtime Updates</span>
            </div>
            <h1 className="text-2xl font-bold text-dark-50 tracking-tight">{project.name}</h1>
            <p className="text-sm text-dark-300 mt-1">Prepared by <span className="font-semibold text-dark-100">{businessName}</span></p>
          </div>

          <div className="text-left md:text-right text-xs">
            <span className="text-dark-400 block font-semibold uppercase tracking-wider text-[10px]">Total Agreed Scope</span>
            <p className="text-xl font-extrabold text-gradient mt-1">{formatINR(project.totalValue)}</p>
            <span className="text-[10px] text-dark-400 block mt-1">Date: {new Date().toLocaleDateString('en-IN')}</span>
          </div>
        </div>

        {/* Progress Bar Widget */}
        <div className="p-6 sm:p-8 border-b border-dark-600/30">
          <div className="flex justify-between items-center text-xs font-semibold text-dark-300 mb-2">
            <span>Overall Progress</span>
            <span className="text-accent">{pct}% Complete</span>
          </div>
          <div className="w-full h-3 rounded-full bg-dark-800 overflow-hidden relative border border-dark-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-dark-400 mt-2 font-medium">
            <span>{completedCount} of {totalCount} Milestones Delivered</span>
            <span>Target Launch: {milestones[milestones.length - 1]?.dueDate ? new Date(milestones[milestones.length - 1].dueDate).toLocaleDateString('en-IN') : 'TBD'}</span>
          </div>
        </div>

        {/* Timelines / Milestones list */}
        <div className="p-6 sm:p-8 space-y-4">
          <h3 className="text-sm font-bold text-dark-100 uppercase tracking-wider mb-2">Deliverables Schedule</h3>
          
          <div className="space-y-4 relative pl-4 border-l-2 border-dark-700">
            {milestones.map((ms, idx) => {
              const isDelivered = ms.status === 'Completed' || ms.status === 'Invoiced';
              return (
                <div key={ms.id} className="relative group animate-fade-in">
                  
                  {/* Timeline indicator circle */}
                  <div className="absolute -left-[25px] top-1.5 bg-dark-900 z-10 transition-transform duration-300 group-hover:scale-110">
                    {isDelivered ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-500/10" />
                    ) : (
                      <Circle className="w-5 h-5 text-dark-400" />
                    )}
                  </div>

                  <div className={`p-4 rounded-xl border transition-all ${
                    isDelivered 
                      ? 'bg-emerald-500/5 border-emerald-500/15'
                      : 'bg-dark-900/60 border-dark-600/30'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <div>
                        <h4 className={`text-sm font-semibold ${isDelivered ? 'text-emerald-400' : 'text-dark-50'}`}>
                          {ms.name}
                        </h4>
                        <div className="flex items-center gap-3 text-[10px] text-dark-400 mt-1 font-medium">
                          <span>Milestone #{idx + 1} ({ms.percentage}%)</span>
                          {ms.dueDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Due: {new Date(ms.dueDate).toLocaleDateString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 justify-between sm:justify-end">
                        <span className="font-bold text-dark-100 text-xs sm:text-sm">{formatINR(ms.amount)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                          ms.status === 'Invoiced' || ms.status === 'Completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }`}>
                          {isDelivered ? 'Delivered' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Change Request List */}
        {projectCRs.length > 0 && (
          <div className="p-6 sm:p-8 border-t border-dark-600/30 bg-[#161616]/20 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-bold text-dark-100 uppercase tracking-wider">Approved Scope Extensions</h3>
            </div>
            <p className="text-xs text-dark-300">
              Work elements approved during execution that fell outside the baseline Statement of Work (SOW).
            </p>
            
            <div className="space-y-3 font-sans">
              {projectCRs.map(cr => (
                <div key={cr.id} className="bg-dark-900/60 border border-dark-600/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-dark-50">{cr.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        cr.status === 'Billed' ? 'bg-green-500/10 text-emerald-400 border-green-500/20' :
                        cr.status === 'Approved' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }`}>
                        {cr.status}
                      </span>
                    </div>
                    <p className="text-dark-300 mt-1 leading-relaxed">{cr.description}</p>
                    <div className="text-[10px] text-dark-400 mt-2 font-medium">
                      <span>Logged: {new Date(cr.requestedAt).toLocaleDateString('en-IN')}</span>
                      {cr.approvedAt && <span className="ml-2">• Approved via {cr.clientApprovalMethod || 'WhatsApp'}</span>}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-extrabold text-dark-50 text-sm">{formatINR(cr.estimatedAmount)}</span>
                    {cr.estimatedHours > 0 && <span className="block text-[10px] text-dark-400 mt-0.5">{cr.estimatedHours} Hours logged</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portal Footer */}
        <div className="p-6 sm:p-8 bg-dark-950/40 border-t border-dark-600/30 text-center space-y-2">
          <p className="text-xs text-dark-300 leading-relaxed">
            Need revisions or have questions about this schedule? Please reach out directly to <strong>{contactEmail}</strong>.
          </p>
          <p className="text-[10px] text-dark-400 font-medium">
            Project schedule generated securely via FreelanceOS India. Real-time updates active.
          </p>
        </div>

      </div>
    </div>
  );
}
