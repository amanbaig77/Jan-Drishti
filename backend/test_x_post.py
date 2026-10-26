import os
import requests
from dotenv import load_dotenv
from requests_oauthlib import OAuth1

load_dotenv()

consumer_key = os.getenv("X_CONSUMER_KEY")
consumer_secret = os.getenv("X_CONSUMER_SECRET")
access_token = os.getenv("X_ACCESS_TOKEN")
access_token_secret = os.getenv("X_ACCESS_TOKEN_SECRET")

if not all([
    consumer_key,
    consumer_secret,
    access_token,
    access_token_secret,
]):
    print("❌ X credentials are missing from .env")
    raise SystemExit(1)

auth = OAuth1(
    consumer_key,
    consumer_secret,
    access_token,
    access_token_secret,
)

url = "https://api.x.com/2/tweets"

payload = {
    "text": "Jan-Drishti test post. This is an API connectivity test from @jandrishtiindia."
}

response = requests.post(
    url,
    auth=auth,
    json=payload,
    timeout=20,
)

print("HTTP Status:", response.status_code)
print("Response:")

try:
    print(response.json())
except Exception:
    print(response.text)