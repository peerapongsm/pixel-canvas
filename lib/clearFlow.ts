// Pure decision rules for the two-party clear-canvas handshake. Kept apart
// from app/page.tsx so the state machine can be unit tested without React.
// A peer's clear messages are untrusted: an unsolicited clearAccept must
// never wipe the grid, and an unsolicited clearRequest must never override
// a clear flow already in progress locally.

export type ClearFlow = "idle" | "awaiting-peer" | "peer-requested" | "confirm-solo";

// An incoming clearAccept only clears the canvas when we're the one who
// asked for it and is still waiting on the peer's acceptance.
export function shouldAcceptClearAccept(current: ClearFlow): boolean {
  return current === "awaiting-peer";
}

// An incoming clearRequest must not override a clear flow already in
// progress locally (we're awaiting our own request, or mid solo-confirm).
export function shouldAcceptClearRequest(current: ClearFlow): boolean {
  return current === "idle" || current === "peer-requested";
}
