from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from memory_folder.user_memory import add_memory, load_user_memory
from vision_agent import analyze_image, VALID_MODES
from mode_router import analyze_image_auto
from logger import log_request
from typing import Optional

app = FastAPI(title="Visual Assistance Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


ALL_MODES = VALID_MODES + ["auto"]


class CameraRequest(BaseModel):
    image: str
    mode: str = "general"


class MemoryRequest(BaseModel):
    text: str
    category: str = "general"
    image: Optional[str] = None


@app.get("/")
@app.get("/api/")
def home():
    return {"message": "Visual Assistance backend is running"}


@app.get("/modes")
@app.get("/api/modes")
def get_modes():
    return {
        "available_modes": ALL_MODES
    }


@app.post("/api/analyze-camera")
@app.post("/analyze-camera")
def analyze_camera(request: CameraRequest):
    if not request.image:
        error_message = "Image is missing."

        log_request(
            mode=request.mode,
            success=False,
            error=error_message
        )

        return {
            "success": False,
            "description": "",
            "error": error_message
        }

    if request.mode not in ALL_MODES:
        error_message = f"Invalid mode. Available modes are: {ALL_MODES}"

        log_request(
            mode=request.mode,
            success=False,
            error=error_message
        )

        return {
            "success": False,
            "description": "",
            "error": error_message
        }

    try:
        if request.mode == "auto":
            result = analyze_image_auto(request.image)

            description = result["description"]
            selected_mode = result["selected_mode"]
            router_reason = result["router_reason"]

            log_request(
                mode=f"auto -> {selected_mode}",
                success=True,
                description=description
            )

            return {
                "success": True,
                "description": description,
                "mode": "auto",
                "selected_mode": selected_mode,
                "router_reason": router_reason
            }

        description = analyze_image(request.image, request.mode)

        log_request(
            mode=request.mode,
            success=True,
            description=description
        )

        return {
            "success": True,
            "description": description,
            "mode": request.mode
        }

    except Exception as e:
        error_message = f"AI analysis failed: {str(e)}"

        log_request(
            mode=request.mode,
            success=False,
            error=error_message
        )

        return {
            "success": False,
            "description": "",
            "error": error_message
        }


@app.post("/memory/add")
@app.post("/api/memory/add")
def add_user_memory(request: MemoryRequest):
    if not request.text.strip():
        return {
            "success": False,
            "error": "Memory text cannot be empty."
        }

    memory = add_memory(
        text=request.text.strip(),
        category=request.category,
        image_base64=request.image
    )

    return {
        "success": True,
        "message": "Memory saved successfully.",
        "memory": memory
    }


@app.get("/memory")
@app.get("/api/memory")
def get_memory():
    return {
        "success": True,
        "memory": load_user_memory()
    }