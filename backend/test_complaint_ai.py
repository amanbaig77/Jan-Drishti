from app.models.complaint import Complaint
from app.services.complaint_ai import analyze_complaint


complaint = Complaint(
    state="Uttar Pradesh",
    district="Moradabad",
    category="Road Damage",
    description="A large pothole has developed on the main road near the market and vehicles are having difficulty passing.",
    duration="3 weeks",
    affected_people="Around 100 people daily",
    affected_groups="Adults, elderly people",
    traffic_impact="High",
    immediate_danger="Yes",
    location_details="Main market road, Moradabad",
)

result = analyze_complaint(complaint)

print("\n========== JAN-DRISHTI AI RESULT ==========\n")

print("Summary:")
print(result["summary"])

print("\nSeverity:")
print(result["severity"])

print("\nPublic Impact:")
print(result["public_impact"])

print("\nOfficial Report:")
print(result["official_report"])