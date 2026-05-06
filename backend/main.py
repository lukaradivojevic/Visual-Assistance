from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from vision_agent import analyze_image, VALID_MODES
from logger import log_request

app = FastAPI(title="Visual Assistance Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CameraRequest(BaseModel):
    image: str
    mode: str = "general"

@app.get("/") # does backend work
def home():
    return {"message": "Visual Assistance backend is running"}

@app.get("/modes") # returns possible working mode
def get_modes():
    return {
        "available_modes": VALID_MODES
    }

@app.post("/analyze-camera") # takes picture and mode
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

    if request.mode not in VALID_MODES:
        error_message = f"Invalid mode. Available modes are: {VALID_MODES}"
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
        description = analyze_image(request.image, request.mode)
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