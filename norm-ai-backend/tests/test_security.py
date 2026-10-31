from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip():
    h = hash_password("Secret123!")
    assert h != "Secret123!"
    assert verify_password("Secret123!", h)
    assert not verify_password("wrong", h)


def test_access_token_roundtrip():
    payload = decode_token(create_access_token("user-1", {"role": "student"}))
    assert payload["sub"] == "user-1"
    assert payload["role"] == "student"


def test_refresh_token_roundtrip():
    assert decode_token(create_refresh_token("user-2"))["sub"] == "user-2"


def test_invalid_token_rejected():
    import pytest

    with pytest.raises(ValueError):
        decode_token("not.a.token")
