"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@clawe/backend";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@clawe/ui/components/dialog";
import { Button } from "@clawe/ui/components/button";
import { Textarea } from "@clawe/ui/components/textarea";
import { cn } from "@clawe/ui/lib/utils";
import { Circle, ThumbsUp, Pencil } from "lucide-react";
import type { Id } from "@clawe/backend/dataModel";
import type { KanbanTask } from "./types";
import type { DocumentWithCreator } from "@clawe/backend/types";
import { DocumentsSection } from "./_components/documents-section";
import { DocumentViewerModal } from "./_components/document-viewer-modal";

const priorityConfig: Record<
  KanbanTask["priority"],
  { label: string; className: string }
> = {
  high: {
    label: "High",
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  medium: {
    label: "Medium",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  low: {
    label: "Low",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  },
};

export type TaskDetailModalProps = {
  task: KanbanTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const TaskDetailModal = ({
  task,
  open,
  onOpenChange,
}: TaskDetailModalProps) => {
  const [selectedDocument, setSelectedDocument] =
    useState<DocumentWithCreator | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const approve = useMutation(api.tasks.approve);
  const requestChanges = useMutation(api.tasks.requestChanges);

  if (!task) return null;

  const priority = priorityConfig[task.priority];
  const hasSubtasks = task.subtasks.length > 0;
  const isReview = task.status === "review";

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await approve({
        taskId: task.id as Id<"tasks">,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!feedback.trim()) return;
    setIsSubmitting(true);
    try {
      await requestChanges({
        taskId: task.id as Id<"tasks">,
        feedback: feedback.trim(),
      });
      setFeedback("");
      setShowFeedback(false);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setShowFeedback(false);
      setFeedback("");
    }
    onOpenChange(open);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">{task.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Priority badge */}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium",
                  priority.className,
                )}
              >
                {priority.label} Priority
              </span>
            </div>

            {/* Description */}
            {task.description && (
              <div>
                <h4 className="text-muted-foreground mb-1 text-sm font-medium">
                  Description
                </h4>
                <p className="text-sm">{task.description}</p>
              </div>
            )}

            {/* Subtasks list */}
            {hasSubtasks && (
              <div>
                <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                  Subtasks ({task.subtasks.length})
                </h4>
                <ul className="space-y-2">
                  {task.subtasks.map((subtask) => (
                    <li
                      key={subtask.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Circle className="text-muted-foreground h-4 w-4" />
                      <span>{subtask.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Documents section */}
            <DocumentsSection
              taskId={task.id}
              onViewDocument={setSelectedDocument}
            />

            {/* Review actions */}
            {isReview && (
              <div className="bg-muted/50 rounded-lg p-4">
                {!showFeedback ? (
                  <>
                    <p className="text-muted-foreground mb-3 text-sm font-medium">
                      What do you think?
                    </p>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-950/50 flex-1"
                        onClick={handleApprove}
                        disabled={isSubmitting}
                      >
                        <ThumbsUp className="mr-2 h-4 w-4" />
                        Looks good!
                      </Button>
                      <Button
                        variant="outline"
                        className="border-amber-200 hover:bg-amber-50 hover:border-amber-300 dark:border-amber-800 dark:hover:bg-amber-950/50 flex-1"
                        onClick={() => setShowFeedback(true)}
                        disabled={isSubmitting}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Needs tweaks
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground mb-2 text-sm font-medium">
                      What needs to change?
                    </p>
                    <Textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Describe the changes needed..."
                      className="mb-3 min-h-[80px] resize-none"
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowFeedback(false);
                          setFeedback("");
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleRequestChanges}
                        disabled={isSubmitting || !feedback.trim()}
                      >
                        Send feedback
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Document viewer modal */}
      <DocumentViewerModal
        document={selectedDocument}
        open={selectedDocument !== null}
        onOpenChange={(isOpen) => !isOpen && setSelectedDocument(null)}
      />
    </>
  );
};
