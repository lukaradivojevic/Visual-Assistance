const API_BASE_URL = "http://localhost:8000";

let realtimeStream = null;
let captureStream = null;
let medicalStream = null;

let realtimeTimer = null;
let isRealtimeAnalyzing = false;

let lastRealtimeText = "";
let lastCaptureText = "";
let lastUploadText = "";
let lastMedicalText = "";
let lastDocumentText = "";

const medicines = [];
const reminders = [];

const sidebarStatus = document.getElementById("sidebarStatus");

function setGlobalStatus(text) {
  sidebarStatus.textContent = text;
}

function setPageStatus(page, text) {
  const element = document.getElementById(`${page}Status`);
  if (element) element.textContent = text;
  setGlobalStatus(text);
}

let speechQueue = [];
let isSpeaking = false;

function speak(text) {
  if (!text || text.trim() === "") return;

  speechQueue.push(text);
  processSpeechQueue();
}

function processSpeechQueue() {
  if (isSpeaking || speechQueue.length === 0) return;

  isSpeaking = true;

  const text = speechQueue.shift();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1;
  utterance.pitch = 1;

  utterance.onend = function () {
    isSpeaking = false;
    processSpeechQueue();
  };

  utterance.onerror = function () {
    isSpeaking = false;
    processSpeechQueue();
  };

  window.speechSynthesis.speak(utterance);
}

function stopSpeech() {
  speechQueue = [];
  isSpeaking = false;
  window.speechSynthesis.cancel();
}

function showPage(pageId) {
  console.log("Changing tab to:", pageId);

  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  document.querySelectorAll(".menu-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  const page = document.getElementById(pageId);
  const activeButton = document.querySelector(`.menu-btn[data-page="${pageId}"]`);

  if (!page) {
    console.error("Page not found:", pageId);
    return;
  }

  page.classList.add("active");

  if (activeButton) {
    activeButton.classList.add("active");
  }

  setGlobalStatus("Ready");
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".menu-btn").forEach(button => {
    button.addEventListener("click", () => {
      const pageId = button.getAttribute("data-page");
      showPage(pageId);
    });
  });

  showPage("realtime");
});

async function startCamera(videoElement, placeholderElement) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "environment"
    },
    audio: false
  });

  videoElement.srcObject = stream;
  videoElement.style.display = "block";

  if (placeholderElement) {
    placeholderElement.style.display = "none";
  }

  return stream;
}

function stopCamera(stream, videoElement, placeholderElement) {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }

  if (videoElement) {
    videoElement.srcObject = null;
    videoElement.style.display = "none";
  }

  if (placeholderElement) {
    placeholderElement.style.display = "block";
  }
}

function captureFrame(videoElement, canvasElement) {
  const width = videoElement.videoWidth || 640;
  const height = videoElement.videoHeight || 480;

  canvasElement.width = width;
  canvasElement.height = height;

  const context = canvasElement.getContext("2d");
  context.drawImage(videoElement, 0, 0, width, height);

  return canvasElement.toDataURL("image/jpeg", 0.8);
}

async function analyzeImage(imageBase64, mode, source) {
  try {
    const cleanBase64 = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;

    const response = await fetch(`${API_BASE_URL}/analyze-camera`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image: cleanBase64,
        mode: mode
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return data.error || "Backend error.";
    }

    if (!data.success) {
      return data.error || "AI analysis failed.";
    }

    return data.description || "No description returned from backend.";
  } catch (error) {
    console.error("Frontend-backend connection error:", error);
    return "Could not connect to backend. Make sure FastAPI is running on http://localhost:8000.";
  }
}

