export type CompletionType = "view" | "watch" | "submit" | "explore" | "complete" | "optional";

export type CompletionMilestone = {
  id: string;
  label: string;
  type: CompletionType;
  targetId: string;
  required: boolean;
  threshold?: number;
};

export const completionSettings = {
  storageKey: "astro-course-progress:nike-winflo-12:v1",
};

export const completionMilestones: CompletionMilestone[] = [
  { id: "lesson-1", label: "Welcome and Customer moment", type: "view", targetId: "lesson-1", required: true },
  { id: "customer-moment", label: "Customer moment and learning journey", type: "view", targetId: "customer-moment", required: true },
  { id: "lesson-2", label: "Product basics", type: "view", targetId: "lesson-2", required: true },
  { id: "lesson-3", label: "Technology lesson", type: "view", targetId: "lesson-3", required: true },
  { id: "technology-carousel", label: "Explore six technology features", type: "explore", targetId: "technology-carousel", required: true },
  { id: "lesson-4", label: "Customer fit lesson", type: "view", targetId: "lesson-4", required: true },
  { id: "fit-carousel", label: "Explore five Customer fits", type: "explore", targetId: "fit-carousel", required: true },
  { id: "lesson-5", label: "Product updates", type: "view", targetId: "lesson-5", required: true },
  { id: "lesson-6", label: "A-M-E-R selling message", type: "view", targetId: "lesson-6", required: true },
  { id: "lesson-7", label: "Customer scenarios", type: "view", targetId: "lesson-7", required: true },
  { id: "needs-carousel", label: "Explore six Customer needs", type: "explore", targetId: "needs-carousel", required: true },
  { id: "lesson-8", label: "Practice lesson", type: "view", targetId: "lesson-8", required: true },
  { id: "practice-1", label: "Attempt practice question 1", type: "complete", targetId: "practice-1", required: true },
  { id: "practice-2", label: "Attempt practice question 2", type: "complete", targetId: "practice-2", required: true },
  { id: "practice-3", label: "Attempt practice question 3", type: "complete", targetId: "practice-3", required: true },
  { id: "recap", label: "Course recap", type: "view", targetId: "recap", required: true },
];

const completionTypes = new Set<CompletionType>(["view", "watch", "submit", "explore", "complete", "optional"]);

export function validateCompletionConfiguration(milestones: CompletionMilestone[], storageKey: string) {
  const errors: string[] = [];
  const ids = new Set<string>();
  const targetIds = new Set<string>();

  if (!/^astro-course-progress:[a-z0-9-]+:v\d+(?:\.\d+)*$/i.test(storageKey)) {
    errors.push(`Storage key "${storageKey}" must be course-specific and versioned.`);
  }

  milestones.forEach((milestone, index) => {
    const location = `Milestone ${index + 1}`;
    if (!milestone.id.trim()) errors.push(`${location} has no id.`);
    if (!milestone.label.trim()) errors.push(`${location} has no label.`);
    if (!milestone.targetId.trim()) errors.push(`${location} has no targetId.`);
    if (!completionTypes.has(milestone.type)) errors.push(`${location} has an unsupported type.`);
    if (typeof milestone.required !== "boolean") errors.push(`${location} must declare required as a boolean.`);
    if (ids.has(milestone.id)) errors.push(`Duplicate completion id "${milestone.id}".`);
    if (targetIds.has(milestone.targetId)) errors.push(`Duplicate completion target "${milestone.targetId}".`);
    if (milestone.threshold !== undefined && (milestone.type !== "watch" || !Number.isFinite(milestone.threshold) || milestone.threshold <= 0 || milestone.threshold > 1)) {
      errors.push(`${location} has an invalid watch threshold.`);
    }
    ids.add(milestone.id);
    targetIds.add(milestone.targetId);
  });

  if (errors.length) throw new Error(`Invalid completion configuration:\n- ${errors.join("\n- ")}`);
}

validateCompletionConfiguration(completionMilestones, completionSettings.storageKey);
