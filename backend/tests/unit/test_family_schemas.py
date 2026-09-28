import pytest
from pydantic import ValidationError

from app.schemas.family import FamilyIn, UserSearchQuery, mask_email


@pytest.mark.parametrize("email,masked", [
    ("dipak@gmail.com", "d****@gmail.com"),
    ("a@example.com", "a****@example.com"),
])
def test_mask_email_keeps_first_character_and_domain(email, masked):
    assert mask_email(email) == masked


def test_family_name_is_stripped_and_limited():
    assert FamilyIn(name="  Home  ").name == "Home"
    with pytest.raises(ValidationError):
        FamilyIn(name="x" * 101)


def test_family_in_rejects_unknown_fields():
    with pytest.raises(ValidationError):
        FamilyIn(name="Home", created_by=1)


def test_search_name_is_stripped_before_length_check():
    with pytest.raises(ValidationError):
        UserSearchQuery(name="  ab  ")


def test_search_email_is_lowercased():
    assert UserSearchQuery(email="Ravi@Example.COM").email == "ravi@example.com"
