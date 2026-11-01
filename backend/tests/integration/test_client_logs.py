"""POST /api/client-logs: browser errors land in the server log as the `client` logger."""

import pytest

ENTRY = {"message": "TypeError: x is undefined", "stack": "at Dashboard.jsx:12",
         "url": "/families", "request_id": "abc123"}


def test_entries_are_logged_without_a_login(client, caplog):
    response = client.post("/api/client-logs", json={"entries": [ENTRY, ENTRY]},
                           headers={"User-Agent": "TestBrowser/1.0"})
    assert response.status_code == 204
    records = [r for r in caplog.records if r.name == "client"]
    assert len(records) == 2
    record = records[0]
    assert (record.levelname, record.client_message, record.url, record.api_request_id) == (
        "WARNING", ENTRY["message"], "/families", "abc123")
    assert record.user_agent == "TestBrowser/1.0"


@pytest.mark.parametrize("body", [
    {"entries": []},
    {"entries": [ENTRY] * 11},
    {"entries": [ENTRY | {"message": "x" * 1001}]},
    {"entries": [ENTRY | {"stack": "x" * 5001}]},
    {"entries": [ENTRY | {"password": "secret"}]},
])
def test_oversized_or_unknown_input_is_rejected(client, body):
    assert client.post("/api/client-logs", json=body).status_code == 422
