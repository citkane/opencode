#!/usr/bin/env python3
"""field.py — the round field builder.

Builds a scout's self-contained field from the CURRENT database state:
<id>-mech.txt (the full active clue inventory + census) and
<id>-samples.txt (the selected parts, keyed [n], no ptrs). Writes the
[n] -> ptr hinge into fieldkey — director-only: the loader resolves it,
the scout never sees a ptr.

Sample source: the mine (cand), or the director-verified set
(instances, all or by face). Sampling: uniform random (--count), or
stratified per clue group (--per-group N). --context adds the
mechanical per-sample context: the preceding user turn, the next tool
event, and its result — the scout must see the outcome.

usage: field.py build SCOUT_ID [--clue NAME]... [--count N]
       [--per-group N] [--instances FACE|all] [--context]
       [--window CHARS] [--ctx-window CHARS] [--seed N]
"""
import argparse
import json
import os
import random
import sqlite3

import db

SRC = "file:" + os.path.expanduser("~/.local/share/opencode/opencode.db") + "?mode=ro"


def fetch(ptr):
    d = sqlite3.connect(SRC, uri=True)
    if ptr.startswith("parts:"):
        _, sid, tc, ordn = ptr.split(":")
        r = d.execute(
            "select data from session_part where session_id=? and time_created=? and ordinal=?",
            (sid, int(tc), int(ordn))).fetchone()
        out = (json.loads(r[0]).get("text") or "") if r else ""
        d.close()
        return out
    _, sid, tc, seq, bi = ptr.split(":")
    r = d.execute(
        "select data from session_message where session_id=? and time_created=? and seq=?",
        (sid, int(tc), int(seq))).fetchone()
    d.close()
    if not r:
        return ""
    try:
        return (json.loads(r[0]).get("content") or [])[int(bi)].get("text") or ""
    except Exception:
        return ""


def prev_user_turn(ptr):
    """The preceding user turn for the part's session (msg store)."""
    p = ptr.split(":")
    d = sqlite3.connect(SRC, uri=True)
    r = d.execute(
        "select data from session_message where session_id=? and type='user' "
        "and time_created < ? order by time_created desc limit 1",
        (p[1], int(p[2]))).fetchone()
    d.close()
    if not r:
        return ""
    return json.loads(r[0]).get("text") or ""


def input_summary(name, inp):
    if not isinstance(inp, dict):
        return ""
    if name == "edit":
        return "%s (oldString %d chars, newString %d chars)" % (
            str(inp.get("path") or ""),
            len(str(inp.get("oldString") or "")),
            len(str(inp.get("newString") or "")))
    if name == "shell":
        return str(inp.get("command") or "")[:80]
    if name in ("read", "write", "grep", "glob"):
        return str(inp.get("path") or inp.get("pattern") or "")[:80]
    return str(inp)[:80]


def summarize(b):
    """A tool block -> (name, input summary, status, result text)."""
    st = b.get("state") or {}
    err = st.get("error")
    result = ""
    if isinstance(err, dict):
        result = "error — " + str(err.get("message") or "")
    else:
        for c in st.get("content") or []:
            if isinstance(c, dict) and c.get("type") == "text":
                result = str(c.get("text") or "")
                break
    return (b.get("name") or "", input_summary(b.get("name"), st.get("input")),
            st.get("status") or "", result)


def tool_event(ptr):
    """The next tool event after the part, by session + order."""
    d = sqlite3.connect(SRC, uri=True)
    out = None
    if ptr.startswith("parts:"):
        _, sid, tc, ordn = ptr.split(":")
        r = d.execute(
            "select data from session_part where session_id=? and type='tool' "
            "and (time_created > ? or (time_created = ? and ordinal > ?)) "
            "order by time_created, ordinal limit 1",
            (sid, int(tc), int(tc), int(ordn))).fetchone()
        if r:
            out = summarize(json.loads(r[0]))
    else:
        _, sid, tc, seq, bi = ptr.split(":")
        r = d.execute(
            "select data from session_message where session_id=? and time_created=? and seq=?",
            (sid, int(tc), int(seq))).fetchone()
        if r:
            for b in json.loads(r[0]).get("content") or []:
                if isinstance(b, dict) and b.get("type") == "tool":
                    out = summarize(b)
                    break
            if out is None:
                for (dta,) in d.execute(
                        "select data from session_message where session_id=? "
                        "and type='assistant' and (time_created > ? or "
                        "(time_created = ? and seq > ?)) "
                        "order by time_created, seq",
                        (sid, int(tc), int(tc), int(seq))):
                    for b in json.loads(dta).get("content") or []:
                        if isinstance(b, dict) and b.get("type") == "tool":
                            out = summarize(b)
                            break
                    if out is not None:
                        break
    d.close()
    return out


def context_block(ptr, a):
    """The mechanical per-sample context, windowed."""
    ut = prev_user_turn(ptr)
    ev = tool_event(ptr)
    w = a.ctx_window
    out = ["  context:"]
    out.append("    user turn: %s" %
               (ut[:w] + ("…" if len(ut) > w else "") if ut else "(none)"))
    if ev is None:
        out.append("    next tool: (none found)")
    else:
        name, inp, status, result = ev
        out.append("    next tool: %s %s — status: %s" % (name, inp, status))
        out.append("    result: %s" %
                   (result[:w] + ("…" if len(result) > w else "") if result else "(none)"))
    return out


