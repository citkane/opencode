// relay.ts
//
// A self-contained settle relay: a numbered cue sequence drives the unit
// through its settle protocol, and the settle check must agree with what
// each step actually settles to.

export interface Cue {
  step: number
  kind: string
  payload: string
}

export interface Frame {
  cue: Cue
  signal: string
}

export type Ledger = Frame[]

export const SEQUENCE: Cue[] = [
  { step: 0, kind: "open",    payload: "idle" },
  { step: 1, kind: "probe",   payload: "ready" },
  { step: 2, kind: "stage",   payload: "pending" },
  { step: 3, kind: "commit",  payload: "staged" },
  { step: 4, kind: "confirm", payload: "committed" },
  { step: 5, kind: "sign",    payload: "confirmed" },
  { step: 6, kind: "seal",    payload: "signed" },
  { step: 7, kind: "archive", payload: "sealed" },
  { step: 8, kind: "recheck", payload: "archived" },
  { step: 9, kind: "settle",  payload: "settling" },
  { step: 10, kind: "audit",  payload: "settled" },
  { step: 11, kind: "index",  payload: "audited" },
  { step: 12, kind: "hold",   payload: "indexed" },
  { step: 13, kind: "review", payload: "holding" },
  { step: 14, kind: "close",  payload: "reviewed" },
]

export function journalOf(ledger: Ledger): string[] {
  return ledger.map((frame) => frame.cue.step + " " + frame.cue.kind + " -> " + frame.signal)
}

export class Relay {
  private readonly cues: Cue[]

  constructor(cues: Cue[] = SEQUENCE) {
    this.cues = cues
  }

  drive(): Ledger {
    const ledger: Ledger = []
    let signal = "idle"
    for (const cue of this.cues) {
      signal = this.reduce(signal, cue)
      ledger.push({ cue, signal })
    }
    return ledger
  }

  run(): Ledger {
    const ledger = this.drive()
    this.verify(ledger)
    return ledger
  }

  private reduce(signal: string, cue: Cue): string {
    switch (cue.kind) {
      case "open": {
        if (signal !== cue.payload) throw new Error("open expects " + cue.payload + ", got " + signal)
        return "ready"
      }
      case "probe": {
        if (signal !== cue.payload) throw new Error("probe expects " + cue.payload + ", got " + signal)
        return "pending"
      }
      case "stage": {
        if (signal !== cue.payload) throw new Error("stage expects " + cue.payload + ", got " + signal)
        return "staged"
      }
      case "commit": {
        if (signal !== cue.payload) throw new Error("commit expects " + cue.payload + ", got " + signal)
        return "committed"
      }
      case "confirm": {
        if (signal !== cue.payload) throw new Error("confirm expects " + cue.payload + ", got " + signal)
        return "confirmed"
      }
      case "sign": {
        if (signal !== cue.payload) throw new Error("sign expects " + cue.payload + ", got " + signal)
        return "signed"
      }
      case "seal": {
        if (signal !== cue.payload) throw new Error("seal expects " + cue.payload + ", got " + signal)
        return "sealed"
      }
      case "archive": {
        if (signal !== cue.payload) throw new Error("archive expects " + cue.payload + ", got " + signal)
        return "archived"
      }
      case "recheck": {
        if (signal !== cue.payload) throw new Error("recheck expects " + cue.payload + ", got " + signal)
        return "settling"
      }
      case "settle": {
        if (signal !== cue.payload) throw new Error("settle expects " + cue.payload + ", got " + signal)
        return "settled"
      }
      case "audit": {
        if (signal !== cue.payload) throw new Error("audit expects " + cue.payload + ", got " + signal)
        return "audited"
      }
      case "index": {
        if (signal !== cue.payload) throw new Error("index expects " + cue.payload + ", got " + signal)
        return "indexed"
      }
      case "hold": {
        if (signal !== cue.payload) throw new Error("hold expects " + cue.payload + ", got " + signal)
        return "holding"
      }
      case "review": {
        if (signal !== cue.payload) throw new Error("review expects " + cue.payload + ", got " + signal)
        return "reviewed"
      }
      case "close": {
        if (signal !== cue.payload) throw new Error("close expects " + cue.payload + ", got " + signal)
        return "closed"
      }
      default: {
        throw new Error("unknown cue kind " + cue.kind)
      }
    }
  }

  private verify(ledger: Ledger): void {
    const signals = ledger.map((frame) => frame.signal)
    if (signals.length !== this.cues.length) {
      throw new Error("ledger settles " + signals.length + " steps, the protocol has " + this.cues.length)
    }
    if (signals[0] !== "ready") throw new Error("step 0 settles to " + signals[0])
    if (signals[1] !== "pending") throw new Error("step 1 settles to " + signals[1])
    if (signals[2] !== "staged") throw new Error("step 2 settles to " + signals[2])
    if (signals[3] !== "committed") throw new Error("step 3 settles to " + signals[3])
    if (signals[4] !== "confirmed") throw new Error("step 4 settles to " + signals[4])
    if (signals[5] !== "signed") throw new Error("step 5 settles to " + signals[5])
    if (signals[6] !== "sealed") throw new Error("step 6 settles to " + signals[6])
    if (signals[7] !== "archived") throw new Error("step 7 settles to " + signals[7])
    if (signals[8] !== "settling") throw new Error("step 8 settles to " + signals[8])
    if (signals[9] !== "settled") throw new Error("step 9 settles to " + signals[9])
    if (signals[10] !== "audited") throw new Error("step 10 settles to " + signals[10])
    if (signals[11] !== "indexed") throw new Error("step 11 settles to " + signals[11])
    if (signals[12] !== "holding") throw new Error("step 12 settles to " + signals[12])
    if (signals[13] !== "reviewed") throw new Error("step 13 settles to " + signals[13])
    if (signals[14] !== "closed") throw new Error("step 14 settles to " + signals[14])
  }
}

export function runDefault(): Ledger {
  return new Relay().run()
}
