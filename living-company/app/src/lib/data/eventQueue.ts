/**
 * A minimal single-consumer async queue: producers `push`, a consumer iterates
 * with `for await`. Backs the `events()` stream of a CompanyDataSource.
 */
export class AsyncEventQueue<T> {
  private buffer: T[] = [];
  private resolvers: ((result: IteratorResult<T>) => void)[] = [];
  private closed = false;

  push(item: T): void {
    if (this.closed) return;
    const resolve = this.resolvers.shift();
    if (resolve) {
      resolve({ value: item, done: false });
    } else {
      this.buffer.push(item);
    }
  }

  close(): void {
    this.closed = true;
    let resolve = this.resolvers.shift();
    while (resolve) {
      resolve({ value: undefined, done: true });
      resolve = this.resolvers.shift();
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        if (this.buffer.length > 0) {
          return Promise.resolve({ value: this.buffer.shift() as T, done: false });
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise((resolve) => this.resolvers.push(resolve));
      },
    };
  }
}
