export type ProgressStatus = "complete" | "progress" | "waiting" | "pending";

export interface ProgressTask {
  name: string;
  status: ProgressStatus;
}

export interface ProjectPhase {
  id: number;
  name: string;
  status: ProgressStatus;
  tasks: ProgressTask[];
}

export const projectPhases: ProjectPhase[] = [
  {
    id: 1,
    name: "Foundation & Database",
    status: "complete",
    tasks: [
      { name: "PostgreSQL", status: "complete" },
      { name: "Prisma Database", status: "complete" },
      { name: "Authentication", status: "complete" },
      { name: "Authorization", status: "complete" },
      { name: "Security Foundation", status: "complete" }
    ]
  },
  {
    id: 2,
    name: "WordPress Integration",
    status: "progress",
    tasks: [
      { name: "Backend Integration", status: "complete" },
      { name: "Website Management", status: "complete" },
      { name: "Credential Encryption", status: "complete" },
      { name: "Vue Website Management UI", status: "complete" },
      { name: "Website #1 Connection", status: "complete" },
      { name: "Website #1 Draft Test", status: "complete" },
      { name: "Website #2 Connection", status: "waiting" },
      { name: "Website #2 Draft Test", status: "pending" }
    ]
  },
  {
    id: 3,
    name: "Gemini Research Agent",
    status: "complete",
    tasks: [
      { name: "Gemini API Integration", status: "complete" },
      { name: "Research Prompt", status: "complete" },
      { name: "Structured Research Output", status: "complete" },
      { name: "Research Run Logging", status: "complete" },
      { name: "Research Result UI", status: "complete" },
      { name: "Final Acceptance Test", status: "complete" }
    ]
  },
  {
    id: 4,
    name: "Writer Agent (Gemini Pilot)",
    status: "complete",
    tasks: [
      { name: "Gemini Writer Integration", status: "complete" },
      { name: "Writer Prompt", status: "complete" },
      { name: "Structured Article Output", status: "complete" },
      { name: "Brand Voice Rules", status: "complete" },
      { name: "AIRun Logging", status: "complete" },
      { name: "Article Preview Action", status: "complete" },
      { name: "Acceptance Test", status: "complete" }
    ]
  },
  {
    id: 5,
    name: "SEO & Quality Agent (Gemini Pilot)",
    status: "complete",
    tasks: [
      { name: "Gemini Quality Integration", status: "complete" },
      { name: "Structured Quality Output", status: "complete" },
      { name: "SEO Review", status: "complete" },
      { name: "Quality Score", status: "complete" },
      { name: "Revision Feedback Loop", status: "complete" },
      { name: "Maximum 2 Revisions", status: "complete" },
      { name: "Quality Review UI", status: "complete" },
      { name: "Acceptance Test", status: "complete" }
    ]
  },
  {
    id: 6,
    name: "Final Workflow & Production",
    status: "progress",
    tasks: [
      { name: "AI Orchestration", status: "complete" },
      { name: "Scheduled Date & Time Automation", status: "complete" },
      { name: "Persistent Schedule Worker", status: "complete" },
      { name: "Blog Topic Focus Management", status: "complete" },
      { name: "Review & Publish Workflow", status: "complete" },
      { name: "WordPress Draft Workflow", status: "complete" },
      { name: "Admin Publish Guard", status: "complete" },
      { name: "LINE Group Notification", status: "pending" },
      { name: "Production Deployment", status: "pending" },
      { name: "Final Acceptance Test", status: "progress" }
    ]
  }
];
