import { courseData } from "./course";

export type CompletionType = "view" | "watch" | "submit" | "explore" | "complete" | "optional";

export type CompletionMilestone = {
  id: string;
  label: string;
  type: CompletionType;
  targetId: string;
  path?: string;
  requiredItems?: string[];
  required: boolean;
  threshold?: number;
};

export const completionSettings = {
  storageKey: "astro-course-progress:on-match-the-move:v3",
  completionEnabled: true,
};

// All seven lessons. The final People Connect quiz is outside this Astro course.
export const completionMilestones: CompletionMilestone[] = [
  { id: "lesson-0-guidance", label: "Your learning, your pace", type: "view", targetId: "lesson-0-guidance", path: "/", required: true },
  { id: "lesson-0-why", label: "Why ON?", type: "view", targetId: "lesson-0-why", path: "/", required: true },
  { id: "lesson-0-customers", label: "Every Customer moves differently", type: "view", targetId: "lesson-0-customers", path: "/", required: true },
  { id: "lesson-0-scenario", label: "You are on the footwear floor", type: "complete", targetId: "lesson-0-scenario", path: "/", required: true },
  { id: "lesson-0-check", label: "Check your understanding", type: "submit", targetId: "lesson-0-check", path: "/", required: true },
  { id: "lesson-0-reflection", label: "Your starting point", type: "complete", targetId: "lesson-0-reflection", path: "/", required: true },
  { id: "lesson-0-takeaway", label: "Key takeaway", type: "view", targetId: "lesson-0-takeaway", path: "/", required: true },
  { id: "lesson-1-introduction", label: "Product knowledge that moves the conversation", type: "view", targetId: "lesson-1-introduction", path: "/lesson-1/", required: true },
  { id: "lesson-1-profiles", label: "Customer profiles", type: "explore", targetId: "lesson-1-profiles", path: "/lesson-1/", requiredItems: ["profile-1", "profile-2", "profile-3", "profile-4", "profile-5", "profile-6", "profile-7", "profile-8"], required: true },
  { id: "lesson-1-check-clue", label: "Check the clue", type: "complete", targetId: "lesson-1-check-clue", path: "/lesson-1/", required: true },
  { id: "lesson-1-technology", label: "Get to Know the Technology Inside the Shoe", type: "explore", targetId: "lesson-1-technology", path: "/lesson-1/", requiredItems: ["technology-1", "technology-2", "technology-3", "technology-4", "technology-5", "technology-6", "technology-7"], required: true },
  { id: "lesson-1-challenge", label: "Quick Customer Challenge", type: "complete", targetId: "lesson-1-challenge", path: "/lesson-1/", required: true },
  { id: "lesson-1-technology-takeaway", label: "Technology key takeaway", type: "view", targetId: "lesson-1-technology-takeaway", path: "/lesson-1/", required: true },
  { id: "lesson-1-measure", label: "Measure what matters", type: "explore", targetId: "lesson-1-measure", path: "/lesson-1/", requiredItems: ["hotspot-1", "hotspot-2", "hotspot-3", "hotspot-4"], required: true },
  { id: "lesson-1-discovery", label: "Ask before you recommend", type: "view", targetId: "lesson-1-discovery", path: "/lesson-1/", required: true },
  { id: "lesson-1-matching", label: "Listen for the clue", type: "complete", targetId: "lesson-1-matching", path: "/lesson-1/", required: true },
  { id: "lesson-1-reflection", label: "Discovery question reflection", type: "complete", targetId: "lesson-1-reflection", path: "/lesson-1/", required: true },
  { id: "lesson-1-takeaway", label: "Key takeaway", type: "view", targetId: "lesson-1-takeaway", path: "/lesson-1/", required: true },
  { id: "lesson-2-introduction", label: "Everyday running introduction", type: "view", targetId: "lesson-2-introduction", path: "/lesson-2/", required: true },
  { id: "lesson-2-sipho-check", label: "Meet Sipho", type: "complete", targetId: "lesson-2-sipho-check", path: "/lesson-2/", required: true },
  { id: "lesson-2-products", label: "Explore everyday running shoes", type: "explore", targetId: "lesson-2-products", path: "/lesson-2/", requiredItems: courseData.lesson2.explorer.products.map((product) => product.id), required: true },
  { id: "lesson-2-feature-cards", label: "Everyday running benefits", type: "explore", targetId: "lesson-2-feature-cards", path: "/lesson-2/", requiredItems: courseData.lesson2.explorer.products.map((product) => product.id), required: true },
  { id: "lesson-2-matching", label: "Build the everyday recommendation", type: "complete", targetId: "lesson-2-matching", path: "/lesson-2/", required: true },
  { id: "lesson-2-knowledge", label: "Everyday running knowledge check", type: "complete", targetId: "lesson-2-knowledge", path: "/lesson-2/", required: true },
  { id: "lesson-2-takeaway", label: "Everyday running takeaway", type: "view", targetId: "lesson-2-takeaway", path: "/lesson-2/", required: true },
  { id: "lesson-3-introduction", label: "Performance running introduction", type: "view", targetId: "lesson-3-introduction", path: "/lesson-3/", required: true },
  { id: "lesson-3-anele-check", label: "Meet Anele", type: "complete", targetId: "lesson-3-anele-check", path: "/lesson-3/", required: true },
  { id: "lesson-3-products", label: "Explore performance running shoes", type: "explore", targetId: "lesson-3-products", path: "/lesson-3/", requiredItems: courseData.lesson3.explorer.products.map((product) => product.id), required: true },
  { id: "lesson-3-feature-cards", label: "Performance running benefits", type: "explore", targetId: "lesson-3-feature-cards", path: "/lesson-3/", requiredItems: courseData.lesson3.explorer.products.map((product) => product.id), required: true },
  { id: "lesson-3-matching", label: "Build the performance recommendation", type: "complete", targetId: "lesson-3-matching", path: "/lesson-3/", required: true },
  { id: "lesson-3-knowledge", label: "Performance knowledge check", type: "complete", targetId: "lesson-3-knowledge", path: "/lesson-3/", required: true },
  { id: "lesson-3-takeaway", label: "Performance running takeaway", type: "view", targetId: "lesson-3-takeaway", path: "/lesson-3/", required: true },
  { id: "lesson-4-introduction", label: "Outdoor introduction", type: "view", targetId: "lesson-4-introduction", path: "/lesson-4/", required: true },
  { id: "lesson-4-lerato-check", label: "Meet Lerato", type: "complete", targetId: "lesson-4-lerato-check", path: "/lesson-4/", required: true },
  { id: "lesson-4-products", label: "Explore outdoor shoes", type: "explore", targetId: "lesson-4-products", path: "/lesson-4/", requiredItems: courseData.lesson4.explorer.products.map((product) => product.id), required: true },
  { id: "lesson-4-feature-cards", label: "Outdoor benefits", type: "explore", targetId: "lesson-4-feature-cards", path: "/lesson-4/", requiredItems: courseData.lesson4.explorer.products.map((product) => product.id), required: true },
  { id: "lesson-4-matching", label: "Build the outdoor recommendation", type: "complete", targetId: "lesson-4-matching", path: "/lesson-4/", required: true },
  { id: "lesson-4-knowledge", label: "Outdoor knowledge check", type: "complete", targetId: "lesson-4-knowledge", path: "/lesson-4/", required: true },
  { id: "lesson-4-takeaway", label: "Outdoor takeaway", type: "view", targetId: "lesson-4-takeaway", path: "/lesson-4/", required: true },
  { id: "lesson-5-introduction", label: "Training and lifestyle introduction", type: "view", targetId: "lesson-5-introduction", path: "/lesson-5/", required: true },
  { id: "lesson-5-thabo-check", label: "Meet Thabo", type: "complete", targetId: "lesson-5-thabo-check", path: "/lesson-5/", required: true },
  { id: "lesson-5-products", label: "Explore training and lifestyle shoes", type: "explore", targetId: "lesson-5-products", path: "/lesson-5/", requiredItems: courseData.lesson5.explorer.products.map((product) => product.id), required: true },
  { id: "lesson-5-feature-cards", label: "Training and lifestyle benefits", type: "explore", targetId: "lesson-5-feature-cards", path: "/lesson-5/", requiredItems: courseData.lesson5.explorer.products.map((product) => product.id), required: true },
  { id: "lesson-5-matching", label: "Build the training recommendation", type: "complete", targetId: "lesson-5-matching", path: "/lesson-5/", required: true },
  { id: "lesson-5-knowledge", label: "Training and lifestyle knowledge check", type: "complete", targetId: "lesson-5-knowledge", path: "/lesson-5/", required: true },
  { id: "lesson-5-takeaway", label: "Training and lifestyle takeaway", type: "view", targetId: "lesson-5-takeaway", path: "/lesson-5/", required: true },
  { id: "lesson-6-introduction", label: "Final lesson introduction", type: "view", targetId: "lesson-6-introduction", path: "/lesson-6/", required: true },
  { id: "lesson-6-run", label: "RUN the recommendation", type: "explore", targetId: "lesson-6-run", path: "/lesson-6/", requiredItems: ["run-r", "run-u", "run-n"], required: true },
  { id: "lesson-6-dialogue", label: "Watch RUN in action", type: "view", targetId: "lesson-6-dialogue", path: "/lesson-6/", required: true },
  { id: "lesson-6-conclusion", label: "Every move has a match", type: "view", targetId: "lesson-6-conclusion", path: "/lesson-6/", required: true },
  { id: "lesson-6-challenge", label: "Final quiz instructions", type: "view", targetId: "lesson-6-challenge", path: "/lesson-6/", required: true },
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
    if (milestone.path && !/^\/(?:[a-z0-9-]+\/)*$/i.test(milestone.path)) errors.push(`${location} has an invalid page path.`);
    if (milestone.requiredItems && (milestone.type !== "explore" || milestone.requiredItems.length === 0 || new Set(milestone.requiredItems).size !== milestone.requiredItems.length)) errors.push(`${location} has invalid exploration items.`);
    if (milestone.type === "explore" && milestone.path && !milestone.requiredItems?.length) errors.push(`${location} needs requiredItems for cross-page restoration.`);
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
