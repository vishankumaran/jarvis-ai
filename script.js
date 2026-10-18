"use strict";

/*
 * JARVIS frontend
 * Cloudflare Worker handles AI requests.
 * Never put your OpenAI API key in this file.
 */

const API_URL =
  "https://jarvis-ai-backend.kumaranvishan.workers.dev/chat";

const $ = (id) => document.getElementById(id);

const ui = {
  mic: $("micButton"),
  navMic: $("navMicButton"),
  send: $("sendButton"),
  input: $("messageInput"),
  messages: $("chatMessages"),
  transcript: $("transcript"),
  status: $("statusText"),
  instruction: $("instruction"),
  voiceStatus: $("voiceStatus"),
  ready: $("readyText"),
  waveform: $("waveform"),
  language: $("languageSelect"),
  clear: $("clearChatButton"),
  toast: $("toast")
};

let recognition = null;
let isListening = false;
let isBusy = false;
let shouldSpeak = true;
let toastTimer = null;
let requestController = null;

const conversation = [];

/* Build the animated waveform once. */
function buildWaveform() {
  const count = window.innerWidth < 600 ? 65 : 100;
  ui.waveform.replaceChildren();

  for (let i = 0; i < count; i++) {
    const bar = document.createElement("span");
    const distance = Math.abs(i - (count - 1) / 2);
    const height = Math.max(8, 58 - distance * 1.05);

    bar.style.setProperty("--bar-height", `${height}px`);
    bar.style.setProperty("--delay", `${(i % 13) * -0.09}s`);

    ui.waveform.appendChild(bar);
  }
}

buildWaveform();

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(buildWaveform, 200);
});

/* Status helpers */
function setStatus(status, instruction) {
  ui.status.textContent = status;
  ui.instruction.textContent = instruction;

  document.body.classList.toggle("listening", status === "Listening...");
  document.body.classList.toggle("speaking", status === "Speaking...");

  ui.voiceStatus.textContent =
    status === "Listening..." ? "ACTIVE" :
    status === "Speaking..." ? "SPEAKING" :
    isBusy ? "THINKING" : "READY";

  ui.ready.textContent = isBusy ? "THINKING" : "READY";
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("visible");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    ui.toast.classList.remove("visible");
  }, 2800);
}

function scrollMessages() {
  ui.messages.scrollTop = ui.messages.scrollHeight;
}

/* Create safe chat elements using textContent, not HTML from AI. */
function addMessage(role, text) {
  const bubble = document.createElement("div");
  bubble.className =
    "message " + (role === "user" ? "user-message" : "assistant-message");

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "YOU" : "JARVIS";

  const content = document.createElement("div");
  content.textContent = text;

  bubble.append(label, content);
  ui.messages.appendChild(bubble);
  scrollMessages();

  return bubble;
}

function updateBubble(bubble, text) {
  const content = bubble.querySelector("div");
  if (content) content.textContent = text;
}

/* Speech output */
function stopSpeaking() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  document.body.classList.remove("speaking");
}

function speak(text) {
  if (!shouldSpeak || !("speechSynthesis" in window)) return;

  stopSpeaking();

  const utterance = new SpeechSynthesisUtterance(text);
  const selectedLanguage = ui.language.value;

  utterance.lang =
    selectedLanguage === "auto" ? detectLanguage(text) : selectedLanguage;

  utterance.rate = 1.03;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onstart = () => {
    document.body.classList.add("speaking");
    ui.status.textContent = "Speaking...";
    ui.instruction.textContent = "JARVIS is responding";
  };

  utterance.onend = () => {
    document.body.classList.remove("speaking");
    if (!isListening && !isBusy) {
      setStatus("JARVIS READY", "Tap the microphone and ask me anything");
    }
  };

  utterance.onerror = () => {
    document.body.classList.remove("speaking");
  };

  window.speechSynthesis.speak(utterance);
}

function detectLanguage(text) {
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN";
  return "en-IN";
}

/* Browser voice recognition */
function setupRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    recognition = null;
    ui.voiceStatus.textContent = "UNAVAILABLE";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  function applyRecognitionLanguage() {
    recognition.lang =
      ui.language.value === "auto" ? "en-IN" : ui.language.value;
  }

  applyRecognitionLanguage();

  ui.language.addEventListener("change", applyRecognitionLanguage);

  recognition.onstart = () => {
    isListening = true;
    stopSpeaking();
    setStatus("Listening...", "I'm listening. Speak now.");
    ui.mic.setAttribute("aria-label", "Stop listening");
  };

  recognition.onresult = (event) => {
    let finalText = "";
    let interimText = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        finalText += text;
      } else {
        interimText += text;
      }
    }

    ui.transcript.textContent = finalText || interimText || "Listening...";

    if (finalText.trim()) {
      ui.input.value = finalText.trim();
    }
  };

  recognition.onerror = (event) => {
    const messages = {
      "not-allowed": "Please allow microphone access in your browser.",
      "audio-capture": "No microphone was found.",
      "network": "Voice recognition needs an internet connection.",
      "no-speech": "I didn't hear anything. Please try again."
    };

    showToast(messages[event.error] || `Voice error: ${event.error}`);
  };

  recognition.onend = async () => {
    isListening = false;
    ui.mic.setAttribute("aria-label", "Start voice input");

    if (ui.input.value.trim()) {
      const text = ui.input.value.trim();
      ui.input.value = "";
      await sendMessage(text);
    } else {
      setStatus("JARVIS READY", "Tap the microphone and ask me anything");
    }
  };
}

