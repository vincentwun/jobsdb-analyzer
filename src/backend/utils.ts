// Summary: Miscellaneous utility functions for progress display, timing, and simple helpers.
// printProgressBar: render a textual progress bar to stdout, with a non-TTY fallback.
export function printProgressBar(completed : number, total : number, barLength = 40) {
  const progress = Math.min(completed / total, 1);
  const filledLength = Math.round(progress * barLength);
  const bar = '█'.repeat(filledLength) + '-'.repeat(barLength - filledLength);
  const percentage = (progress * 100).toFixed(2);

  if (process.stdout.isTTY) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`Progress: [${bar}] ${percentage}%`);
    if (completed >= total) {
      process.stdout.write('\n');
    }
  } else {
    console.log(`Progress: [${bar}] ${percentage}%`);
  }
}
// sleep: delay for a given number of milliseconds.
export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// reverseString: return a reversed copy of the input string.
export function reverseString(str: string): string {
  return str.split("").reverse().join("");
}
// getObjectSize: count enumerable own properties on an object.
export function getObjectSize(obj: { [key: string]: any }): number {
  return Object.keys(obj).length;
}

// createTimeoutPromise: create a promise that rejects after timeout seconds and a clear handle.
export function createTimeoutPromise(timeout: number, timeoutVal: any) {
  let timeoutId: NodeJS.Timeout;

  const promise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(timeoutVal), timeout*1000);
  });

  return {
    promise,
    clear: () => clearTimeout(timeoutId)
  };
}
