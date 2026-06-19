/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RepairOrderStatus } from "./types";
import { normalizeRepairOrderStatus } from "./sav-core";

export interface TaskStatusVisual {
  status: RepairOrderStatus;
  label: string;
  className: string;
  badgeClassName: string;
  borderClassName: string;
  dotClassName: string;
  priority: number;
  testId: string;
}

export const TASK_STATUS_VISUAL_ORDER: RepairOrderStatus[] = [
  "in_progress",
  "blocked",
  "reopened",
  "paused",
  "pending",
  "done",
];

const TASK_STATUS_VISUALS: Record<RepairOrderStatus, Omit<TaskStatusVisual, "status">> = {
  pending: {
    label: "En attente",
    className: "bg-blue-50/95 border-blue-400 text-blue-900",
    badgeClassName: "bg-blue-50 text-blue-700 border-blue-100",
    borderClassName: "border-blue-400",
    dotClassName: "bg-blue-500",
    priority: 30,
    testId: "gantt-task-status-pending",
  },
  in_progress: {
    label: "En cours",
    className: "bg-orange-50/95 border-orange-500 text-orange-900",
    badgeClassName: "bg-orange-50 text-orange-800 border-orange-100",
    borderClassName: "border-orange-500",
    dotClassName: "bg-orange-500",
    priority: 90,
    testId: "gantt-task-status-in-progress",
  },
  paused: {
    label: "Suspendue",
    className: "bg-yellow-50/95 border-yellow-500 text-yellow-900",
    badgeClassName: "bg-yellow-50 text-yellow-800 border-yellow-100",
    borderClassName: "border-yellow-500",
    dotClassName: "bg-yellow-500",
    priority: 50,
    testId: "gantt-task-status-paused",
  },
  blocked: {
    label: "Bloquée",
    className: "bg-red-50/95 border-red-500 text-red-900",
    badgeClassName: "bg-red-50 text-red-800 border-red-100",
    borderClassName: "border-red-500",
    dotClassName: "bg-red-500",
    priority: 100,
    testId: "gantt-task-status-blocked",
  },
  done: {
    label: "Terminée",
    className: "bg-green-50/95 border-green-500 text-green-900",
    badgeClassName: "bg-green-50 text-green-800 border-green-100",
    borderClassName: "border-green-500",
    dotClassName: "bg-green-500",
    priority: 10,
    testId: "gantt-task-status-done",
  },
  reopened: {
    label: "Reprise",
    className: "bg-purple-50/95 border-purple-500 text-purple-900",
    badgeClassName: "bg-purple-50 text-purple-800 border-purple-100",
    borderClassName: "border-purple-500",
    dotClassName: "bg-purple-500",
    priority: 80,
    testId: "gantt-task-status-reopened",
  },
};

export function getTaskStatusVisual(status: RepairOrderStatus | string): TaskStatusVisual {
  const normalized = normalizeRepairOrderStatus(status);
  return {
    status: normalized,
    ...TASK_STATUS_VISUALS[normalized],
  };
}
