import base64
import os
import requests


API_URL = "http://localhost:8000/analyze-camera"

# Ovde samo promeniš ime slike kada hoćeš drugu sliku da testiraš
IMAGE_PATH = "test_images/room.jpg"

MODES = ["general", "short", "text", "obstacles"]


def image_to_base64(image_path: str) -> str:
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    with open(image_path, "rb") as image_file:
        encoded_image = base64.b64encode(image_file.read()).decode("utf-8")

    return "data:image/jpeg;base64," + encoded_image


def send_image_to_backend(image_base64: str, mode: str):
    payload = {
        "image": image_base64,
        "mode": mode
    }

    response = requests.post(API_URL, json=payload)

    print("--------------------------------")
    print("Mode:", mode)
    print("Status code:", response.status_code)

    try:
        print("Response:", response.json())
    except Exception:
        print("Raw response:", response.text)


def test_all_modes():
    print("Testing image:", IMAGE_PATH)

    image_base64 = image_to_base64(IMAGE_PATH)

    for mode in MODES:
        send_image_to_backend(image_base64, mode)


if __name__ == "__main__":
    test_all_modes()