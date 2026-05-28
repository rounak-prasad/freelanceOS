import React from 'react';
import { getStatusBgClass } from '../../utils/helpers';

export default function StatusBadge({ status, size = 'sm' }) {
  const colorClass = getStatusBgClass(status);
  const sizeClass = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center rounded-full font-medium border ${colorClass} ${sizeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
        status === 'Paid' || status === 'Accepted' ? 'bg-green-400' :
        status === 'In Progress' || status === 'Sent' ? 'bg-blue-400' :
        status === 'Invoice Sent' ? 'bg-amber-400' :
        status === 'Overdue' || status === 'Rejected' ? 'bg-red-400' :
        status === 'Proposal Sent' || status === 'Draft' ? 'bg-purple-400' :
        'bg-gray-400'
      }`} />
      {status}
    </span>
  );
}
