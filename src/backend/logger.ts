// logger.ts
import fs from "fs";
import pino, { Logger } from "pino";

const logDir = "./jobsdb_scrape_logs";

export function createLogger(name: string, enableLogging: boolean): Logger {
  if (!enableLogging) return pino({ level: "silent" });

  fs.mkdirSync(logDir, { recursive: true });

  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const destinationPath = `${logDir}/${name}-${now}.log`;

  // let pino write directly to the file destination (no stdout)
  const dest = pino.destination({ dest: destinationPath, sync: false });

  return pino({ level: "info", name }, dest);
}
