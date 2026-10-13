
"use strict";

// ==========================================
// JARVIS AI ASSISTANT
// Cloudflare Worker + OpenAI API
// ==========================================

const API_URL =
  "https://jarvis-ai-backend.kumaranvishan.workers.dev/chat";

// HTML elements
const micButton = document.getElementById("micButton");
const statusText = document.getElementById("statusText");
const reactor = document.getElementById("reactor");
const chat = document.getElementById("chat");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const clearButton = document.getElementById("clearButton");

// App state
let recognition = null;
let isListening = false;
let isBusy = false;
let currentLanguage = "en-IN";

// ==========================================
// STATUS
// ==========================================

function setStatus(message, listening = false) {
  statusText.textContent = message;
  reactor.classList.toggle("listening", listening);
}

// ==========================================
// CHAT MESSAGES
// ==========================================

function addMessage(sender, message) {
  const bubble = document.createElement("div");

  bubble.className =
    sender === "JARVIS"
      ? "message jarvis-message"
      : "message user-message";

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = sender;

  const content = document.createElement("div");
  content.textContent = message;

  bubble.appendChild(label);
  bubble.appendChild(content);

  chat.appendChild(bubble);
  chat.scrollTop = chat.scrollHeight;
}

// ==========================================
// LANGUAGE DETECTION FOR SPEECH
// ==========================================

function detectSpeechLanguage(text) {
  // Tamil Unicode character range
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return "ta-IN";
  }

  return "en-IN";
}

// ==========================================
// SPEAK AI RESPONSE
// ==========================================

function speak(message) {
  if (!("speechSynthesis" in window)) {
    setStatus("Reply ready. Speech is unavailable.");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(message);

  currentLanguage = detectSpeechLanguage(message);
  utterance.lang = currentLanguage;
  utterance.rate = 0.95;
  utterance.pitch = 1;

  utterance.onstart = () => {
    setStatus("JARVIS is speaking...");
  };

  utterance.onend = () => {
    setStatus("Systems ready");
  };

  utterance.onerror = () => {
    setStatus("Reply displayed");
  };

  window.speechSynthesis.speak(utterance);
}

// ==========================================
// CONNECT TO CLOUDFLARE AI BACKEND
// ==========================================

async function handleCommand(rawMessage) {
  const message = String(rawMessage || "").trim();

  if (!message || isBusy) {
    return;
  }

  addMessage("YOU", message);

  isBusy = true;
  messageInput.disabled = true;
  micButton.disabled = true;

  setStatus("JARVIS is thinking...");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message
      })
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "The backend returned an invalid response."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error || `Request failed: ${response.status}`
      );
    }

    if (
      typeof data.reply !== "string" ||
      data.reply.trim() === ""
    ) {
      throw new Error("The AI returned an empty reply.");
    }

    addMessage("JARVIS", data.reply);

    speak(data.reply);

  } catch (error) {
    console.error("JARVIS connection error:", error);

    addMessage(
      "JARVIS",
      "I'm unable to connect to my AI service right now. " +
      "Please check your internet connection and try again."
    );

    setStatus("AI connection failed");

  } finally {
    isBusy = false;
    messageInput.disabled = false;
    micButton.disabled = false;
    messageInput.focus();
  }
}

// ==========================================
// VOICE RECOGNITION
// ==========================================

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();

  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = currentLanguage;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;

    micButton.innerHTML =
      "<span>🔴</span> LISTENING...";

    setStatus("Listening — speak now", true);
  };

  recognition.onresult = (event) => {
    const result = event.results[0][0];
    const transcript = result.transcript;

    if (transcript && transcript.trim()) {
      handleCommand(transcript);
    }
  };

  recognition.onerror = (event) => {
    let message = "Voice input failed. Please try again.";

    if (event.error === "not-allowed") {
      message =
        "Microphone permission denied. Allow microphone access in your browser.";
    } else if (event.error === "no-speech") {
      message =
        "No speech detected. Tap the microphone and try again.";
    } else if (event.error === "network") {
      message =
        "Speech recognition network error. Check your internet connection.";
    } else if (event.error === "audio-capture") {
      message =
        "No microphone was detected.";
    }

    setStatus(message);
  };

  recognition.onend = () => {
    isListening = false;

    micButton.innerHTML =
      "<span>🎙</span> TALK TO JARVIS";

    reactor.classList.remove("listening");

    if (
      statusText.textContent === "Listening — speak now"
    ) {
      setStatus("Systems ready");
    }
  };

} else {
  micButton.innerHTML =
    "<span>⌨️</span> TYPE TO JARVIS";

  setStatus(
    "Voice recognition is unsupported here. You can type messages."
  );
}

// ==========================================
// MICROPHONE BUTTON
// ==========================================

micButton.addEventListener("click", () => {
  if (isBusy) {
    setStatus("Please wait for JARVIS to finish.");
    return;
  }

  if (!recognition) {
    messageInput.focus();
    setStatus("Type your question below.");
    return;
  }

  if (isListening) {
    recognition.stop();
    return;
  }

  try {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    recognition.lang = currentLanguage;
    recognition.start();

  } catch (error) {
    console.error("Microphone start error:", error);

    setStatus(
      "Unable to start microphone. Please try again."
    );
  }
});

// ==========================================
// SEND TYPED MESSAGE
// ==========================================

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const message = messageInput.value.trim();

  if (!message || isBusy) {
    return;
  }

  messageInput.value = "";
  handleCommand(message);
});

// ==========================================
// QUICK COMMANDS
// ==========================================

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    if (isBusy) {
      return;
    }

    const command = button.dataset.command;

    if (command) {
      handleCommand(command);
    }
  });
});

// ==========================================
// CLEAR CHAT
// ==========================================

clearButton.addEventListener("click", () => {
  if (isBusy) {
    return;
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  if (isListening && recognition) {
    recognition.stop();
  }

  chat.replaceChildren();

  addMessage(
    "JARVIS",
    "Conversation cleared. How can I help you?"
  );

  setStatus("Systems ready");
});

// ==========================================
// INITIALIZE JARVIS
// ==========================================

setStatus("Systems ready");

console.log("JARVIS AI interface initialized.");
