import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

VALID_MODES = ["general", "short", "text", "obstacles"]

client = OpenAI(
    api_key=os.getenv("MISTRAL_API_KEY"),
    base_url="https://api.mistral.ai/v1"
)


def build_prompt(mode: str) -> str:
    if mode == "short":
        return (
            "Describe the image in one short sentence. "
            "Mention only the most important information for a blind user."
        )

    if mode == "text":
        return (
            "Read any visible text in the image. "
            "If there is no readable text, say that no clear text is visible."
        )

    if mode == "obstacles":
        return (
            "Focus on obstacles, people, stairs, doors, vehicles, dangerous objects, "
            "and anything important for safe movement."
        )

    return (
        "Describe what is visible in the image for a blind or visually impaired user. "
        "Mention important objects, people, visible text, obstacles, and points of interest. "
        "Keep the description concise and practical."
    )


def analyze_image(image_base64: str, mode: str = "general") -> str:
    prompt = build_prompt(mode)

    response = client.chat.completions.create(
        model="pixtral-12b-2409",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_base64}"
                        }
                    }
                ]
            }
        ],
        max_tokens=250
    )

    return response.choices[0].message.content