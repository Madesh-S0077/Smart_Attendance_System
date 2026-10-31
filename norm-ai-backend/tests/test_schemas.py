from datetime import date
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.attendance import AttendanceOverrideRequest, AttendanceVerifyRequest


def test_embedding_must_be_512():
    with pytest.raises(ValidationError):
        AttendanceVerifyRequest(face_embedding=[0.1] * 511, date=date.today())
    assert AttendanceVerifyRequest(face_embedding=[0.1] * 512, date=date.today())


def test_embedding_range_enforced():
    with pytest.raises(ValidationError):
        AttendanceVerifyRequest(face_embedding=[11.0] + [0.0] * 511, date=date.today())


def test_override_status_validated():
    kwargs = dict(student_id=uuid4(), slot_id=uuid4(), date=date.today())
    assert AttendanceOverrideRequest(status="present", **kwargs)
    with pytest.raises(ValidationError):
        AttendanceOverrideRequest(status="late", **kwargs)
