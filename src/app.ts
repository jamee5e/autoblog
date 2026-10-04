import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { healthRouter } from "./routes/health.routes";
import { websiteRouter } from "./routes/website.routes";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { authRouter } from "./routes/auth.routes";
import { authenticateRequest } from "./middlewares/auth.middleware";
import { systemLogRouter } from "./routes/system-log.routes";
import { articleRouter } from "./routes/article.routes";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

const publicDirectory = path.join(process.cwd(), "src", "public");
app.use("/assets", express.static(publicDirectory));

app.use("/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/websites", authenticateRequest, websiteRouter);
app.use("/api/companies", authenticateRequest);
app.use("/api/system-logs", authenticateRequest, systemLogRouter);
app.use("/api/articles", authenticateRequest, articleRouter);

app.get("/", (_req, res) => {
  res.redirect("/login");
});

app.get("/login", (_req, res) => {
  res.sendFile(path.join(publicDirectory, "login.html"));
});

app.get("/dashboard", (_req, res) => {
  res.sendFile(path.join(publicDirectory, "dashboard.html"));
});

app.get("/websites", (_req, res) => {
  res.sendFile(path.join(publicDirectory, "websites.html"));
});

app.get("/system-logs", (_req, res) => {
  res.sendFile(path.join(publicDirectory, "system-logs.html"));
});

app.get("/project-progress", (_req, res) => {
  res.sendFile(path.join(publicDirectory, "project-progress.html"));
});

app.get("/articles", (_req, res) => {
  res.sendFile(path.join(publicDirectory, "articles.html"));
});

app.get("/articles/preview", (_req, res) => {
  res.sendFile(path.join(publicDirectory, "article-preview.html"));
});

app.use(notFoundHandler);
app.use(errorHandler);
