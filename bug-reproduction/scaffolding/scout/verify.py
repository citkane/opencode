#!/usr/bin/env python3
"""verify.py — the director's verification (the scout's mark is a
hypothesis; the trace DB is the whole).

Shows the evidence for a round's marked rows — the preceding user
turn, the part's next tool event, and its result — and accepts rows
into the instances table: the director-verified seed, the top's
population, growing per round. The mark stays in report; the accepted
row is the fact. Rejections need no row: the director's note
(report.py note) carries them.

usage:
  verify.py show SCOUT_ID [CLS ...]
  verify.py accept SCOUT_ID FACE KEY [KEY ...]
  verify.py list
"""
import sys

import db
import field

FACES = ("error", "corruption")
REALIZED = ("signal", "error", "corruption")


def show(scout_id, cls_filter):
    cls = cls_filter if cls_filter else list(REALIZED)
    d = db.conn()
    rows = d.execute(
        "select key, ptr, cls, label, reason, quote from report "
        "where scout_id=? and cls in (%s) order by key" % ",".join("?" * len(cls)),
        [scout_id] + cls).fetchall()
    d.close()
    for key, ptr, cls_, label, reason, quote in rows:
        print("%-4d %-10s %s" % (key, cls_, ptr))
        if label:
            print("  label: %s" % label)
        if reason:
            print("  mark: %s" % reason)
        if quote:
            print("  quote: %s" % quote)
        ut = field.prev_user_turn(ptr)
        print("  user turn: %s" % (ut[:200] if ut else "(none)"))
        ev = field.tool_event(ptr)
        if ev is None:
            print("  next tool: (none found)")
        else:
            name, inp, status, result = ev
            print("  next tool: %s %s — status: %s" % (name, inp, status))
            print("  result: %s" % (result[:300] if result else "(none)"))
        print()
    print("%d marked row(s)" % len(rows))


def accept(scout_id, face, keys):
    if face not in FACES:
        raise SystemExit("face %r not one of %s" % (face, "/".join(FACES)))
    if not keys:
        raise SystemExit("no keys given")
    d = db.conn()
    marks = dict(
        (k, (p, c)) for k, p, c in d.execute(
            "select key, ptr, cls from report where scout_id=?", (scout_id,)))
    for k in keys:
        if k not in marks:
            raise SystemExit("key %d not marked in %s" % (k, scout_id))
        ptr, cls = marks[k]
        if cls == "noise":
            print("note: key %d was marked noise; accepted as %s (director override)" % (k, face))
        elif cls != face:
            print("note: key %d was marked %s; accepted as %s" % (k, cls, face))
        d.execute("insert or replace into instances values (?,?,?,?,?)",
                  (scout_id, k, ptr, face, ""))
    d.commit()
    d.close()
    print("accepted %d row(s) as %s -> instances (%s)" % (len(keys), face, scout_id))


def list_():
    d = db.conn()
    rows = d.execute(
        "select scout_id, key, face, ptr from instances order by scout_id, key").fetchall()
    d.close()
    for sid, key, face, ptr in rows:
        print("%s  %-4d %-10s %s" % (sid, key, face, ptr))
    print("total: %d verified instance(s)" % len(rows))


def main():
    args = sys.argv[1:]
    if not args:
        raise SystemExit(__doc__)
    cmd = args[0]
    if cmd == "show":
        show(args[1], args[2:] if len(args) > 2 else [])
    elif cmd == "accept":
        accept(args[1], args[2], [int(k) for k in args[3:]])
    elif cmd == "list":
        list_()
    else:
        raise SystemExit("unknown command: %s (show / accept / list)" % cmd)


if __name__ == "__main__":
    main()
