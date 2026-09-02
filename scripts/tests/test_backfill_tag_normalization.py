"""Unit tests for the tag-normalization backfill's pure planning logic
(no AWS calls). The normalization rules themselves are covered by
api/tests/test_helpers.py -- here we only check the "write only real
changes / be idempotent / skip empties" behavior the backfill adds."""

import importlib.util
import os
import sys
from pathlib import Path

os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_REGION", "us-east-1")

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "api"))

_spec = importlib.util.spec_from_file_location(
    "backfill_tag_normalization",
    Path(__file__).resolve().parents[1] / "backfill-tag-normalization.py",
)
backfill = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(backfill)


def test_skips_records_with_no_tags():
    assert backfill.plan_change({"video_id": "v"}) is None
    assert backfill.plan_change({"video_id": "v", "tags": []}) is None


def test_already_canonical_tags_are_not_rewritten():
    assert backfill.plan_change({"video_id": "v", "tags": ["true-crime", "space"]}) is None


def test_mechanically_inconsistent_tags_normalize():
    change = backfill.plan_change(
        {"video_id": "v", "tags": ["True Crime", "true crime", "true-crime"]}
    )
    assert change is not None
    before, after = change
    assert after == ["true-crime"]


def test_duplicates_collapse():
    change = backfill.plan_change({"video_id": "v", "tags": ["dogs", "Dogs", "dogs"]})
    assert change is not None
    assert change[1] == ["dogs"]


def test_truecrime_stays_distinct_from_true_crime():
    # "truecrime" is already canonical on its own -> no change.
    assert backfill.plan_change({"video_id": "v", "tags": ["truecrime"]}) is None
    # and it never merges with the hyphenated spelling.
    _, after = backfill.plan_change(
        {"video_id": "v", "tags": ["truecrime", "true crime"]}
    )
    assert after == ["truecrime", "true-crime"]


def test_space_does_not_become_spaceflight():
    assert backfill.plan_change({"video_id": "v", "tags": ["space"]}) is None


def test_rerun_on_normalized_output_produces_no_further_change():
    original = {"video_id": "v", "tags": ["True Crime", "  #Space Flight "]}
    change = backfill.plan_change(original)
    assert change is not None
    _, after = change
    # Feeding the result back in is a no-op -> idempotent.
    assert backfill.plan_change({"video_id": "v", "tags": after}) is None
