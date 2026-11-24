#!/usr/bin/env python3
"""scout_offby.py — focused scout on the "by one"/"by 1" symptom.

Every candidate part carrying E.off_by gets: the compact hit-line(s)
(the line containing each hit, previous line prepended when the hit-line
is short), whole-part confusion + byte-context flags (flags, NOT
adjacency — the word "byte" may be absent), and the next two tool calls
in the session (the escape trajectory). Whole parts are never dumped.
"""
import os
import sqlite3
import json
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(os.path.dirname(HERE)), "data.sqlite")  # report level
TRACE = "file:/home/michael/.local/share/opencode/opencode.db?mode=ro"

dst = sqlite3.connect(DATA)
src = sqlite3.connect(TRACE, uri=True)

BO = re.compile(r"by one|by 1", re.I)
# confusion context: a held fact no longer holds
CONFUSION = re.compile(
    r"\bhmm\b|\bwait\b|\bstrange\b|\bweird\b|\bodd\b|\bpuzzl|\bconfus|\bhuh\b|"
    r"\?!|doesn'?t (add up|line up|fit)|not lining up|shouldn'?t be (possible|right|true)|"
    r"no idea|why (is|would|does|does it|that)", re.I)
# byte context: content-level vocabulary, whole part, NOT an adjacency
BYTEISH = re.compile(
    r"byte|char|space|tab\b|newline|linefeed|crlf|whitespace|invisible|indent|"
    r"\\r|\\n|0x|hex|oldstring|newstring|string|match|render|prefix|copy|paste|"
    r"quote|dash|unicode|nbsp|character|line number|line break|terminator|ending|"
    r"blank line|trailing|leading", re.I)


def fetch(ptr):
    if ptr.startswith("parts:"):
        _, sid, tc, ordn = ptr.split(":")
        r = src.execute(
            "SELECT data FROM session_part WHERE session_id=? AND time_created=? AND ordinal=?",
            (sid, int(tc), int(ordn))).fetchone()
        return (json.loads(r[0]).get("text") or "", None) if r else (None, None)
    _, sid, tc, seq, bi = ptr.split(":")
    r = src.execute(
        "SELECT data FROM session_message WHERE session_id=? AND time_created=? AND seq=?",
        (sid, int(tc), int(seq))).fetchone()
    if not r:
        return None, None
    j = json.loads(r[0])
    try:
        return (j.get("content") or [])[int(bi)].get("text") or "", j
    except Exception:
        return None, None


def tool_summary(name, inp):
    if not isinstance(inp, dict):
        return str(name)
    if name == "shell":
        return "shell: " + str(inp.get("command") or "")[:70]
    if name in ("read", "edit", "write", "grep", "glob"):
        return "%s: %s" % (name, str(inp.get("path") or inp.get("pattern") or "")[:50])
    if name == "question":
        qs = inp.get("questions") or []
        return "question: " + str(qs[0].get("header") if qs else "")[:50]
    return str(name)


def next_tools(ptr, msgjson):
    out = []
    if ptr.startswith("parts:"):
        _, sid, tc, ordn = ptr.split(":")
        q = ("SELECT json_extract(data,'$.name'), data FROM session_part "
             "WHERE session_id=? AND type='tool' AND (time_created > ? OR "
             "(time_created = ? AND ordinal > ?)) ORDER BY time_created, ordinal LIMIT 2")
        for name, data in src.execute(q, (sid, int(tc), int(tc), int(ordn))):
            j = json.loads(data)
            out.append(tool_summary(name, (j.get("state") or {}).get("input")))
        return out
    _, sid, tc, seq, bi = ptr.split(":")
    if msgjson is not None:
        for b in (msgjson.get("content") or [])[int(bi) + 1:]:
            if isinstance(b, dict) and b.get("type") == "tool" and len(out) < 2:
                out.append(tool_summary(b.get("name"), (b.get("state") or {}).get("input")))
    for (data,) in src.execute(
            "SELECT data FROM session_message WHERE session_id=? AND type='assistant' "
            "AND (time_created > ? OR (time_created = ? AND seq > ?)) "
            "ORDER BY time_created, seq LIMIT 6", (sid, int(tc), int(tc), int(seq))):
        if len(out) >= 2:
            break
        for b in json.loads(data).get("content") or []:
            if isinstance(b, dict) and b.get("type") == "tool" and len(out) < 2:
                out.append(tool_summary(b.get("name"), (b.get("state") or {}).get("input")))
    return out


def hit_lines(text):
    bounds, start = [], 0
    for i, ch in enumerate(text):
        if ch == "\n":
            bounds.append((start, i))
            start = i + 1
    bounds.append((start, len(text)))
    seen, out = set(), []
    for m in BO.finditer(text):
        li = next(i for i, (s, e) in enumerate(bounds) if s <= m.start() < e)
        if li in seen:
            continue
        seen.add(li)
        s, e = bounds[li]
        frag = text[s:e].strip()
        if len(frag) < 120 and li > 0:
            frag = text[bounds[li - 1][0]:bounds[li - 1][1]].strip()[-100:] + " // " + frag
        lo = max(0, m.start() - s - 120)
        hi = min(len(frag), max(0, m.start() - s - 120) + 260)
        out.append(frag[lo:hi].replace("\n", " "))
        if len(out) >= 3:
            break
    return out


rows = dst.execute(
    "SELECT c.ptr, c.sid FROM cand c "
    "JOIN cand_clue cc ON cc.ptr = c.ptr AND cc.clue='E.off_by'").fetchall()

st = [0, 0, 0, 0, 0, 0]  # n, conf, byte, shell, conf&byte, gone
for ptr, sid in sorted(rows):
    text, msgjson = fetch(ptr)
    if text is None:
        st[5] += 1
        print("-- %s GONE" % ptr)
        continue
    st[0] += 1
    conf = 1 if CONFUSION.search(text) else 0
    byte = 1 if BYTEISH.search(text) else 0
    tools = next_tools(ptr, msgjson)
    shell = 1 if any(t.startswith("shell") for t in tools) else 0
    st[1] += conf
    st[2] += byte
    st[3] += shell
    st[4] += (conf and byte)
    print("\n-- %s %s len=%d conf=%d byte=%d next=[%s]"
          % (sid[-10:], "parts" if ptr.startswith("parts:") else "msg",
             len(text), conf, byte,
             " | ".join(tools) or "-"))
    for h in hit_lines(text):
        print("   " + h)

print("\n=== flags over %d parts ===" % st[0])
print("confusion present: %d   byte-context present: %d   both: %d" % (st[1], st[2], st[4]))
print("next tool call includes shell: %d" % st[3])
print("gone: %d" % st[5])

dst.close()
src.close()
