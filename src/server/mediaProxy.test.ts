import { Writable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { fetchWithHeaderTimeout, pipeWebBody } from '../../server/media-proxy.mjs';

describe('media proxy streaming', () => {
  it('returns an upstream timeout as an awaitable rejection', async () => {
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(timeout);
      },
    });
    const destination = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });

    await expect(pipeWebBody(body, destination)).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('clears the header timeout once fetch returns a streaming response', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
      signal = options.signal as AbortSignal;
      return new Response('stream');
    }));
    const result = await fetchWithHeaderTimeout('https://music.163.com/stream', {}, 15_000);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(signal?.aborted).toBe(false);
    result.controller.abort();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
