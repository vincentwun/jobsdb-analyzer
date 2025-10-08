import Deque from 'double-ended-queue';

// Summary: Implements a generic async blocking queue where producers can enqueue
// values and consumers can await dequeued values; supports async iteration.
export class AsyncBlockingQueue<T> {
    // Holds resolver functions for promises created when consumers wait.
    private resolvers: Deque<(value: T) => void>;
    // Holds promises that resolve to available values for consumers.
    private promises: Deque<Promise<T>>;
  
    // Initializes internal deques used to track pending promises and resolvers.
    constructor() {
      this.resolvers = new Deque();
      this.promises = new Deque();
    }
  
    // Creates a pending promise and stores its resolver so a future enqueue can fulfill it.
    private _add(): void {
      this.promises.push(
        new Promise<T>((resolve) => {
          this.resolvers.push(resolve);
        })
      );
    }
    
    // If a consumer is waiting, resolve it immediately with the value; otherwise store
    // a resolved promise representing an available value.
    enqueue(value: T): void {
      if (!this.resolvers.isEmpty()) {
        const resolver = this.resolvers.shift();
        if (resolver) {
          resolver(value);
        }
      } else {
        this.promises.push(Promise.resolve(value));
      }
    }
  
    // Return a promise for the next value, creating a pending promise if none are available.
    dequeue(): Promise<T> {
      if (this.promises.isEmpty()) {
        this._add();
      }
      return this.promises.shift()!;
    }
  
    // Returns true when there are no available values to consume.
    isEmpty(): boolean {
      return this.promises.isEmpty();
    }
  
    // Returns true when there are consumers currently waiting for values.
    isBlocked(): boolean {
      return !this.resolvers.isEmpty();
    }
  
    // Net count of available values minus waiting consumers.
    get length(): number {
      return this.promises.length - this.resolvers.length;
    }
  
    // Provide an async iterator that repeatedly yields values from dequeue().
    [Symbol.asyncIterator](): AsyncIterableIterator<T> {
      return {
        next: () =>
          this.dequeue().then((value) => ({
            done: false,
            value,
          })),
        [Symbol.asyncIterator]() {
          return this;
        },
      };
    }
  }
  