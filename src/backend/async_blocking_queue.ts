import Deque from 'double-ended-queue';

export class AsyncBlockingQueue<T> {
    private resolvers: Deque<(value: T) => void>;
    private promises: Deque<Promise<T>>;
  
    constructor() {
      // invariant: at least one of the queues is empty
      this.resolvers = new Deque();
      this.promises = new Deque();
    }
  
    private _add(): void {
      this.promises.push(
        new Promise<T>((resolve) => {
          this.resolvers.push(resolve);
        })
      );
    }
    
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
  
    dequeue(): Promise<T> {
      if (this.promises.isEmpty()) {
        this._add();
      }
      return this.promises.shift()!;
    }
  
    // Utilities
   
    isEmpty(): boolean {
      // there are no values available
      return this.promises.isEmpty();
    }
  
    isBlocked(): boolean {
      // it's waiting for values
      return !this.resolvers.isEmpty();
    }
  
    get length(): number {
      return this.promises.length - this.resolvers.length;
    }
  
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
  