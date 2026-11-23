/**
 * One request's state, live, for one screen.
 *
 * The controller is plain TypeScript — no React — so the state
 * machine is testable on its own: idle → loading → ready | error
 * | aborted, and any settled state → loading again on a new
 * start. It owns one AbortController per start; abort() cancels
 * the in-flight call, and the port's AbortError lands here as the
 * aborted state, never as an error.
 */

import { createBrowserTransportPort } from "./browser-transport.ts";
import {
  TransportError,
  type SchemaLike,
  type TransportOptions,
  type TransportPort,
  type TransportState,
} from "./transport.ts";

/** One request driven by hand, with its state on subscription. */
export interface TransportRequest<T> {
  /** The current state. */
  getState(): TransportState<T>;
  /** Hear about every state change. Returns the unsubscribe
   * function. */
  subscribe(cb: () => void): () => void;
  /** Start a request, cancelling any in-flight one. The returned
   * promise settles when the request settles; it never rejects —
   * the outcome lives in the state. */
  start(
    url: string,
    schema: SchemaLike<T>,
    opts?: TransportOptions,
  ): Promise<void>;
  /** Cancel the in-flight request, if any. A no-op when idle or
   * already settled. */
  abort(): void;
}

/** Make a request controller over a port (the browser port when
 * none is given). */
export function createTransportRequest<T>(
  port: TransportPort = createBrowserTransportPort(),
): TransportRequest<T> {
  let state: TransportState<T> = { status: "idle", data: null, error: null };
  const listeners = new Set<() => void>();
  let inFlight: AbortController | null = null;
  let generation = 0;

  const setState = (next: TransportState<T>): void => {
    state = next;
    for (const cb of [...listeners]) {
      try {
        cb();
      } catch {
        // One listener must never break the others or the request.
      }
    }
  };

  return {
    getState(): TransportState<T> {
      return state;
    },

    subscribe(cb: () => void): () => void {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },

    async start(
      url: string,
      schema: SchemaLike<T>,
      opts: TransportOptions = {},
    ): Promise<void> {
      inFlight?.abort();
      const controller = new AbortController();
      inFlight = controller;
      const gen = ++generation;

      // An abort of the caller's own signal cancels this request
      // too, through the controller the port actually hears.
      const callerSignal = opts.signal;
      const onCallerAbort = (): void => {
        controller.abort(callerSignal?.reason);
      };
      if (callerSignal) {
        if (callerSignal.aborted) controller.abort(callerSignal.reason);
        else
          callerSignal.addEventListener("abort", onCallerAbort, {
            once: true,
          });
      }

      setState({ status: "loading", data: null, error: null });
      try {
        const data = await port.getJson(url, schema, {
          ...opts,
          signal: controller.signal,
        });
        if (gen !== generation) return; // A newer start owns the state.
        setState({ status: "ready", data, error: null });
      } catch (err) {
        if (gen !== generation) return;
        if (err instanceof TransportError) {
          setState({ status: "error", data: null, error: err });
        } else if (
          (err instanceof Error && err.name === "AbortError") ||
          controller.signal.aborted
        ) {
          // A cancellation — this controller's own abort (or the
          // caller's, forwarded above) — is not a failure.
          setState({ status: "aborted", data: null, error: null });
        } else {
          // Anything else is unexpected, but it is a failure,
          // not a cancellation: surface it as a network-kind
          // error with the original as cause, so the error state
          // never carries a null error.
          setState({
            status: "error",
            data: null,
            error: new TransportError("network", url, { cause: err }),
          });
        }
      } finally {
        callerSignal?.removeEventListener("abort", onCallerAbort);
        if (gen === generation) inFlight = null;
      }
    },

    abort(): void {
      inFlight?.abort();
    },
  };
}
