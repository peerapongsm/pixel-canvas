// Thin manual-signaling WebRTC wrapper. No server anywhere: the offer/answer
// SDP is exchanged as copy-paste codes (see lib/codes.ts) by the two people
// themselves. Google's public STUN server is used for NAT traversal info
// only; there is no TURN relay, so some NAT combinations simply can't
// connect peer-to-peer (see /method for the honest explanation).
import { encodeSdp, decodeAnyCodeToSdp } from "@/lib/shortCode";
import { encode, decode, type Message } from "@/lib/proto";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const CHANNEL_LABEL = "pixel-canvas";
const ICE_GATHERING_TIMEOUT_MS = 5000;

export type ConnectionState =
  | "idle"
  | "gathering"
  | "waiting-for-answer"
  | "connecting"
  | "connected"
  | "failed"
  | "disconnected"
  | "closed";

export interface RtcCallbacks {
  onStateChange?: (state: ConnectionState) => void;
  onMessage?: (message: Message) => void;
}

export class PixelCanvasConnection {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private callbacks: RtcCallbacks;
  private _state: ConnectionState = "idle";

  constructor(callbacks: RtcCallbacks = {}) {
    this.callbacks = callbacks;
  }

  get state(): ConnectionState {
    return this._state;
  }

  private setState(state: ConnectionState): void {
    if (this._state === state) return;
    this._state = state;
    this.callbacks.onStateChange?.(state);
  }

  private createPeerConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") this.setState("failed");
    };
    this.pc = pc;
    return pc;
  }

  private attachChannel(channel: RTCDataChannel): void {
    this.channel = channel;
    channel.onopen = () => this.setState("connected");
    channel.onclose = () => {
      if (this._state !== "closed") this.setState("disconnected");
    };
    channel.onmessage = (event: MessageEvent) => {
      try {
        const message = decode(event.data as string);
        this.callbacks.onMessage?.(message);
      } catch {
        // A malformed message from the peer should never crash the app.
      }
    };
  }

  // Some networks (VPNs, restrictive firewalls, unreachable STUN) never reach
  // "complete", which would otherwise hang invite/answer generation forever.
  // We settle for whatever candidates gathered within the timeout instead.
  private waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === "complete") return Promise.resolve();
    return new Promise((resolve) => {
      const finish = () => {
        pc.removeEventListener("icegatheringstatechange", check);
        clearTimeout(timer);
        resolve();
      };
      const check = () => {
        if (pc.iceGatheringState === "complete") finish();
      };
      const timer = setTimeout(finish, ICE_GATHERING_TIMEOUT_MS);
      pc.addEventListener("icegatheringstatechange", check);
    });
  }

  /** Host, step 1: open a room, produce an invite code to send to the friend. */
  async createInvite(): Promise<string> {
    const pc = this.createPeerConnection();
    this.attachChannel(pc.createDataChannel(CHANNEL_LABEL));

    this.setState("gathering");
    await pc.setLocalDescription(await pc.createOffer());
    await this.waitForIceGatheringComplete(pc);

    this.setState("waiting-for-answer");
    return encodeSdp(pc.localDescription!.sdp);
  }

  /** Guest, step 2: paste the host's invite code, produce an answer code to send back. */
  async joinWithInvite(inviteCode: string): Promise<string> {
    const pc = this.createPeerConnection();
    pc.ondatachannel = (event) => this.attachChannel(event.channel);

    const offerSdp = decodeAnyCodeToSdp(inviteCode);
    await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });

    this.setState("gathering");
    await pc.setLocalDescription(await pc.createAnswer());
    await this.waitForIceGatheringComplete(pc);

    this.setState("connecting");
    return encodeSdp(pc.localDescription!.sdp);
  }

  /** Host, step 3: paste the guest's answer code to complete the connection. */
  async completeWithAnswer(answerCode: string): Promise<void> {
    if (!this.pc) throw new Error("no active connection to complete");
    const answerSdp = decodeAnyCodeToSdp(answerCode);
    this.setState("connecting");
    await this.pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  }

  send(message: Message): void {
    if (this.channel?.readyState === "open") {
      this.channel.send(encode(message));
    }
  }

  close(): void {
    this.channel?.close();
    this.pc?.close();
    this.channel = null;
    this.pc = null;
    this.setState("closed");
  }
}
