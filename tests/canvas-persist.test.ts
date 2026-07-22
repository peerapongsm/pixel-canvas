import { describe, it, expect, vi } from "vitest";
import { makePersister } from "../net/canvas";

describe("debounced persister", () => {
  it("coalesces rapid schedules into one upsert of the latest grid", async () => {
    vi.useFakeTimers();
    const upsert = vi.fn(async (_g: string) => {});
    const p = makePersister("r", { debounceMs: 1000, upsert });
    p.schedule("g1");
    p.schedule("g2");
    p.schedule("g3");
    expect(upsert).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(upsert).toHaveBeenCalledTimes(1); // coalesced
    expect(upsert).toHaveBeenCalledWith("g3"); // latest wins
    vi.useRealTimers();
  });

  it("flush() upserts immediately and cancels the timer", async () => {
    vi.useFakeTimers();
    const upsert = vi.fn(async (_g: string) => {});
    const p = makePersister("r", { debounceMs: 9999, upsert });
    p.schedule("g");
    await p.flush();
    expect(upsert).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(20000);
    expect(upsert).toHaveBeenCalledTimes(1); // timer cancelled, no double write
    vi.useRealTimers();
  });

  it("flush() with nothing pending is a no-op", async () => {
    const upsert = vi.fn(async (_g: string) => {});
    const p = makePersister("r", { debounceMs: 10, upsert });
    await p.flush();
    expect(upsert).not.toHaveBeenCalled();
  });
});
