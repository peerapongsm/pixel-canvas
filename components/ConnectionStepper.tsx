"use client";

import { useState } from "react";
import { PixelCanvasConnection, type ConnectionState } from "@/lib/rtc";
import { validateCode } from "@/lib/codes";

type Role = "none" | "host" | "guest";

export interface ConnectionStepperProps {
  connection: PixelCanvasConnection;
  connectionState: ConnectionState;
  role: Role;
  onRoleChange: (role: Role) => void;
}

const STATE_LABEL: Record<ConnectionState, string> = {
  idle: "ยังไม่ได้เชื่อมต่อ",
  gathering: "กำลังเตรียมโค้ด...",
  "waiting-for-answer": "รอโค้ดตอบจากเพื่อน",
  connecting: "กำลังเชื่อมต่อ...",
  connected: "เชื่อมต่อแล้ว 🎉",
  failed: "เชื่อมต่อไม่สำเร็จ",
  disconnected: "การเชื่อมต่อหลุด",
  closed: "ปิดการเชื่อมต่อแล้ว",
};

function stateDotClass(state: ConnectionState): string {
  if (state === "connected") return "state-dot connected";
  if (state === "failed" || state === "disconnected") return "state-dot failed";
  if (state === "gathering" || state === "waiting-for-answer" || state === "connecting") return "state-dot pending";
  return "state-dot";
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function ConnectionStepper({ connection, connectionState, role, onRoleChange }: ConnectionStepperProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [answerCode, setAnswerCode] = useState("");
  const [pastedInvite, setPastedInvite] = useState("");
  const [pastedAnswer, setPastedAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedAnswer, setCopiedAnswer] = useState(false);

  function reset() {
    connection.close();
    setInviteCode("");
    setAnswerCode("");
    setPastedInvite("");
    setPastedAnswer("");
    setError(null);
    setBusy(false);
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

  async function submitAnswer() {
    const result = validateCode(pastedAnswer);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await connection.completeWithAnswer(pastedAnswer.trim());
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

  async function submitInvite() {
    const result = validateCode(pastedInvite);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const code = await connection.joinWithInvite(pastedInvite.trim());
      setAnswerCode(code);
    } catch {
      setError("เข้าร่วมห้องไม่สำเร็จ ตรวจสอบว่าโค้ดชวนถูกวางครบถ้วน");
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
            เปิดห้อง
          </button>
          <button type="button" className="btn btn-outline" onClick={startGuest}>
            เข้าร่วมห้อง
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stepper">
      <div className="state-badge">
        <span className={stateDotClass(connectionState)} />
        {STATE_LABEL[connectionState]}
      </div>

      {role === "host" && (
        <>
          <div className="step">
            <div className="step-title">
              <span className="step-badge">1</span> เปิดห้อง → ส่งโค้ดชวนให้เพื่อน
            </div>
            {inviteCode ? (
              <>
                <textarea className="code-box" readOnly value={inviteCode} />
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={async () => setCopiedInvite(await copyToClipboard(inviteCode))}
                >
                  {copiedInvite ? "คัดลอกแล้ว ✓" : "คัดลอกโค้ดชวน"}
                </button>
              </>
            ) : (
              <p className="hint">{busy ? "กำลังเตรียมโค้ด..." : "กดปุ่ม \"เปิดห้อง\" ด้านล่าง"}</p>
            )}
          </div>

          {inviteCode && connectionState !== "connected" && (
            <div className="step">
              <div className="step-title">
                <span className="step-badge">2</span> วางโค้ดตอบจากเพื่อน
              </div>
              <textarea
                className="code-input"
                placeholder="วางโค้ดตอบที่เพื่อนส่งกลับมาที่นี่"
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
          <div className="step">
            <div className="step-title">
              <span className="step-badge">1</span> วางโค้ดชวนจากเพื่อน
            </div>
            {!answerCode && (
              <>
                <textarea
                  className="code-input"
                  placeholder="วางโค้ดชวนที่เพื่อนส่งมาที่นี่"
                  value={pastedInvite}
                  onChange={(e) => setPastedInvite(e.target.value)}
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={submitInvite} disabled={busy || !pastedInvite}>
                  ถัดไป
                </button>
              </>
            )}
          </div>

          {answerCode && (
            <div className="step">
              <div className="step-title">
                <span className="step-badge">2</span> ส่งโค้ดตอบกลับให้เพื่อน
              </div>
              <textarea className="code-box" readOnly value={answerCode} />
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={async () => setCopiedAnswer(await copyToClipboard(answerCode))}
              >
                {copiedAnswer ? "คัดลอกแล้ว ✓" : "คัดลอกโค้ดตอบ"}
              </button>
              <p className="hint">รอเพื่อนวางโค้ดนี้ฝั่งเขาเพื่อต่อติด</p>
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
