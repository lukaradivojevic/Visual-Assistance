# Visual-Assistance

AI Agent for blind, visually impaired, dyslexic users, and people with vision loss.

The application helps users understand their surroundings by using a camera or uploaded image.  
The frontend sends an image to the backend as Base64, and the backend uses a vision-capable AI model to generate a natural language description.

## Features

- Real-time camera assistance
- Capture photo and describe it
- Upload image and analyze it
- Text reading mode
- Obstacle-focused mode
- Medical assistant prototype
- Drug interaction demo
- Document explainer prototype
- Medication reminder prototype
- Text-to-speech output in the browser

## Project Structure

```text
Visual-Assistance/
├── backend/
│   ├── main.py
│   ├── vision_agent.py
│   ├── logger.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── style.css
└── README.md
```

## Backend Setup

Go to the backend folder:

```bash
cd backend
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file inside the `backend` folder:

```env
MISTRAL_API_KEY=your_api_key_here
```

Run the backend:

```bash
uvicorn main:app --reload
```

Backend runs at:

```text
http://localhost:8000
```

Swagger documentation:

```text
http://localhost:8000/docs
```

## Frontend Setup

Go to the frontend folder:

```bash
cd frontend
```

Open the frontend:

```bash
start index.html
```

Or open `frontend/index.html` manually in a browser.

## API Endpoint

### Analyze Camera/Image

```http
POST /analyze-camera
```

Request body:

```json
{
  "image": "base64_string_without_prefix",
  "mode": "general"
}
```

Available modes:

```text
general, short, text, obstacles
```

Successful response:

```json
{
  "success": true,
  "description": "Description of the image.",
  "mode": "general"
}
```

Error response:

```json
{
  "success": false,
  "description": "",
  "error": "Error message."
}
```

## Notes

The `.env` file is not pushed to GitHub because it contains private API keys.  
Each developer must create their own local `.env` file.