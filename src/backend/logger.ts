// Summary: Create and configure a pino logger that writes to timestamped files when enabled.
import fs from "fs";
import pino, { Logger } from "pino";

const logDir = "./jobsdb_scrape_logs";

// createLogger: return a silent logger when disabled, or a pino logger that writes to a file when enabled.
export function createLogger(name: string, enableLogging: boolean): Logger {
  if (!enableLogging) return pino({ level: "silent" });

  fs.mkdirSync(logDir, { recursive: true });

  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const destinationPath = `${logDir}/${name}-${now}.log`;

  const dest = pino.destination({ dest: destinationPath, sync: false });

  return pino({ level: "info", name }, dest);
}
