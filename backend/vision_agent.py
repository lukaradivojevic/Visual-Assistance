import os
from openai import OpenAI
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import json
from pydantic import ValidationError
from memory_folder.user_memory import get_user_context

load_dotenv()

VALID_MODES = ["general", "people", "text", "obstacles"]



client = OpenAI(
    api_key=os.getenv("MISTRAL_API_KEY"),
    base_url="https://api.mistral.ai/v1"
)

SYSTEM_PROMPT = """
    You are an assistive vision agent for blind and visually impaired users.
    Your task is to describe images in a clear, practical, and safety-focused way.

    Always prioritize:
    1. obstacles and dangers
    2. people
    3. visible text
    4. important objects
    5. navigation-relevant information

    Do not mention a person's appearance, such as hair color, beard, glasses, clothing, 
    or other visual details. The response must contain at most two sentences.
    Do not invent details that are not visible.
    If something is unclear, say that it is unclear.
    Keep the answer short and suitable for text-to-speech, but long enough to provide right information.
"""

class VisualExtraction(BaseModel):
    """Step 1: Extract only the essential visible information."""

    environment_type: Literal[
        "indoor",
        "outdoor",
        "public_transport",
        "store",
        "document_or_screen",
        "unknown"
    ] = Field(description="General type of environment.")

    main_elements: List[str] = Field(
        description="Only the most important visible elements."
    )

    people_summary: str = Field(
        description="Short note about visible people, if relevant."
    )

    safety_concerns: List[str] = Field(
        description="Important obstacles, hazards, blocked paths, vehicles, stairs, or moving objects."
    )

    visible_text: List[str] = Field(
        description="Important clearly readable text only."
    )

    spatial_context: str = Field(
        description="Very short layout information: ahead, left, right, near, far, path, door, counter, seats."
    )


class GeneralSituationAnalysis(BaseModel):
    """Step 2: General awareness analysis."""

    extraction: VisualExtraction

    key_awareness_info: str = Field(
        description="The most useful overall information for the user."
    )

    safety_or_navigation_note: str = Field(
        description="Any important safety or navigation note, or 'none'."
    )


class GeneralFinalResponse(BaseModel):
    """Step 3: Final spoken response for general mode."""

    analysis: GeneralSituationAnalysis

    final_response: str = Field(
        description="Preferably one sentence, maximum two sentences."
    )


class PeopleSituationAnalysis(BaseModel):
    """Step 2: People and social awareness analysis."""

    extraction: VisualExtraction

    people_count_estimate: str = Field(
        description="Estimated number of visible people, or unclear."
    )

    people_positions: List[str] = Field(
        description="People positions relative to the user: left, right, center, ahead, near, far."
    )

    movement_or_action: str = Field(
        description="Relevant movement or social action: approaching, leaving, standing, sitting, waving, offering object, queue, blocking path, or unclear."
    )

    interaction_priority: Literal["low", "medium", "high", "unclear"] = Field(
        description="How important this information is for interaction or navigation."
    )


class PeopleFinalResponse(BaseModel):
    """Step 3: Final spoken response for people mode."""

    analysis: PeopleSituationAnalysis

    final_response: str = Field(
        description="Mention only number, position, movement, distance, or relevant actions. Do not mention appearance. Preferably one sentence, maximum two."
    )


class ObstacleSituationAnalysis(BaseModel):
    """Step 2: Safe navigation and obstacle analysis."""

    extraction: VisualExtraction

    path_status: Literal["clear", "partially_blocked", "blocked", "unsafe", "unclear"] = Field(
        description="Whether the path is clear, blocked, unsafe, or unclear."
    )

    nearest_hazard: str = Field(
        description="Closest or most important obstacle/hazard, or none."
    )

    hazard_position: Literal[
        "directly_ahead",
        "left",
        "right",
        "center",
        "low_on_ground",
        "head_height",
        "surrounding",
        "unclear"
    ] = Field(description="Position of the most important hazard.")

    safe_movement_hint: Literal[
        "continue_forward",
        "move_left",
        "move_right",
        "slow_down",
        "stop",
        "seat_available",
        "counter_available",
        "unclear"
    ] = Field(description="Most useful movement hint if visible.")

    urgency_level: Literal["low", "medium", "high", "unclear"] = Field(
        description="How urgent the warning is."
    )


class ObstacleFinalResponse(BaseModel):
    """Step 3: Final spoken response for obstacle mode."""

    analysis: ObstacleSituationAnalysis

    final_response: str = Field(
        description="Immediate safety-focused response. Preferably one sentence, maximum two."
    )


class TextSituationAnalysis(BaseModel):
    """Step 2: Visible text reading and interpretation."""

    extraction: VisualExtraction

    text_found: bool = Field(
        description="Whether relevant readable text is visible."
    )

    text_context: Literal[
        "menu",
        "transport_info",
        "product_label",
        "price",
        "machine_or_atm",
        "building_sign",
        "room_number",
        "direction",
        "warning",
        "screen",
        "document",
        "unknown"
    ] = Field(description="Practical context of the visible text.")

    readable_text: List[str] = Field(
        description="Only exact clearly readable text."
    )

    important_numbers: List[str] = Field(
        description="Important numbers, prices, bus numbers, room numbers, times, or dates."
    )

    meaning_or_instruction: str = Field(
        description="Short explanation of the important meaning or required action."
    )


class TextFinalResponse(BaseModel):
    """Step 3: Final spoken response for text mode."""

    analysis: TextSituationAnalysis

    final_response: str = Field(
        description="Read or summarize the most important visible text. Preferably one sentence, maximum two."
    )


SCHEMAS = {
    "general": GeneralFinalResponse,
    "people": PeopleFinalResponse,
    "obstacles": ObstacleFinalResponse,
    "text": TextFinalResponse,
}


def build_sgr_prompt(mode: str, schema_model, user_context: str) -> str:
    schema = schema_model.model_json_schema()

    return f"""
You are using Schema-Guided Reasoning with a Cascade Pattern.

You must analyze the image through the provided schema.
Each later field must be based on the previous visual extraction and mode-specific analysis.
Do not skip the structure.

Mode: {mode}

Personal user context:
{user_context}

Return only valid JSON matching this schema:
{json.dumps(schema, indent=2)}

Global rules:
- Do not mention personal appearance at all.
- Do not mention hair, beard, glasses, clothing, skin tone, age, gender, or facial features.
- Focus only on useful information for blind and visually impaired users.
- Use the personal user context only when it is relevant.
- Do not invent details based on the personal context.
- Do not invent details that are not clearly visible.
- If something is unclear, mark it as unclear.
- final_response must preferably be one sentence.
- final_response must never be more than two sentences.
- final_response must be suitable for text-to-speech.
"""


def analyze_image(image_base64: str, mode: str = "general") -> str:

    if mode not in SCHEMAS:
        raise ValueError(f"Invalid mode: {mode}")

    schema_model = SCHEMAS[mode]
    user_context = get_user_context(mode)
    prompt = build_sgr_prompt(mode, schema_model, user_context)

    response = client.chat.completions.create(
        model="pixtral-large-latest",
        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
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
        temperature=0.1,
        top_p=0.9,
        max_tokens=700,
        response_format={"type": "json_object"}
    )

    raw_output = response.choices[0].message.content

    try:
        parsed = schema_model.model_validate_json(raw_output)
        return parsed.final_response

    except Exception as e:
        print("SGR parsing error:", e)

        try:
            data = json.loads(raw_output)
            return data.get("final_response", "I could not generate a clean description.")
        except Exception as json_error:
            print("JSON fallback error:", json_error)
            return "I could not generate a clean description."