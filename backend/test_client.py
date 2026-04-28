import base64
import requests


API_URL = "http://localhost:8000/analyze-camera"
IMAGE_PATH = "test_images/room.jpg"


def image_to_base64(image_path: str) -> str:
    with open(image_path, "rb") as image_file:
        encoded = base64.b64encode(image_file.read()).decode("utf-8")
        return "data:image/jpeg;base64," + encoded


def test_analyze_camera(mode: str = "general"):
    image_base64 = image_to_base64(IMAGE_PATH)

    payload = {
        "image": image_base64,
        "mode": mode
    }

    response = requests.post(API_URL, json=payload)

    print("Status code:", response.status_code)
    print("Response:")
    print(response.json())


if __name__ == "__main__":
    for mode in ["general", "short", "text", "obstacles"]:
        print("\nTesting mode:", mode)
        test_analyze_camera(mode)