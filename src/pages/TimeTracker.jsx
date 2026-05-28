// ==========================================
// FreelanceOS — Time Tracker Page
// ==========================================
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { formatDuration, formatHours, formatINR, generateId } from '../utils/helpers';
import {
  Play, Pause, Square, Clock, Plus, Trash2, Timer,
  ChevronDown, Edit3, Check, X, CalendarDays, TrendingUp,
  DollarSign, Users, Coffee,
} from 'lucide-react';

// ---- Helpers ----
function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function dateInRange(dateStr, start, end) {
  const d = new Date(dateStr + 'T12:00:00');
  return d >= start && d <= end;
}

// ==========================================
// Main Component
// ==========================================
export default function TimeTracker() {
  const { state, dispatch, addToast } = useData();
  const { clients, timeEntries, activeTimer } = state;

  // ---- Active Timer State ----
  const [isRunning, setIsRunning] = useState(activeTimer?.isRunning || false);
  const [seconds, setSeconds] = useState(activeTimer?.seconds || 0);
  const [timerClient, setTimerClient] = useState(activeTimer?.clientName || '');
  const [timerProject, setTimerProject] = useState(activeTimer?.project || '');
  const [timerDesc, setTimerDesc] = useState(activeTimer?.description || '');
  const [timerRate, setTimerRate] = useState(activeTimer?.hourlyRate || 1500);
  const intervalRef = useRef(null);

  // ---- Manual Entry State ----
  const [showManual, setShowManual] = useState(false);
  const [manualDate, setManualDate] = useState(getTodayStr());
  const [manualClient, setManualClient] = useState('');
  const [manualProject, setManualProject] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualHours, setManualHours] = useState('');
  const [manualRate, setManualRate] = useState(1500);

  // ---- Edit State ----
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  // ---- Timer Logic ----
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  // Persist active timer to context
  useEffect(() => {
    dispatch({
      type: 'SET_ACTIVE_TIMER',
      payload: isRunning || seconds > 0
        ? { isRunning, seconds, clientName: timerClient, project: timerProject, description: timerDesc, hourlyRate: timerRate }
        : null,
    });
  }, [isRunning, seconds, timerClient, timerProject, timerDesc, timerRate, dispatch]);

  // Restore timer on mount if it was running
  useEffect(() => {
    if (activeTimer?.isRunning) {
      setIsRunning(true);
      setSeconds(activeTimer.seconds || 0);
      setTimerClient(activeTimer.clientName || '');
      setTimerProject(activeTimer.project || '');
      setTimerDesc(activeTimer.description || '');
      setTimerRate(activeTimer.hourlyRate || 1500);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = useCallback(() => {
    if (!timerClient) {
      addToast('Please select a client before starting', 'error');
      return;
    }
    setIsRunning(true);
  }, [timerClient, addToast]);

  const handlePause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const handleStop = useCallback(() => {
    if (seconds < 1) {
      addToast('Timer has no recorded time', 'error');
      return;
    }
    setIsRunning(false);
    const entry = {
      id: generateId(),
      clientName: timerClient,
      project: timerProject,
      description: timerDesc || 'Untitled session',
      date: getTodayStr(),
      seconds,
      hourlyRate: timerRate,
    };
    dispatch({ type: 'ADD_TIME_ENTRY', payload: entry });
    addToast(`Time entry added — ${formatDuration(seconds)}`, 'success');
    // Reset
    setSeconds(0);
    setTimerDesc('');
    setTimerProject('');
  }, [seconds, timerClient, timerProject, timerDesc, timerRate, dispatch, addToast]);

  // ---- Manual Entry ----
  const handleManualAdd = useCallback(() => {
    const hrs = parseFloat(manualHours);
    if (!manualClient || !hrs || hrs <= 0) {
      addToast('Please fill client and hours', 'error');
      return;
    }
    const entry = {
      id: generateId(),
      clientName: manualClient,
      project: manualProject,
      description: manualDesc || 'Manual entry',
      date: manualDate,
      seconds: Math.round(hrs * 3600),
      hourlyRate: manualRate,
    };
    dispatch({ type: 'ADD_TIME_ENTRY', payload: entry });
    addToast('Manual time entry added', 'success');
    setManualHours('');
    setManualDesc('');
    setManualProject('');
  }, [manualClient, manualProject, manualDesc, manualDate, manualHours, manualRate, dispatch, addToast]);

  // ---- Delete Entry ----
  const handleDelete = useCallback((id) => {
    dispatch({ type: 'DELETE_TIME_ENTRY', payload: id });
    addToast('Time entry deleted', 'success');
  }, [dispatch, addToast]);

  // ---- Edit Entry ----
  const startEdit = useCallback((entry) => {
    setEditingId(entry.id);
    setEditData({
      description: entry.description,
      hours: (entry.seconds / 3600).toFixed(2),
      hourlyRate: entry.hourlyRate,
    });
  }, []);

  const saveEdit = useCallback((id) => {
    dispatch({
      type: 'UPDATE_TIME_ENTRY',
      payload: {
        id,
        description: editData.description,
        seconds: Math.round(parseFloat(editData.hours) * 3600),
        hourlyRate: Number(editData.hourlyRate),
      },
    });
    setEditingId(null);
    addToast('Time entry updated', 'success');
  }, [editData, dispatch, addToast]);

  // ---- Computed Data ----
  const today = getTodayStr();
  const todayEntries = useMemo(
    () => timeEntries.filter(e => e.date === today),
    [timeEntries, today]
  );

  const todayTotals = useMemo(() => {
    const totalSeconds = todayEntries.reduce((sum, e) => sum + e.seconds, 0);
    const totalEarnings = todayEntries.reduce((sum, e) => sum + (e.seconds / 3600) * e.hourlyRate, 0);
    return { totalSeconds, totalEarnings };
  }, [todayEntries]);

  const { start: weekStart, end: weekEnd } = useMemo(() => getWeekRange(), []);

  const weekEntries = useMemo(
    () => timeEntries.filter(e => dateInRange(e.date, weekStart, weekEnd)),
    [timeEntries, weekStart, weekEnd]
  );

  const weeklyByClient = useMemo(() => {
    const map = {};
    weekEntries.forEach(e => {
      if (!map[e.clientName]) map[e.clientName] = { seconds: 0, earnings: 0 };
      map[e.clientName].seconds += e.seconds;
      map[e.clientName].earnings += (e.seconds / 3600) * e.hourlyRate;
    });
    return map;
  }, [weekEntries]);

  const weekTotals = useMemo(() => {
    const totalSeconds = weekEntries.reduce((sum, e) => sum + e.seconds, 0);
    const totalEarnings = weekEntries.reduce((sum, e) => sum + (e.seconds / 3600) * e.hourlyRate, 0);
    return { totalSeconds, totalEarnings };
  }, [weekEntries]);

  // ---- Unique client names ----
  const clientNames = useMemo(() => clients.map(c => c.name), [clients]);

  // ---- Compute live earnings ----
  const liveEarnings = (seconds / 3600) * timerRate;

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#FAFAFA] flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#F97316] to-[#F59E0B]">
              <Timer className="w-6 h-6 text-white" />
            </div>
            Time Tracker
          </h1>
          <p className="text-[#A3A3A3] mt-1 ml-14">Track your hours and maximize your earnings</p>
        </div>
        <button
          onClick={() => setShowManual(prev => !prev)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-[#FAFAFA] hover:border-[#F97316]/50 transition-all text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Manual Entry
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showManual ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* ============================== */}
      {/* ACTIVE TIMER SECTION           */}
      {/* ============================== */}
      <div className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${
        isRunning
          ? 'border-[#F97316]/40 shadow-[0_0_40px_rgba(249,115,22,0.15)]'
          : 'border-[#2A2A2A]'
      } bg-[#1A1A1A]`}>
        {/* Animated background glow when running */}
        {isRunning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#F97316]/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#F59E0B]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
        )}

        <div className="relative p-6 md:p-8">
          {/* Timer Display */}
          <div className="text-center mb-8">
            <div className={`font-mono text-6xl md:text-8xl font-bold tracking-wider transition-colors duration-300 ${
              isRunning
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-[#F97316] to-[#F59E0B]'
                : seconds > 0
                  ? 'text-[#FAFAFA]'
                  : 'text-[#737373]'
            }`}>
              {formatDuration(seconds)}
            </div>
            {/* Live earnings indicator */}
            {(isRunning || seconds > 0) && timerRate > 0 && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <DollarSign className="w-4 h-4 text-[#22C55E]" />
                <span className="text-lg font-semibold text-[#22C55E]">
                  {formatINR(liveEarnings)}
                </span>
                <span className="text-[#737373] text-sm">earned this session</span>
              </div>
            )}
          </div>

          {/* Timer Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Client Selector */}
            <div>
              <label className="block text-xs font-medium text-[#A3A3A3] mb-1.5 uppercase tracking-wider">Client</label>
              <select
                value={timerClient}
                onChange={e => setTimerClient(e.target.value)}
                disabled={isRunning}
                className="w-full px-3.5 py-2.5 bg-[#0F0F0F] border border-[#2A2A2A] rounded-xl text-[#FAFAFA] text-sm focus:outline-none focus:border-[#F97316] transition-colors disabled:opacity-50"
              >
                <option value="">Select client…</option>
                {clientNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Project Input */}
            <div>
              <label className="block text-xs font-medium text-[#A3A3A3] mb-1.5 uppercase tracking-wider">Project</label>
              <input
                type="text"
                value={timerProject}
                onChange={e => setTimerProject(e.target.value)}
                disabled={isRunning}
                placeholder="Project name"
                className="w-full px-3.5 py-2.5 bg-[#0F0F0F] border border-[#2A2A2A] rounded-xl text-[#FAFAFA] text-sm focus:outline-none focus:border-[#F97316] transition-colors placeholder:text-[#737373] disabled:opacity-50"
              />
            </div>

            {/* Description Input */}
            <div>
              <label className="block text-xs font-medium text-[#A3A3A3] mb-1.5 uppercase tracking-wider">Description</label>
              <input
                type="text"
                value={timerDesc}
                onChange={e => setTimerDesc(e.target.value)}
                placeholder="What are you working on?"
                className="w-full px-3.5 py-2.5 bg-[#0F0F0F] border border-[#2A2A2A] rounded-xl text-[#FAFAFA] text-sm focus:outline-none focus:border-[#F97316] transition-colors placeholder:text-[#737373]"
              />
            </div>

            {/* Hourly Rate */}
            <div>
              <label className="block text-xs font-medium text-[#A3A3A3] mb-1.5 uppercase tracking-wider">Hourly Rate (₹)</label>
              <input
                type="number"
                value={timerRate}
                onChange={e => setTimerRate(Number(e.target.value))}
                disabled={isRunning}
                min={0}
                className="w-full px-3.5 py-2.5 bg-[#0F0F0F] border border-[#2A2A2A] rounded-xl text-[#FAFAFA] text-sm focus:outline-none focus:border-[#F97316] transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          {/* Timer Controls */}
          <div className="flex items-center justify-center gap-4">
            {!isRunning ? (
              <button
                onClick={handleStart}
                className="flex items-center gap-2.5 px-8 py-3.5 bg-gradient-to-r from-[#F97316] to-[#F59E0B] rounded-xl text-white font-semibold text-base hover:shadow-[0_0_24px_rgba(249,115,22,0.4)] transition-all active:scale-95"
              >
                <Play className="w-5 h-5" fill="white" />
                {seconds > 0 ? 'Resume' : 'Start Timer'}
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="flex items-center gap-2.5 px-8 py-3.5 bg-[#F59E0B]/20 border border-[#F59E0B]/40 rounded-xl text-[#F59E0B] font-semibold text-base hover:bg-[#F59E0B]/30 transition-all active:scale-95"
              >
                <Pause className="w-5 h-5" />
                Pause
              </button>
            )}
            {(isRunning || seconds > 0) && (
              <button
                onClick={handleStop}
                className="flex items-center gap-2.5 px-8 py-3.5 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl text-[#EF4444] font-semibold text-base hover:bg-[#EF4444]/20 transition-all active:scale-95"
              >
                <Square className="w-5 h-5" fill="currentColor" />
                Stop & Save
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============================== */}
      {/* MANUAL ENTRY FORM (Collapsible)*/}
      {/* ============================== */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showManual ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-[#FAFAFA] mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#F97316]" />
            Add Manual Entry
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-[#A3A3A3] mb-1.5 uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={manualDate}
                onChange={e => setManualDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0F0F0F] border border-[#2A2A2A] rounded-xl text-[#FAFAFA] text-sm focus:outline-none focus:border-[#F97316] transition-colors"
              />
            </div>
            {/* Client */}
            <div>
              <label className="block text-xs font-medium text-[#A3A3A3] mb-1.5 uppercase tracking-wider">Client</label>
              <select
                value={manualClient}
                onChange={e => setManualClient(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0F0F0F] border border-[#2A2A2A] rounded-xl text-[#FAFAFA] text-sm focus:outline-none focus:border-[#F97316] transition-colors"
              >
                <option value="">Select client…</option>
                {clientNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            {/* Project */}
            <div>
              <label className="block text-xs font-medium text-[#A3A3A3] mb-1.5 uppercase tracking-wider">Project</label>
              <input
                type="text"
                value={manualProject}
                onChange={e => setManualProject(e.target.value)}
                placeholder="Project name"
                className="w-full px-3.5 py-2.5 bg-[#0F0F0F] border border-[#2A2A2A] rounded-xl text-[#FAFAFA] text-sm focus:outline-none focus:border-[#F97316] transition-colors placeholder:text-[#737373]"
              />
            </div>
            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-[#A3A3A3] mb-1.5 uppercase tracking-wider">Description</label>
              <input
                type="text"
                value={manualDesc}
                onChange={e => setManualDesc(e.target.value)}
                placeholder="Task description"
                className="w-full px-3.5 py-2.5 bg-[#0F0F0F] border border-[#2A2A2A] rounded-xl text-[#FAFAFA] text-sm focus:outline-none focus:border-[#F97316] transition-colors placeholder:text-[#737373]"
              />
            </div>
            {/* Hours */}
            <div>
              <label className="block text-xs font-medium text-[#A3A3A3] mb-1.5 uppercase tracking-wider">Hours</label>
              <input
                type="number"
                value={manualHours}
                onChange={e => setManualHours(e.target.value)}
                placeholder="e.g. 2.5"
                min={0}
                step={0.25}
                className="w-full px-3.5 py-2.5 bg-[#0F0F0F] border border-[#2A2A2A] rounded-xl text-[#FAFAFA] text-sm focus:outline-none focus:border-[#F97316] transition-colors placeholder:text-[#737373]"
              />
            </div>
            {/* Rate */}
            <div>
              <label className="block text-xs font-medium text-[#A3A3A3] mb-1.5 uppercase tracking-wider">Hourly Rate (₹)</label>
              <input
                type="number"
                value={manualRate}
                onChange={e => setManualRate(Number(e.target.value))}
                min={0}
                className="w-full px-3.5 py-2.5 bg-[#0F0F0F] border border-[#2A2A2A] rounded-xl text-[#FAFAFA] text-sm focus:outline-none focus:border-[#F97316] transition-colors"
              />
            </div>
          </div>
          <button
            onClick={handleManualAdd}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#F97316] to-[#F59E0B] rounded-xl text-white font-semibold text-sm hover:shadow-[0_0_16px_rgba(249,115,22,0.3)] transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
        </div>
      </div>

      {/* ============================== */}
      {/* TODAY'S LOG + WEEKLY SUMMARY    */}
      {/* ============================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ---- Today's Log ---- */}
        <div className="lg:col-span-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-[#2A2A2A] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-lg font-semibold text-[#FAFAFA] flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#3B82F6]" />
              Today's Log
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="w-4 h-4 text-[#A3A3A3]" />
                <span className="text-[#A3A3A3]">Total:</span>
                <span className="font-semibold text-[#FAFAFA]">{formatHours(todayTotals.totalSeconds / 3600)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <TrendingUp className="w-4 h-4 text-[#22C55E]" />
                <span className="text-[#A3A3A3]">Earned:</span>
                <span className="font-semibold text-[#22C55E]">{formatINR(todayTotals.totalEarnings)}</span>
              </div>
            </div>
          </div>

          {/* Entries List */}
          <div className="divide-y divide-[#2A2A2A]">
            {todayEntries.length === 0 ? (
              <div className="p-10 text-center">
                <Coffee className="w-10 h-10 text-[#737373] mx-auto mb-3" />
                <p className="text-[#737373]">No time entries today yet.</p>
                <p className="text-[#737373] text-sm mt-1">Start the timer above to begin tracking!</p>
              </div>
            ) : (
              todayEntries.map(entry => {
                const hours = entry.seconds / 3600;
                const earnings = hours * entry.hourlyRate;
                const isEditing = editingId === entry.id;

                return (
                  <div key={entry.id} className="p-4 hover:bg-[#262626]/50 transition-colors group">
                    {isEditing ? (
                      /* ---- Inline Edit Mode ---- */
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <input
                          type="text"
                          value={editData.description}
                          onChange={e => setEditData(d => ({ ...d, description: e.target.value }))}
                          className="flex-1 px-3 py-1.5 bg-[#0F0F0F] border border-[#F97316]/50 rounded-lg text-[#FAFAFA] text-sm focus:outline-none"
                        />
                        <input
                          type="number"
                          value={editData.hours}
                          onChange={e => setEditData(d => ({ ...d, hours: e.target.value }))}
                          step={0.25}
                          min={0}
                          className="w-20 px-3 py-1.5 bg-[#0F0F0F] border border-[#F97316]/50 rounded-lg text-[#FAFAFA] text-sm focus:outline-none"
                        />
                        <input
                          type="number"
                          value={editData.hourlyRate}
                          onChange={e => setEditData(d => ({ ...d, hourlyRate: e.target.value }))}
                          min={0}
                          className="w-24 px-3 py-1.5 bg-[#0F0F0F] border border-[#F97316]/50 rounded-lg text-[#FAFAFA] text-sm focus:outline-none"
                          placeholder="₹/hr"
                        />
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => saveEdit(entry.id)} className="p-1.5 rounded-lg bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20 transition-colors">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ---- Display Mode ---- */
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/20 truncate">
                              {entry.clientName}
                            </span>
                            {entry.project && (
                              <span className="text-xs text-[#737373] truncate">{entry.project}</span>
                            )}
                          </div>
                          <p className="text-sm text-[#FAFAFA] truncate">{entry.description}</p>
                        </div>
                        {/* Duration */}
                        <div className="flex items-center gap-4 sm:gap-6 text-sm shrink-0">
                          <div className="text-right">
                            <span className="font-mono font-medium text-[#FAFAFA]">{formatHours(hours)}</span>
                            <span className="text-[#737373] ml-1.5">@ {formatINR(entry.hourlyRate)}/hr</span>
                          </div>
                          <span className="font-semibold text-[#22C55E] min-w-[80px] text-right">{formatINR(earnings)}</span>
                          {/* Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(entry)} className="p-1.5 rounded-lg hover:bg-[#262626] text-[#A3A3A3] hover:text-[#3B82F6] transition-colors">
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(entry.id)} className="p-1.5 rounded-lg hover:bg-[#262626] text-[#A3A3A3] hover:text-[#EF4444] transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ---- Weekly Summary ---- */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-[#2A2A2A]">
            <h3 className="text-lg font-semibold text-[#FAFAFA] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#22C55E]" />
              This Week
            </h3>
          </div>

          {/* Totals */}
          <div className="p-5 border-b border-[#2A2A2A]">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0F0F0F] rounded-xl p-4 text-center">
                <Clock className="w-5 h-5 text-[#3B82F6] mx-auto mb-2" />
                <p className="text-2xl font-bold text-[#FAFAFA]">{formatHours(weekTotals.totalSeconds / 3600)}</p>
                <p className="text-xs text-[#737373] mt-0.5">Total Hours</p>
              </div>
              <div className="bg-[#0F0F0F] rounded-xl p-4 text-center">
                <TrendingUp className="w-5 h-5 text-[#22C55E] mx-auto mb-2" />
                <p className="text-2xl font-bold text-[#22C55E]">{formatINR(weekTotals.totalEarnings)}</p>
                <p className="text-xs text-[#737373] mt-0.5">Total Earned</p>
              </div>
            </div>
          </div>

          {/* Client Breakdown */}
          <div className="p-5">
            <h4 className="text-xs font-medium text-[#A3A3A3] mb-3 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Hours by Client
            </h4>
            {Object.keys(weeklyByClient).length === 0 ? (
              <p className="text-sm text-[#737373]">No entries this week</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(weeklyByClient)
                  .sort(([, a], [, b]) => b.seconds - a.seconds)
                  .map(([client, data]) => {
                    const hrs = data.seconds / 3600;
                    const maxHrs = Math.max(...Object.values(weeklyByClient).map(d => d.seconds / 3600));
                    const pct = maxHrs > 0 ? (hrs / maxHrs) * 100 : 0;
                    return (
                      <div key={client}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-[#FAFAFA] truncate">{client}</span>
                          <span className="text-xs text-[#A3A3A3] ml-2 shrink-0">{formatHours(hrs)}</span>
                        </div>
                        <div className="h-2 bg-[#262626] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#F97316] to-[#F59E0B] rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-[#22C55E] mt-0.5">{formatINR(data.earnings)}</p>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Avg hourly rate */}
          {weekTotals.totalSeconds > 0 && (
            <div className="px-5 pb-5">
              <div className="bg-gradient-to-r from-[#F97316]/10 to-[#F59E0B]/10 border border-[#F97316]/20 rounded-xl p-4 text-center">
                <p className="text-xs text-[#A3A3A3] mb-1">Avg. Hourly Rate</p>
                <p className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#F97316] to-[#F59E0B]">
                  {formatINR(weekTotals.totalEarnings / (weekTotals.totalSeconds / 3600))}
                  <span className="text-sm text-[#A3A3A3] font-normal">/hr</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
