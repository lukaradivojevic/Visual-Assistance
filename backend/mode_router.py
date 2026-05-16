import os
import json
from typing import TypedDict, Literal

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field, ValidationError
from langgraph.graph import StateGraph, START, END

from vision_agent import analyze_image

load_dotenv()

client = OpenAI(
    api_key=os.getenv("MISTRAL_API_KEY"),
    base_url="https://api.mistral.ai/v1"
)


class RouterState(TypedDict):
    image_base64: str
    selected_mode: str
    router_reason: str
    description: str


class ModeDecision(BaseModel):
    mode: Literal["general", "people", "text", "obstacles"] = Field(
        description="The best mode for analyzing the image."
    )
    reason: str = Field(
        description="Short explanation why this mode was selected."
    )


ROUTER_SYSTEM_PROMPT = """
You are a routing model for an assistive vision application for blind and visually impaired users.

Your task is NOT to describe the image.
Your task is only to choose the best analysis mode.

Choose exactly one mode:

- text:
  Choose this if visible readable text is the most important information,
  such as signs, documents, labels, prices, menus, screens, medicine boxes, or instructions.

- obstacles:
  Choose this if safety or navigation is most important,
  such as blocked paths, stairs, vehicles, holes, objects on the ground, doors, crossings, or hazards.

- people:
  Choose this if people are the main focus,
  such as someone standing nearby, a crowd, a queue, social interaction, or people blocking the way.

- general:
  Choose this if the image needs a general scene description and no other mode clearly dominates.

Priority rules:
1. If there is an immediate safety or navigation risk, choose obstacles.
2. If readable text is clearly the main purpose of the image, choose text.
3. If people are the main useful information, choose people.
4. Otherwise choose general.

Return only valid JSON in this format:
{
  "mode": "general | people | text | obstacles",
  "reason": "short reason"
}
"""


def route_image(state: RouterState) -> dict:
    image_base64 = state["image_base64"]

    response = client.chat.completions.create(
        model="pixtral-large-latest",
        messages=[
            {
                "role": "system",
                "content": ROUTER_SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Select the best analysis mode for this image."
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
        temperature=0,
        top_p=1,
        max_tokens=150,
        response_format={"type": "json_object"}
    )

    raw_output = response.choices[0].message.content

    try:
        decision = ModeDecision.model_validate_json(raw_output)
        return {
            "selected_mode": decision.mode,
            "router_reason": decision.reason
        }

    except ValidationError:
        try:
            data = json.loads(raw_output)
            mode = data.get("mode", "general")

            if mode not in ["general", "people", "text", "obstacles"]:
                mode = "general"

            return {
                "selected_mode": mode,
                "router_reason": data.get("reason", "Fallback router decision.")
            }

        except Exception:
            return {
                "selected_mode": "general",
                "router_reason": "Router failed, fallback to general mode."
            }


def route_to_selected_mode(state: RouterState) -> str:
    return state["selected_mode"]


def analyze_general_node(state: RouterState) -> dict:
    description = analyze_image(state["image_base64"], "general")
    return {"description": description}


def analyze_people_node(state: RouterState) -> dict:
    description = analyze_image(state["image_base64"], "people")
    return {"description": description}


def analyze_text_node(state: RouterState) -> dict:
    description = analyze_image(state["image_base64"], "text")
    return {"description": description}


def analyze_obstacles_node(state: RouterState) -> dict:
    description = analyze_image(state["image_base64"], "obstacles")
    return {"description": description}


router_graph = StateGraph(RouterState)

router_graph.add_node("router", route_image)
router_graph.add_node("general", analyze_general_node)
router_graph.add_node("people", analyze_people_node)
router_graph.add_node("text", analyze_text_node)
router_graph.add_node("obstacles", analyze_obstacles_node)

router_graph.add_edge(START, "router")

router_graph.add_conditional_edges(
    "router",
    route_to_selected_mode,
    {
        "general": "general",
        "people": "people",
        "text": "text",
        "obstacles": "obstacles"
    }
)

router_graph.add_edge("general", END)
router_graph.add_edge("people", END)
router_graph.add_edge("text", END)
router_graph.add_edge("obstacles", END)

router_app = router_graph.compile()


def analyze_image_auto(image_base64: str) -> dict:
    result = router_app.invoke({
        "image_base64": image_base64,
        "selected_mode": "",
        "router_reason": "",
        "description": ""
    })

    return {
        "selected_mode": result["selected_mode"],
        "router_reason": result["router_reason"],
        "description": result["description"]
    }