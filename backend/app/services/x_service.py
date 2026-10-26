import os

import tweepy
from dotenv import load_dotenv


load_dotenv()


X_CONSUMER_KEY = os.getenv("X_CONSUMER_KEY")
X_CONSUMER_SECRET = os.getenv("X_CONSUMER_SECRET")
X_ACCESS_TOKEN = os.getenv("X_ACCESS_TOKEN")

# Supports your current variable name.
X_ACCESS_TOKEN_SECRET = (
    os.getenv("X_ACCESS_TOKEN_SE")
    or os.getenv("X_ACCESS_TOKEN_SECRET")
)


def post_to_x(text: str):
    """
    Publish a post to X using Jan-Drishti's account.
    """

    if not X_CONSUMER_KEY:
        raise ValueError("X_CONSUMER_KEY missing")

    if not X_CONSUMER_SECRET:
        raise ValueError("X_CONSUMER_SECRET missing")

    if not X_ACCESS_TOKEN:
        raise ValueError("X_ACCESS_TOKEN missing")

    if not X_ACCESS_TOKEN_SECRET:
        raise ValueError(
            "X_ACCESS_TOKEN_SE / "
            "X_ACCESS_TOKEN_SECRET missing"
        )

    if not text:
        raise ValueError("X post text cannot be empty")

    if len(text) > 280:
        raise ValueError(
            f"X post exceeds 280 characters: {len(text)}"
        )

    client = tweepy.Client(
        consumer_key=X_CONSUMER_KEY,
        consumer_secret=X_CONSUMER_SECRET,
        access_token=X_ACCESS_TOKEN,
        access_token_secret=X_ACCESS_TOKEN_SECRET,
    )

    response = client.create_tweet(
        text=text
    )

    if not response or not response.data:
        raise RuntimeError(
            "X API returned no post data"
        )

    post_id = str(
        response.data["id"]
    )

    post_url = (
        f"https://x.com/i/web/status/{post_id}"
    )

    return {
        "post_id": post_id,
        "post_url": post_url,
    }