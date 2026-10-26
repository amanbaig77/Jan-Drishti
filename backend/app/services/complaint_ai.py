# backend/app/services/complaint_ai.py

import os
import json
from dotenv import load_dotenv
from groq import Groq

from app.models.complaint import Complaint

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is not set in .env")

client = Groq(api_key=GROQ_API_KEY)

MODEL_NAME = "openai/gpt-oss-20b"


def analyze_complaint(complaint: Complaint) -> dict:
    """
    Generate an official civic complaint assessment using only
    the structured information provided by the citizen.

    Important:
    - Photo/video are NOT analyzed by the AI.
    - AI must not invent missing facts.
    - Area and exact location must be preserved.
    """

    prompt = f"""
You are the AI assessment engine of Jan-Drishti,
a civic complaint and grievance reporting platform.

Analyze the following citizen complaint.

IMPORTANT RULES:
1. Use ONLY the information provided below.
2. DO NOT invent facts.
3. DO NOT assume missing information.
4. DO NOT analyze the photo or video.
5. Photo/video are only supporting evidence.
6. Preserve the location information exactly.
7. Clearly distinguish Area from Exact Location.
8. The official report must mention State, District, Area,
   and Exact Location when they are provided.
9. Do not change or replace the citizen's location.
10. Severity must be one of:
    Low, Medium, High, Critical.

COMPLAINT INFORMATION

State:
{complaint.state}

District:
{complaint.district}

Area:
{complaint.area}

Category:
{complaint.category}

Exact Location Provided by Citizen:
{complaint.location_details}

Description:
{complaint.description}

Duration:
{complaint.duration}

Affected People:
{complaint.affected_people}

Affected Groups:
{complaint.affected_groups}

Traffic Impact:
{complaint.traffic_impact}

Immediate Danger:
{complaint.immediate_danger}


Return ONLY valid JSON in exactly this structure:

{{
    "summary": "Short factual summary of the complaint",
    "severity": "Low | Medium | High | Critical",
    "public_impact": "Explain the public impact using only provided facts",
    "official_report": "Professional official complaint report including State, District, Area, Exact Location, problem, duration, affected people, affected groups, traffic impact, immediate danger and requested action."
}}

Do not include markdown.
Do not include extra JSON fields.
"""

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a factual civic grievance assessment system. "
                        "Never fabricate information."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.1,
            max_tokens=1200,
        )

        content = response.choices[0].message.content.strip()

        # Handle accidental markdown fences from the model
        if content.startswith("```"):
            content = content.replace("```json", "")
            content = content.replace("```", "")
            content = content.strip()

        result = json.loads(content)

        return {
            "summary": result.get("summary", ""),
            "severity": result.get("severity", "Medium"),
            "public_impact": result.get("public_impact", ""),
            "official_report": result.get("official_report", ""),
        }

    except json.JSONDecodeError as e:
        print(f"AI JSON parsing error: {e}")
        print(f"Raw AI response: {content if 'content' in locals() else 'No response'}")

        return {
            "summary": "AI assessment could not be parsed.",
            "severity": "Medium",
            "public_impact": "",
            "official_report": complaint.description,
        }

    except Exception as e:
        print(f"AI analysis error: {e}")

        return {
            "summary": "AI assessment temporarily unavailable.",
            "severity": "Medium",
            "public_impact": "",
            "official_report": complaint.description,
        }