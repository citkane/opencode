#!/usr/bin/env python3
"""report.py — the report channel (mandate in, rows out).

The scout appends compact JSON lines to its report file (one line per
instance or note, section by section). After the round, the director
loads the file into the channel tables; keys resolve to ptrs via
fieldkey. The channel tables:

  mandate(scout_id, text)             — the director's hypothesis, set
                                        before dispatch
  fieldkey(scout_id, key, ptr)        — the hinge (written by field.py;
                                        the scout never sees it)
  report(scout_id, key, ptr, cls,     — one row per examined part:
          label, reason, quote)           cls in signal / noise / error
                                                  / corruption (the
                                          per-round vocabulary is
                                          declared in the dispatch; the
                                          loader is round-agnostic). A
                                          noise row carries the scout's
                                          label: a free-form string,
                                          unbounded set, never
                                          validated.
  report_note(scout_id, section,      — the report's prose sections
          seq, text)                        (judgment first; the
                                          scout's notes; the
                                          director's notes)

usage:
  report.py mandate SCOUT_ID TEXT
  report.py load SCOUT_ID FILE
  report.py note SCOUT_ID SECTION TEXT
  report.py show [SCOUT_ID]
"""
import json
import sys
from collections import Counter

import db

VALID_CLS = ("signal", "noise", "error", "corruption")


def mandate(scout_id, text):
    d = db.conn()
    d.execute("insert or replace into mandate values (?,?)", (scout_id, text))
    d.commit()
    d.close()
    print("mandate set for %s" % scout_id)


def load(scout_id, path):
    d = db.conn()
    keys = dict(d.execute(
        "select key, ptr from fieldkey where scout_id=?", (scout_id,)).fetchall())
    if not keys:
        d.close()
        raise SystemExit("no fieldkey rows for %s — build the field first (field.py)" % scout_id)
    # the file is the round's source of truth: a reload replaces the
    # row set (notes are the append-only journal and are not touched)
    d.execute("delete from report where scout_id=?", (scout_id,))
    inst = notes = 0
    seen = set()
    for ln, line in enumerate(open(path), 1):
        line = line.strip()
        if not line:
            continue
        try:
            r = json.loads(line)
        except ValueError:
            raise SystemExit("line %d: not a JSON object" % ln)
        if "note" in r:
            section = r["note"]
            seq = d.execute(
                "select coalesce(max(seq),-1)+1 from report_note where scout_id=? and section=?",
                (scout_id, section)).fetchone()[0]
            d.execute("insert into report_note values (?,?,?,?)",
                      (scout_id, section, seq, r.get("text", "")))
            notes += 1
            continue
        key, cls = r.get("key"), r.get("cls")
        if key not in keys:
            raise SystemExit("line %d: key %s not in the field (fieldkey)" % (ln, key))
        if cls not in VALID_CLS:
            raise SystemExit("line %d: cls %r not one of %s" % (ln, cls, "/".join(VALID_CLS)))
        if key in seen:
            raise SystemExit("line %d: key %d judged twice" % (ln, key))
        seen.add(key)
        label = (r.get("label") or "").strip()
        if cls == "noise" and not label:
            raise SystemExit("line %d: noise row %d has no label" % (ln, key))
        d.execute(
            "insert or replace into report (scout_id, key, ptr, cls, label, reason, quote) "
            "values (?,?,?,?,?,?,?)",
            (scout_id, key, keys[key], cls, label, r.get("reason", ""), r.get("quote", "")))
        inst += 1
    d.commit()
    d.close()
    print("loaded %s: %d instances, %d notes (field: %d parts)" %
          (scout_id, inst, notes, len(keys)))


def note(scout_id, section, text):
    d = db.conn()
    seq = d.execute(
        "select coalesce(max(seq),-1)+1 from report_note where scout_id=? and section=?",
        (scout_id, section)).fetchone()[0]
    d.execute("insert into report_note values (?,?,?,?)", (scout_id, section, seq, text))
    d.commit()
    d.close()
    print("note added for %s [%s]" % (scout_id, section))


def show(scout_id=None):
    d = db.conn()
    ids = [r[0] for r in d.execute("select scout_id from mandate order by scout_id")]
    if scout_id:
        if scout_id not in ids:
            print("no mandate recorded for %s" % scout_id)
            d.close()
            return
        ids = [scout_id]
    for sid in ids:
        m = d.execute("select text from mandate where scout_id=?", (sid,)).fetchone()
        print("=== %s ===" % sid)
        print("mandate: %s" % (m[0] if m else "(none)"))
        for section, seq, text in d.execute(
                "select section, seq, text from report_note where scout_id=? order by section, seq",
                (sid,)):
            print("\n[%s]" % section)
            print(text)
        n = Counter()
        for cls, key, ptr, label, reason, quote in d.execute(
                "select cls, key, ptr, label, reason, quote from report where scout_id=? order by key",
                (sid,)):
            n[cls] += 1
            extra = "  label: %s" % label if label else ""
            print("%-4d %-6s %s  %s%s" % (key, cls, ptr, reason, extra))
            if quote:
                print("       quote: %s" % quote)
        print("\ntotal: %d instances (%s)" %
              (sum(n.values()), ", ".join("%d %s" % (v, k) for k, v in n.items())))
    d.close()


def main():
    args = sys.argv[1:]
    if not args:
        raise SystemExit(__doc__)
    cmd = args[0]
    if cmd == "mandate":
        mandate(args[1], " ".join(args[2:]))
    elif cmd == "load":
        load(args[1], args[2])
    elif cmd == "note":
        note(args[1], args[2], " ".join(args[3:]))
    elif cmd == "show":
        show(args[1] if len(args) > 1 else None)
    else:
        raise SystemExit("unknown command: %s (mandate / load / note / show)" % cmd)


if __name__ == "__main__":
    main()
