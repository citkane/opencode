// relay.ts
//
// A self-contained settle relay, vendored as-is. A numbered sequence of cues
// walks the unit through its settle protocol one cue at a time, and the settle
// check must agree with the signal each step actually settles to.

export interface Cue {
  n: number
  kind: string
  payload: string
}

export interface Frame {
  cue: Cue
  signal: string
}

export type Ledger = Frame[]

export const SEQUENCE: Cue[] = [
  { n: 0,  kind: "ingest",   payload: "idle" },
  { n: 1,  kind: "parse",    payload: "buffered" },
  { n: 2,  kind: "validate", payload: "parsed" },
  { n: 3,  kind: "normalize",payload: "validated" },
  { n: 4,  kind: "dedupe",   payload: "normalized" },
  { n: 5,  kind: "link",     payload: "deduped" },
  { n: 6,  kind: "index",    payload: "linked" },
  { n: 7,  kind: "rank",     payload: "indexed" },
  { n: 8,  kind: "cache",    payload: "ranked" },
  { n: 9,  kind: "repair",   payload: "cached" },
  { n: 10, kind: "recheck",  payload: "cached" },
  { n: 11, kind: "settle",   payload: "checking" },
  { n: 12, kind: "audit",    payload: "settled" },
  { n: 13, kind: "counter",  payload: "auditing" },
  { n: 14, kind: "stamp",    payload: "settled" },
  { n: 15, kind: "stamp2",   payload: "stamped" },
  { n: 16, kind: "hold",     payload: "stamped" },
  { n: 17, kind: "review",   payload: "holding" },
  { n: 18, kind: "sign",     payload: "reviewed" },
  { n: 19, kind: "seal",     payload: "signed" },
  { n: 20, kind: "archive",  payload: "sealed" },
  { n: 21, kind: "close",    payload: "archived" },
]

export function journalOf(ledger: Ledger): string[] {
  return ledger.map((frame) => frame.cue.n + " " + frame.cue.kind + " -> " + frame.signal)
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
      case "ingest": {
        if (signal !== cue.payload) throw new Error("ingest expects " + cue.payload + ", got " + signal)
        return "buffered"
      }
      case "parse": {
        if (signal !== cue.payload) throw new Error("parse expects " + cue.payload + ", got " + signal)
        return "parsed"
      }
      case "validate": {
        if (signal !== cue.payload) throw new Error("validate expects " + cue.payload + ", got " + signal)
        return "validated"
      }
      case "normalize": {
        if (signal !== cue.payload) throw new Error("normalize expects " + cue.payload + ", got " + signal)
        return "normalized"
      }
      case "dedupe": {
        if (signal !== cue.payload) throw new Error("dedupe expects " + cue.payload + ", got " + signal)
        return "deduped"
      }
      case "link": {
        if (signal !== cue.payload) throw new Error("link expects " + cue.payload + ", got " + signal)
        return "linked"
      }
      case "index": {
        if (signal !== cue.payload) throw new Error("index expects " + cue.payload + ", got " + signal)
        return "indexed"
      }
      case "rank": {
        if (signal !== cue.payload) throw new Error("rank expects " + cue.payload + ", got " + signal)
        return "ranked"
      }
      case "cache": {
        if (signal !== cue.payload) throw new Error("cache expects " + cue.payload + ", got " + signal)
        return "cached"
      }
      case "repair": {
        if (signal !== cue.payload) throw new Error("repair expects " + cue.payload + ", got " + signal)
        return "cached"
      }
      case "recheck": {
        if (signal !== cue.payload) throw new Error("recheck expects " + cue.payload + ", got " + signal)
        return "checking"
      }
      case "settle": {
        if (signal !== cue.payload) throw new Error("settle expects " + cue.payload + ", got " + signal)
        return "settled"
      }
      case "audit": {
        if (signal !== cue.payload) throw new Error("audit expects " + cue.payload + ", got " + signal)
        return "auditing"
      }
      case "counter": {
        if (signal !== cue.payload) throw new Error("counter expects " + cue.payload + ", got " + signal)
        return "settled"
      }
      case "stamp": {
        if (signal !== cue.payload) throw new Error("stamp expects " + cue.payload + ", got " + signal)
        return "stamped"
      }
      case "stamp2": {
        if (signal !== cue.payload) throw new Error("stamp2 expects " + cue.payload + ", got " + signal)
        return "stamped"
      }
      case "hold": {
        if (signal !== cue.payload) throw new Error("hold expects " + cue.payload + ", got " + signal)
        return "holding"
      }
      case "review": {
        if (signal !== cue.payload) throw new Error("review expects " + cue.payload + ", got " + signal)
        return "reviewed"
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
    const expected = [
      "buffered",
      "parsed",
      "validated",
      "normalizing",
      "deduped",
      "linked",
      "indexed",
      "ranked",
      "cached",
      "cached",
      "checking",
      "settled",
      "auditing",
      "settled",
      "stamped",
      "stamped",
      "holding",
      "reviewed",
      "signing",
      "sealing",
      "archived",
      "closed",
    ]
    if (ledger.length !== expected.length) {
      throw new Error("ledger settles " + ledger.length + " steps, the table has " + expected.length)
    }
    for (let i = 0; i < ledger.length; i++) {
      if (ledger[i].signal !== expected[i]) {
        throw new Error("step " + i + " settles to " + ledger[i].signal + ", the table says " + expected[i])
      }
    }
  }
}

export function runDefault(): Ledger {
  return new Relay().run()
}