setupRecognition();

function startListening() {
  if (isBusy) {
    showToast("Please wait for the current answer.");
    return;
  }

  if (!recognition) {
    showToast("Voice recognition isn't supported in this browser. Try typing.");
    return;
  }

  if (isListening) {
    recognition.stop();
    return;
  }

  stopSpeaking();

  try {
    recognition.start();
  } catch {
    showToast("Microphone is busy. Please try again.");
  }
}

/* Send a message to the Cloudflare Worker. */
async function sendMessage(rawMessage) {
  const message = String(rawMessage || "").trim();

  if (!message || isBusy) return;

  if (message.length > 4000) {
    showToast("Please keep your message under 4000 characters.");
    return;
  }

  stopSpeaking();

  addMessage("user", message);
  ui.transcript.textContent = message;

  ui.input.value = "";
  isBusy = true;
  ui.send.disabled = true;
  ui.ready.textContent = "THINKING";
  ui.voiceStatus.textContent = "THINKING";

  setStatus("Thinking...", "JARVIS is preparing an answer");

  const pendingBubble = addMessage("assistant", "Connecting to JARVIS...");

  requestController = new AbortController();
  const timeout = setTimeout(() => requestController.abort(), 45000);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        language: ui.language.value
      }),
      signal: requestController.signal
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("The backend returned an invalid response.");
    }

    if (!response.ok) {
      throw new Error(data.error || `Backend error (${response.status}).`);
    }

    const reply = String(data.reply || "").trim();

    if (!reply) {
      throw new Error("JARVIS received an empty answer. Please try again.");
    }

    updateBubble(pendingBubble, reply);
    ui.transcript.textContent = reply;

    conversation.push(
      { role: "user", content: message },
      { role: "assistant", content: reply }
    );

    if (conversation.length > 20) {
      conversation.splice(0, conversation.length - 20);
    }

    setStatus("JARVIS READY", "Tap the microphone to ask another question");
    speak(reply);

  } catch (error) {
    let messageText;

    if (error.name === "AbortError") {
      messageText = "The request took too long. Please try again.";
    } else if (error instanceof TypeError) {
      messageText =
        "Couldn't connect to the backend. Check your internet connection and Cloudflare CORS settings.";
    } else {
      messageText = error.message || "Something went wrong.";
    }

    updateBubble(pendingBubble, messageText);
    ui.transcript.textContent = messageText;
    setStatus("CONNECTION ISSUE", "Check your connection and try again");
    showToast(messageText);
  } finally {
    clearTimeout(timeout);
    requestController = null;
    isBusy = false;
    ui.send.disabled = false;
    ui.ready.textContent = "READY";

    if (!document.body.classList.contains("speaking")) {
      ui.voiceStatus.textContent = "READY";
    }
  }
}

/* Buttons */
ui.send.addEventListener("click", () => {
  sendMessage(ui.input.value);
});

ui.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    sendMessage(ui.input.value);
  }
});

ui.mic.addEventListener("click", startListening);
ui.navMic.addEventListener("click", startListening);

document.querySelectorAll(".quick-card").forEach((button) => {
  button.addEventListener("click", () => {
    const prompt = button.dataset.prompt;
    if (prompt) sendMessage(prompt);
  });
});

ui.clear.addEventListener("click", () => {
  if (isBusy) {
    showToast("Wait for the current response before clearing.");
    return;
  }

  ui.messages.replaceChildren();
  conversation.length = 0;
  ui.transcript.textContent = "Conversation cleared.";
  addMessage("assistant", "Hello! What would you like to ask me?");
  showToast("Conversation cleared.");
});

$("settingsButton").addEventListener("click", () => {
  showToast("Choose your preferred language from the language selector.");
});

$("modeButton").addEventListener("click", () => {
  showToast("Hybrid mode: this web interface uses online AI responses.");
});

$("menuButton").addEventListener("click", () => {
  $("chatSection").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("active");
    });

    button.classList.add("active");

    const page = button.dataset.page;

    if (page === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (page === "tools") {
      document.querySelector(".quick-actions").scrollIntoView({
        behavior: "smooth"
      });
    } else if (page === "history") {
      $("chatSection").scrollIntoView({ behavior: "smooth" });
      showToast("Chat history is stored only in this current page session.");
    } else if (page === "profile") {
      showToast("JARVIS Web Assistant · Browser-based interface");
    }
  });
});

/* Initial state */
setStatus("JARVIS READY", "Tap the microphone and ask me anything");

if (!recognition) {
  ui.instruction.textContent =
    "Voice recognition unavailable in this browser. You can type below.";
}
