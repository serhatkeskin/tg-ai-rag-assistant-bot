#!/usr/bin/env python3
"""Seed the RAG system with NovaTech demo documents via the REST API."""

import sys
import time
from pathlib import Path

import requests

API_BASE = "http://localhost:8000/api"

DEMO_DOCS = [
    ("NovaTech Product Guide", "data/demo/novatech_product_guide.txt"),
    ("Engineering Handbook", "data/demo/engineering_handbook.txt"),
    ("API Reference", "data/demo/api_reference.txt"),
    ("HR Policies", "data/demo/hr_policies.txt"),
    ("Support Playbook", "data/demo/support_playbook.txt"),
]


def wait_for_api(max_retries: int = 30) -> None:
    print(f"Waiting for API at {API_BASE}...")
    for i in range(max_retries):
        try:
            r = requests.get(f"{API_BASE}/health/", timeout=5)
            if r.status_code == 200:
                print("API is ready.\n")
                return
        except requests.exceptions.ConnectionError:
            pass
        time.sleep(2)
        print(f"  retry {i + 1}/{max_retries}...")
    print("ERROR: API did not become ready in time.")
    sys.exit(1)


def seed() -> None:
    root = Path(__file__).parent.parent

    existing = requests.get(f"{API_BASE}/documents/").json()
    existing_titles = {d["title"] for d in existing}

    seeded = 0
    for title, rel_path in DEMO_DOCS:
        if title in existing_titles:
            print(f"  SKIP  {title} (already indexed)")
            continue

        path = root / rel_path
        if not path.exists():
            print(f"  WARN  {path} not found, skipping")
            continue

        content = path.read_text(encoding="utf-8")
        print(f"  INDEX {title} ({len(content):,} chars)...", end="", flush=True)

        r = requests.post(
            f"{API_BASE}/documents/",
            json={"title": title, "content": content},
            timeout=120,
        )

        if r.status_code == 201:
            doc = r.json()
            print(f" done (id={doc['id']}, chunks={doc.get('chunk_count', '?')})")
            seeded += 1
        else:
            print(f" FAILED: {r.status_code} {r.text[:200]}")

    print(f"\nDone. {seeded} document(s) seeded.")


if __name__ == "__main__":
    wait_for_api()
    seed()
