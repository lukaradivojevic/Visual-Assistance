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
    const response = await fetch(`${API_BASE_URL}/analyze-camera`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image_base64: imageBase64,
        mode,
        source
      })
    });

    if (!response.ok) {
      throw new Error("Backend error");
    }

    const data = await response.json();

    return (
      data.description ||
      data.response ||
      "The backend returned a response, but no description was found."
    );
  } catch (error) {
    return mockVisionResponse(mode, source);
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

    realtimeTimer = setInterval(async () => {
      if (isRealtimeAnalyzing) return;

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
        setPageStatus("realtime", "Error");
      } finally {
        isRealtimeAnalyzing = false;
      }
    }, intervalMs);
  } catch (error) {
    setPageStatus("realtime", "Camera error");
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

/* DEFAULT PAGE */

