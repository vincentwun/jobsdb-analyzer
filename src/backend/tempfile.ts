import * as fs from 'fs';
import * as path from 'path';
import { Mutex } from 'async-mutex';
import { arePathsOnDifferentDrives } from './file_io_utils';
import { reverseString } from './utils';

// Summary: Thread-safe temporary file utilities for writing, renaming, trimming the last line, and copying.
export class TempFile {
  private tempFilePath: string ;
  private mutex: Mutex;
  constructor(file: any) {
    this.tempFilePath = file.name
    this.mutex = new Mutex();
  }

  // writeToFile: append content to the temp file while holding a mutex for concurrency safety.
  public async writeToFile(content: any): Promise<void> {
    const release = await this.mutex.acquire();

    try {
      if (!fs.existsSync(this.tempFilePath)) {
        throw new Error('Temporary file is not created.');
      }

      fs.appendFileSync(this.tempFilePath, content, { encoding: 'utf-8' });
    } catch (error) {
      console.error('Error writing to temporary file:', error);
    } finally {
      release();
    }
  }

  // renameTempFile: move or copy the temp file to the new path, handling cross-device moves.
  public async renameTempFile(newFilePath: string): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      if (!fs.existsSync(this.tempFilePath)) {
        throw new Error('Temporary file is not created.');
      }
      const dirPath = path.dirname(newFilePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      if (await arePathsOnDifferentDrives(path.resolve(this.tempFilePath), path.resolve(dirPath))){
        await this.copyFileUnsafe(newFilePath)
      } else {
        fs.renameSync(this.tempFilePath, newFilePath);
      }
      this.tempFilePath = newFilePath;
    } catch (error) {
      throw error;
    } finally {
      release();
    }
  }

  // popLine: safely remove and return the last line from the temp file.
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

      while (position >= 0) {
        fs.readSync(fd, buffer, 0, 1, position);
        lastChar = buffer.toString();

        if (lastChar === '\n' && line.length > 0) {
          break;
        }

        line += lastChar;
        position--;
      }

      fs.ftruncateSync(fd, position + 1);
      fs.closeSync(fd);
      return reverseString(line.trim());
    } catch (error) {
      console.error('Error popping last line from temporary file:', error);
      return undefined;
    } finally {
      release();
    }
  }
  // getFilePath: return the current temporary file path, ensuring it exists.
  public getFilePath(): string {
    if (!fs.existsSync(this.tempFilePath)) {
      throw new Error('Temporary file is not created.');
    }
    return this.tempFilePath;
  }
  // copyFile: thread-safe copy wrapper that delegates to copyFileUnsafe.
  public async copyFile(destinationPath: string): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      this.copyFileUnsafe(destinationPath)
    } finally {
      release();
    }
  }
  // copyFileUnsafe: copy temp file to destination without locking.
  public async copyFileUnsafe(destinationPath: string): Promise<void> {
    try {
      if (!fs.existsSync(this.tempFilePath)) {
        throw new Error('Temporary file is not created.');
      }
      const dirPath = path.dirname(destinationPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.copyFileSync(this.tempFilePath, destinationPath);
    } catch (error) {
      console.error(error);
      throw error;
    } 
  }
}