#!/usr/bin/env python3
"""trace.py — dump a subagent session's tool calls (edit/read/grep) with
oldString/newString/status/error, in ordinal order. Reads opencode.db.

Usage: python3 trace.py <session_id> [db]
"""
import json
import sqlite3
import sys


def main() -> None:
    sid = sys.argv[1]
    db = sys.argv[2] if len(sys.argv) > 2 else "/home/michael/.local/share/opencode/opencode.db"
    c = sqlite3.connect(f"file:{db}?mode=ro", uri=True).cursor()
    c.execute(
        "SELECT ordinal, type, data FROM session_part WHERE session_id=? ORDER BY ordinal, time_created",
        (sid,),
    )
    n = 0
    for ordn, t, raw in c.fetchall():
        p = json.loads(raw)
        if t == "tool" and p.get("name") in ("edit", "read", "grep", "write"):
            n += 1
            st = p.get("state", {})
            inp = st.get("input", {})
            status = st.get("status")
            tag = "ERR" if status == "error" else status
            print(f"[{n}] {p.get('name').upper()} ({tag}) {inp.get('path','')}")
            for k in ("oldString", "newString", "pattern"):
                if k in inp:
                    print(f"    {k} = {inp[k]!r}")
            err = st.get("error")
            if err:
                print(f"    >>> ERROR: {err}")
        elif t == "tool":
            print(f"[{n}] tool={p.get('name')} status={p.get('state',{}).get('status')}")
        elif t == "reasoning":
            print(f"    (reasoning) {p.get('text','')[:160]!r}")
    if n == 0:
        print("no edit/read/grep/write calls found for", sid)


if __name__ == "__main__":
    main()
