"use client";

import { Users, Plus, CheckCircle, Clock, AlertCircle } from "lucide-react";

const taskStatusIcons = {
  todo: <Clock size={14} className="text-gray-400" />,
  in_progress: <AlertCircle size={14} className="text-yellow-400" />,
  done: <CheckCircle size={14} className="text-green-400" />,
};

// Placeholder data
const teamMembers: {
  id: number;
  name: string;
  role: string;
  responsibilities: string[];
  taskCount: number;
}[] = [];

const tasks: {
  id: number;
  title: string;
  assignee: string;
  dueDate: string;
  status: "todo" | "in_progress" | "done";
  priority: string;
}[] = [];

export default function AdminTeamPage() {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Team</h1>
          <p className="text-gray-400 mt-1">
            Roles, responsibilities, and task tracking
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 border border-white/10 text-gray-300 hover:text-gold-500 hover:border-gold-500/30 px-4 py-2 rounded-lg text-sm transition-colors">
            <Plus size={14} />
            Add Member
          </button>
          <button className="flex items-center gap-2 bg-gold-gradient text-black font-semibold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition-opacity">
            <Plus size={14} />
            Add Task
          </button>
        </div>
      </div>

      {/* Team Members */}
      <div className="mb-10">
        <h2 className="font-semibold mb-4">Team Members</h2>
        {teamMembers.length === 0 ? (
          <div className="bg-dark-500 border border-white/10 rounded-xl p-8 text-center">
            <Users size={28} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              Add team members to assign roles and track responsibilities.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="bg-dark-500 border border-white/10 rounded-xl p-5"
              >
                <h3 className="font-bold">{member.name}</h3>
                <p className="text-gold-500 text-sm">{member.role}</p>
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Board */}
      <div>
        <h2 className="font-semibold mb-4">Task Board</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(["todo", "in_progress", "done"] as const).map((status) => (
            <div
              key={status}
              className="bg-dark-500 border border-white/10 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-4">
                {taskStatusIcons[status]}
                <h3 className="text-sm font-medium capitalize">
                  {status.replace("_", " ")}
                </h3>
                <span className="text-gray-500 text-xs bg-white/5 px-2 py-0.5 rounded ml-auto">
                  {tasks.filter((t) => t.status === status).length}
                </span>
              </div>
              {tasks
                .filter((t) => t.status === status)
                .map((task) => (
                  <div
                    key={task.id}
                    className="bg-dark-300/50 rounded-lg p-3 mb-2"
                  >
                    <p className="text-sm font-medium">{task.title}</p>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span>{task.assignee}</span>
                      <span>{task.dueDate}</span>
                    </div>
                  </div>
                ))}
              {tasks.filter((t) => t.status === status).length === 0 && (
                <p className="text-gray-600 text-xs text-center py-4">
                  No tasks
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
