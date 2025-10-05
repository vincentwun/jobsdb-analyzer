//Wait for port number to be returned from a proccess server stdout
export function waitForPort(process: any): Promise<number>{
    return new Promise((resolve, reject) => {
      process.stdout?.once('data', (data: Buffer) => {
        try {
          const port = parseInt(data.toString()); // Convert data to number
          resolve(port);
        }catch(error){
          reject(error)
        }
      });
    });
  }