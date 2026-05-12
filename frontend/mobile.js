/*
  IMPORTANT:
  Put your real AWS backend URL here.

  Examples:
  const API_BASE_URL = "https://your-domain.com";
  const API_BASE_URL = "https://api.your-project.com";
  const API_BASE_URL = "http://ec2-xx-xx-xx-xx.compute.amazonaws.com:8000";

  For phone camera, HTTPS is strongly recommended.
*/

const API_BASE_URL = "http://visual-assistance-load-balancer-1429357949.eu-west-1.elb.amazonaws.com";

let realtimeStream = null;
let captureStream = null;
let medicalStream = null;
let documentStream = null;

let realtimeTimer = null;
let isRealtimeAnalyzing = false;

let lastRealtimeText = "";
let lastCaptureText = "";
let lastUploadText = "";
let lastMedicalText = "";
let lastDocumentText = "";

let uploadedImageBase64 = "";

const medicines = [];
const reminders = [];

const globalStatus = document.getElementById("globalStatus");
const pageTitle = document.getElementById("pageTitle");

function setStatus(text) {
  globalStatus.textContent = text;
}

function speak(text) {
  if (!text) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

function stopSpeech() {
  window.speechSynthesis.cancel();
}

function showPage(pageId, title) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  document.querySelectorAll(".nav-btn").forEach(button => {
    button.classList.remove("active");
  });

  const selectedPage = document.getElementById(pageId);
  const selectedButton = document.querySelector(`.nav-btn[data-page="${pageId}"]`);

  if (selectedPage) {
    selectedPage.classList.add("active");
  }

  if (selectedButton) {
    selectedButton.classList.add("active");
  }

  pageTitle.textContent = title || "Visual Assistance";
  setStatus("Ready");
}

