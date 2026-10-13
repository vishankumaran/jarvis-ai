
"use strict";

// JARVIS — first interactive version

const micButton = document.getElementById("micButton");
const statusText = document.getElementById("statusText");
const reactor = document.getElementById("reactor");
const chat = document.getElementById("chat");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const clearButton = document.getElementById("clearButton");

let recognition = null;
let isListening = false;
let currentLanguage = "en-IN";

// Display a message safely in the conversation.
function addMessage(sender, message) {
  const bubble = document.createElement("div");
  bubble.className =
    sender === "JARVIS" ? "message jarvis-message" : "message user-message";

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

// Update the interface status.
function setStatus(message, listening = false) {
  statusText.textContent = message;
  reactor.classList.toggle("listening", listening);
}

// Speak a reply if speech synthesis is available.
function speak(message, language = currentLanguage) {
  if (!("speechSynthesis" in window)) {
    setStatus("Text reply ready — speech is unsupported here.");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = language;
  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  utterance.onstart = () => setStatus("JARVIS is speaking...");
  utterance.onend = () => setStatus("Systems ready");
  utterance.onerror = () => setStatus("Reply displayed");

  window.speechSynthesis.speak(utterance);
}

// Choose a basic response using keywords.
function getReply(rawMessage) {
  const message = rawMessage.toLowerCase().trim();

  if (/^(hi|hello|hey|hai|vanakkam)\b/.test(message)) {
    return {
      text: "Hello! I am JARVIS, your personal assistant. How can I help you today?",
      lang: "en-IN"
    };
  }

  if (message.includes("time")) {
    return {
      text: "The current time is " +
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        }),
      lang: "en-IN"
    };
  }

  if (message.includes("date") || message.includes("today")) {
    return {
      text: "Today's date is " +
        new Date().toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric"
        }),
      lang: "en-IN"
    };
  }

  if (message.includes("tamil") || message.includes("vanakkam")) {
    return {
      text: "வணக்கம்! நான் ஜார்விஸ். உங்களுக்கு எப்படி உதவ வேண்டும்?",
      lang: "ta-IN"
    };
  }

  if (message.includes("thunglish") || message.includes("thanglish")) {
    return {
      text: "Vanakkam! Naan JARVIS. Sollunga, ungalukku enna help venum?",
      lang: "en-IN"
    };
  }

  if (message.includes("your name") || message.includes("who are you")) {
    return {
      text: "I am JARVIS, your personal assistant interface. My advanced AI features are not connected yet.",
      lang: "en-IN"
    };
  }

  if (message.includes("fun fact")) {
    return {
      text: "Fun fact: Honeybees communicate the location of food using a special movement called the waggle dance.",
      lang: "en-IN"
    };
  }

  if (message.includes("learn english")) {
    return {
      text: "Let's practise! Instead of saying 'I am having a doubt', you can say 'I have a question'. Try speaking a sentence in English.",
      lang: "en-IN"
    };
  }

  if (message.includes("help")) {
    return {
      text: "You can ask me the time, today's date, a fun fact, or a Tamil greeting. You can also type any message. Connecting an AI service will be a later step.",
      lang: "en-IN"
    };
  }

  if (message.includes("thank")) {
    return {
      text: "You're welcome! I'm ready for your next command.",
      lang: "en-IN"
    };
  }

  return {
    text: "I received your message: " + rawMessage +
      ". My AI brain is not connected yet. For now, try asking the time, date, or a fun fact.",
    lang: "en-IN"
  };
}

// Process a typed or recognised command.
function handleCommand(rawMessage) {
  const message = rawMessage.trim();
  if (!message) return;

  addMessage("YOU", message);

  const reply = getReply(message);

  window.setTimeout(() => {
    addMessage("JARVIS", reply.text);
    speak(reply.text, reply.lang);
  }, 250);
}

// Check browser support for speech recognition.
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = currentLanguage;

  recognition.onstart = () => {
    isListening = true;
    micButton.innerHTML = "<span>🔴</span> LISTENING...";
    setStatus("Listening — speak now", true);
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    messageInput.value = "";
    handleCommand(transcript);
  };

  recognition.onerror = (event) => {
    let message = "Microphone error. Please try again.";

    if (event.error === "not-allowed") {
      message = "Microphone permission denied. Allow it in browser settings.";
    } else if (event.error === "no-speech") {
      message = "No speech detected. Tap the microphone and try again.";
    } else if (event.error === "network") {
      message = "Speech recognition network error. Check your connection.";
    }

    setStatus(message);
  };

  recognition.onend = () => {
    isListening = false;
    micButton.innerHTML = "<span>🎙</span> TALK TO JARVIS";
    reactor.classList.remove("listening");

    if (statusText.textContent === "Listening — speak now") {
      setStatus("Systems ready");
    }
  };
} else {
  micButton.innerHTML = "<span>⌨️</span> VOICE UNSUPPORTED";
  setStatus("Type commands below; speech recognition is unavailable.");
}

// Microphone button.
micButton.addEventListener("click", () => {
  if (!recognition) {
    setStatus("Voice input is unsupported in this browser. Try typing.");
    return;
  }

  if (isListening) {
    recognition.stop();
    return;
  }

  try {
    window.speechSynthesis?.cancel();

    // Select the speech recognition language.
    recognition.lang = currentLanguage;
    recognition.start();
  } catch (error) {
    setStatus("Unable to start microphone. Please try again.");
  }
});

// Send typed messages.
chatForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const message = messageInput.value.trim();
  if (!message) return;

  messageInput.value = "";
  handleCommand(message);
});

// Quick command buttons.
document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    handleCommand(button.dataset.command);
  });
});

// Clear the conversation.
clearButton.addEventListener("click", () => {
  window.speechSynthesis?.cancel();

  if (isListening && recognition) {
    recognition.stop();
  }

  chat.replaceChildren();
  addMessage("JARVIS", "Conversation cleared. How can I help you?");
  setStatus("Systems ready");
});

// Initial greeting.
setStatus("Systems ready");
