import resend
import os

from dotenv import load_dotenv

load_dotenv()

resend.api_key = os.getenv("RESEND_API_KEY")

params = {
    "from": "onboarding@resend.dev",
    "to": ["delivered@resend.dev"],
    "subject": "Jan-Drishti Resend Test",
    "html": "<h2>Jan-Drishti</h2><p>Resend email integration is working successfully.</p>",
}

email = resend.Emails.send(params)

print("EMAIL SENT SUCCESSFULLY")
print(email)