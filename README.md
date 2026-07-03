# Pixel Canvas สองคน

canvas 64×64 ที่คุณกับเพื่อนคนเดียววาดด้วยกันสด ๆ ผ่าน WebRTC DataChannel ตรงระหว่างสองเบราว์เซอร์ — ไม่มี server กลาง, ไม่มี backend, ไม่มี database. Signaling (การแลก SDP ครั้งแรก) เป็นแบบ copy-paste โค้ดด้วยมือ (ดู `/method` ในแอปสำหรับคำอธิบายเต็ม).

## Dev

```
npm install
npm run dev        # http://localhost:3000/
npm test            # vitest (lib/grid, lib/proto, lib/codes)
npm run typecheck
npm run build        # static export -> out/
```

## Stack

Next 15 static export (`output: "export"`), TypeScript, Vitest, zero runtime deps beyond Next/React itself. No service worker.

## Architecture

- `lib/grid.ts` — 64×64 LWW grid: `apply`/`merge`/`serialize`/`deserialize`. TDD, fully unit tested.
- `lib/proto.ts` — wire message encode/decode (`pixel`/`cursor`/`fullSync`/`clearRequest`/`clearAccept`) with validation. TDD, fully unit tested.
- `lib/codes.ts` — SDP ↔ compressed base64url invite/answer code, plus `validateCode` with Thai error messages. TDD, fully unit tested.
- `lib/rtc.ts` — thin manual-signaling `RTCPeerConnection`/`RTCDataChannel` wrapper built on top of `codes.ts`/`proto.ts`. Not unit tested (jsdom has no WebRTC implementation) — see "Manual RTC test" below.
- `lib/palette.ts`, `lib/peerId.ts`, `lib/storage.ts`, `lib/exportPng.ts` — small glue utilities.
- `components/CanvasGrid.tsx` — canvas rendering, draw/pan/zoom (pinch + wheel) gestures, friend-cursor + heat-mode rendering.
- `components/Toolbar.tsx`, `components/ConnectionStepper.tsx` — palette/heat/export/clear UI and the 3-step connect flow.

## Why only some files are TDD'd

`grid`/`proto`/`codes` are pure logic where a bug silently corrupts drawings or breaks the handshake — those get red/green TDD with unit tests (37 tests total). `rtc.ts` orchestrates real browser `RTCPeerConnection` objects that don't exist in the jsdom test environment, and the canvas/gesture UI is "what you see is what you get" render code with no meaningful pass/fail assertion — both are exercised manually instead, per the same reasoning as `/method` in the app.

## Manual RTC test (two browsers, one machine)

No headless-browser automation tool was available in this environment to script an automated two-peer handshake, and adding one (Playwright/Puppeteer) would violate the project's zero-extra-devDeps constraint — so verify by hand instead. The `codes.ts` unit tests already cover the SDP↔code encode/decode/validate path exhaustively (round-trips, garbage rejection, corruption rejection); this manual pass just confirms the browser wiring on top of it.

1. `npm run build && npx serve out` (or `npm run dev`) and open the app in **two separate browser windows/profiles** (e.g. a normal window + an incognito window, so `localStorage`/peer-id don't collide).
2. Window A: click **"เปิดห้อง"**. Wait for the invite code textarea to populate (ICE gathering finishes in a second or two on localhost). Copy it.
3. Window B: click **"เข้าร่วมห้อง"**, paste the invite code, click **"ถัดไป"**. Copy the resulting answer code.
4. Window A: paste the answer code into step 2's box, click **"เชื่อมต่อ"**.
5. Both windows should show the green "เชื่อมต่อแล้ว 🎉" badge within a couple seconds.
6. Draw a pixel in window A → it should appear in window B (and vice versa) essentially instantly.
7. Move the pointer/finger in one window without drawing → the other window should show a friend-cursor marker following it (throttled, so slightly stepped, not per-frame).
8. Click "ล้างผืนทั้งหมด" in one window → the other window should see the "เพื่อนขอล้างผืนทั้งหมด" banner; accepting clears both.
9. To sanity-check the NAT-failure path, there's nothing to force on localhost (both peers resolve host candidates), so this is verified by code review of `lib/rtc.ts`'s `failed` state mapping plus the honest-caveat copy on the connection panel and `/method`.
