# net/ — Supabase transport layer

Replaces the v1/v2 WebRTC layer (`lib/rtc.ts`, `lib/codes.ts`, `lib/shortCode.ts`,
`lib/inviteLink.ts`, `components/ConnectionStepper.tsx`). The pure libs are reused
**verbatim** — their tests are the regression guard:

## Reused lib API (do not modify)

- `lib/grid.ts` — LWW grid. `GRID_SIZE=64`, `CELL_COUNT`, `Cell {color,ts,peerId}`,
  `Grid=(Cell|null)[]`, `createEmptyGrid()`, `indexOf(x,y)`, `inBounds(x,y)`,
  `apply(grid, PixelInput)` (LWW by ts then peerId; eraser tombstone = color `-1`),
  `merge(grid, other)`, `serialize(grid)`, `deserialize(data)`.
- `lib/proto.ts` — wire messages. `Message = pixel | cursor | fullSync | clearRequest | clearAccept`,
  `encode(Message): string`, `decode(string): Message` (throws on malformed).
- `lib/validate.ts` — `isValidPixelMessage`, `isValidCursorMessage`, `filterValidCells`.
- `lib/palette.ts` — `PALETTE` (64), `ERASER = -1`.
- `lib/undo.ts`, `lib/clearFlow.ts`, `lib/storage.ts` (localStorage = client cache now,
  Postgres row is the source of truth), `lib/peerId.ts`.

## This layer

- `identity.ts` — anonymous peer (uuid + nickname) + `heatColor(slot)` tints 1..4.
- `canvas.ts` — Postgres persistence: `loadGrid` / `ensureRoom` / `makePersister` (debounced full-grid upsert).
- `room.ts` — Realtime channel `pixel:<roomId>`: op broadcast + presence roster (≤4, stable slots).
- `online-session.ts` — glue between the canvas UI, the room, and the persister.