function mockVisionResponse(mode, source) {
  if (source === "live") {
    if (mode === "obstacles") {
      return "A possible obstacle is in front of you. Move carefully.";
    }

    if (mode === "text") {
      return "No clearly readable text is detected in this frame.";
    }

    if (mode === "people") {
      return "An indoor space is visible in front of you.";
    }

    return "You are facing an indoor space with several objects ahead.";
  }

  if (source === "capture") {
    return "This captured photo appears to show an indoor environment. A real AI model would provide a detailed description here.";
  }

  if (source === "upload") {
    return "The uploaded image has been analyzed. A real AI model would explain important objects, text, and possible risks.";
  }

  if (source === "medical") {
    return "Possible medicine detected. This is only a prototype result. Please verify the medicine with a pharmacist or doctor.";
  }

  return "Image analyzed.";
}

/* REALTIME ASSISTANCE */

const realtimeVideo = document.getElementById("realtimeVideo");
const realtimeCanvas = document.getElementById("realtimeCanvas");
const realtimePlaceholder = document.getElementById("realtimePlaceholder");
const realtimeResponse = document.getElementById("realtimeResponse");

document.getElementById("startRealtimeBtn").addEventListener("click", async () => {
  try {
    setPageStatus("realtime", "Starting camera");

    if (!realtimeStream) {
      realtimeStream = await startCamera(realtimeVideo, realtimePlaceholder);
    }

    setPageStatus("realtime", "Active");

    if (realtimeTimer) {
      clearInterval(realtimeTimer);
    }

    const intervalMs = Number(document.getElementById("realtimeInterval").value);

   async function analyzeRealtimeLoop() {
    if (!realtimeStream) return;

    isRealtimeAnalyzing = true;
    setPageStatus("realtime", "Analyzing");

    try {
      const mode = document.getElementById("realtimeMode").value;
      const imageBase64 = captureFrame(realtimeVideo, realtimeCanvas);
      const result = await analyzeImage(imageBase64, mode, "live");

      if (result !== lastRealtimeText) {
        lastRealtimeText = result;
        realtimeResponse.textContent = result;
        speak(result);
      }

      setPageStatus("realtime", "Active");
    } catch (error) {
      console.error("Realtime analysis error:", error);
      setPageStatus("realtime", "Error");
    } finally {
      isRealtimeAnalyzing = false;

      let intervalValue = Number(document.getElementById("realtimeInterval").value);

      // If the value is written as 5, treat it as 5 seconds.
      // If it is written as 5000, treat it as milliseconds.
      const intervalMs = intervalValue < 1000 ? intervalValue * 1000 : intervalValue;

      realtimeTimer = setTimeout(analyzeRealtimeLoop, intervalMs);
    }
}

analyzeRealtimeLoop();
  } catch (error) {
    setPageStatus("realtime", "Camera error");
  }
});

document.getElementById("stopRealtimeBtn").addEventListener("click", () => {
  if (realtimeTimer) {
    clearTimeout(realtimeTimer);
    realtimeTimer = null;
  }

  stopCamera(realtimeStream, realtimeVideo, realtimePlaceholder);
  realtimeStream = null;

  stopSpeech();
  setPageStatus("realtime", "Stopped");
});

document.getElementById("repeatRealtimeBtn").addEventListener("click", () => {
  speak(lastRealtimeText);
});

document.getElementById("stopVoiceRealtimeBtn").addEventListener("click", stopSpeech);

/* CAPTURE PHOTO */

const captureVideo = document.getElementById("captureVideo");
const captureCanvas = document.getElementById("captureCanvas");
const capturePlaceholder = document.getElementById("capturePlaceholder");
const captureResponse = document.getElementById("captureResponse");

document.getElementById("startCaptureCameraBtn").addEventListener("click", async () => {
  try {
    setPageStatus("capture", "Starting camera");

    if (!captureStream) {
      captureStream = await startCamera(captureVideo, capturePlaceholder);
    }

    setPageStatus("capture", "Camera ready");
  } catch (error) {
    setPageStatus("capture", "Camera error");
  }
});

