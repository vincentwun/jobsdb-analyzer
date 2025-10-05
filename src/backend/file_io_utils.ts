import { createReadStream, createWriteStream , existsSync} from 'fs';
import * as fs from 'fs';
import * as path from 'path'

export function clean_dir(dirname:string){
    // Define the path to the directory
    const d = path.join(__dirname, dirname);
    if (fs.existsSync(d)) {
        try {
            // Remove the directory and all of its contents
            fs.rmSync(d, { recursive: true, force: true });
            // console.log('Logs directory removed successfully.');
        } catch (err) {
            console.error('Error while removing logs directory:', err);
        }
    }
}
export async function arePathsOnDifferentDrives(path1 : string, path2 : string) {
    try {
      const stat1 = await fs.promises.stat(path1);
      const stat2 = await fs.promises.stat(path2);
  
      // Compare the device IDs (dev property)
      return stat1.dev !== stat2.dev;
    } catch (err) {
      throw err
    }
}
export const appendFileContent = (inputFile: string, outputFile: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Ensure the output file exists; create it if it doesn't
      if (!existsSync(outputFile)) {
        createWriteStream(outputFile).close();
      }
  
      const readStream = createReadStream(inputFile);
      const writeStream = createWriteStream(outputFile, { flags: 'a' }); // 'a' for append mode
  
      // Pipe the input file directly to the output file
      readStream.pipe(writeStream);
  
      // Resolve or reject the promise based on completion or error
      readStream.on('error', (err) => reject(`Error reading ${inputFile}: ${err}`));
      writeStream.on('error', (err) => reject(`Error writing ${outputFile}: ${err}`));
      writeStream.on('finish', resolve);
    });
  };
  
  export const mergeFiles = (inputFile1: string, inputFile2: string, outputFile: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const readStream1 = createReadStream(inputFile1);
      const readStream2 = createReadStream(inputFile2);
      const writeStream = createWriteStream(outputFile);
  
      readStream1.pipe(writeStream, { end: false });
      
      readStream1.on('end', () => {
        readStream2.pipe(writeStream);
      });
  
      readStream1.on('error', (err) => reject(`Error reading ${inputFile1}: ${err}`));
      readStream2.on('error', (err) => reject(`Error reading ${inputFile2}: ${err}`));
      writeStream.on('error', (err) => reject(`Error writing ${outputFile}: ${err}`));
  
      writeStream.on('finish', resolve);
    });
  };