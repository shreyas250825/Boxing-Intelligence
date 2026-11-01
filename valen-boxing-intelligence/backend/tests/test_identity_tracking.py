import numpy as np

from app.tracking.identity_tracker import DetectionCandidate, IdentityAwareTracker


def _embed(value: float):
    return np.array([value, 0.0, 0.0], dtype=np.float32)


def test_identity_matches_are_not_reversed_by_screen_position():
    tracker = IdentityAwareTracker(boxer_ids=["A", "B"])
    tracker.add_anchor("A", (0.2, 0.5, 0.12, 0.18), _embed(1.0))
    tracker.add_anchor("B", (0.8, 0.5, 0.12, 0.18), _embed(-1.0))

    left_detections = [
        DetectionCandidate(boxer_id="A", bbox=(0.2, 0.5, 0.12, 0.18), confidence=0.9, embedding=_embed(1.0), timestamp=1.0),
        DetectionCandidate(boxer_id="B", bbox=(0.8, 0.5, 0.12, 0.18), confidence=0.9, embedding=_embed(-1.0), timestamp=1.0),
    ]
    assignment = tracker.assign_detections(left_detections)
    assert {item.boxer_id for item in assignment if item.is_assigned} == {"A", "B"}
    assert assignment[0].boxer_id == "A"
    assert assignment[1].boxer_id == "B"

    right_detections = [
        DetectionCandidate(boxer_id="A", bbox=(0.8, 0.5, 0.12, 0.18), confidence=0.9, embedding=_embed(1.0), timestamp=2.0),
        DetectionCandidate(boxer_id="B", bbox=(0.2, 0.5, 0.12, 0.18), confidence=0.9, embedding=_embed(-1.0), timestamp=2.0),
    ]
    switched = tracker.assign_detections(right_detections)
    assert {item.boxer_id for item in switched if item.is_assigned} == {"A", "B"}
    assert switched[0].boxer_id == "A"
    assert switched[1].boxer_id == "B"


def test_ambiguous_overlap_is_marked_uncertain():
    tracker = IdentityAwareTracker(boxer_ids=["A", "B"])
    tracker.add_anchor("A", (0.4, 0.5, 0.12, 0.18), _embed(1.0))
    tracker.add_anchor("B", (0.6, 0.5, 0.12, 0.18), _embed(-1.0))

    ambiguous = [
        DetectionCandidate(boxer_id="A", bbox=(0.47, 0.52, 0.16, 0.2), confidence=0.3, embedding=_embed(0.0), timestamp=3.0),
        DetectionCandidate(boxer_id="B", bbox=(0.53, 0.48, 0.16, 0.2), confidence=0.3, embedding=_embed(0.0), timestamp=3.0),
    ]
    assignment = tracker.assign_detections(ambiguous)
    assert any(item.state == "UNCERTAIN" for item in assignment)
