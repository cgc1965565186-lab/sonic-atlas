import { Writable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { pipeWebBody } from '../../server/media-proxy.mjs';

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
});
