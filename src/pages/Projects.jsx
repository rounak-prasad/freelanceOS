// ==========================================
// FreelanceOS — Project Kanban Board
// ==========================================
import React, { useState, useMemo, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  Plus, GripVertical, Calendar, CheckSquare, Square,
  Trash2, Edit2, Flag, ChevronDown, ChevronRight,
  Layers, AlertCircle, X,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import Modal from '../components/UI/Modal';
import { generateId, toInputDate } from '../utils/helpers';

// ---- Column Definitions ----
const COLUMNS = [
  { id: 'todo',       label: 'To Do',        accent: 'blue',   iconBg: 'bg-blue-500/10',   iconText: 'text-blue-400',   borderTop: 'border-t-blue-500/50' },
  { id: 'inProgress', label: 'In Progress',   accent: 'orange', iconBg: 'bg-orange-500/10',  iconText: 'text-orange-400', borderTop: 'border-t-orange-500/50' },
  { id: 'review',     label: 'Review',        accent: 'purple', iconBg: 'bg-purple-500/10',  iconText: 'text-purple-400', borderTop: 'border-t-purple-500/50' },
  { id: 'completed',  label: 'Completed',     accent: 'green',  iconBg: 'bg-green-500/10',   iconText: 'text-green-400',  borderTop: 'border-t-green-500/50' },
];

// Priority styling
const PRIORITY_STYLES = {
  high:   { bg: 'bg-red-500/10 border-red-500/20',    text: 'text-red-400',    label: 'High' },
  medium: { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400',  label: 'Medium' },
  low:    { bg: 'bg-green-500/10 border-green-500/20', text: 'text-green-400',  label: 'Low' },
};

// ---- Blank Project Template ----
function blankProject() {
  return {
    id: '',
    title: '',
    clientName: '',
    status: 'todo',
    priority: 'medium',
    deadline: '',
    subtasks: [],
    notes: '',
  };
}

// ========================================================
// Main Component
// ========================================================
export default function Projects() {
  const { state, dispatch, addToast } = useData();
  const { projects = [], clients = [] } = state;

  // UI states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});
  const [newSubtask, setNewSubtask] = useState('');

  // ---- Form state ----
  const [form, setForm] = useState(blankProject());

  // ---- Grouped projects by column ----
  const columns = useMemo(() => {
    const grouped = { todo: [], inProgress: [], review: [], completed: [] };
    projects.forEach((p) => {
      if (grouped[p.status]) {
        grouped[p.status].push(p);
      } else {
        grouped.todo.push(p);
      }
    });
    return grouped;
  }, [projects]);

  // ---- Drag-and-drop handler ----
  const onDragEnd = useCallback((result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;

    // Find the project
    const project = projects.find((p) => p.id === draggableId);
    if (!project || project.status === newStatus) return;

    dispatch({
      type: 'UPDATE_PROJECT',
      payload: { id: draggableId, status: newStatus },
    });

    const colLabel = COLUMNS.find((c) => c.id === newStatus)?.label || newStatus;
    addToast(`Moved "${project.title}" to ${colLabel}`, 'success');
  }, [projects, dispatch, addToast]);

  // ---- Toggle card expansion ----
  const toggleExpand = useCallback((id) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ---- Toggle subtask done ----
  const toggleSubtask = useCallback((projectId, subtaskId) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const updatedSubtasks = project.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, done: !st.done } : st
    );
    dispatch({
      type: 'UPDATE_PROJECT',
      payload: { id: projectId, subtasks: updatedSubtasks },
    });
  }, [projects, dispatch]);

  // ---- Open modal for new project ----
  const openNewModal = useCallback(() => {
    setEditingProject(null);
    setForm(blankProject());
    setNewSubtask('');
    setModalOpen(true);
  }, []);

  // ---- Open modal for editing ----
  const openEditModal = useCallback((project) => {
    setEditingProject(project);
    setForm({
      ...project,
      deadline: project.deadline ? toInputDate(project.deadline) : '',
    });
    setNewSubtask('');
    setModalOpen(true);
  }, []);

  // ---- Close modal ----
  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingProject(null);
    setForm(blankProject());
    setNewSubtask('');
  }, []);

  // ---- Add subtask in form ----
  const addSubtaskToForm = useCallback(() => {
    const trimmed = newSubtask.trim();
    if (!trimmed) return;
    setForm((prev) => ({
      ...prev,
      subtasks: [...prev.subtasks, { id: generateId(), title: trimmed, done: false }],
    }));
    setNewSubtask('');
  }, [newSubtask]);

  // ---- Remove subtask from form ----
  const removeSubtaskFromForm = useCallback((subtaskId) => {
    setForm((prev) => ({
      ...prev,
      subtasks: prev.subtasks.filter((st) => st.id !== subtaskId),
    }));
  }, []);

  // ---- Toggle subtask done in form ----
  const toggleFormSubtask = useCallback((subtaskId) => {
    setForm((prev) => ({
      ...prev,
      subtasks: prev.subtasks.map((st) =>
        st.id === subtaskId ? { ...st, done: !st.done } : st
      ),
    }));
  }, []);

  // ---- Save project ----
  const handleSave = useCallback(() => {
    if (!form.title.trim()) {
      addToast('Please enter a project title', 'error');
      return;
    }

    if (editingProject) {
      dispatch({
        type: 'UPDATE_PROJECT',
        payload: {
          ...form,
          deadline: form.deadline ? new Date(form.deadline).toISOString() : '',
        },
      });
      addToast(`"${form.title}" updated`, 'success');
    } else {
      dispatch({
        type: 'ADD_PROJECT',
        payload: {
          ...form,
          id: generateId(),
          deadline: form.deadline ? new Date(form.deadline).toISOString() : '',
          createdAt: new Date().toISOString(),
        },
      });
      addToast(`"${form.title}" created`, 'success');
    }
    closeModal();
  }, [form, editingProject, dispatch, addToast, closeModal]);

  // ---- Delete project ----
  const handleDelete = useCallback((id, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    dispatch({ type: 'DELETE_PROJECT', payload: id });
    addToast(`"${title}" deleted`, 'success');
  }, [dispatch, addToast]);

  // ---- Days remaining helper ----
  function getDaysRemaining(deadline) {
    if (!deadline) return null;
    const now = new Date();
    const dl = new Date(deadline);
    const diff = dl - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="page-enter space-y-6">
      {/* ═══════ Page Header ═══════ */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
            Projects
            <Layers className="w-6 h-6 text-accent opacity-70" />
          </h1>
          <p className="text-dark-400 mt-1">
            <span className="text-dark-200 font-medium">{projects.length}</span>{' '}
            {projects.length === 1 ? 'project' : 'projects'} total
          </p>
        </div>
        <button onClick={openNewModal} className="btn-primary flex items-center gap-2 w-fit">
          <Plus className="w-4 h-4" />
          Add Project
        </button>
      </div>

      {/* ═══════ Kanban Board ═══════ */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              projects={columns[col.id]}
              expandedCards={expandedCards}
              onToggleExpand={toggleExpand}
              onToggleSubtask={toggleSubtask}
              onEdit={openEditModal}
              onDelete={handleDelete}
              getDaysRemaining={getDaysRemaining}
            />
          ))}
        </div>
      </DragDropContext>

      {/* ═══════ Add / Edit Modal ═══════ */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingProject ? 'Edit Project' : 'New Project'}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="input-label">Project Title</label>
            <input
              type="text"
              placeholder="e.g. Website Redesign"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full"
            />
          </div>

          {/* Client & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Client</label>
              <select
                value={form.clientName}
                onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                className="w-full"
              >
                <option value="">Select Client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="w-full"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Deadline & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Deadline</label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                className="w-full"
              />
            </div>
            {editingProject && (
              <div>
                <label className="input-label">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full"
                >
                  {COLUMNS.map((col) => (
                    <option key={col.id} value={col.id}>{col.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="input-label">Notes</label>
            <textarea
              rows={3}
              placeholder="Project details, requirements, etc."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full resize-none"
            />
          </div>

          {/* Subtasks */}
          <div>
            <label className="input-label">Subtasks</label>
            <div className="space-y-2 mb-3">
              {form.subtasks.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center gap-2 rounded-lg bg-dark-700/50 px-3 py-2 group"
                >
                  <button
                    type="button"
                    onClick={() => toggleFormSubtask(st.id)}
                    className="shrink-0"
                  >
                    {st.done ? (
                      <CheckSquare className="w-4 h-4 text-green-400" />
                    ) : (
                      <Square className="w-4 h-4 text-dark-400" />
                    )}
                  </button>
                  <span className={`flex-1 text-sm ${st.done ? 'line-through text-dark-500' : 'text-dark-200'}`}>
                    {st.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSubtaskFromForm(st.id)}
                    className="shrink-0 p-1 text-dark-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add subtask input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add a subtask..."
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSubtaskToForm();
                  }
                }}
                className="flex-1"
              />
              <button
                type="button"
                onClick={addSubtaskToForm}
                className="btn-secondary flex items-center gap-1 shrink-0"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-dark-600/50">
            <button onClick={closeModal} className="btn-ghost">
              Cancel
            </button>
            <button onClick={handleSave} className="btn-primary">
              {editingProject ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ========================================================
// Kanban Column
// ========================================================
function KanbanColumn({
  column,
  projects,
  expandedCards,
  onToggleExpand,
  onToggleSubtask,
  onEdit,
  onDelete,
  getDaysRemaining,
}) {
  return (
    <div className="flex flex-col min-h-[300px]">
      {/* Column Header */}
      <div className={`rounded-t-xl border-t-2 ${column.borderTop} bg-dark-800/60 backdrop-blur-sm px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${column.iconBg.replace('/10', '')} ${column.iconText.replace('text-', 'bg-')}`} />
          <h3 className="text-sm font-semibold text-dark-100">{column.label}</h3>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${column.iconBg} ${column.iconText}`}>
          {projects.length}
        </span>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 rounded-b-xl border border-t-0 border-dark-600/30 p-2 space-y-2 transition-colors duration-200 ${
              snapshot.isDraggingOver
                ? 'bg-white/[0.03] border-accent/20'
                : 'bg-dark-900/30'
            }`}
          >
            {projects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={index}
                isExpanded={!!expandedCards[project.id]}
                onToggleExpand={onToggleExpand}
                onToggleSubtask={onToggleSubtask}
                onEdit={onEdit}
                onDelete={onDelete}
                getDaysRemaining={getDaysRemaining}
              />
            ))}
            {provided.placeholder}

            {/* Empty state */}
            {projects.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex flex-col items-center justify-center py-10 text-dark-500">
                <Layers className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs">No projects</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}

// ========================================================
// Project Card (Draggable)
// ========================================================
function ProjectCard({
  project,
  index,
  isExpanded,
  onToggleExpand,
  onToggleSubtask,
  onEdit,
  onDelete,
  getDaysRemaining,
}) {
  const { subtasks = [] } = project;
  const completedCount = subtasks.filter((st) => st.done).length;
  const totalCount = subtasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const daysLeft = getDaysRemaining(project.deadline);
  const priority = PRIORITY_STYLES[project.priority] || PRIORITY_STYLES.medium;

  return (
    <Draggable draggableId={project.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`group rounded-lg border transition-all duration-200 ${
            snapshot.isDragging
              ? 'bg-dark-700 border-accent/30 shadow-xl shadow-accent/10 rotate-[2deg] scale-[1.02]'
              : 'bg-dark-800/80 backdrop-blur-xl border-dark-600/50 hover:border-dark-500/70 hover:shadow-lg hover:shadow-black/20'
          }`}
        >
          {/* Card Content */}
          <div className="p-3">
            {/* Top: Drag handle + Actions */}
            <div className="flex items-start gap-2">
              <div
                {...provided.dragHandleProps}
                className="mt-0.5 shrink-0 p-0.5 text-dark-600 hover:text-dark-300 cursor-grab active:cursor-grabbing transition-colors"
              >
                <GripVertical className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                {/* Title */}
                <button
                  onClick={() => onToggleExpand(project.id)}
                  className="w-full text-left flex items-start gap-1.5"
                >
                  {totalCount > 0 && (
                    isExpanded
                      ? <ChevronDown className="w-3.5 h-3.5 mt-0.5 shrink-0 text-dark-400" />
                      : <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-dark-400" />
                  )}
                  <span className="text-sm font-semibold text-dark-50 leading-snug line-clamp-2">
                    {project.title}
                  </span>
                </button>

                {/* Client name */}
                {project.clientName && (
                  <p className="text-xs text-dark-400 mt-1 ml-5 truncate">{project.clientName}</p>
                )}
              </div>

              {/* Quick actions */}
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onEdit(project)}
                  className="p-1 rounded text-dark-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(project.id, project.title)}
                  className="p-1 rounded text-dark-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Meta row: Priority + Deadline */}
            <div className="flex items-center gap-2 mt-2.5 ml-5 flex-wrap">
              {/* Priority badge */}
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${priority.bg} ${priority.text}`}>
                <Flag className="w-2.5 h-2.5" />
                {priority.label}
              </span>

              {/* Deadline */}
              {project.deadline && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                    daysLeft !== null && daysLeft < 0
                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                      : daysLeft !== null && daysLeft <= 3
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-dark-700 text-dark-300 border-dark-600'
                  }`}
                >
                  <Calendar className="w-2.5 h-2.5" />
                  {daysLeft !== null
                    ? daysLeft < 0
                      ? `${Math.abs(daysLeft)}d overdue`
                      : daysLeft === 0
                        ? 'Due today'
                        : daysLeft === 1
                          ? 'Tomorrow'
                          : `${daysLeft}d left`
                    : new Date(project.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  }
                </span>
              )}
            </div>

            {/* Progress bar */}
            {totalCount > 0 && (
              <div className="mt-3 ml-5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-dark-400">
                    {completedCount}/{totalCount} subtasks
                  </span>
                  <span className="text-[10px] text-dark-400 font-medium">
                    {progressPercent}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-dark-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                      progressPercent === 100
                        ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                        : 'bg-gradient-to-r from-orange-500 to-amber-400'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Expanded subtasks */}
            {isExpanded && totalCount > 0 && (
              <div className="mt-3 ml-5 space-y-1 animate-fade-in">
                {subtasks.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => onToggleSubtask(project.id, st.id)}
                    className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.03] transition-colors text-left"
                  >
                    {st.done ? (
                      <CheckSquare className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-dark-500 shrink-0" />
                    )}
                    <span
                      className={`text-xs leading-snug ${
                        st.done ? 'line-through text-dark-500' : 'text-dark-300'
                      }`}
                    >
                      {st.title}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
