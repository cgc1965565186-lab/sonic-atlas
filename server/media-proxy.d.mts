import type { Response } from 'express';
import type { ReadableStream } from 'node:stream/web';

export function isAllowedCoverUrl(value: string): boolean;
export function normalizeCoverSource(value: unknown): string;
export function isAllowedAudioUrl(value: string): boolean;
export function pipeWebBody(body: ReadableStream<Uint8Array>, destination: NodeJS.WritableStream): Promise<void>;
export function fetchWithHeaderTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<{ response: globalThis.Response; controller: AbortController }>;
export function proxyImage(source: string, response: Response): Promise<void>;
export function proxyAudio(url: string, range: string | undefined, response: Response): Promise<void>;