document.getElementById("capturePhotoBtn").addEventListener("click", async () => {
  try {
    if (!captureStream) {
      captureStream = await startCamera(captureVideo, capturePlaceholder);
    }

    setPageStatus("capture", "Analyzing");

    const mode = document.getElementById("captureMode").value;
    const imageBase64 = captureFrame(captureVideo, captureCanvas);
    const result = await analyzeImage(imageBase64, mode, "capture");

    lastCaptureText = result;
    captureResponse.textContent = result;
    speak(result);

    setPageStatus("capture", "Done");
  } catch (error) {
    setPageStatus("capture", "Error");
  }
});

document.getElementById("repeatCaptureBtn").addEventListener("click", () => {
  speak(lastCaptureText);
});

document.getElementById("stopVoiceCaptureBtn").addEventListener("click", stopSpeech);

/* UPLOAD IMAGE */

const uploadInput = document.getElementById("uploadInput");
const uploadPreview = document.getElementById("uploadPreview");
const uploadPlaceholder = document.getElementById("uploadPlaceholder");
const uploadResponse = document.getElementById("uploadResponse");

let uploadedImageBase64 = "";

uploadInput.addEventListener("change", () => {
  const file = uploadInput.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    uploadedImageBase64 = reader.result;
    uploadPreview.src = uploadedImageBase64;
    uploadPreview.style.display = "block";
    uploadPlaceholder.style.display = "none";
    setPageStatus("upload", "Image ready");
  };

  reader.readAsDataURL(file);
});

document.getElementById("analyzeUploadBtn").addEventListener("click", async () => {
  if (!uploadedImageBase64) {
    setPageStatus("upload", "Choose image first");
    return;
  }

  setPageStatus("upload", "Analyzing");

  const mode = document.getElementById("uploadMode").value;
  const result = await analyzeImage(uploadedImageBase64, mode, "upload");

  lastUploadText = result;
  uploadResponse.textContent = result;
  speak(result);

  setPageStatus("upload", "Done");
});

document.getElementById("repeatUploadBtn").addEventListener("click", () => {
  speak(lastUploadText);
});

document.getElementById("stopVoiceUploadBtn").addEventListener("click", stopSpeech);

/* MEDICAL ASSISTANT */

const medicalVideo = document.getElementById("medicalVideo");
const medicalCanvas = document.getElementById("medicalCanvas");
const medicalPlaceholder = document.getElementById("medicalPlaceholder");
const medicalResponse = document.getElementById("medicalResponse");

document.getElementById("startMedicalCameraBtn").addEventListener("click", async () => {
  try {
    setPageStatus("medical", "Starting camera");

    if (!medicalStream) {
      medicalStream = await startCamera(medicalVideo, medicalPlaceholder);
    }

    setPageStatus("medical", "Camera ready");
  } catch (error) {
    setPageStatus("medical", "Camera error");
  }
});

document.getElementById("scanMedicineBtn").addEventListener("click", async () => {
  try {
    if (!medicalStream) {
      medicalStream = await startCamera(medicalVideo, medicalPlaceholder);
    }

    setPageStatus("medical", "Scanning");

    const imageBase64 = captureFrame(medicalVideo, medicalCanvas);

    const result = await analyzeImage(imageBase64, "text", "medical");

    lastMedicalText =
      "Possible medicine scan result: " +
      result +
      " This information must be verified by a medical professional.";

    medicalResponse.textContent = lastMedicalText;
    speak(lastMedicalText);

    setPageStatus("medical", "Done");
  } catch (error) {
    setPageStatus("medical", "Error");
  }
});

document.getElementById("repeatMedicalBtn").addEventListener("click", () => {
  speak(lastMedicalText);
});

document.getElementById("stopVoiceMedicalBtn").addEventListener("click", stopSpeech);

/* DRUG INTERACTION */

const drugTableBody = document.getElementById("drugTableBody");
const interactionResponse = document.getElementById("interactionResponse");

