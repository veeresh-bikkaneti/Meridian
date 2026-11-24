/** One raw I/O call, injected so CI records a red run. Removed in the next commit. */
export function zzHardAtZeroProbe(): Promise<Response> {
  return fetch("/zz-hard-at-zero-probe");
}
