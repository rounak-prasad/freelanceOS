// ==========================================
// FreelanceOS — Proposal Preview (Branded)
// ==========================================
import React, { useRef, useState } from 'react';
import {
  Download, Link2, CheckCircle2, Send, Copy, Loader2,
  Calendar, Clock, IndianRupee, FileText, Shield, ArrowLeft,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { formatINR, formatDate, encodeProposalData, generateId } from '../../utils/helpers';
import StatusBadge from '../UI/StatusBadge';

export default function ProposalPreview({ proposal, onBack }) {
  const { dispatch, addToast } = useData();
  const previewRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  if (!proposal) return null;

  const validUntil = new Date(proposal.createdAt);
  validUntil.setDate(validUntil.getDate() + (proposal.validity || 15));

  // ---- Copy shareable link ----
  const handleCopyLink = async () => {
    try {
      const encoded = encodeProposalData(proposal);
      const url = `${window.location.origin}/proposals#${encoded}`;
      await navigator.clipboard.writeText(url);
      addToast('Shareable link copied to clipboard!', 'success');
    } catch {
      addToast('Failed to copy link', 'error');
    }
  };

  // ---- Download PDF ----
  const handleDownloadPDF = async () => {
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;

      const element = document.getElementById('proposal-preview');
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgW = canvas.width;
      const imgH = canvas.height;
      const ratio = Math.min(pdfW / imgW, pdfH / imgH);
      const w = imgW * ratio;
      const h = imgH * ratio;
      const x = (pdfW - w) / 2;

      // If content is taller than one page, split into multiple pages
      const pageHeight = pdfH * (imgW / w);
      let heightLeft = imgH;
      let position = 0;

      pdf.addImage(imgData, 'PNG', x, 0, w, h);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pdfH;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', x, position, w, h);
        heightLeft -= pageHeight;
      }

      const filename = `Proposal-${proposal.projectTitle.replace(/\s+/g, '-')}.pdf`;
      pdf.save(filename);
      addToast('PDF downloaded successfully!', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      addToast('Failed to export PDF', 'error');
    } finally {
      setExporting(false);
    }
  };

  // ---- Status transitions ----
  const handleMarkSent = () => {
    dispatch({ type: 'UPDATE_PROPOSAL', payload: { id: proposal.id, status: 'Sent' } });
    dispatch({
      type: 'ADD_ACTIVITY',
      payload: {
        id: generateId(),
        type: 'proposal',
        message: `Proposal "${proposal.projectTitle}" sent to ${proposal.clientName}`,
        timestamp: new Date().toISOString(),
        icon: 'Send',
      },
    });
    addToast('Proposal marked as Sent', 'success');
  };

  const handleMarkAccepted = () => {
    dispatch({ type: 'UPDATE_PROPOSAL', payload: { id: proposal.id, status: 'Accepted' } });
    dispatch({
      type: 'ADD_ACTIVITY',
      payload: {
        id: generateId(),
        type: 'proposal',
        message: `Proposal "${proposal.projectTitle}" accepted by ${proposal.clientName}`,
        timestamp: new Date().toISOString(),
        icon: 'CheckCircle',
      },
    });
    addToast('Proposal marked as Accepted!', 'success');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ---- Action Bar ---- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="btn-ghost flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div>
            <h2 className="text-lg font-semibold text-dark-50">Proposal Preview</h2>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={proposal.status} />
              <span className="text-xs text-dark-400">Created {formatDate(proposal.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="btn-secondary flex items-center gap-2"
          >
            <Link2 className="w-4 h-4" />
            <span className="hidden sm:inline">Copy Shareable Link</span>
            <span className="sm:hidden">Share</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={exporting}
            className="btn-secondary flex items-center gap-2"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>

          {proposal.status === 'Draft' && (
            <button onClick={handleMarkSent} className="btn-primary flex items-center gap-2">
              <Send className="w-4 h-4" /> Mark as Sent
            </button>
          )}
          {proposal.status === 'Sent' && (
            <button onClick={handleMarkAccepted} className="btn-primary flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Mark as Accepted
            </button>
          )}
        </div>
      </div>

      {/* ---- Printable Preview Area (WHITE bg for PDF) ---- */}
      <div className="rounded-xl border border-dark-600/50 overflow-hidden shadow-2xl">
        <div
          id="proposal-preview"
          ref={previewRef}
          className="bg-white text-gray-900 p-8 sm:p-12"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {/* Gradient accent bar */}
          <div
            className="h-2 -mx-8 sm:-mx-12 -mt-8 sm:-mt-12 mb-8"
            style={{ background: 'linear-gradient(90deg, #F97316, #F59E0B, #F97316)' }}
          />

          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 mb-10">
            <div>
              <p
                className="text-xs font-bold tracking-[0.3em] uppercase mb-2"
                style={{ color: '#F97316' }}
              >
                Project Proposal
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                {proposal.projectTitle}
              </h1>
              <p className="text-base text-gray-500 mt-1">
                Prepared for <span className="font-semibold text-gray-700">{proposal.clientName}</span>
              </p>
            </div>
            <div className="text-right text-sm text-gray-500 flex-shrink-0">
              <p>{formatDate(proposal.createdAt)}</p>
              <p className="font-semibold text-lg mt-1" style={{ color: '#F97316' }}>
                {formatINR(proposal.projectValue)}
              </p>
            </div>
          </div>

          {/* Prepared By / Prepared For */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10 p-5 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
            <div>
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 mb-1.5">
                Prepared By
              </p>
              <p className="font-semibold text-gray-900 text-sm">{proposal.yourName}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 mb-1.5">
                Prepared For
              </p>
              <p className="font-semibold text-gray-900 text-sm">{proposal.clientName}</p>
            </div>
          </div>

          {/* Divider helper */}
          {(() => {
            const SectionTitle = ({ icon: Icon, children }) => (
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#FFF7ED' }}
                >
                  <Icon className="w-4 h-4" style={{ color: '#F97316' }} />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-gray-800">
                  {children}
                </h3>
              </div>
            );

            return (
              <>
                {/* Scope of Work */}
                <div className="mb-8">
                  <SectionTitle icon={FileText}>Scope of Work</SectionTitle>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line pl-[42px]">
                    {proposal.scope}
                  </p>
                </div>

                {/* Deliverables */}
                {proposal.deliverables?.length > 0 && (
                  <div className="mb-8">
                    <SectionTitle icon={CheckCircle2}>Deliverables</SectionTitle>
                    <div className="space-y-2.5 pl-[42px]">
                      {proposal.deliverables.map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: '#FFF7ED' }}
                          >
                            <span className="text-[10px] font-bold" style={{ color: '#F97316' }}>
                              {i + 1}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="mb-8">
                  <SectionTitle icon={Calendar}>Timeline</SectionTitle>
                  <div className="pl-[42px]">
                    <div
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg"
                      style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
                    >
                      <Clock className="w-4 h-4" style={{ color: '#F97316' }} />
                      <span className="text-sm font-semibold text-gray-800">
                        {proposal.timeline} {proposal.timeline === 1 ? 'day' : 'days'}
                      </span>
                      <span className="text-xs text-gray-400">
                        (approx. {Math.ceil(proposal.timeline / 7)} {Math.ceil(proposal.timeline / 7) === 1 ? 'week' : 'weeks'})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Investment */}
                <div className="mb-8">
                  <SectionTitle icon={IndianRupee}>Investment</SectionTitle>
                  <div className="pl-[42px]">
                    <div
                      className="p-5 rounded-lg"
                      style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-semibold text-gray-700">Total Project Value</span>
                        <span className="text-2xl font-bold" style={{ color: '#F97316' }}>
                          {formatINR(proposal.projectValue)}
                        </span>
                      </div>

                      {/* Milestone breakdown */}
                      {proposal.milestones?.length > 0 && (
                        <div className="mt-4 pt-4" style={{ borderTop: '1px solid #FDE68A' }}>
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                            Milestone Breakdown
                          </p>
                          <div className="space-y-2">
                            {proposal.milestones.map((m, i) => (
                              <div key={i} className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">
                                  <span className="font-medium text-gray-800">{m.name || `Milestone ${i + 1}`}</span>
                                </span>
                                <span className="font-semibold text-gray-800">
                                  {formatINR(m.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment Terms */}
                <div className="mb-8">
                  <SectionTitle icon={IndianRupee}>Payment Terms</SectionTitle>
                  <div className="pl-[42px]">
                    <div
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg"
                      style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}
                    >
                      <CheckCircle2 className="w-4 h-4" style={{ color: '#16A34A' }} />
                      <span className="text-sm font-semibold text-gray-800">
                        {proposal.paymentTerms}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Terms & Conditions */}
                {proposal.termsAndConditions && (
                  <div className="mb-8">
                    <SectionTitle icon={Shield}>Terms & Conditions</SectionTitle>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line pl-[42px]">
                      {proposal.termsAndConditions}
                    </p>
                  </div>
                )}

                {/* Validity */}
                <div className="mb-4">
                  <div
                    className="flex items-center justify-between p-4 rounded-lg text-sm"
                    style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
                  >
                    <span className="text-gray-500">This proposal is valid until</span>
                    <span className="font-semibold text-gray-800">
                      {formatDate(validUntil.toISOString())} ({proposal.validity} days)
                    </span>
                  </div>
                </div>

                {/* Footer accent bar */}
                <div
                  className="h-1.5 rounded-full mt-8"
                  style={{ background: 'linear-gradient(90deg, #F97316, #F59E0B, #F97316)' }}
                />
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