document.getElementById("addDrugBtn").addEventListener("click", () => {
  const nameInput = document.getElementById("drugNameInput");
  const doseInput = document.getElementById("drugDoseInput");

  const name = nameInput.value.trim();
  const dose = doseInput.value.trim() || "Not specified";

  if (!name) {
    setPageStatus("drug", "Enter medicine");
    return;
  }

  const status = checkInteraction(name);

  medicines.push({
    name,
    dose,
    status
  });

  nameInput.value = "";
  doseInput.value = "";

  renderMedicineTable();
  updateDrugStatus();

  interactionResponse.textContent = status.message;
  speak(status.message);
});

document.getElementById("mockScanDrugBtn").addEventListener("click", () => {
  const scannedName = "Scanned Example Medicine";
  const status = checkInteraction(scannedName);

  medicines.push({
    name: scannedName,
    dose: "Unknown",
    status
  });

  renderMedicineTable();
  updateDrugStatus();

  interactionResponse.textContent =
    "Scanned medicine was added. " + status.message;

  speak(interactionResponse.textContent);
});

function checkInteraction(newMedicineName) {
  const lower = newMedicineName.toLowerCase();

  const hasAspirin = medicines.some(m => m.name.toLowerCase().includes("aspirin"));
  const hasIbuprofen = medicines.some(m => m.name.toLowerCase().includes("ibuprofen"));

  if (lower.includes("aspirin") && hasIbuprofen) {
    return {
      level: "risky",
      label: "Risky",
      message: "Possible risk detected. Aspirin and ibuprofen may not be safe to combine without medical advice."
    };
  }

  if (lower.includes("ibuprofen") && hasAspirin) {
    return {
      level: "risky",
      label: "Risky",
      message: "Possible risk detected. Ibuprofen and aspirin may increase side effect risk."
    };
  }

  return {
    level: "safe",
    label: "OK",
    message: "Everything looks OK in this demo. Real medical verification is still required."
  };
}

function renderMedicineTable() {
  drugTableBody.innerHTML = "";

  if (medicines.length === 0) {
    drugTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-row">No medicines added yet.</td>
      </tr>
    `;
    return;
  }

  medicines.forEach((medicine, index) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${medicine.name}</td>
      <td>${medicine.dose}</td>
      <td class="${medicine.status.level}">${medicine.status.label}</td>
      <td><button class="btn secondary" onclick="removeMedicine(${index})">Remove</button></td>
    `;

    drugTableBody.appendChild(row);
  });
}

function removeMedicine(index) {
  medicines.splice(index, 1);
  renderMedicineTable();
  updateDrugStatus();
}

function updateDrugStatus() {
  const status = document.getElementById("drugStatus");
  const hasRisk = medicines.some(m => m.status.level === "risky");

  if (hasRisk) {
    status.textContent = "Risk detected";
    status.classList.remove("success");
    setGlobalStatus("Risk detected");
  } else {
    status.textContent = "All clear";
    status.classList.add("success");
    setGlobalStatus("All clear");
  }
}

/* DOCUMENT EXPLAINER */

const documentInput = document.getElementById("documentInput");
const documentPreview = document.getElementById("documentPreview");
const documentPlaceholder = document.getElementById("documentPlaceholder");
const documentResponse = document.getElementById("documentResponse");

let documentImageBase64 = "";

documentInput.addEventListener("change", () => {
  const file = documentInput.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    documentImageBase64 = reader.result;
    documentPreview.src = documentImageBase64;
    documentPreview.style.display = "block";
    documentPlaceholder.style.display = "none";
    setPageStatus("document", "Document ready");
  };

  reader.readAsDataURL(file);
});

document.getElementById("explainDocumentBtn").addEventListener("click", () => {
  if (!documentImageBase64) {
    setPageStatus("document", "Choose document first");
    return;
  }

  setPageStatus("document", "Explaining");

  lastDocumentText =
    "This is a prototype explanation. The real AI system would read the medical document, summarize the findings, explain important values, and highlight anything that should be checked with a doctor.";

  documentResponse.textContent = lastDocumentText;
  speak(lastDocumentText);

  setPageStatus("document", "Done");
});

