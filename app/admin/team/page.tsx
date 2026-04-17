"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { TeamMember, TeamTask } from "@/lib/types";

const taskStatusIcons = {
  todo: <Clock size={14} className="text-gray-400" />,
  in_progress: <AlertCircle size={14} className="text-yellow-400" />,
  done: <CheckCircle size={14} className="text-green-400" />,
  blocked: <AlertCircle size={14} className="text-red-400" />,
};

interface MemberForm {
  id?: string;
  name: string;
  role: string;
  responsibilities: string;
  phone: string;
  email: string;
}

interface TaskForm {
  id?: string;
  title: string;
  description: string;
  assigned_to: string;
  due_date: string;
  status: TeamTask["status"];
  priority: TeamTask["priority"];
}

const emptyMember: MemberForm = {
  name: "",
  role: "",
  responsibilities: "",
  phone: "",
  email: "",
};

const emptyTask: TaskForm = {
  title: "",
  description: "",
  assigned_to: "",
  due_date: "",
  status: "todo",
  priority: "medium",
};

export default function AdminTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberForm, setMemberForm] = useState<MemberForm | null>(null);
  const [taskForm, setTaskForm] = useState<TaskForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "member" | "task";
    id: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const res = await fetch("/api/admin/team");
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members || []);
      setTasks(data.tasks || []);
    }
    setLoading(false);
  }

  async function saveMember(e: React.FormEvent) {
    e.preventDefault();
    if (!memberForm) return;
    setSaving(true);

    const body = {
      type: "member",
      ...memberForm,
      responsibilities: memberForm.responsibilities
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    const res = await fetch("/api/admin/team", {
      method: memberForm.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setMemberForm(null);
      await loadData();
    } else {
      alert((await res.json()).error || "Save failed");
    }
    setSaving(false);
  }

  async function saveTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskForm) return;
    setSaving(true);

    const body = {
      type: "task",
      ...taskForm,
      due_date: taskForm.due_date || null,
    };

    const res = await fetch("/api/admin/team", {
      method: taskForm.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setTaskForm(null);
      await loadData();
    } else {
      alert((await res.json()).error || "Save failed");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch("/api/admin/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: deleteTarget.type, id: deleteTarget.id }),
    });
    if (res.ok) await loadData();
    setDeleteTarget(null);
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Team</h1>
          <p className="text-gray-400 mt-1">Roles and task tracking</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMemberForm(emptyMember)}
            className="flex items-center gap-2 border border-white/10 hover:border-gold-500/30 text-gray-300 hover:text-gold-500 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Plus size={14} />
            Add Member
          </button>
          <button
            onClick={() => setTaskForm(emptyTask)}
            disabled={members.length === 0}
            className="flex items-center gap-2 bg-gold-gradient text-black font-semibold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Plus size={14} />
            Add Task
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : (
        <>
          {/* Members */}
          <div className="mb-10">
            <h2 className="font-semibold mb-4">
              Team Members ({members.length})
            </h2>
            {members.length === 0 ? (
              <div className="bg-dark-500 border border-white/10 rounded-xl p-8 text-center">
                <Users size={28} className="text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">
                  Add team members to assign tasks and track responsibilities.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="bg-dark-500 border border-white/10 rounded-xl p-5 relative group"
                  >
                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() =>
                          setMemberForm({
                            id: member.id,
                            name: member.name,
                            role: member.role,
                            responsibilities: member.responsibilities?.join(", ") || "",
                            phone: member.phone || "",
                            email: member.email || "",
                          })
                        }
                        className="text-gray-400 hover:text-gold-500 p-1"
                        aria-label={`Edit ${member.name}`}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteTarget({ type: "member", id: member.id })
                        }
                        className="text-gray-400 hover:text-red-400 p-1"
                        aria-label={`Delete ${member.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <h3 className="font-bold">{member.name}</h3>
                    <p className="text-gold-500 text-sm">{member.role}</p>
                    {member.responsibilities && member.responsibilities.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {member.responsibilities.map((r) => (
                          <span
                            key={r}
                            className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tasks */}
          <div>
            <h2 className="font-semibold mb-4">Task Board</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(["todo", "in_progress", "done"] as const).map((status) => {
                const statusTasks = tasks.filter((t) => t.status === status);
                return (
                  <div
                    key={status}
                    className="bg-dark-500 border border-white/10 rounded-xl p-4 min-h-[200px]"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      {taskStatusIcons[status]}
                      <h3 className="text-sm font-medium capitalize">
                        {status.replace("_", " ")}
                      </h3>
                      <span className="text-gray-500 text-xs bg-white/5 px-2 py-0.5 rounded ml-auto">
                        {statusTasks.length}
                      </span>
                    </div>
                    {statusTasks.length === 0 ? (
                      <p className="text-gray-600 text-xs text-center py-4">No tasks</p>
                    ) : (
                      statusTasks.map((task) => {
                        const assignee = members.find((m) => m.id === task.assigned_to);
                        return (
                          <button
                            key={task.id}
                            onClick={() =>
                              setTaskForm({
                                id: task.id,
                                title: task.title,
                                description: task.description || "",
                                assigned_to: task.assigned_to,
                                due_date: task.due_date || "",
                                status: task.status,
                                priority: task.priority,
                              })
                            }
                            className="w-full text-left bg-dark-300/50 hover:bg-dark-300 rounded-lg p-3 mb-2 transition-colors"
                          >
                            <p className="text-sm font-medium">{task.title}</p>
                            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                              <span>{assignee?.name || "Unassigned"}</span>
                              {task.due_date && (
                                <span>
                                  {new Date(task.due_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Member Form */}
      {memberForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-500 border border-white/10 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-xl font-bold">
                {memberForm.id ? "Edit Member" : "Add Team Member"}
              </h2>
              <button
                onClick={() => setMemberForm(null)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveMember} className="p-5 space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Name *</label>
                <input
                  required
                  type="text"
                  value={memberForm.name}
                  onChange={(e) =>
                    setMemberForm({ ...memberForm, name: e.target.value })
                  }
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Role *</label>
                <input
                  required
                  type="text"
                  value={memberForm.role}
                  onChange={(e) =>
                    setMemberForm({ ...memberForm, role: e.target.value })
                  }
                  placeholder="DJ, Content Creator, Founder..."
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">
                  Responsibilities (comma-separated)
                </label>
                <input
                  type="text"
                  value={memberForm.responsibilities}
                  onChange={(e) =>
                    setMemberForm({
                      ...memberForm,
                      responsibilities: e.target.value,
                    })
                  }
                  placeholder="booking venues, social media, video editing"
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Phone</label>
                  <input
                    type="tel"
                    value={memberForm.phone}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, phone: e.target.value })
                    }
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Email</label>
                  <input
                    type="email"
                    value={memberForm.email}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, email: e.target.value })
                    }
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setMemberForm(null)}
                  className="px-4 py-2 text-sm text-gray-300 hover:text-white border border-white/10 rounded-lg"
                >
                  Cancel
                </button>
                {memberForm.id && (
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({ type: "member", id: memberForm.id! })
                    }
                    className="px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-400/30 rounded-lg"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-gold-gradient text-black font-semibold px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {memberForm.id ? "Save" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Form */}
      {taskForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-500 border border-white/10 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-xl font-bold">
                {taskForm.id ? "Edit Task" : "Add Task"}
              </h2>
              <button
                onClick={() => setTaskForm(null)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveTask} className="p-5 space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Title *</label>
                <input
                  required
                  type="text"
                  value={taskForm.title}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, title: e.target.value })
                  }
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">
                  Description
                </label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, description: e.target.value })
                  }
                  rows={2}
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">
                  Assigned to *
                </label>
                <select
                  required
                  value={taskForm.assigned_to}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, assigned_to: e.target.value })
                  }
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                >
                  <option value="">Select...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, due_date: e.target.value })
                    }
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">
                    Priority
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) =>
                      setTaskForm({
                        ...taskForm,
                        priority: e.target.value as TaskForm["priority"],
                      })
                    }
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Status</label>
                <select
                  value={taskForm.status}
                  onChange={(e) =>
                    setTaskForm({
                      ...taskForm,
                      status: e.target.value as TaskForm["status"],
                    })
                  }
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                >
                  <option value="todo">Todo</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setTaskForm(null)}
                  className="px-4 py-2 text-sm text-gray-300 hover:text-white border border-white/10 rounded-lg"
                >
                  Cancel
                </button>
                {taskForm.id && (
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({ type: "task", id: taskForm.id! })
                    }
                    className="px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-400/30 rounded-lg"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-gold-gradient text-black font-semibold px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {taskForm.id ? "Save" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={`Delete ${deleteTarget?.type}?`}
        message={
          deleteTarget?.type === "member"
            ? "This will remove the team member. Their tasks will remain but become unassigned."
            : "This will permanently delete this task."
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
