import * as fs from 'fs';
import * as path from 'path';
import { Mutex } from 'async-mutex';
import { arePathsOnDifferentDrives } from './file_io_utils';
import { reverseString } from './utils';


export class TempFile {
  private tempFilePath: string ;
  private mutex: Mutex;
  constructor(file: any) {
    this.tempFilePath = file.name
    this.mutex = new Mutex();
  }

  /**
   * Writes data to the temporary file in a concurrent-safe manner using a mutex.
   * @param content - The content to write to the file.
   */
  public async writeToFile(content: any): Promise<void> {
    const release = await this.mutex.acquire();

    try {
      if (!fs.existsSync(this.tempFilePath)) {
        throw new Error('Temporary file is not created.');
      }

      // Append to the file rather than overwrite
      fs.appendFileSync(this.tempFilePath, content, { encoding: 'utf-8' });
    } catch (error) {
      console.error('Error writing to temporary file:', error);
    } finally {
      release(); // Release the mutex lock
    }
  }

  /**
   * Renames the temporary file to a permanent file at the specified path.
   * @param newFilePath - The new file path for renaming.
   */
  public async renameTempFile(newFilePath: string): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      if (!fs.existsSync(this.tempFilePath)) {
        throw new Error('Temporary file is not created.');
      }
      const dirPath = path.dirname(newFilePath);
      // Ensure the directory exists
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      if (await arePathsOnDifferentDrives(path.resolve(this.tempFilePath), path.resolve(dirPath))){
        await this.copyFileUnsafe(newFilePath)
      } else {
        fs.renameSync(this.tempFilePath, newFilePath);
      }
      // console.log(`Temporary file renamed to: ${newFilePath}`);
      // Update the file path
      this.tempFilePath = newFilePath;
    } catch (error) {
      throw error; // Re-throw to indicate failure
    } finally {
      release(); // Release the mutex lock
    }
  }

  /**
   * Safely trims and returns the last line of the file in a concurrent-safe manner using a mutex.
   * @returns The last line of the temporary file.
   */
  public async popLine(): Promise<string | undefined> {
    const release = await this.mutex.acquire();

    try {
      if (!fs.existsSync(this.tempFilePath)) {
        throw new Error('Temporary file is not created.');
      }

      const fd = fs.openSync(this.tempFilePath, 'r+');
      let fileSize = fs.statSync(this.tempFilePath).size;
      if (fileSize === 0) {
        fs.closeSync(fd);
        return undefined;
      }

      let buffer = Buffer.alloc(1);
      let position = fileSize - 1;
      let lastChar = '';
      let line = '';

      // Read backwards to find the last newline character
      while (position >= 0) {
        fs.readSync(fd, buffer, 0, 1, position);
        lastChar = buffer.toString();

        if (lastChar === '\n' && line.length > 0) {
          break;
        }

        line += lastChar;
        position--;
      }

      // Truncate the file to remove the last line
      fs.ftruncateSync(fd, position + 1);
      fs.closeSync(fd);
      return reverseString(line.trim());
    } catch (error) {
      console.error('Error popping last line from temporary file:', error);
      return undefined;
    } finally {
      release(); // Release the mutex lock
    }
  }
  /**
   * Gets the path of the temporary file.
   * @returns The path to the temporary file.
   */
  public getFilePath(): string {
    if (!fs.existsSync(this.tempFilePath)) {
      throw new Error('Temporary file is not created.');
    }
    return this.tempFilePath;
  }
  /**
   * Copies the temporary file to a new destination path.
   * @param destinationPath - The path to copy the file to.
   */
  public async copyFile(destinationPath: string): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      this.copyFileUnsafe(destinationPath)
    } finally {
      release(); // Release the mutex lock
    }
  }
  /**
   * Copies the temporary file to a new destination path. No use of mutex to protect file.
   * @param destinationPath - The path to copy the file to.
   */
  public async copyFileUnsafe(destinationPath: string): Promise<void> {
    try {
      if (!fs.existsSync(this.tempFilePath)) {
        throw new Error('Temporary file is not created.');
      }
      const dirPath = path.dirname(destinationPath);
      // Ensure the directory exists
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      // Copy the file to the new destination
      fs.copyFileSync(this.tempFilePath, destinationPath);
    } catch (error) {
      console.error(error);
      throw error; // Re-throw to indicate failure
    } 
  }
}