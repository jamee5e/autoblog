import { app } from "./app";
import { env } from "./config/env";
import { startScheduleWorker } from "./services/schedule.service";

app.listen(env.PORT, () => {
  // Keep startup log simple for container logs.
  console.log(`API running on port ${env.PORT}`);
  startScheduleWorker();
  console.log("Schedule worker started");
});
