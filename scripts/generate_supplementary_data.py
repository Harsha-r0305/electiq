#!/usr/bin/env python3
"""
Generate SYNTHETIC supplementary course information for ElectIQ.

The curriculum in PostgreSQL has titles, verticals and linked skills, but no descriptions, topics or
learning outcomes. This script derives them deterministically (same input -> same output) from the real
title / vertical / skills and stores them in course_supplementary_info with is_synthetic = true and a
provenance string. It never touches the courses table and never overwrites a row unless --refresh is given.

    python scripts/generate_supplementary_data.py [--refresh]
"""
import argparse, os, sys
import psycopg2

SOURCE = "synthetic:template-v1 (derived from course title, vertical and linked skills; NOT university-approved)"
VERTICALS = {
    "AAML": "Advanced AI and Machine Learning", "AII": "Applied AI and Industry Intelligence",
    "CSCS": "Computer Systems and Cyber Security", "NICE": "Networks, IoT and Communication Engineering",
    "SPaSE": "Signal Processing, Sensing and Embedded Systems", "core": "core curriculum",
}

def build(title, level, vertical, skills):
    clean = title.replace(" (core)", "")
    vname = " and ".join(VERTICALS.get(v.strip(), v.strip()) for v in (vertical or "").split("+") if v.strip()) or "the curriculum"
    topics = skills[:8]
    lead = ", ".join(skills[:4]) if skills else "the fundamentals of the subject"
    description = (f"{clean} is a {level}-level course in the {vname} area. "
                   f"It covers {lead}" + (f", and related topics such as {', '.join(skills[4:7])}." if len(skills) > 4 else "."))
    outcomes = [f"Explain the core concepts behind {s.lower()} and where they are used in practice." if i == 0
                else f"Apply {s.lower()} to solve a realistic problem." for i, s in enumerate(skills[:4])]
    keywords = sorted({w.lower() for t in [clean] + skills for w in t.replace("/", " ").replace("-", " ").split() if len(w) > 3})[:15]
    return description, topics, skills, outcomes, keywords

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--refresh", action="store_true", help="regenerate rows that already exist")
    args = ap.parse_args()
    url = os.environ.get("OWNER_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url: sys.exit("Set OWNER_DATABASE_URL (see .env.example)")
    conn = psycopg2.connect(url); cur = conn.cursor()
    cur.execute("""SELECT c.course_id, c.title, c.level, c.vertical,
                          COALESCE(ARRAY(SELECT s.name FROM course_skills cs JOIN skills s USING (skill_id)
                                         WHERE cs.course_id = c.course_id ORDER BY cs.depth DESC, s.name), '{}')
                   FROM courses c WHERE c.is_active ORDER BY c.course_id""")
    created = skipped = updated = 0
    for cid, title, level, vertical, skills in cur.fetchall():
        d, t, s, o, k = build(title, level, vertical, skills)
        c2 = conn.cursor()
        c2.execute("SELECT 1 FROM course_supplementary_info WHERE course_id = %s", (cid,))
        exists = c2.fetchone() is not None
        if exists and not args.refresh: skipped += 1; continue
        c2.execute("""INSERT INTO course_supplementary_info (course_id, description, topics, skills_taught, learning_outcomes, keywords, source)
                      VALUES (%s,%s,%s,%s,%s,%s,%s)
                      ON CONFLICT (course_id) DO UPDATE SET description=EXCLUDED.description, topics=EXCLUDED.topics,
                        skills_taught=EXCLUDED.skills_taught, learning_outcomes=EXCLUDED.learning_outcomes,
                        keywords=EXCLUDED.keywords, source=EXCLUDED.source, generated_at=now()""", (cid, d, t, s, o, k, SOURCE))
        updated += exists; created += (not exists)
    conn.commit(); conn.close()
    print(f"supplementary info: created={created} updated={updated} skipped={skipped}")

if __name__ == "__main__":
    main()
