"use client";

import { useEffect, useRef, useState } from "react";
import { PixelCanvasConnection, type ConnectionState } from "@/lib/rtc";
import { validateAnyCode } from "@/lib/shortCode";
import { buildInviteLink, parseInviteFragment } from "@/lib/inviteLink";
import QrCode from "@/components/QrCode";
import { CheckIcon, CopyIcon, DoorIcon, LinkIcon, QrIcon, ShareIcon } from "@/components/icons";

type Role = "none" | "host" | "guest";

export interface ConnectionStepperProps {
  connection: PixelCanvasConnection;
  connectionState: ConnectionState;
  role: Role;
  onRoleChange: (role: Role) => void;
  /** invite code arriving via a #j= link — auto-starts the guest flow */
  initialInviteCode?: string | null;
}

const STATE_LABEL: Record<ConnectionState, string> = {
  idle: "ยังไม่ได้เชื่อมต่อ",
  gathering: "กำลังเตรียมลิงก์...",
  "waiting-for-answer": "รอโค้ดตอบจากเพื่อน",
  connecting: "กำลังเชื่อมต่อ...",
  connected: "เชื่อมต่อแล้ว 🎉",
  failed: "เชื่อมต่อไม่สำเร็จ",
  disconnected: "การเชื่อมต่อหลุด",
  closed: "ปิดการเชื่อมต่อแล้ว",
};

