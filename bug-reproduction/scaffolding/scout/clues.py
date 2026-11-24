#!/usr/bin/env python3
"""clues.py — the clue state (the net), persisted in data.sqlite.

Two tables: `clue` (active — the miner mines against these, the field
builder carries them in [0]) and `trashcan` (dead — never matched, never
fielded; a record an audit may need). The director is the only actor
who moves clues (add / trash); a scout never mutates the clue state.
Genesis: the hand-designed seed in genesis-clues.json, ported once by
`init`.

usage:
  clues.py init [--force]
  clues.py add NAME GRP TIER PATTERN [PATTERN ...]
  clues.py trash NAME [NOTE ...]
  clues.py list
"""
import json
import os
import re
import sys

import db

GENESIS = os.path.join(db.HERE, "genesis-clues.json")


def init(force=False):
    d = db.conn()
    n = d.execute("select count(distinct name) from clue").fetchone()[0]
    if n and not force:
        d.close()
        raise SystemExit("clue state holds %d clues; reseed with: init --force" % n)
    if force:
        d.execute("delete from clue")
    seed = json.load(open(GENESIS))["clues"]
    rows = [(c["name"], c["group"], c["tier"], i, p)
            for c in seed for i, p in enumerate(c["patterns"])]
    d.executemany("insert into clue values (?,?,?,?,?)", rows)
    d.commit()
    d.close()
    print("seeded %d clues (%d patterns) from genesis" % (len(seed), len(rows)))


def add(name, grp, tier, patterns):
    d = db.conn()
    base = d.execute("select coalesce(max(seq), -1) + 1 from clue where name = ?",
                     (name,)).fetchone()[0]
    d.executemany("insert into clue values (?,?,?,?,?)",
                  [(name, grp, tier, base + i, p) for i, p in enumerate(patterns)])
    d.commit()
    d.close()
    print("added %s (%s/%s, %d pattern%s)" %
          (name, grp, tier, len(patterns), "s" if len(patterns) != 1 else ""))


def trash(name, note=""):
    d = db.conn()
    rows = d.execute("select name, grp, tier, seq, pattern from clue where name = ?",
                     (name,)).fetchall()
    if not rows:
        d.close()
        raise SystemExit("no active clue named %s" % name)
    d.execute("delete from clue where name = ?", (name,))
    d.executemany("insert or replace into trashcan values (?,?,?,?,?,?)",
                  [(n, g, t, s, p, note) for (n, g, t, s, p) in rows])
    d.commit()
    d.close()
    print("trashed %s (%d pattern%s)%s" %
          (name, len(rows), "s" if len(rows) != 1 else "",
           " — " + note if note else ""))


def active(d):
    """The active clue set: name -> [grp, tier, [compiled patterns]]."""
    out = {}
    for name, grp, tier, pattern in d.execute(
            "select name, grp, tier, pattern from clue order by name, seq"):
        out.setdefault(name, [grp, tier, []])[2].append(re.compile(pattern, re.I))
    return out


def list_():
    d = db.conn()
    act = active(d)
    print("active: %d clues" % len(act))
    for name in sorted(act, key=lambda n: (act[n][0], n)):
        grp, tier, rxs = act[name]
        print("  %-20s %s/%-5s %s" % (name, grp, tier, " | ".join(rx.pattern for rx in rxs)))
    dead = {}
    for name, grp, tier, note in d.execute("select name, grp, tier, note from trashcan"):
        dead.setdefault(name, [grp, tier, note])
    print("trashcan: %d clue%s" % (len(dead), "s" if len(dead) != 1 else ""))
    for name in sorted(dead, key=lambda n: (dead[n][0], n)):
        grp, tier, note = dead[name]
        print("  %-20s %s/%-5s %s" % (name, grp, tier, note or ""))
    d.close()


def main():
    args = sys.argv[1:]
    if not args:
        raise SystemExit(__doc__)
    op = args[0]
    if op == "init":
        init(force="--force" in args)
    elif op == "add":
        add(args[1], args[2], args[3], args[4:])
    elif op == "trash":
        trash(args[1], " ".join(args[2:]))
    elif op == "list":
        list_()
    else:
        raise SystemExit("unknown op: %s (init / add / trash / list)" % op)


if __name__ == "__main__":
    main()
