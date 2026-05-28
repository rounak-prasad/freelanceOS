import React from 'react';

export default function StatCard({ icon: Icon, label, value, subValue, color = 'accent', trend, className = '' }) {
  const colorMap = {
    green: { bg: 'from-green-500/10 to-green-500/5', border: 'border-green-500/20', icon: 'text-green-400', glow: 'shadow-green-500/10' },
    amber: { bg: 'from-amber-500/10 to-amber-500/5', border: 'border-amber-500/20', icon: 'text-amber-400', glow: 'shadow-amber-500/10' },
    red: { bg: 'from-red-500/10 to-red-500/5', border: 'border-red-500/20', icon: 'text-red-400', glow: 'shadow-red-500/10' },
    blue: { bg: 'from-blue-500/10 to-blue-500/5', border: 'border-blue-500/20', icon: 'text-blue-400', glow: 'shadow-blue-500/10' },
    purple: { bg: 'from-purple-500/10 to-purple-500/5', border: 'border-purple-500/20', icon: 'text-purple-400', glow: 'shadow-purple-500/10' },
    accent: { bg: 'from-accent/10 to-accent/5', border: 'border-accent/20', icon: 'text-accent', glow: 'shadow-accent/10' },
  };
  
  const c = colorMap[color] || colorMap.accent;

  return (
    <div className={`glass-card p-5 relative overflow-hidden group hover:shadow-lg hover:${c.glow} transition-all duration-300 ${className}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${c.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${c.bg} border ${c.border} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${c.icon}`} />
          </div>
          {trend !== undefined && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              trend >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
        </div>
        <p className="text-2xl font-bold text-dark-50 tracking-tight">{value}</p>
        <p className="text-sm text-dark-300 mt-0.5">{label}</p>
        {subValue && <p className="text-xs text-dark-400 mt-1">{subValue}</p>}
      </div>
    </div>
  );
}
