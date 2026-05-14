import json
import base64
import re
from pathlib import Path
from datetime import datetime, timezone

BASE_DIR = Path(__file__).resolve().parent
MEMORY_FILE = BASE_DIR / "user_memory.json"
IMAGE_DIR = BASE_DIR / "memory_images"

IMAGE_DIR.mkdir(exist_ok=True)


def load_user_memory() -> dict:
    if not MEMORY_FILE.exists():
        return {
            "user_profile": {
                "preferred_language": "English",
                "response_length": "short"
            },
            "memories": []
        }

    with open(MEMORY_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def save_user_memory(memory: dict) -> None:
    with open(MEMORY_FILE, "w", encoding="utf-8") as file:
        json.dump(memory, file, indent=2, ensure_ascii=False)


def safe_filename(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = text.strip("_")
    return text[:40] or "memory"


def save_memory_image(image_base64: str, memory_text: str) -> str | None:
    if not image_base64:
        return None

    try:
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]

        image_bytes = base64.b64decode(image_base64)

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"{safe_filename(memory_text)}_{timestamp}.jpg"

        image_path = IMAGE_DIR / filename

        with open(image_path, "wb") as file:
            file.write(image_bytes)

        return f"memory_images/{filename}"

    except Exception as e:
        print("Memory image save error:", e)
        return None


def add_memory(text: str, category: str = "general", image_base64: str | None = None) -> dict:
    memory = load_user_memory()

    if "memories" not in memory:
        memory["memories"] = []

    image_file = save_memory_image(image_base64, text)

    new_memory = {
        "text": text,
        "category": category,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    if image_file:
        new_memory["image_file"] = image_file

    memory["memories"].append(new_memory)
    save_user_memory(memory)

    return new_memory


def get_user_context(mode: str = "general") -> str:
    memory = load_user_memory()

    profile = memory.get("user_profile", {})
    memories = memory.get("memories", [])

    context_parts = []

    if profile:
        context_parts.append("User profile:")
        for key, value in profile.items():
            context_parts.append(f"- {key}: {value}")

    relevant_memories = []

    for item in memories:
        category = item.get("category", "general")

        if category == "general" or category == mode:
            relevant_memories.append(item)

    if relevant_memories:
        context_parts.append("\nUser memories:")
        for item in relevant_memories:
            text = item.get("text")
            category = item.get("category", "general")
            image_file = item.get("image_file")

            if image_file:
                context_parts.append(f"- [{category}] {text} | saved image: {image_file}")
            else:
                context_parts.append(f"- [{category}] {text}")

    if not context_parts:
        return "No personal user context is available."

    return "\n".join(context_parts)