function ledClass(state: ConnectionState): string {
  if (state === "connected") return "led connected";
  if (state === "failed" || state === "disconnected") return "led failed";
  if (state === "gathering" || state === "waiting-for-answer" || state === "connecting") return "led pending";
  return "led";
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Accept either a bare code or a whole invite link pasted into the code box. */
function extractCode(pasted: string): string {
  const trimmed = pasted.trim();
  const hashIndex = trimmed.indexOf("#j=");
  if (hashIndex >= 0) {
    const fromLink = parseInviteFragment(trimmed.slice(hashIndex));
    if (fromLink) return fromLink;
  }
  return trimmed;
}

export default function ConnectionStepper({
  connection,
  connectionState,
  role,
  onRoleChange,
  initialInviteCode = null,
}: ConnectionStepperProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [answerCode, setAnswerCode] = useState("");
  const [pastedInvite, setPastedInvite] = useState("");
  const [pastedAnswer, setPastedAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [canShare, setCanShare] = useState(false);

  const inviteLink = inviteCode ? buildInviteLink(window.location.origin, inviteCode) : "";

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  // A #j= link landed us here: join automatically, no pasting needed.
  const autoJoined = useRef(false);
  useEffect(() => {
    if (!initialInviteCode || autoJoined.current) return;
    autoJoined.current = true;
    void joinWithCode(initialInviteCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialInviteCode]);

  function reset() {
    connection.close();
    setInviteCode("");
    setAnswerCode("");
    setPastedInvite("");
    setPastedAnswer("");
    setError(null);
    setBusy(false);
    setShowQr(false);
    onRoleChange("none");
  }

  async function startHost() {
    onRoleChange("host");
    setBusy(true);
    setError(null);
    try {
      const code = await connection.createInvite();
      setInviteCode(code);
    } catch {
      setError("เปิดห้องไม่สำเร็จ เบราว์เซอร์นี้อาจไม่รองรับ WebRTC");
    } finally {
      setBusy(false);
    }
  }

  async function shareInvite() {
    try {
      await navigator.share({ title: "มาวาด Pixel Canvas ด้วยกัน", url: inviteLink });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }

  async function submitAnswer() {
    const code = extractCode(pastedAnswer);
    const result = validateAnyCode(code);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await connection.completeWithAnswer(code);
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ตรวจสอบว่าโค้ดตอบถูกวางครบถ้วน");
    } finally {
      setBusy(false);
    }
  }

  function startGuest() {
    onRoleChange("guest");
    setError(null);
  }

  async function joinWithCode(rawCode: string) {
    const code = extractCode(rawCode);
    const result = validateAnyCode(code);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const answer = await connection.joinWithInvite(code);
      setAnswerCode(answer);
    } catch {
      setError("เข้าร่วมห้องไม่สำเร็จ ตรวจสอบว่าลิงก์หรือโค้ดชวนถูกต้อง");
    } finally {
      setBusy(false);
    }
  }

  if (role === "none") {
    return (
      <div className="stepper">
        <p className="hint">เล่นคนเดียวได้เสมอ — เชื่อมต่อเพื่อวาดพร้อมเพื่อนแบบสด ๆ</p>
        <div className="role-picker">
          <button type="button" className="btn btn-primary" onClick={startHost}>
            <DoorIcon />
            เปิดห้อง
          </button>
          <button type="button" className="btn btn-outline" onClick={startGuest}>
            <LinkIcon />
            เข้าร่วมห้อง
          </button>
        </div>
        <p className="hint">ได้ลิงก์ชวนมา? แค่กดลิงก์นั้น — จะเข้าห้องให้เอง</p>
      </div>
    );
  }

  return (
    <div className="stepper">
      <div className="state-badge">
        <span className={ledClass(connectionState)} />
        {STATE_LABEL[connectionState]}
      </div>

      {role === "host" && (
        <>
          <div className="step">
            <div className="step-title">
              <span className="step-badge">1</span> ส่งลิงก์ชวนให้เพื่อน
            </div>
            {inviteCode ? (
              <>
                <input className="code-box code-line" readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
                <div className="invite-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={async () => setCopiedInvite(await copyToClipboard(inviteLink))}
                  >
                    {copiedInvite ? <CheckIcon /> : <CopyIcon />}
                    {copiedInvite ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
                  </button>
                  {canShare && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={shareInvite}>
                      <ShareIcon />
                      แชร์
                    </button>
                  )}
                  <button
                    type="button"
                    className={`btn btn-outline btn-sm${showQr ? " on" : ""}`}
                    onClick={() => setShowQr((s) => !s)}
                    aria-pressed={showQr}
                  >
                    <QrIcon />
                    QR
                  </button>
                </div>
                {showQr && (
                  <div className="qr-wrap">
                    <QrCode text={inviteLink} />
                    <p className="hint">ให้เพื่อนสแกนด้วยกล้องมือถือ แล้วเปิดลิงก์</p>
                  </div>
                )}
              </>
            ) : (
              <p className="hint">{busy ? "กำลังเตรียมลิงก์..." : "กดปุ่ม \"เปิดห้อง\" ด้านล่าง"}</p>
            )}
          </div>

          {inviteCode && connectionState !== "connected" && (
            <div className="step">
              <div className="step-title">
                <span className="step-badge">2</span> วางโค้ดตอบจากเพื่อน แล้วกดเชื่อมต่อ
              </div>
              <textarea
                className="code-input"
                placeholder="เพื่อนเปิดลิงก์แล้วจะได้ &quot;โค้ดตอบ&quot; สั้น ๆ — วางที่นี่"
                value={pastedAnswer}
                onChange={(e) => setPastedAnswer(e.target.value)}
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={submitAnswer} disabled={busy || !pastedAnswer}>
                เชื่อมต่อ
              </button>
            </div>
          )}
        </>
      )}

      {role === "guest" && (
        <>
          {!answerCode && (
            <div className="step">
              <div className="step-title">
                <span className="step-badge">1</span> วางลิงก์หรือโค้ดชวนจากเพื่อน
              </div>
              {busy ? (
                <p className="hint">กำลังเข้าห้อง...</p>
              ) : (
                <>
                  <textarea
                    className="code-input"
                    placeholder="วางลิงก์ชวน (หรือโค้ดชวน) ที่เพื่อนส่งมาที่นี่"
                    value={pastedInvite}
                    onChange={(e) => setPastedInvite(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void joinWithCode(pastedInvite)}
                    disabled={busy || !pastedInvite}
                  >
                    ถัดไป
                  </button>
                </>
              )}
            </div>
          )}

          {answerCode && (
            <div className="step">
              <div className="step-title">
                <span className="step-badge">2</span> ส่งโค้ดตอบนี้กลับให้เพื่อน
              </div>
              <textarea className="code-box" readOnly value={answerCode} onFocus={(e) => e.currentTarget.select()} />
              <button
                type="button"
                className="btn btn-primary copy-btn"
                onClick={async () => setCopiedAnswer(await copyToClipboard(answerCode))}
              >
                {copiedAnswer ? <CheckIcon /> : <CopyIcon />}
                {copiedAnswer ? "คัดลอกแล้ว" : "คัดลอกโค้ดตอบ"}
              </button>
              <p className="hint">เพื่อนวางโค้ดนี้แล้วกด "เชื่อมต่อ" — เสร็จแล้ววาดด้วยกันได้เลย</p>
            </div>
          )}
        </>
      )}

      {error && <p className="error-text">{error}</p>}

      {connectionState === "failed" && (
        <p className="error-text">
          ต่อกันไม่ติด: บางเครือข่าย (NAT) บล็อกการเชื่อมต่อตรงแบบนี้ ลองเปลี่ยนเน็ต (เช่นจาก Wi-Fi เป็นเน็ตมือถือ) หรือลองเปิดห้องใหม่อีกครั้ง
          — งานวาดที่มีอยู่จะไม่หายไป เล่นคนเดียวต่อได้ตามปกติ
        </p>
      )}

      <button type="button" className="btn btn-sm btn-outline" onClick={reset}>
        เริ่มใหม่ / เล่นคนเดียว
      </button>
    </div>
  );
}