document.querySelectorAll(".nav-btn").forEach(button => {
  button.addEventListener("click", () => {
    const pageId = button.getAttribute("data-page");
    const title = button.getAttribute("data-title");

    showPage(pageId, title);
  });
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

function removeDataUrlPrefix(imageBase64) {
  if (!imageBase64) return "";

  if (imageBase64.includes(",")) {
    return imageBase64.split(",")[1];
  }

  return imageBase64;
}

async function analyzeImage(imageBase64, mode, source) {
  try {
    console.log("Sending request to:", `${API_BASE_URL}/analyze-camera`);

    const response = await fetch(`${API_BASE_URL}/analyze-camera`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image: removeDataUrlPrefix(imageBase64),
        mode: mode
      })
    });

    console.log("Backend status:", response.status);

    const data = await response.json();
    console.log("Backend response:", data);

    if (!response.ok) {
      return "Backend HTTP error: " + response.status;
    }

    if (data.success === false) {
      return data.error || "Backend returned success false.";
    }

    return data.description || "Backend returned no description.";
  } catch (error) {
    console.error("FETCH ERROR:", error);
    return "ERROR: Could not connect to backend. Check Console and backend URL.";
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

    if (mode === "short") {
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

  if (source === "document") {
    return "This is a prototype document explanation. The real AI system would read the document and summarize it in simple language.";
  }

  return "Image analyzed.";
}

/* REALTIME */

const realtimeVideo = document.getElementById("realtimeVideo");
const realtimeCanvas = document.getElementById("realtimeCanvas");
const realtimePlaceholder = document.getElementById("realtimePlaceholder");
const realtimeResponse = document.getElementById("realtimeResponse");

document.getElementById("startRealtimeBtn").addEventListener("click", async () => {
  try {
    setStatus("Starting");

    if (!realtimeStream) {
      realtimeStream = await startCamera(realtimeVideo, realtimePlaceholder);
    }

    setStatus("Active");

    if (realtimeTimer) {
      clearInterval(realtimeTimer);
    }

    const intervalMs = Number(document.getElementById("realtimeInterval").value);

    realtimeTimer = setInterval(async () => {
      if (isRealtimeAnalyzing) return;

      isRealtimeAnalyzing = true;
      setStatus("Analyzing");

      try {
        const mode = document.getElementById("realtimeMode").value;
        const imageBase64 = captureFrame(realtimeVideo, realtimeCanvas);
        const result = await analyzeImage(imageBase64, mode, "live");

        if (result !== lastRealtimeText) {
          lastRealtimeText = result;
          realtimeResponse.textContent = result;
          speak(result);
        }

        setStatus("Active");
      } catch (error) {
        setStatus("Error");
      } finally {
        isRealtimeAnalyzing = false;
      }
    }, intervalMs);
  } catch (error) {
    console.error(error);
    setStatus("Camera error");
  }
});

document.getElementById("stopRealtimeBtn").addEventListener("click", () => {
  if (realtimeTimer) {
    clearInterval(realtimeTimer);
    realtimeTimer = null;
  }

  stopCamera(realtimeStream, realtimeVideo, realtimePlaceholder);
  realtimeStream = null;

  stopSpeech();
  setStatus("Stopped");
});

document.getElementById("repeatRealtimeBtn").addEventListener("click", () => {
  speak(lastRealtimeText);
});

document.getElementById("stopVoiceRealtimeBtn").addEventListener("click", stopSpeech);

/* CAPTURE */

const captureVideo = document.getElementById("captureVideo");
const captureCanvas = document.getElementById("captureCanvas");
const capturePlaceholder = document.getElementById("capturePlaceholder");
const captureResponse = document.getElementById("captureResponse");

document.getElementById("startCaptureCameraBtn").addEventListener("click", async () => {
  try {
    setStatus("Starting");

    if (!captureStream) {
      captureStream = await startCamera(captureVideo, capturePlaceholder);
    }

    setStatus("Camera ready");
  } catch (error) {
    console.error(error);
    setStatus("Camera error");
  }
});

document.getElementById("capturePhotoBtn").addEventListener("click", async () => {
  try {
    if (!captureStream) {
      captureStream = await startCamera(captureVideo, capturePlaceholder);
    }

    setStatus("Analyzing");

    const mode = document.getElementById("captureMode").value;
    const imageBase64 = captureFrame(captureVideo, captureCanvas);
    const result = await analyzeImage(imageBase64, mode, "capture");

    lastCaptureText = result;
    captureResponse.textContent = result;
    speak(result);

    setStatus("Done");
  } catch (error) {
    console.error(error);
    setStatus("Error");
  }
});

document.getElementById("repeatCaptureBtn").addEventListener("click", () => {
  speak(lastCaptureText);
});

document.getElementById("stopVoiceCaptureBtn").addEventListener("click", stopSpeech);

/* UPLOAD */

const uploadInput = document.getElementById("uploadInput");
const uploadPreview = document.getElementById("uploadPreview");
const uploadPlaceholder = document.getElementById("uploadPlaceholder");
const uploadResponse = document.getElementById("uploadResponse");

uploadInput.addEventListener("change", () => {
  const file = uploadInput.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    uploadedImageBase64 = reader.result;
    uploadPreview.src = uploadedImageBase64;
    uploadPreview.style.display = "block";
    uploadPlaceholder.style.display = "none";
    setStatus("Image ready");
  };

  reader.readAsDataURL(file);
});

document.getElementById("analyzeUploadBtn").addEventListener("click", async () => {
  if (!uploadedImageBase64) {
    setStatus("Choose image");
    return;
  }

  setStatus("Analyzing");

  const mode = document.getElementById("uploadMode").value;
  const result = await analyzeImage(uploadedImageBase64, mode, "upload");

  lastUploadText = result;
  uploadResponse.textContent = result;
  speak(result);

  setStatus("Done");
});

document.getElementById("repeatUploadBtn").addEventListener("click", () => {
  speak(lastUploadText);
});

document.getElementById("stopVoiceUploadBtn").addEventListener("click", stopSpeech);

/* MEDICAL */

const medicalVideo = document.getElementById("medicalVideo");
const medicalCanvas = document.getElementById("medicalCanvas");
const medicalPlaceholder = document.getElementById("medicalPlaceholder");
const medicalResponse = document.getElementById("medicalResponse");

document.getElementById("startMedicalCameraBtn").addEventListener("click", async () => {
  try {
    setStatus("Starting");

    if (!medicalStream) {
      medicalStream = await startCamera(medicalVideo, medicalPlaceholder);
    }

    setStatus("Camera ready");
  } catch (error) {
    console.error(error);
    setStatus("Camera error");
  }
});

