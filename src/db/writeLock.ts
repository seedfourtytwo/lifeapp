/** Serialize destructive DB writes so weather/calendar can't interleave mid-import/clear. */
let writeChain: Promise<void> = Promise.resolve();

export async function withDbWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = writeChain;
  writeChain = previous.then(() => gate);
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}
