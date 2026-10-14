
"use strict";

// Your Cloudflare Worker endpoint.
// Never put your OpenAI API key in this file.
const API_URL =
  "https://jarvis-ai-backend.kumaranvishan.workers.dev/chat";

const micButton = document.getElementById("micButton");
const statusText = document.getElementById("statusText");
const chat = document.getElementById("chat");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const clearButton = document.getElementById("clearButton");

let recognition = null;
let isListening = false;
let isBusy = false;

function setStatus(message) {
  statusText.textContent = message;
}

function addMessage(text, sender = "assistant") {
  const row = document.createElement("div");
  row.className =
    sender === "user"
      ? "message user-message"
      : "message assistant-message";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = sender === "user" ? "Y" : "J";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  row.append(avatar, bubble);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.lang = "en-US";

  window.speechSynthesis.speak(utterance);
}

function getLocalReply(message) {
  const text = message.toLowerCase().trim();

  if (/^(hi|hello|hey|vanakkam)\b/.test(text)) {
    return "Hello! I'm JARVIS, your personal AI assistant. How can I help you?";
  }

  if (text.includes("what time") || text === "time") {
    return "The current time on your device is " +
      new Date().toLocaleTimeString();
  }

  if (text.includes("today's date") ||
      text.includes("what date") ||
      text === "date") {
    return "Today's date is " + new Date().toLocaleDateString();
  }

  if (text.includes("fun fact")) {
    return "Fun fact: A day on Venus is longer than its year!";
  }

  if (text.includes("say hello in tamil") ||
      text.includes("tamil greeting")) {
    return "வணக்கம்! எப்படி இருக்கிறீர்கள்?";
  }

  if (text.includes("teach me one english word")) {
    return 'English word: "Curious". It means wanting to learn or know something. Example: "I am curious about space."';
  }

  return null;
}

async function askAI(message) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ||
      `The AI server returned error ${response.status}.`
    );
  }

  if (!data.reply) {
    throw new Error("JARVIS received an empty reply from the server.");
  }

  return data.reply;
}

async function handleCommand(message) {
  const cleanedMessage = message.trim();
  if (!cleanedMessage || isBusy) return;

  isBusy = true;
  sendButton.disabled = true;
  messageInput.disabled = true;

  addMessage(cleanedMessage, "user");
  setStatus("JARVIS is thinking...");

  try {
    // Simple commands work locally without calling the AI service.
    const localReply = getLocalReply(cleanedMessage);
    const reply = localReply || await askAI(cleanedMessage);

    addMessage(reply, "assistant");
    setStatus("JARVIS is ready");
    speak(reply);
  } catch (error) {
    console.error("JARVIS request failed:", error);

    addMessage(
      "Sorry bro, I couldn't reach the AI service. " +
      (error.message || "Please try again."),
      "assistant"
    );

    setStatus("Connection problem");
  } finally {
    isBusy = false;
    sendButton.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
  }
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = messageInput.value.trim();
  if (!message || isBusy) return;

  messageInput.value = "";
  await handleCommand(message);
});

// Voice input is supported only in browsers that implement
// the Web Speech API. Microphone permission may be required.
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    micButton.classList.add("listening");
    setStatus("Listening... speak now");
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    messageInput.value = transcript;
    handleCommand(transcript);
  };

  recognition.onerror = (event) => {
    setStatus("Voice input error: " + event.error);
  };

  recognition.onend = () => {
    isListening = false;
    micButton.classList.remove("listening");

    if (!isBusy) setStatus("JARVIS is ready");
  };
} else {
  micButton.title =
    "Voice input is not supported in this browser. Please type instead.";
}

micButton.addEventListener("click", () => {
  if (!recognition) {
    setStatus("Voice input is not supported here. Please type your message.");
    return;
  }

  if (isListening) {
    recognition.stop();
  } else if (!isBusy) {
    try {
      recognition.start();
    } catch (error) {
      setStatus("Please wait a moment and try the microphone again.");
    }
  }
});

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    handleCommand(button.dataset.command);
  });
});

clearButton.addEventListener("click", () => {
  chat.replaceChildren();
  addMessage("Chat cleared. What would you like to do next?");
  setStatus("JARVIS is ready");

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
});

setStatus("JARVIS is ready");
