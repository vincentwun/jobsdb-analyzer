// Summary: Helpers for inter-process coordination, e.g., waiting for a child process to emit a port.
// waitForPort: resolve when the child process writes a port number to stdout.
export function waitForPort(process: any): Promise<number>{
    return new Promise((resolve, reject) => {
      process.stdout?.once('data', (data: Buffer) => {
        try {
          const port = parseInt(data.toString());
          resolve(port);
        }catch(error){
          reject(error)
        }
      });
    });
  }