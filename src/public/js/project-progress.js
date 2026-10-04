import { bindLogout, getCurrentUser, requireAuth } from "./auth.js";

const projectPhases = [
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
      { name: "Website Management UI", status: "complete" },
      { name: "Website #1 Connection", status: "waiting" },
      { name: "Website #1 Draft Test", status: "pending" },
      { name: "Website #2 Connection", status: "waiting" },
      { name: "Website #2 Draft Test", status: "pending" }
    ]
  },
  {
    id: 3,
    name: "Gemini Research Agent",
    status: "pending",
    tasks: [
      { name: "Research Agent Service", status: "pending" },
      { name: "Structured Research Output", status: "pending" },
      { name: "Keyword Research", status: "pending" },
      { name: "Research Run Logging", status: "pending" }
    ]
  },
  {
    id: 4,
    name: "Claude Content Writer",
    status: "pending",
    tasks: [
      { name: "Writer Agent Service", status: "pending" },
      { name: "Article Structure", status: "pending" },
      { name: "Brand Voice", status: "pending" },
      { name: "Article Storage", status: "pending" }
    ]
  },
  {
    id: 5,
    name: "GPT SEO & Quality",
    status: "pending",
    tasks: [
      { name: "SEO Review", status: "pending" },
      { name: "Quality Score", status: "pending" },
      { name: "Revision Feedback", status: "pending" },
      { name: "Revision Loop", status: "pending" }
    ]
  },
  {
    id: 6,
    name: "Final Workflow & Production",
    status: "pending",
    tasks: [
      { name: "Full AI Orchestration", status: "pending" },
      { name: "Article Review Workflow", status: "pending" },
      { name: "LINE Notification", status: "pending" },
      { name: "Production Deployment", status: "pending" },
      { name: "Final Production Test", status: "pending" }
    ]
  }
];

const statusIcon = {
  complete: "✓",
  progress: "…",
  waiting: "○",
  pending: "○"
};

const getPhasePercent = (phase) => {
  if (!phase.tasks.length) return 0;
  const complete = phase.tasks.filter((task) => task.status === "complete").length;
  return Math.round((complete / phase.tasks.length) * 100);
};

const renderPhases = () => {
  const phaseGrid = document.getElementById("phaseGrid");
  phaseGrid.innerHTML = "";

  projectPhases.forEach((phase) => {
    const percent = getPhasePercent(phase);
    const card = document.createElement("article");
    card.className = `phase-card ${phase.status === "progress" ? "current" : ""}`;
    card.innerHTML = `
      <div class="phase-title-row">
        <div>
          <span class="phase-kicker">PHASE ${phase.id}</span>
          <h3>${phase.name}</h3>
        </div>
        <span class="phase-state ${phase.status}">${statusIcon[phase.status]}</span>
      </div>
      <div class="phase-progress-row">
        <div class="phase-progress-track">
          <span style="width: ${percent}%"></span>
        </div>
        <strong>${percent}%</strong>
      </div>
      <ul class="phase-task-list">
        ${phase.tasks
          .map(
            (task) => `
              <li class="task-${task.status}">
                <span class="task-status-icon">${statusIcon[task.status]}</span>
                <span>${task.name}</span>
              </li>
            `
          )
          .join("")}
      </ul>
    `;
    phaseGrid.appendChild(card);
  });
};

const renderSummary = () => {
  const tasks = projectPhases.flatMap((phase) => phase.tasks);
  const completed = tasks.filter((task) => task.status === "complete").length;
  const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const current = projectPhases.find((phase) => phase.status === "progress");

  document.getElementById("overallProgress").textContent = `${percent}%`;
  document.getElementById("overallTaskCount").textContent = `${completed} of ${tasks.length} tasks completed`;
  document.getElementById("completedTasks").textContent = String(completed);

  if (current) {
    document.getElementById("currentPhase").textContent = `Phase ${current.id}`;
    document.getElementById("currentPhaseName").textContent = current.name;
  }

  const completedList = document.getElementById("completedToday");
  const completedItems = projectPhases
    .flatMap((phase) => phase.tasks)
    .filter((task) => task.status === "complete")
    .slice(-6);

  completedList.innerHTML = completedItems.map((task) => `<li>✓ ${task.name}</li>`).join("");
};

const renderUser = () => {
  const user = getCurrentUser();
  if (!user) return;

  const nameField = document.getElementById("progressUserName");
  const roleField = document.getElementById("progressUserRole");
  nameField.textContent = user.name || "KSD Team";
  roleField.textContent = `${user.role || "User"} · KSD`;
};

const renderDate = () => {
  const dateField = document.getElementById("lastUpdated");
  dateField.textContent = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
};

const init = async () => {
  await requireAuth();
  bindLogout();
  renderUser();
  renderSummary();
  renderPhases();
  renderDate();
};

void init();