def stratify(rows, n, seed):
    """n parts per clue group; each part is assigned to the first group
    (alphabetically) it matched. Deterministic."""
    groups = {}
    for ptr, _s, _sid, clues in rows:
        g = clues.split(",")[0].split(".")[0]
        groups.setdefault(g, []).append(ptr)
    rng = random.Random(seed)
    out = []
    for g in sorted(groups):
        pool = sorted(set(groups[g]))
        out.extend(rng.sample(pool, min(n, len(pool))))
    return out


def select(a):
    d = db.conn()
    if a.instances:
        q = "select ptr from instances"
        params = ()
        if a.instances != "all":
            q += " where face=?"
            params = (a.instances,)
        total = d.execute("select count(*) from instances").fetchone()[0]
        sel = [(p, "inst", "", "") for (p,) in d.execute(q, params).fetchall()]
        src = "verified instances" + (
            "" if a.instances == "all" else " (face=%s)" % a.instances)
    else:
        total = d.execute("select count(*) from cand").fetchone()[0]
        q = "select ptr, store, sid, clues from cand"
        if a.clue:
            q += " where " + " or ".join(
                "instr(',' || clues || ',', ',%s,') > 0" % c for c in a.clue)
        rows = d.execute(q).fetchall()
        if a.per_group:
            keep = set(stratify(rows, a.per_group, a.seed))
            rows = [r for r in rows if r[0] in keep]
        sel = rows
        src = "candidate parts"
    d.close()
    if not a.per_group:
        rng = random.Random(a.seed)
        rng.shuffle(sel)
        sel = sel[:a.count]
    return sel, total, src


def build(a):
    sel, total, src = select(a)
    if not sel:
        raise SystemExit("empty selection — check the source and filters")
    d = db.conn()

    L = []
    A = L.append
    A("=== SCOUT FIELD — mechanical (whole = the %d %s)" % (total, src))
    samp = "per-group %d" % a.per_group if a.per_group \
        else "random %d of %d" % (len(sel), total)
    A("source: %s | sampling: %s | context: %s" %
      (src, samp, "on" if a.context else "off"))
    inv = {}
    for name, tier, pattern in d.execute(
            "select name, tier, pattern from clue order by name, seq"):
        inv.setdefault(name, [tier, []])[1].append(pattern)
    A("")
    A("[0] CLUE INVENTORY — the complete active clue set, all case-insensitive.")
    A("    %-20s %-5s %s" % ("name", "tier", "patterns (verbatim)"))
    for name in sorted(inv, key=lambda n: (inv[n][0], n)):
        A("    %-20s %-5s %s" % (name, inv[name][0], " | ".join(inv[name][1])))
    A("")
    dead = d.execute("select count(distinct name) from trashcan").fetchone()[0]
    A("    trashcan: %d dead clue%s — never matched, never fielded (audit-only)"
      % (dead, "s" if dead != 1 else ""))
    A("")
    A("[1] CENSUS — by clue (parts matched | total occurrences):")
    A("    %-20s %10s %10s" % ("clue", "parts", "occ"))
    for name in sorted(inv, key=lambda n: (inv[n][0], n)):
        parts = d.execute("select count(*) from cand_clue where clue=?", (name,)).fetchone()[0]
        occ = d.execute("select coalesce(sum(n),0) from cand_clue where clue=?", (name,)).fetchone()[0]
        A("    %-20s %10d %10d" % (name, parts, occ))
    A("")
    A("[2] SELECTION — the parts in the samples file (keys only; the hinge is director-side):")
    A("    " + " ".join("%d" % (i + 1) for i in range(len(sel))))

    open(os.path.join(db.HERE, a.scout_id + "-mech.txt"), "w").write("\n".join(L) + "\n")

    S = []
    for i, (ptr, store, sid, cl) in enumerate(sel):
        t = fetch(ptr)
        S.append("[%d] store=%s len=%d clues=%s" % (i + 1, store, len(t), cl))
        if len(t) > a.window:
            S.append("(window: first %d of %d chars)" % (a.window, len(t)))
        S.append(t[:a.window])
        if a.context:
            S.extend(context_block(ptr, a))
        S.append("")
    open(os.path.join(db.HERE, a.scout_id + "-samples.txt"), "w").write("\n".join(S) + "\n")

    d.execute("delete from fieldkey where scout_id=?", (a.scout_id,))
    d.executemany("insert into fieldkey values (?,?,?)",
                  [(a.scout_id, i + 1, ptr) for i, (ptr, _s, _sid, _cl) in enumerate(sel)])
    d.commit()
    d.close()
    print("field for %s: %d parts -> %s-mech.txt / %s-samples.txt (+ %d fieldkey rows)"
          % (a.scout_id, len(sel), a.scout_id, a.scout_id, len(sel)))


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd")
    b = sub.add_parser("build")
    b.add_argument("scout_id")
    b.add_argument("--clue", action="append", default=[])
    b.add_argument("--count", type=int, default=32)
    b.add_argument("--per-group", type=int, default=0)
    b.add_argument("--instances", default="")
    b.add_argument("--context", action="store_true")
    b.add_argument("--window", type=int, default=1200)
    b.add_argument("--ctx-window", type=int, default=400)
    b.add_argument("--seed", type=int, default=7)
    a = p.parse_args()
    if a.cmd == "build":
        build(a)
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