document.getElementById("repeatDocumentBtn").addEventListener("click", () => {
  speak(lastDocumentText);
});

document.getElementById("stopVoiceDocumentBtn").addEventListener("click", stopSpeech);

/* REMINDER */

const reminderTableBody = document.getElementById("reminderTableBody");

document.getElementById("addReminderBtn").addEventListener("click", () => {
  const medicineInput = document.getElementById("reminderMedicineInput");
  const timeInput = document.getElementById("reminderTimeInput");

  const medicine = medicineInput.value.trim();
  const time = timeInput.value;

  if (!medicine || !time) {
    setPageStatus("reminder", "Fill all fields");
    return;
  }

  const reminder = {
    medicine,
    time,
    status: "Scheduled"
  };

  reminders.push(reminder);

  medicineInput.value = "";
  timeInput.value = "";

  renderReminderTable();
  scheduleReminder(reminder);

  setPageStatus("reminder", "Reminder added");
});

function renderReminderTable() {
  reminderTableBody.innerHTML = "";

  if (reminders.length === 0) {
    reminderTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-row">No reminders added yet.</td>
      </tr>
    `;
    return;
  }

  reminders.forEach((reminder, index) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${reminder.medicine}</td>
      <td>${reminder.time}</td>
      <td>${reminder.status}</td>
      <td><button class="btn secondary" onclick="removeReminder(${index})">Remove</button></td>
    `;

    reminderTableBody.appendChild(row);
  });
}

function removeReminder(index) {
  reminders.splice(index, 1);
  renderReminderTable();
  setPageStatus("reminder", "Reminder removed");
}

function scheduleReminder(reminder) {
  const now = new Date();
  const [hours, minutes] = reminder.time.split(":");

  const reminderTime = new Date();
  reminderTime.setHours(Number(hours));
  reminderTime.setMinutes(Number(minutes));
  reminderTime.setSeconds(0);

  if (reminderTime < now) {
    reminderTime.setDate(reminderTime.getDate() + 1);
  }

  const delay = reminderTime - now;

  setTimeout(() => {
    const message = `Reminder: It is time to take ${reminder.medicine}.`;
    reminder.status = "Triggered";
    renderReminderTable();
    speak(message);
    alert(message);
  }, delay);
}

const voiceCommandBtn = document.getElementById("voiceCommandBtn");
const voiceCommandText = document.getElementById("voiceCommandText");

const captureVoiceCommandBtn = document.getElementById("captureVoiceCommandBtn");
const captureVoiceCommandText = document.getElementById("captureVoiceCommandText");

const uploadVoiceCommandBtn = document.getElementById("uploadVoiceCommandBtn");
const uploadVoiceCommandText = document.getElementById("uploadVoiceCommandText");

let activeVoiceSource = "realtime";
let activeVoiceTextElement = voiceCommandText;

const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;

function setVoiceText(text) {
    if (activeVoiceTextElement) {
        activeVoiceTextElement.textContent = text;
    }
}

function startVoiceCommand(source, textElement) {
    activeVoiceSource = source;
    activeVoiceTextElement = textElement;

    if (!SpeechRecognition) {
        setVoiceText("Speech recognition is not supported in this browser.");
        return;
    }

    setVoiceText("Listening...");
    recognition.start();
}

