import base64
import os
import requests


API_URL = "http://localhost:8000/analyze-camera"

# Ovde promeniš sliku kada hoćeš da testiraš drugu
IMAGE_PATH = "test_images/room.jpg"

MODES = ["general", "short", "text", "obstacles"]


def image_to_base64(image_path: str) -> str:
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    with open(image_path, "rb") as image_file:
        encoded_image = base64.b64encode(image_file.read()).decode("utf-8")

    return encoded_image


def send_request(image_base64: str, mode: str):
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
    print("\nTEST 1: Valid image with all modes")
    print("Testing image:", IMAGE_PATH)

    image_base64 = image_to_base64(IMAGE_PATH)

    for mode in MODES:
        send_request(image_base64, mode)


def test_empty_image():
    print("\nTEST 2: Empty image")

    send_request("", "general")


def test_invalid_mode():
    print("\nTEST 3: Invalid mode")

    image_base64 = image_to_base64(IMAGE_PATH)

    send_request(image_base64, "wrong_mode")


def test_missing_image_file():
    print("\nTEST 4: Missing image file")

    wrong_path = "test_images/does_not_exist.jpg"

    try:
        image_to_base64(wrong_path)
    except FileNotFoundError as error:
        print("--------------------------------")
        print("Local error:", error)


if __name__ == "__main__":
    test_all_modes()
    test_empty_image()
    test_invalid_mode()
    test_missing_image_file()