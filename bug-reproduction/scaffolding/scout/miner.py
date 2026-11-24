#!/usr/bin/env python3
"""miner.py — the candidate net over the live trace DB.

Reads the ACTIVE clue set from data.sqlite (`clue`), scans every
model-generated text part (reasoning or visible text, both stores), and
writes the candidate body: cand / cand_clue — clearing and rebuilding
ONLY those two tables. The clue state, the trashcan, and the report
channel are persistent and untouched by a mine. The census is printed
and written to mine.out; the loop's diff is mine-vs-mine.
"""
import json
import os
import sqlite3
from collections import Counter

import clues
import db

SRC = "file:" + os.path.expanduser("~/.local/share/opencode/opencode.db") + "?mode=ro"
OUT = os.path.join(db.ROOT, "mine.out")


def corpus():
    d = sqlite3.connect(SRC, uri=True)
    out = []
    for sid, tc, ordn, data in d.execute(
            "SELECT session_id, time_created, ordinal, data FROM session_part "
            "WHERE type IN ('reasoning','text')"):
        t = json.loads(data).get("text") or ""
        if t:
            out.append(("parts", sid, "parts:%s:%d:%d" % (sid, tc, ordn), t))
    for sid, tc, seq, data in d.execute(
            "SELECT session_id, time_created, seq, data FROM session_message "
            "WHERE type='assistant'"):
        for bi, b in enumerate(json.loads(data).get("content") or []):
            if isinstance(b, dict) and b.get("type") in ("reasoning", "text"):
                t = b.get("text") or ""
                if t:
                    out.append(("msg", sid, "msg:%s:%d:%d:%d" % (sid, tc, seq, bi), t))
    d.close()
    return out


def net(d, act):
    """Finds, tags, counts; never curates. Returns (candidate count, census)."""
    d.execute("delete from cand")
    d.execute("delete from cand_clue")

    L = ["=== candidate census (mechanical net, no curation) ==="]
    cand_rows, cand_clue_rows = [], []
    store_counts = Counter()
    clue_parts = Counter()
    clue_occ = Counter()

    rows = corpus()
    for store, sid, ptr, t in rows:
        perclue = {}
        for name, val in act.items():
            c = sum(len(rx.findall(t)) for rx in val[2])
            if c:
                perclue[name] = c
        if not perclue:
            continue
        cand_rows.append((ptr, store, sid, sum(perclue.values()),
                          ",".join(perclue), t.count("\r")))
        store_counts[store] += 1
        for name, c in perclue.items():
            cand_clue_rows.append((ptr, name, c))
            clue_parts[name] += 1
            clue_occ[name] += c

    d.executemany("insert into cand values (?,?,?,?,?,?)", cand_rows)
    d.executemany("insert into cand_clue values (?,?,?)", cand_clue_rows)

    L.append("model text parts scanned: %d (parts+msg, reasoning+text, all sessions)" % len(rows))
    L.append("CANDIDATE parts (>=1 clue matched): %d" % len(cand_rows))
    L.append("  by store: %s" % dict(store_counts))
    L.append("  distinct candidate sids: %d" % len({r[2] for r in cand_rows}))
    L.append("")
    L.append("  by clue (parts that matched | total occurrences):")
    L.append("    %-18s %-8s %8s %10s" % ("clue", "grp/tier", "parts", "occ"))
    for name in sorted(act, key=lambda n: (act[n][0], n)):
        grp, tier, _ = act[name]
        L.append("    %-18s %-8s %8d %10d" %
                 (name, "%s/%s" % (grp, tier), clue_parts[name], clue_occ[name]))
    L.append("")
    L.append("  by group (parts with >=1 clue in group | occurrences):")
    grp_parts, grp_occ = {}, Counter()
    for ptr, clue_name, c in cand_clue_rows:
        g = clue_name.split(".")[0]
        grp_occ[g] += c
        grp_parts[g] = grp_parts.get(g, set()) | {ptr}
    for g in sorted(grp_parts):
        L.append("    group %s: %5d parts, %6d occurrences" % (g, len(grp_parts[g]), grp_occ[g]))
    return len(cand_rows), L


def mine():
    d = db.conn()
    act = clues.active(d)
    if not act:
        d.close()
        raise SystemExit("no active clues — seed with: python3 clues.py init")
    n, L = net(d, act)
    d.commit()
    d.close()
    for line in L:
        print(line)
    open(OUT, "w").write("\n".join(L) + "\n")
    print("data.sqlite: %d candidate parts (census -> mine.out)" % n)


if __name__ == "__main__":
    mine()