if (!SpeechRecognition) {
    if (voiceCommandText) {
        voiceCommandText.textContent = "Speech recognition is not supported in this browser.";
    }

    if (captureVoiceCommandText) {
        captureVoiceCommandText.textContent = "Speech recognition is not supported in this browser.";
    }

    if (uploadVoiceCommandText) {
        uploadVoiceCommandText.textContent = "Speech recognition is not supported in this browser.";
    }
} else {
    recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    if (voiceCommandBtn) {
        voiceCommandBtn.addEventListener("click", () => {
            startVoiceCommand("realtime", voiceCommandText);
        });
    }

    if (captureVoiceCommandBtn) {
        captureVoiceCommandBtn.addEventListener("click", () => {
            startVoiceCommand("capture", captureVoiceCommandText);
        });
    }

    if (uploadVoiceCommandBtn) {
        uploadVoiceCommandBtn.addEventListener("click", () => {
            startVoiceCommand("upload", uploadVoiceCommandText);
        });
    }

    recognition.onresult = (event) => {
        const command = event.results[0][0].transcript.toLowerCase().trim();

        console.log("Voice command:", command);
        setVoiceText("You said: " + command);

        handleVoiceCommand(command);
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setVoiceText("Voice recognition error: " + event.error);
    };

    recognition.onend = () => {
        console.log("Voice recognition stopped.");
    };
}

function getCurrentMemoryImageBase64() {
    if (activeVoiceSource === "realtime") {
        if (!realtimeStream) {
            setVoiceText("Start realtime camera first.");
            return null;
        }

        return captureFrame(realtimeVideo, realtimeCanvas);
    }

    if (activeVoiceSource === "capture") {
        if (!captureStream) {
            setVoiceText("Start capture camera first.");
            return null;
        }

        return captureFrame(captureVideo, captureCanvas);
    }

    if (activeVoiceSource === "upload") {
        if (!uploadedImageBase64) {
            setVoiceText("Upload an image first.");
            return null;
        }

        return uploadedImageBase64;
    }

    return null;
}

function changeModeForActiveSource(mode) {
    if (activeVoiceSource === "realtime") {
        const realtimeMode = document.getElementById("realtimeMode");
        if (realtimeMode) realtimeMode.value = mode;
    }

    if (activeVoiceSource === "capture") {
        const captureMode = document.getElementById("captureMode");
        if (captureMode) captureMode.value = mode;
    }

    if (activeVoiceSource === "upload") {
        const uploadMode = document.getElementById("uploadMode");
        if (uploadMode) uploadMode.value = mode;
    }
}

