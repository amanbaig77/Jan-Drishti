from pathlib import Path

import torch
from PIL import Image
from torchvision.models import (
    mobilenet_v3_small,
    MobileNet_V3_Small_Weights
)


# --------------------------------------------------
# LIGHTWEIGHT AI MODEL
# --------------------------------------------------

print("Loading lightweight AI vision model...")

weights = MobileNet_V3_Small_Weights.DEFAULT

model = mobilenet_v3_small(weights=weights)
model.eval()

preprocess = weights.transforms()
categories = weights.meta["categories"]

print("AI vision model loaded successfully.")


# --------------------------------------------------
# CATEGORY KEYWORDS
# --------------------------------------------------

CATEGORY_KEYWORDS = {
    "Road Damage": [
        "pothole",
        "street",
        "road",
        "asphalt",
        "construction"
    ],

    "Garbage / Waste": [
        "trash",
        "garbage",
        "waste",
        "container",
        "dustbin"
    ],

    "Street Light": [
        "street light",
        "lamp",
        "light",
        "pole"
    ],

    "Water Supply": [
        "water",
        "pipe",
        "pipeline",
        "fountain"
    ],

    "Drainage / Sewerage": [
        "drain",
        "sewer",
        "water",
        "pipe"
    ],

    "Electricity": [
        "electric",
        "pole",
        "wire",
        "cable"
    ],

    "Public Safety": [
        "street",
        "building",
        "vehicle",
        "person"
    ],

    "Other": []
}


# --------------------------------------------------
# IMAGE VERIFICATION
# --------------------------------------------------

def verify_image(
    file_path: str,
    complaint_category: str
):
    path = Path(file_path)

    if not path.exists():
        return {
            "relevant": False,
            "confidence": 0.0,
            "evidence_type": "image",
            "message": "Evidence file not found."
        }

    try:
        image = Image.open(path).convert("RGB")

        image_tensor = preprocess(image).unsqueeze(0)

        with torch.no_grad():
            output = model(image_tensor)

        probabilities = torch.nn.functional.softmax(
            output,
            dim=1
        )[0]

        top_values, top_indices = torch.topk(
            probabilities,
            10
        )

        detected_objects = []

        for value, index in zip(
            top_values,
            top_indices
        ):
            label = categories[index.item()]
            confidence = float(value)

            detected_objects.append({
                "label": label,
                "confidence": round(
                    confidence * 100,
                    2
                )
            })

        keywords = CATEGORY_KEYWORDS.get(
            complaint_category,
            []
        )

        matched = []

        for item in detected_objects:

            label = item["label"].lower()

            for keyword in keywords:

                if keyword.lower() in label:
                    matched.append(item)
                    break

        if matched:

            confidence = max(
                item["confidence"]
                for item in matched
            )

            relevant = True

        else:

            confidence = max(
                item["confidence"]
                for item in detected_objects
            )

            relevant = False

        return {
            "relevant": relevant,
            "confidence": round(confidence, 2),
            "evidence_type": "image",
            "category": complaint_category,
            "detected_objects": detected_objects,
            "message": (
                "AI detected visual content related "
                "to the complaint category."
                if relevant
                else
                "AI could not confidently match the "
                "image with the complaint category."
            )
        }

    except Exception as error:

        return {
            "relevant": False,
            "confidence": 0.0,
            "evidence_type": "image",
            "message": f"AI image analysis failed: {str(error)}"
        }


# --------------------------------------------------
# MAIN EVIDENCE VERIFICATION
# --------------------------------------------------

def verify_evidence(
    file_path: str,
    complaint_category: str
):

    path = Path(file_path)

    if not path.exists():
        return {
            "relevant": False,
            "confidence": 0.0,
            "message": "Evidence file not found."
        }

    extension = path.suffix.lower()

    image_extensions = {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    }

    video_extensions = {
        ".mp4",
        ".mpeg",
        ".mov",
        ".webm"
    }

    if extension in image_extensions:

        return verify_image(
            file_path=file_path,
            complaint_category=complaint_category
        )

    if extension in video_extensions:

        return {
            "relevant": True,
            "confidence": 0.0,
            "evidence_type": "video",
            "message": (
                "Video uploaded successfully. "
                "Video frame analysis will be added next."
            )
        }

    return {
        "relevant": False,
        "confidence": 0.0,
        "message": "Unsupported evidence format."
    }