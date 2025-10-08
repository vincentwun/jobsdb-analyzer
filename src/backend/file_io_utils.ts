import { createReadStream, createWriteStream , existsSync} from 'fs';
import * as fs from 'fs';
import * as path from 'path'

// Summary: File system helpers for temporary file handling, merging and appending files,
// and checking whether two paths are on different devices.
export function clean_dir(dirname:string){
    // Remove the directory and its contents if it exists
    const d = path.join(__dirname, dirname);
    if (fs.existsSync(d)) {
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch (err) {
            console.error('Error while removing logs directory:', err);
        }
    }
}
// Checks whether two filesystem paths belong to different device mounts.
export async function arePathsOnDifferentDrives(path1 : string, path2 : string) {
    try {
      const stat1 = await fs.promises.stat(path1);
      const stat2 = await fs.promises.stat(path2);
      return stat1.dev !== stat2.dev;
    } catch (err) {
      throw err
    }
}
// Append the contents of inputFile to outputFile, creating the output file if missing.
export const appendFileContent = (inputFile: string, outputFile: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!existsSync(outputFile)) {
        createWriteStream(outputFile).close();
      }

      const readStream = createReadStream(inputFile);
      const writeStream = createWriteStream(outputFile, { flags: 'a' });

      readStream.pipe(writeStream);

      readStream.on('error', (err) => reject(`Error reading ${inputFile}: ${err}`));
      writeStream.on('error', (err) => reject(`Error writing ${outputFile}: ${err}`));
      writeStream.on('finish', resolve);
    });
  };
  // Merge two input files sequentially into a single output file.
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