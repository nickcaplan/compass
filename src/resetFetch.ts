/** Bound reset transport without invalidating an email the server may have sent. */
export async function resetFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!String(input).includes('/auth/v1/recover')) return fetch(input, init);
  const controller = new AbortController();
  const abort = () => controller.abort(init?.signal?.reason);
  init?.signal?.addEventListener('abort', abort, { once: true });
  if (init?.signal?.aborted) abort();
  const timer = setTimeout(() => controller.abort(new Error('reset-timeout')), 20_000);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    // The provider response body can stall too, after the headers arrive.
    await response.clone().arrayBuffer();
    return response;
  } catch (error) {
    if (controller.signal.reason instanceof Error && controller.signal.reason.message === 'reset-timeout')
      throw new TypeError('Reset request timed out');
    throw error;
  } finally { clearTimeout(timer); init?.signal?.removeEventListener('abort', abort); }
}
