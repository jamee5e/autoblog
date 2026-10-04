import { app } from "./app";
import { env } from "./config/env";

app.listen(env.PORT, () => {
  // Keep startup log simple for container logs.
  console.log(`API running on port ${env.PORT}`);
});