function handleVoiceCommand(command) {
    command = command.toLowerCase().trim();

    // REMEMBER PLACE
    if (
        command.startsWith("remember this place as") ||
        command.startsWith("remember this place is")
    ) {
        let placeName = "";

        if (command.startsWith("remember this place as")) {
            placeName = command.replace("remember this place as", "").trim();
        } else {
            placeName = command.replace("remember this place is", "").trim();
        }

        if (!placeName) {
            setVoiceText("Place name is missing.");
            return;
        }

        const memoryText = "Known place: " + placeName;
        const imageBase64 = getCurrentMemoryImageBase64();

        if (!imageBase64) return;

        saveMemoryToBackend(memoryText, "general", imageBase64);

        setVoiceText("Saving place memory: " + placeName);
        console.log("Place to remember:", placeName);
    }

    // REMEMBER PERSON
    else if (
        command.startsWith("remember this person as") ||
        command.startsWith("remember this person is")
    ) {
        let personName = "";

        if (command.startsWith("remember this person as")) {
            personName = command.replace("remember this person as", "").trim();
        } else {
            personName = command.replace("remember this person is", "").trim();
        }

        if (!personName) {
            setVoiceText("Person name is missing.");
            return;
        }

        const memoryText = "Known person: " + personName;
        const imageBase64 = getCurrentMemoryImageBase64();

        if (!imageBase64) return;

        saveMemoryToBackend(memoryText, "people", imageBase64);

        setVoiceText("Saving person memory: " + personName);
        console.log("Person to remember:", personName);
    }

    // REMEMBER OBJECT
    else if (
        command.startsWith("remember this object as") ||
        command.startsWith("remember this object is")
    ) {
        let objectName = "";

        if (command.startsWith("remember this object as")) {
            objectName = command.replace("remember this object as", "").trim();
        } else {
            objectName = command.replace("remember this object is", "").trim();
        }

        if (!objectName) {
            setVoiceText("Object name is missing.");
            return;
        }

        const memoryText = "Known object: " + objectName;
        const imageBase64 = getCurrentMemoryImageBase64();

        if (!imageBase64) return;

        saveMemoryToBackend(memoryText, "general", imageBase64);

        setVoiceText("Saving object memory: " + objectName);
        console.log("Object to remember:", objectName);
    }

    // REMEMBER TEXT
    else if (
        command.startsWith("remember this text as") ||
        command.startsWith("remember this text is")
    ) {
        let textName = "";

        if (command.startsWith("remember this text as")) {
            textName = command.replace("remember this text as", "").trim();
        } else {
            textName = command.replace("remember this text is", "").trim();
        }

        if (!textName) {
            setVoiceText("Text memory is missing.");
            return;
        }

        const memoryText = "Known visible text: " + textName;
        const imageBase64 = getCurrentMemoryImageBase64();

        if (!imageBase64) return;

        saveMemoryToBackend(memoryText, "text", imageBase64);

        setVoiceText("Saving text memory: " + textName);
        console.log("Text to remember:", textName);
    }

    // CHANGE MODE TO OBSTACLES
    else if (
        command.includes("detect obstacles") ||
        command.includes("obstacle mode") ||
        command.includes("find obstacles")
    ) {
        changeModeForActiveSource("obstacles");

        setVoiceText("Mode changed to obstacle detection.");
        console.log("Command: obstacle mode");
    }

    // CHANGE MODE TO PEOPLE
    else if (
        command.includes("find people") ||
        command.includes("people mode") ||
        command.includes("detect people")
    ) {
        changeModeForActiveSource("people");

        setVoiceText("Mode changed to people description.");
        console.log("Command: people mode");
    }

    // CHANGE MODE TO TEXT
    else if (
        command.includes("read text") ||
        command.includes("text mode") ||
        command.includes("read visible text")
    ) {
        changeModeForActiveSource("text");

        setVoiceText("Mode changed to text reading.");
        console.log("Command: text mode");
    }

    // CHANGE MODE TO GENERAL
    else if (
        command.includes("describe") ||
        command.includes("general mode") ||
        command.includes("describe scene")
    ) {
        changeModeForActiveSource("general");

        setVoiceText("Mode changed to general description.");
        console.log("Command: general mode");
    }

    // UNKNOWN COMMAND
    else {
        setVoiceText("Command heard, but not recognized: " + command);
        console.log("Unknown command:", command);
    }
}

async function saveMemoryToBackend(text, category, imageBase64 = null) {
    try {
        const response = await fetch("http://127.0.0.1:8000/memory/add", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: text,
                category: category,
                image: imageBase64
            })
        });

        const data = await response.json();

        if (data.success) {
            setVoiceText("Memory saved: " + text);
            console.log("Memory saved:", data.memory);
        } else {
            setVoiceText("Memory save failed: " + data.error);
            console.error("Memory save failed:", data);
        }
    } catch (error) {
        setVoiceText("Could not connect to backend memory endpoint.");
        console.error("Memory backend error:", error);
    }
}

async function saveMemoryToBackend(text, category, imageBase64 = null) {
    try {
        const response = await fetch("http://127.0.0.1:8000/memory/add", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: text,
                category: category,
                image: imageBase64
            })
        });

        const data = await response.json();

        if (data.success) {
            voiceCommandText.textContent = "Memory saved: " + text;
            console.log("Memory saved:", data.memory);
        } else {
            voiceCommandText.textContent = "Memory save failed: " + data.error;
            console.error("Memory save failed:", data);
        }
    } catch (error) {
        voiceCommandText.textContent = "Could not connect to backend memory endpoint.";
        console.error("Memory backend error:", error);
    }
}