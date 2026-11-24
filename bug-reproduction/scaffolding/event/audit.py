#!/usr/bin/env python3
"""Audit every edit-tool call in a session: leads, statuses, carried-line drift, errors.

Usage: python3 audit.py <sessionID> [file-at-start]
Judgment faces:
  error M1:        status=error, "Could not find oldString" -> oldString re-typed with drift
  corruption M10:  status=completed, a line with identical content in oldString and
                   newString whose leading spaces differ -> carried line re-indented
"""
import json
import sqlite3
import sys

DB = "/home/michael/.local/share/opencode/opencode.db"


def leads(s):
    out = []
    for line in s.split("\n"):
        if line.strip() == "":
            out.append("-")
        else:
            out.append(len(line) - len(line.lstrip(" ")))
    return out


def carried_drift(old, new):
    """Lines whose stripped content matches an oldString line but with a different lead."""
    old_by_content = {}
    for line in old.split("\n"):
        if line.strip():
            old_by_content.setdefault(line.strip(), []).append(len(line) - len(line.lstrip(" ")))
    drifts = []
    for line in new.split("\n"):
        if not line.strip():
            continue
        nlead = len(line) - len(line.lstrip(" "))
        old_leads = old_by_content.get(line.strip())
        if old_leads and nlead not in old_leads:
            drifts.append((line.strip()[:60], old_leads, nlead))
    return drifts


def main():
    sid = sys.argv[1]
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    rows = conn.execute(
        "SELECT data FROM session_part WHERE session_id=? AND type='tool' ORDER BY ordinal, time_created",
        (sid,),
    ).fetchall()
    n = 0
    for (data,) in rows:
        p = json.loads(data)
        if p.get("name") != "edit":
            continue
        if True:
            n += 1
            st = p.get("state", {})
            inp = st.get("input", {})
            old, new = inp.get("oldString", ""), inp.get("newString", "")
            status = st.get("status")
            print(f"=== edit {n} status={status} path={inp.get('path')}")
            print(f"  old: {len(old.splitlines())} lines, leads={leads(old)}")
            print(f"  new: {len(new.splitlines())} lines, leads={leads(new)}")
            cd = carried_drift(old, new)
            if cd:
                print(f"  CARRIED-DRIFT: {len(cd)} line(s)")
                for content, old_leads, nlead in cd:
                    print(f"    {content!r}: old leads {old_leads} -> new lead {nlead}")
            err = st.get("error")
            if err:
                msg = json.dumps(err)
                print(f"  ERROR: {msg[:500]}")
            print()
    print(f"total edit calls: {n}")


if __name__ == "__main__":
    main()
