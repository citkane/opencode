#!/usr/bin/env python3
"""db.py — the shared database (data.sqlite), persistent by design.

The file is never deleted whole. A mine rebuilds only cand / cand_clue.
The net state (clue / trashcan) and the report channel (mandate /
fieldkey / report / report_note) survive every mine.
"""
import os
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))  # scaffolding/scout
ROOT = os.path.dirname(os.path.dirname(HERE))      # the report level
DB = os.path.join(ROOT, "data.sqlite")

SCHEMA = """
-- the net state (clues.py)
CREATE TABLE IF NOT EXISTS clue (
  name TEXT, grp TEXT, tier TEXT, seq INTEGER, pattern TEXT,
  PRIMARY KEY (name, seq)
);
CREATE TABLE IF NOT EXISTS trashcan (
  name TEXT, grp TEXT, tier TEXT, seq INTEGER, pattern TEXT, note TEXT,
  PRIMARY KEY (name, seq)
);
-- the mine's output (miner.py rebuilds these two only)
CREATE TABLE IF NOT EXISTS cand (
  ptr TEXT,             -- fetch key into opencode.db (parts:… / msg:…)
  store TEXT,           -- parts | msg
  sid TEXT,             -- the only metadata in the data domain
  term_total INTEGER,   -- total occurrences of all matched clues
  clues TEXT,           -- comma-joined clue names that matched
  raw_cr INTEGER,       -- reference only: raw U+000D count in the part
  PRIMARY KEY (ptr)
);
CREATE TABLE IF NOT EXISTS cand_clue (
  ptr TEXT, clue TEXT, n INTEGER,
  PRIMARY KEY (ptr, clue)
);
-- the report channel (report.py / field.py)
CREATE TABLE IF NOT EXISTS mandate (
  scout_id TEXT PRIMARY KEY, text TEXT
);
CREATE TABLE IF NOT EXISTS fieldkey (
  scout_id TEXT, key INTEGER, ptr TEXT,
  PRIMARY KEY (scout_id, key)
);
CREATE TABLE IF NOT EXISTS report (
  scout_id TEXT, key INTEGER, ptr TEXT, cls TEXT, label TEXT, reason TEXT, quote TEXT,
  PRIMARY KEY (scout_id, key)
);
CREATE TABLE IF NOT EXISTS report_note (
  scout_id TEXT, section TEXT, seq INTEGER, text TEXT,
  PRIMARY KEY (scout_id, section, seq)
);
-- the director-verified seed (verify.py) — the top's population,
-- growing per round
CREATE TABLE IF NOT EXISTS instances (
  scout_id TEXT, key INTEGER, ptr TEXT, face TEXT, note TEXT,
  PRIMARY KEY (scout_id, key)
);
"""


def conn():
    db = sqlite3.connect(DB)
    db.executescript(SCHEMA)
    cols = [r[1] for r in db.execute("pragma table_info(report)")]
    if "label" not in cols:
        db.execute("alter table report add column label text")
        db.commit()
    return db