document.getElementById("scanMedicineBtn").addEventListener("click", async () => {
  try {
    if (!medicalStream) {
      medicalStream = await startCamera(medicalVideo, medicalPlaceholder);
    }

    setStatus("Scanning");

    const imageBase64 = captureFrame(medicalVideo, medicalCanvas);
    const result = await analyzeImage(imageBase64, "text", "medical");

    lastMedicalText =
      "Possible medicine scan result: " +
      result +
      " This information must be verified by a medical professional.";

    medicalResponse.textContent = lastMedicalText;
    speak(lastMedicalText);

    setStatus("Done");
  } catch (error) {
    console.error(error);
    setStatus("Error");
  }
});

document.getElementById("repeatMedicalBtn").addEventListener("click", () => {
  speak(lastMedicalText);
});

document.getElementById("stopVoiceMedicalBtn").addEventListener("click", stopSpeech);

/* DRUG INTERACTION */

const drugTableBody = document.getElementById("drugTableBody");
const interactionResponse = document.getElementById("interactionResponse");
const interactionTitle = document.getElementById("interactionTitle");
const interactionSubtitle = document.getElementById("interactionSubtitle");

document.getElementById("addDrugBtn").addEventListener("click", () => {
  const nameInput = document.getElementById("drugNameInput");
  const doseInput = document.getElementById("drugDoseInput");

  const name = nameInput.value.trim();
  const dose = doseInput.value.trim() || "Not specified";

  if (!name) {
    setStatus("Enter medicine");
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
        <td colspan="3" class="empty-row">No medicines added yet.</td>
      </tr>
    `;
    return;
  }

  medicines.forEach(medicine => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${medicine.name}</td>
      <td>${medicine.dose}</td>
      <td class="${medicine.status.level}">${medicine.status.label}</td>
    `;

    drugTableBody.appendChild(row);
  });
}

function updateDrugStatus() {
  const hasRisk = medicines.some(m => m.status.level === "risky");

  if (hasRisk) {
    interactionTitle.textContent = "Risk detected";
    interactionSubtitle.textContent = "One or more medicines may not be safe to combine.";
    setStatus("Risk");
  } else {
    interactionTitle.textContent = "Everything is currently OK";
    interactionSubtitle.textContent = "No dangerous combination has been detected yet.";
    setStatus("All clear");
  }
}

/* DOCUMENT */

const documentVideo = document.getElementById("documentVideo");
const documentCanvas = document.getElementById("documentCanvas");
const documentPlaceholder = document.getElementById("documentPlaceholder");
const documentResponse = document.getElementById("documentResponse");

document.getElementById("startDocumentCameraBtn").addEventListener("click", async () => {
  try {
    setStatus("Starting");

    if (!documentStream) {
      documentStream = await startCamera(documentVideo, documentPlaceholder);
    }

    setStatus("Camera ready");
  } catch (error) {
    console.error(error);
    setStatus("Camera error");
  }
});

document.getElementById("scanDocumentBtn").addEventListener("click", async () => {
  try {
    if (!documentStream) {
      documentStream = await startCamera(documentVideo, documentPlaceholder);
    }

    setStatus("Scanning");

    const imageBase64 = captureFrame(documentVideo, documentCanvas);
    const result = await analyzeImage(imageBase64, "text", "document");

    lastDocumentText =
      "Document explanation: " +
      result +
      " Please verify important medical information with a doctor.";

    documentResponse.textContent = lastDocumentText;
    speak(lastDocumentText);

    setStatus("Done");
  } catch (error) {
    console.error(error);
    setStatus("Error");
  }
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
    setStatus("Fill fields");
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

  setStatus("Reminder added");
});

function renderReminderTable() {
  reminderTableBody.innerHTML = "";

  if (reminders.length === 0) {
    reminderTableBody.innerHTML = `
      <tr>
        <td colspan="3" class="empty-row">No reminders added yet.</td>
      </tr>
    `;
    return;
  }

  reminders.forEach(reminder => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${reminder.medicine}</td>
      <td>${reminder.time}</td>
      <td>${reminder.status}</td>
    `;

    reminderTableBody.appendChild(row);
  });
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

/* DEFAULT PAGE */

showPage("realtime", "Realtime Assistance");