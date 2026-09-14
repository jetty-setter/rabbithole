#!/usr/bin/env python3
"""Permanently delete a RabbitHole by slug.

Uses the real `rabbithole_store.hard_delete` (imported, never re-implemented)
so it gets exactly the same behavior the app itself would use if this were
ever exposed as a route: removes the item and its slug sentinel, deletes its
own outbound connections, and marks any OTHER RabbitHole's connection that
points at this one as `target_unavailable` (so nothing dangles).

This is irreversible -- there is no soft-delete/undo. Requires typing the
slug back to confirm.

Usage (needs AWS credentials + boto3, both already in api/.venv):
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/delete-rabbithole.py <slug>
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

os.environ.setdefault("RABBITHOLES_TABLE", "rabbithole-dev-rabbitholes")
os.environ.setdefault("RABBITHOLE_CONNECTIONS_TABLE", "rabbithole-dev-rabbithole-connections")
os.environ.setdefault("RABBITHOLE_REVISIONS_TABLE", "rabbithole-dev-rabbithole-revisions")
os.environ.setdefault("AWS_REGION", "us-east-1")
os.environ.setdefault("AWS_DEFAULT_REGION", os.environ["AWS_REGION"])

# The one canonical implementation -- imported, never re-implemented.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))
from app import rabbithole_store as store  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slug", help="slug of the RabbitHole to permanently delete")
    args = ap.parse_args()

    item = store.get_by_slug(args.slug)
    if not item:
        sys.exit(f"No RabbitHole with slug '{args.slug}'.")

    conns = store.outbound(item["id"])
    inbound = store.inbound(item["id"])

    print(f"About to PERMANENTLY delete:")
    print(f"  id:     {item['id']}")
    print(f"  slug:   {item['slug']}")
    print(f"  title:  {item.get('title')}")
    print(f"  status: {item.get('status')}")
    print(f"  outbound connections to delete: {len(conns)}")
    print(f"  inbound connections to mark unavailable: {len(inbound)}")
    print()
    print("This cannot be undone.")

    typed = input(f"Type the slug ('{args.slug}') to confirm: ")
    if typed != args.slug:
        sys.exit("Slug did not match. Aborted, nothing deleted.")

    store.hard_delete(item["id"])
    print(f"✓ Deleted '{args.slug}' ({item['id']}).")


if __name__ == "__main__":
    main()
