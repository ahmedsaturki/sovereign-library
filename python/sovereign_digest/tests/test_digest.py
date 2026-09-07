"""Native tests for the DIG1 digest Python port (contract-grounded; async paths)."""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sovereign_digest import (
    sha256, sha512, hmacSha256, hmacSha512,
    digestHex, hmacHex, digestAsync, hmacAsync,
    constantTimeEqual, createDigestConfig, DigestError,
)


def test_sha256_hex_known_vector():
    # RFC 6234 / standard test vector
    assert digestHex("sha256", "abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"


def test_sha512_hex_known_vector():
    assert digestHex("sha512", "abc") == (
        "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a"
        "2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f"
    )


def test_hmac_sha256_known_vector():
    # RFC 4231 test case 1
    assert hmacHex("sha256", b"key", b"The quick brown fox jumps over the lazy dog") == \
        "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8"


def test_algorithm_normalization():
    msg = "The quick brown fox jumps over the lazy dog"
    assert digestHex("sha-256", msg) == digestHex("SHA256", msg) == digestHex("sha256", msg)


def test_digest_bytes_roundtrip():
    b = sha256("hello")
    assert isinstance(b, bytes)
    assert b.hex() == digestHex("sha256", "hello")


def test_constant_time_equal():
    assert constantTimeEqual(b"abc", b"abc") is True
    assert constantTimeEqual(b"abc", b"abd") is False
    assert constantTimeEqual(b"ab", b"abc") is False


def test_constant_time_invalid_type():
    import pytest
    with pytest.raises(DigestError):
        constantTimeEqual("abc", "abc")


def test_throws_unsupported_algorithm():
    import pytest
    with pytest.raises(DigestError):
        digestHex("md5", "x")


def test_throws_invalid_input():
    import pytest
    with pytest.raises(DigestError):
        digestHex("sha256", 123)


def test_throws_input_too_large():
    import pytest
    with pytest.raises(DigestError):
        digestHex("sha256", "x" * 10, {"maxInputBytes": 5})


def test_config_default():
    cfg = createDigestConfig()
    assert cfg["maxInputBytes"] == 5 * 1024 * 1024
    assert cfg["maxChunkBytes"] == 1024 * 1024
    assert cfg["maxTotalBytes"] == 256 * 1024 * 1024


def test_config_invalid():
    import pytest
    with pytest.raises(DigestError):
        createDigestConfig(None)


def test_digest_async():
    async def src():
        yield b"The quick brown fox "
        yield b"jumps over the lazy dog"
    out = asyncio.run(digestAsync("sha256", src()))
    assert out.hex() == digestHex("sha256", "The quick brown fox jumps over the lazy dog")


def test_hmac_async():
    async def src():
        yield b"data-"
        yield b"chunk"
    out = asyncio.run(hmacAsync("sha256", b"key", src()))
    assert out.hex() == hmacHex("sha256", b"key", b"data-chunk")
