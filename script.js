"use strict";

/* ============================================
   J.A.R.V.I.S. ADVANCED INTERACTION ENGINE
   VERSION 2.0.0
   ============================================ */

const JARVIS = (() => {

  /* ==========================================
     CONFIGURATION
     ========================================== */

  const CONFIG = {
    name: "JARVIS",
    language: "en-IN",
    speechRate: 0.95,
    speechPitch: 0.9,
    maximumCommandLength: 1000,
    typingDelay: 350,
    storageKey: "jarvis_preferences_v2"
  };

  /* ==========================================
     DOM ELEMENTS
     ========================================== */

  const elements = {
    clock: document.getElementById("clock"),
    date: document.getElementById("date"),

    input: document.getElementById("userInput"),
    chat: document.getElementById("chatBox"),

    send: document.getElementById("sendButton"),
    microphone: document.getElementById("micButton"),
    speak: document.getElementById("speakButton"),
    stop: document.getElementById("stopButton"),
    clear: document.getElementById("clearButton"),

    reactor: document.getElementById("reactor"),
    coreStatus: document.getElementById("coreStatus"),

    systemStatus: document.getElementById("systemStatus"),

    typing: document.getElementById("typingIndicator"),

    voiceStatus: document.getElementById("voiceModuleStatus"),
    aiStatus: document.getElementById("aiModuleStatus"),

    settings: document.getElementById("settingsPanel"),
    settingsButton: document.getElementById("settingsButton"),
    closeSettings: document.getElementById("closeSettings"),
    saveSettings: document.getElementById("saveSettings"),

    voiceEnabled: document.getElementById("voiceEnabled"),
    autoSpeak: document.getElementById("autoSpeak"),
    soundEnabled: document.getElementById("soundEnabled"),

    notification: document.getElementById("notification")
  };

  /* ==========================================
     APPLICATION STATE
     ========================================== */

  const state = {
    listening: false,
    processing: false,
    recognition: null,
    recognitionSupported: false,
    speechSupported: "speechSynthesis" in window,
    lastResponse: "Hello Commander. I am ready.",
    preferences: {
      voiceEnabled: true,
      autoSpeak: true,
      soundEnabled: false
    },
    notificationTimer: null
  };

  /* ==========================================
     STORAGE SYSTEM
     ========================================== */

  function loadPreferences() {
    try {
      const saved = localStorage.getItem(CONFIG.storageKey);

      if (!saved) return;

      const parsed = JSON.parse(saved);

      if (!parsed || typeof parsed !== "object") return;

      state.preferences = {
        voiceEnabled: parsed.voiceEnabled !== false,
        autoSpeak: parsed.autoSpeak !== false,
        soundEnabled: parsed.soundEnabled === true
      };

    } catch (error) {
      console.warn("JARVIS: Preferences unavailable.", error);
    }
  }

  function savePreferences() {
    try {
      localStorage.setItem(
        CONFIG.storageKey,
        JSON.stringify(state.preferences)
      );

      return true;

    } catch (error) {
      console.warn("JARVIS: Could not save preferences.", error);
      return false;
    }
  }

  function syncSettings() {
    elements.voiceEnabled.checked =
      state.preferences.voiceEnabled;

    elements.autoSpeak.checked =
      state.preferences.autoSpeak;

    elements.soundEnabled.checked =
      state.preferences.soundEnabled;
  }

  /* ==========================================
     NOTIFICATION SYSTEM
     ========================================== */

  function notify(message) {
    elements.notification.textContent = message;
    elements.notification.classList.add("show");

    if (state.notificationTimer) {
      clearTimeout(state.notificationTimer);
    }

    state.notificationTimer = setTimeout(() => {
      elements.notification.classList.remove("show");
    }, 2600);
  }

  /* ==========================================
     CLOCK ENGINE
     ========================================== */

  function updateClock() {
    const now = new Date();

    elements.clock.textContent =
      now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      });

    elements.date.textContent =
      now.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
  }

  /* ==========================================
     INTERFACE STATUS
     ========================================== */

  function setStatus(message) {
    elements.coreStatus.textContent = message;
  }

  function setReactorMode(mode) {
    elements.reactor.classList.remove(
      "listening",
      "processing"
    );

    if (mode === "listening") {
      elements.reactor.classList.add("listening");
    }

    if (mode === "processing") {
      elements.reactor.classList.add("processing");
    }
  }

  /* ==========================================
     CHAT SYSTEM
     ========================================== */

  function createMessage(message, sender) {
    const row = document.createElement("div");

    row.className =
      sender === "user"
        ? "chat-message user-message"
        : "chat-message jarvis-message";

    const avatar = document.createElement("div");
    avatar.className = "avatar";

    avatar.textContent =
      sender === "user" ? "C" : "J";

    const content = document.createElement("div");
    content.className = "message-content";

    const author = document.createElement("span");
    author.className = "message-author";

    author.textContent =
      sender === "user" ? "COMMANDER" : "JARVIS SYSTEM";

    const paragraph = document.createElement("p");
    paragraph.textContent = message;

    const time = document.createElement("time");

    time.textContent = new Date().toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );

    content.append(author, paragraph, time);
    row.append(avatar, content);

    elements.chat.appendChild(row);

    elements.chat.scrollTop =
      elements.chat.scrollHeight;
  }

  function clearChat() {
    elements.chat.replaceChildren();

    createMessage(
      "Conversation cleared. I am ready for your next instruction, Commander.",
      "jarvis"
    );

    state.lastResponse =
      "Conversation cleared. Ready for your next instruction.";

    stopSpeech();

    setStatus("AWAITING COMMAND");
  }

  /* ==========================================
     SPEECH OUTPUT
     ========================================== */

  function stopSpeech() {
    if (!state.speechSupported) return;

    window.speechSynthesis.cancel();
  }

  function speak(message) {
    if (!state.preferences.voiceEnabled) {
      notify("Voice responses are disabled.");
      return;
    }

    if (!state.speechSupported) {
      notify("Speech output is unavailable in this browser.");
      return;
    }

    stopSpeech();

    const utterance =
      new SpeechSynthesisUtterance(message);

    utterance.lang = CONFIG.language;
    utterance.rate = CONFIG.speechRate;
    utterance.pitch = CONFIG.speechPitch;
    utterance.volume = 1;

    utterance.onstart = () => {
      setStatus("VOICE OUTPUT ACTIVE");
    };

    utterance.onend = () => {
      if (!state.listening && !state.processing) {
        setStatus("AWAITING COMMAND");
      }
    };

    utterance.onerror = (event) => {
      console.warn("Speech output error:", event.error);

      if (!state.listening && !state.processing) {
        setStatus("AWAITING COMMAND");
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  /* ==========================================
     COMMAND DATABASE
     ========================================== */

  function getLocalResponse(command) {

    const text = command.toLowerCase().trim();

    const now = new Date();

    if (!text) {
      return "Please provide a command, Commander.";
    }

    // GREETING

    if (
      /\b(hello|hi|hey)\b/.test(text) ||
      text.includes("good morning") ||
      text.includes("good evening")
    ) {
      return "Greetings, Commander. All available local interface systems are ready.";
    }

    // IDENTITY

    if (
      text.includes("your name") ||
      text.includes("who are you")
    ) {
      return "I am JARVIS, your personal artificial intelligence assistant project. My advanced intelligence modules are under development.";
    }

    // CREATOR

    if (
      text.includes("who created you") ||
      text.includes("my creator")
    ) {
      return "I am being developed as your personal JARVIS assistant project.";
    }

    // TIME

    if (
      text.includes("time") &&
      !text.includes("timer")
    ) {
      return "The current time is " +
        now.toLocaleTimeString("en-IN");
    }

    // DATE

    if (
      text.includes("date") ||
      text.includes("today")
    ) {
      return "Today's date is " +
        now.toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric"
        });
    }

    // STATUS

    if (
      text.includes("status") ||
      text.includes("system report")
    ) {
      return "The JARVIS interface is operational. The local command engine is active. Voice recognition support is " +
        (state.recognitionSupported ? "available" : "unavailable") +
        ". External artificial intelligence is not connected yet.";
    }

    // HELP

    if (
      text === "help" ||
      text.includes("what can you do")
    ) {
      return "I can respond to greetings, provide the current time and date, explain my system status, and demonstrate local commands. External AI features will be connected in the next development phase.";
    }

    // STOP SPEAKING

    if (
      text.includes("stop speaking") ||
      text.includes("stop talking")
    ) {
      stopSpeech();
      return "Voice output stopped, Commander.";
    }

    // GREETING PERSONALITY

    if (text.includes("how are you")) {
      return "All available systems are functioning normally. Thank you for asking, Commander.";
    }

    // VERSION

    if (text.includes("version")) {
      return "You are currently using the JARVIS frontend version 2.0.";
    }

    // WEATHER NOTICE

    if (text.includes("weather")) {
      return "Live weather intelligence has not been connected yet. This feature will require an external weather service.";
    }

    // AI STATUS

    if (text.includes("artificial intelligence")) {
      return "My current local demonstration engine uses predefined commands. A real artificial intelligence API will be integrated securely through Cloudflare.";
    }

    // UNKNOWN COMMAND

    return "Command received, Commander. I do not have an intelligent answer for that request yet. My external AI brain is waiting to be connected.";

  }

  /* ==========================================
     PROCESS COMMAND
     ========================================== */

  async function processCommand(command) {

    const cleanCommand = command
      .trim()
      .slice(0, CONFIG.maximumCommandLength);

    if (!cleanCommand || state.processing) {
      return;
    }

    if (
      cleanCommand.toLowerCase() === "stop speaking" ||
      cleanCommand.toLowerCase() === "stop talking"
    ) {
      stopSpeech();
    }

    state.processing = true;

    createMessage(cleanCommand, "user");

    elements.typing.hidden = false;

    setStatus("ANALYZING COMMAND");
    setReactorMode("processing");

    const response = getLocalResponse(cleanCommand);

    state.lastResponse = response;

    await new Promise(resolve => {
      setTimeout(resolve, CONFIG.typingDelay);
    });

    createMessage(response, "jarvis");

    elements.typing.hidden = true;

    state.processing = false;

    setReactorMode("idle");

    if (
      state.preferences.autoSpeak &&
      !cleanCommand.toLowerCase().includes("stop speaking") &&
      !cleanCommand.toLowerCase().includes("stop talking")
    ) {
      speak(response);
    } else {
      setStatus("AWAITING COMMAND");
    }

  }

  /* ==========================================
     TEXT COMMAND INPUT
     ========================================== */

  function sendCommand() {

    const command = elements.input.value.trim();

    if (!command) {
      notify("Enter a command first.");
      return;
    }

    if (state.processing) {
      notify("Please wait for the current response.");
      return;
    }

    elements.input.value = "";

    processCommand(command);
  }

  /* ==========================================
     SPEECH RECOGNITION
     ========================================== */

  function setupVoiceRecognition() {

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

      state.recognitionSupported = false;

      elements.voiceStatus.textContent =
        "Not supported";

      elements.microphone.disabled = true;
      elements.microphone.title =
        "Speech recognition is unavailable in this browser.";

      return;
    }

    state.recognitionSupported = true;

    const recognition = new SpeechRecognition();

    state.recognition = recognition;

    recognition.lang = CONFIG.language;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    elements.voiceStatus.textContent = "Available";

    recognition.onstart = () => {

      state.listening = true;

      setReactorMode("listening");

      elements.microphone.classList.add("active");

      setStatus("LISTENING TO COMMAND");

      elements.systemStatus.textContent = "VOICE ACTIVE";

    };

    recognition.onresult = (event) => {

      const result =
        event.results[0][0].transcript;

      elements.input.value = result;

      processCommand(result);

    };

    recognition.onerror = (event) => {

      console.warn("Recognition error:", event.error);

      const errors = {
        "not-allowed": "Microphone permission denied.",
        "audio-capture": "No microphone was detected.",
        "network": "Speech service network error.",
        "no-speech": "No speech was detected."
      };

      notify(
        errors[event.error] ||
        "Voice recognition error: " + event.error
      );

    };

    recognition.onend = () => {

      state.listening = false;

      setReactorMode("idle");

      elements.microphone.classList.remove("active");

      elements.systemStatus.textContent =
        "SYSTEM ONLINE";

      if (!state.processing) {
        setStatus("AWAITING COMMAND");
      }

    };

  }

  function activateMicrophone() {

    if (!state.recognitionSupported) {
      notify("Speech recognition is not supported.");
      return;
    }

    if (state.listening) {

      state.recognition.stop();

      return;
    }

    if (state.processing) {
      notify("Wait until the current command finishes.");
      return;
    }

    try {

      state.recognition.start();

    } catch (error) {

      console.error("Microphone activation:", error);

      notify("Unable to start microphone. Please try again.");

    }

  }

  /* ==========================================
     QUICK COMMAND BUTTONS
     ========================================== */

  function setupQuickCommands() {

    const buttons = document.querySelectorAll(
      ".quick-card"
    );

    buttons.forEach(button => {

      button.addEventListener("click", () => {

        const command = button.dataset.command;

        if (!command) return;

        processCommand(command);

      });

    });

  }

  /* ==========================================
     SETTINGS
     ========================================== */

  function openSettings() {
    elements.settings.hidden = false;

    elements.settings.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  function closeSettings() {
    elements.settings.hidden = true;
  }

  function saveSettings() {

    state.preferences.voiceEnabled =
      elements.voiceEnabled.checked;

    state.preferences.autoSpeak =
      elements.autoSpeak.checked;

    state.preferences.soundEnabled =
      elements.soundEnabled.checked;

    const saved = savePreferences();

    closeSettings();

    notify(
      saved
        ? "JARVIS settings saved."
        : "Settings applied for this session."
    );

  }

  /* ==========================================
     EVENT LISTENERS
     ========================================== */

  function setupEvents() {

    elements.send.addEventListener(
      "click",
      sendCommand
    );

    elements.input.addEventListener(
      "keydown",
      event => {

        if (event.key === "Enter") {
          event.preventDefault();
          sendCommand();
        }

      }
    );

    elements.microphone.addEventListener(
      "click",
      activateMicrophone
    );

    elements.speak.addEventListener(
      "click",
      () => speak(state.lastResponse)
    );

    elements.stop.addEventListener(
      "click",
      () => {

        stopSpeech();

        if (state.listening) {
          state.recognition.stop();
        }

        notify("Voice activity stopped.");

        setStatus("AWAITING COMMAND");

      }
    );

    elements.clear.addEventListener(
      "click",
      clearChat
    );

    elements.settingsButton.addEventListener(
      "click",
      openSettings
    );

    elements.closeSettings.addEventListener(
      "click",
      closeSettings
    );

    elements.saveSettings.addEventListener(
      "click",
      saveSettings
    );

    document.addEventListener(
      "visibilitychange",
      () => {

        if (document.hidden && state.listening) {
          try {
            state.recognition.stop();
          } catch (error) {
            console.warn(error);
          }
        }

      }
    );

  }

  /* ==========================================
     INITIALIZATION
     ========================================== */

  function initialize() {

    loadPreferences();

    syncSettings();

    updateClock();

    setInterval(updateClock, 1000);

    setupVoiceRecognition();

    setupQuickCommands();

    setupEvents();

    elements.aiStatus.textContent =
      "Backend not connected";

    elements.systemStatus.textContent =
      "SYSTEM ONLINE";

    setStatus("AWAITING COMMAND");

    console.log(
      "JARVIS 2.0 initialized successfully."
    );

    console.log(
      "AI backend: Awaiting secure integration."
    );

  }

  /* ==========================================
     PUBLIC METHODS
     ========================================== */

  return {
    initialize,
    processCommand,
    speak,
    stopSpeech,
    clearChat
  };

})();

/* ============================================
   START APPLICATION
   ============================================ */

if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    JARVIS.initialize,
    { once: true }
  );

} else {

  JARVIS.initialize();

      }
