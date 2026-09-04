"""
Geotemporal Transfusing — write one-line headlines with Claude (optional step).

Run:   ANTHROPIC_API_KEY=sk-... python3 headlines_llm.py ../site/data/events.json --out headlines.json
       (or put the key in pipeline/.env as ANTHROPIC_API_KEY=...; refresh.sh runs this step only when a key is present)
Needs: pip install requests

For every event, sends the article name, date, place and the Wikipedia lead paragraph, and asks for a headline that
says what happened and why anyone would care ("Argentina beat France on penalties to win the 2022 World Cup"),
13 words or fewer, past tense, no clickbait tricks — the interest has to come from the fact itself. Cached per slug + lead in headlines_cache/, so a re-run only
writes headlines for new or changed events. Output: { slug: headline }, read by merge.js ahead of its own rules.

Cost: about 250 input + 25 output tokens per event; at Claude Haiku 4.5 prices ($1 / $5 per million tokens, platform.claude.com/docs/en/models/overview) about $4 per 10,000 events.
Model and endpoint are read from the environment (ANTHROPIC_MODEL, default claude-haiku-4-5-20251001) — check
https://platform.claude.com/docs/en/models/overview for the current names before a large run.
"""

import argparse
import hashlib
import json
import os
import sys
import time

import requests

API = "https://api.anthropic.com/v1/messages"
CACHE_DIR = "headlines_cache"
BATCH = 20   # events per request; the model answers with a JSON object slug -> headline

SYSTEM = (
    "You write the headline that makes someone want to click, for events standing on a 3D globe. For each event you get "
    "an article title, a date, a place and the opening of its Wikipedia article. Reply with ONLY a JSON object mapping "
    "each slug to one headline.\n"
    "Write it the way a good newspaper front page would: the specific thing that happened and the detail that makes a "
    "stranger curious. Rules:\n"
    "- Say what happened and why it mattered, never just name the thing. 'United States-Mexico-Canada Agreement' is "
    "useless; 'The three countries tear up NAFTA and sign its replacement' is the headline.\n"
    "- At most 13 words. Past tense. No exclamation marks, no quotation marks, no trailing period.\n"
    "- Lead with the decisive fact when the text has one: who won and how, how many died, the magnitude, who was "
    "elected, what was banned or created.\n"
    "- Never invent a number, name, or outcome that is not in the text. If the text is thin, write the plainest true "
    "sentence you can rather than guessing; accuracy beats drama every time.\n"
    "- For a birth or death, name the person and the one thing they are remembered for.\n"
    "- No teasing without payoff: never 'you won't believe', 'this changed everything', or a question as a headline."
)


def load_key():
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        return key
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_path):
        for line in open(env_path, "r", encoding="utf-8"):
            if line.startswith("ANTHROPIC_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"')
    return None


def cache_key(slug, lead):
    return hashlib.sha1((slug + "|" + lead).encode("utf-8")).hexdigest()[:20]


def ask(key, model, items):
    lines = []
    for it in items:
        lines.append(json.dumps({"slug": it["slug"], "title": it["title"], "date": it["date"], "place": it["place"], "text": it["lead"][:700]}, ensure_ascii=False))
    body = {
        "model": model, "max_tokens": 60 * len(items), "system": SYSTEM,
        "messages": [{"role": "user", "content": "Events, one JSON object per line:\n" + "\n".join(lines) + "\n\nReply with one JSON object: slug -> headline."}],
    }
    for attempt in range(3):
        r = requests.post(API, headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"}, json=body, timeout=120)
        if r.status_code == 200:
            text = r.json()["content"][0]["text"].strip()
            text = text[text.find("{"): text.rfind("}") + 1]
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                print("  unparsable reply, retrying", file=sys.stderr)
        elif r.status_code in (429, 529, 500, 502, 503):
            print("  HTTP " + str(r.status_code) + ", waiting", file=sys.stderr)
            time.sleep(20 * (attempt + 1))
        else:
            print("  HTTP " + str(r.status_code) + ": " + r.text[:200], file=sys.stderr)
            return {}
    return {}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("events")
    parser.add_argument("--out", default="headlines.json")
    parser.add_argument("--min-weight", type=int, default=1)
    parser.add_argument("--max", type=int, default=20000)
    args = parser.parse_args()
    key = load_key()
    if not key:
        print("no ANTHROPIC_API_KEY (environment or pipeline/.env) — skipping written headlines; merge.js uses its rules", file=sys.stderr)
        return
    model = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
    with open(args.events, "r", encoding="utf-8") as f:
        rows = json.load(f)
    out = {}
    if os.path.exists(args.out):
        with open(args.out, "r", encoding="utf-8") as f:
            out = json.load(f)
    os.makedirs(CACHE_DIR, exist_ok=True)
    todo = []
    seen = set()
    for r in rows:
        slug = r[9]
        title = r[13] if len(r) > 13 and r[13] else r[0]
        lead = r[8] or ""
        if not slug or slug in seen or r[6] < args.min_weight or len(lead) < 40:
            continue
        seen.add(slug)
        ck = cache_key(slug, lead)
        cp = os.path.join(CACHE_DIR, ck + ".json")
        if os.path.exists(cp):
            out[slug] = json.load(open(cp, "r", encoding="utf-8"))["headline"]
            continue
        todo.append({"slug": slug, "title": title, "date": r[10] or str(r[3]), "place": r[7] or "", "lead": lead, "ck": ck})
    todo = todo[: args.max]
    print(str(len(todo)) + " headlines to write with " + model, file=sys.stderr)
    for i in range(0, len(todo), BATCH):
        batch = todo[i:i + BATCH]
        got = ask(key, model, batch)
        for it in batch:
            h = got.get(it["slug"])
            if isinstance(h, str) and 3 < len(h) < 140:
                h = h.strip().rstrip(".")
                out[it["slug"]] = h
                with open(os.path.join(CACHE_DIR, it["ck"] + ".json"), "w", encoding="utf-8") as f:
                    json.dump({"headline": h}, f, ensure_ascii=False)
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=0)
        if i % 200 == 0:
            print("  " + str(i + len(batch)) + "/" + str(len(todo)), file=sys.stderr)
    print("wrote " + str(len(out)) + " headlines to " + args.out, file=sys.stderr)


if __name__ == "__main__":
    main()
