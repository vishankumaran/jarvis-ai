
/* ==========================================================
   J.A.R.V.I.S 2.0 — COMPLETE JAVASCRIPT
   Professional Voice | Voice Recognition | Smart Commands
   ========================================================== */

"use strict";

const JARVIS = (() => {

    /* ======================================================
       1. CONFIGURATION
       ====================================================== */

    const CONFIG = {
        assistantName: "JARVIS",
        language: "en-IN",
        voiceRate: 0.92,
        voicePitch: 0.95,
        voiceVolume: 1,
        storageKey: "jarvis_preferences_v2",
        recognitionLanguage: "en-IN",
        typingDelay: 450
    };

    /* ======================================================
       2. DOM ELEMENTS
       ====================================================== */

    const $ = (id) => document.getElementById(id);

    const elements = {
        systemStatus: $("systemStatus"),
        settingsButton: $("settingsButton"),
        clock: $("clock"),
        date: $("date"),
        reactor: $("reactor"),
        coreStatus: $("coreStatus"),

        chatBox: $("chatBox"),
        typingIndicator: $("typingIndicator"),
        userInput: $("userInput"),

        sendButton: $("sendButton"),
        micButton: $("micButton"),
        speakButton: $("speakButton"),
        stopButton: $("stopButton"),
        clearButton: $("clearButton"),

        voiceModuleStatus: $("voiceModuleStatus"),
        aiModuleStatus: $("aiModuleStatus"),

        settingsPanel: $("settingsPanel"),
        closeSettings: $("closeSettings"),
        saveSettings: $("saveSettings"),

        voiceEnabled: $("voiceEnabled"),
        autoSpeak: $("autoSpeak"),
        soundEnabled: $("soundEnabled"),

        notification: $("notification")
    };

    /* ======================================================
       3. APPLICATION STATE
       ====================================================== */

    const state = {
        isListening: false,
        isSpeaking: false,
        isProcessing: false,
        recognition: null,
        voices: [],
        selectedVoice: null,
        currentUtterance: null,
        lastResponse: "",
        preferences: {
            voiceEnabled: true,
            autoSpeak: true,
            soundEnabled: false,
            language: "en-IN"
        }
    };

    /* ======================================================
       4. PREFERENCES
       ====================================================== */

    function loadPreferences() {
        try {
            const saved = localStorage.getItem(CONFIG.storageKey);

            if (saved) {
                const parsed = JSON.parse(saved);

                state.preferences = {
                    ...state.preferences,
                    ...parsed
                };
            }
        } catch (error) {
            console.warn("Preferences could not be loaded:", error);
        }

        updateSettingsUI();
    }

    function savePreferences() {
        try {
            localStorage.setItem(
                CONFIG.storageKey,
                JSON.stringify(state.preferences)
            );

            showNotification("Settings saved successfully");
        } catch (error) {
            console.warn("Preferences could not be saved:", error);
            showNotification("Unable to save settings");
        }
    }

    function updateSettingsUI() {
        if (elements.voiceEnabled) {
            elements.voiceEnabled.checked =
                state.preferences.voiceEnabled;
        }

        if (elements.autoSpeak) {
            elements.autoSpeak.checked =
                state.preferences.autoSpeak;
        }

        if (elements.soundEnabled) {
            elements.soundEnabled.checked =
                state.preferences.soundEnabled;
        }
    }

    function readSettingsUI() {
        if (elements.voiceEnabled) {
            state.preferences.voiceEnabled =
                elements.voiceEnabled.checked;
        }

        if (elements.autoSpeak) {
            state.preferences.autoSpeak =
                elements.autoSpeak.checked;
        }

        if (elements.soundEnabled) {
            state.preferences.soundEnabled =
                elements.soundEnabled.checked;
        }
    }

    /* ======================================================
       5. PROFESSIONAL VOICE ENGINE
       ====================================================== */

    function loadVoices() {
        if (!("speechSynthesis" in window)) {
            updateVoiceStatus("Unavailable");
            return;
        }

        state.voices = window.speechSynthesis.getVoices();

        if (!state.voices.length) return;

        selectProfessionalVoice();
        updateVoiceStatus("Ready");
    }

    function selectProfessionalVoice() {
        if (!state.voices.length) return;

        const voices = state.voices;

        // Preferred voice order:
        // Indian English → British English → US English

        const priorities = [
            /en-IN.*prabhat/i,
            /prabhat/i,
            /en-IN/i,
            /english.*india/i,
            /en-GB/i,
            /en-US/i,
            /english/i
        ];

        let selected = null;

        for (const pattern of priorities) {
            selected = voices.find(voice =>
                pattern.test(
                    voice.name + " " + voice.lang
                )
            );

            if (selected) break;
        }

        state.selectedVoice = selected || voices[0];

        console.log(
            "JARVIS selected voice:",
            state.selectedVoice.name
        );
    }

    function updateVoiceStatus(message) {
        if (elements.voiceModuleStatus) {
            elements.voiceModuleStatus.textContent = message;
        }
    }

    function speak(text) {
        if (!text || !state.preferences.voiceEnabled) return;

        if (!("speechSynthesis" in window)) {
            showNotification("Speech output is not supported");
            return;
        }

        stopSpeech();

        const utterance = new SpeechSynthesisUtterance(text);

        utterance.lang = CONFIG.language;
        utterance.rate = CONFIG.voiceRate;
        utterance.pitch = CONFIG.voicePitch;
        utterance.volume = CONFIG.voiceVolume;

        if (state.selectedVoice) {
            utterance.voice = state.selectedVoice;
        }

        utterance.onstart = () => {
            state.isSpeaking = true;
            updateCoreStatus("SPEAKING");
            updateVoiceStatus("Speaking");

            if (elements.reactor) {
                elements.reactor.classList.add("speaking");
            }
        };

        utterance.onend = () => {
            state.isSpeaking = false;
            state.currentUtterance = null;

            updateCoreStatus("ONLINE");
            updateVoiceStatus("Ready");

            if (elements.reactor) {
                elements.reactor.classList.remove("speaking");
            }
        };

        utterance.onerror = (event) => {
            console.warn("Speech error:", event.error);

            state.isSpeaking = false;
            state.currentUtterance = null;

            updateCoreStatus("ONLINE");
            updateVoiceStatus("Ready");

            if (elements.reactor) {
                elements.reactor.classList.remove("speaking");
            }
        };

        state.currentUtterance = utterance;

        window.speechSynthesis.speak(utterance);
    }

    function stopSpeech() {
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }

        state.isSpeaking = false;
        state.currentUtterance = null;

        if (elements.reactor) {
            elements.reactor.classList.remove("speaking");
        }

        updateCoreStatus("ONLINE");
        updateVoiceStatus("Ready");
    }

    /* ======================================================
       6. CHAT MESSAGE SYSTEM
       ====================================================== */

    function createMessage(text, sender = "assistant") {
        if (!elements.chatBox) return;

        const message = document.createElement("div");

        message.className =
            sender === "user"
                ? "message user-message"
                : "message assistant-message";

        const content = document.createElement("div");
        content.className = "message-content";

        const label = document.createElement("div");
        label.className = "message-label";

        label.textContent =
            sender === "user" ? "YOU" : "J.A.R.V.I.S";

        const body = document.createElement("div");
        body.className = "message-text";

        // textContent prevents command text from being
        // interpreted as HTML.

        body.textContent = text;

        content.appendChild(label);
        content.appendChild(body);

        message.appendChild(content);

        elements.chatBox.appendChild(message);

        elements.chatBox.scrollTop =
            elements.chatBox.scrollHeight;

        return message;
    }

    function clearChat() {
        if (!elements.chatBox) return;

        elements.chatBox.innerHTML = "";

        createMessage(
            "Conversation cleared. All systems are online. How may I assist you?"
        );

        showNotification("Conversation cleared");
    }

    /* ======================================================
       7. NOTIFICATION SYSTEM
       ====================================================== */

    let notificationTimeout;

    function showNotification(message) {
        if (!elements.notification) {
            console.log(message);
            return;
        }

        elements.notification.textContent = message;
        elements.notification.classList.add("show");

        clearTimeout(notificationTimeout);

        notificationTimeout = setTimeout(() => {
            elements.notification.classList.remove("show");
        }, 2500);
    }

    /* ======================================================
       8. SYSTEM STATUS
       ====================================================== */

    function updateCoreStatus(status) {
        if (elements.coreStatus) {
            elements.coreStatus.textContent = status;
        }
    }

    function updateSystemStatus(status) {
        if (elements.systemStatus) {
            elements.systemStatus.textContent = status;
        }
    }

    function updateClock() {
        const now = new Date();

        if (elements.clock) {
            elements.clock.textContent =
                now.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true
                });
        }

        if (elements.date) {
            elements.date.textContent =
                now.toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                });
        }
    }

    /* ======================================================
       9. LOCAL COMMAND INTELLIGENCE
       ====================================================== */

    function getLocalResponse(command) {
        const text = command.toLowerCase().trim();

        const now = new Date();

        const time = now.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });

        const date = now.toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });

        // Greeting commands

        if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(text)) {
            return "Hello! JARVIS systems are online. I am ready to assist you.";
        }

        if (text.includes("how are you")) {
            return "All systems are functioning normally. Thank you for asking.";
        }

        // Identity

        if (
            text.includes("who are you") ||
            text.includes("your name")
        ) {
            return "I am JARVIS, your personal digital assistant interface.";
        }

        if (text.includes("who created you")) {
            return "I was configured as your personal assistant project.";
        }

        // Time and date

        if (text.includes("time")) {
            return `The current time is ${time}.`;
        }

        if (
            text.includes("date") ||
            text.includes("today")
        ) {
            return `Today is ${date}.`;
        }

        // System status

        if (
            text.includes("system status") ||
            text.includes("status report")
        ) {
            return "System status: Interface online, local command engine active, speech module available when supported by your browser.";
        }

        // Help

        if (
            text === "help" ||
            text.includes("what can you do")
        ) {
            return "I can respond to basic commands, tell you the time and date, use voice recognition when supported, and speak responses. My AI connection is not configured in this local version.";
        }

        // Jokes

        if (
            text.includes("tell me a joke") ||
            text.includes("make me laugh")
        ) {
            return "Why did the computer go to the doctor? Because it had a virus!";
        }

        // Mathematics

        if (text.startsWith("calculate ")) {
            return calculateExpression(
                text.replace("calculate ", "")
            );
        }

        // Weather: no live weather service connected

        if (text.includes("weather")) {
            return "Live weather information is not connected yet. An online weather service is needed for current forecasts.";
        }

        // Music

        if (
            text.includes("play music") ||
            text.includes("play song")
        ) {
            return "Music playback is not connected yet. A music source and playback feature must be added.";
        }

        // Goodbye

        if (
            text.includes("goodbye") ||
            text.includes("good bye")
        ) {
            return "Goodbye. JARVIS will be ready when you return.";
        }

        // Unknown command

        return "I understood your command, but this local version does not have an answer for it yet. An AI backend connection is required for more advanced conversations.";
    }

    /* ======================================================
       10. BASIC CALCULATOR
       ====================================================== */

    function calculateExpression(expression) {
        const safeExpression = expression.replace(/\s+/g, "");

        // Only allow simple arithmetic characters.
        if (!/^[0-9+\-*/().%]+$/.test(safeExpression)) {
            return "I can only calculate basic arithmetic expressions in this version.";
        }

        try {
            // Restricted arithmetic expression evaluation.
            const result = Function(
                `"use strict"; return (${safeExpression});`
            )();

            if (
                typeof result !== "number" ||
                !Number.isFinite(result)
            ) {
                return "Please provide a valid calculation.";
            }

            return `The answer is ${result}.`;

        } catch (error) {
            return "I could not calculate that expression. Please check it.";
        }
    }

    /* ======================================================
       11. COMMAND PROCESSING
       ====================================================== */

    async function processCommand(command) {
        const cleanCommand = command.trim();

        if (!cleanCommand || state.isProcessing) return;

        state.isProcessing = true;

        createMessage(cleanCommand, "user");

        updateCoreStatus("PROCESSING");

        if (elements.typingIndicator) {
            elements.typingIndicator.classList.add("active");
        }

        try {
            const response = getLocalResponse(cleanCommand);

            await new Promise(resolve =>
                setTimeout(resolve, CONFIG.typingDelay)
            );

            state.lastResponse = response;

            createMessage(response, "assistant");

            if (state.preferences.autoSpeak) {
                speak(response);
            }

        } catch (error) {
            console.error("Command processing error:", error);

            createMessage(
                "An unexpected error occurred while processing that command."
            );

        } finally {
            state.isProcessing = false;

            if (elements.typingIndicator) {
                elements.typingIndicator.classList.remove("active");
            }

            updateCoreStatus("ONLINE");
        }
    }

    /* ======================================================
       12. VOICE RECOGNITION
       ====================================================== */

    function setupVoiceRecognition() {
        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            updateVoiceStatus("Not supported");

            if (elements.micButton) {
                elements.micButton.disabled = true;
                elements.micButton.title =
                    "Voice recognition is not supported in this browser";
            }

            return;
        }

        const recognition = new SpeechRecognition();

        recognition.lang = CONFIG.recognitionLanguage;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            state.isListening = true;

            updateCoreStatus("LISTENING");
            updateVoiceStatus("Listening");

            if (elements.micButton) {
                elements.micButton.classList.add("active");
            }

            showNotification("JARVIS is listening...");
        };

        recognition.onresult = (event) => {
            let finalTranscript = "";
            let interimTranscript = "";

            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {
                const transcript =
                    event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (elements.userInput) {
                elements.userInput.value =
                    finalTranscript || interimTranscript;
            }

            if (finalTranscript.trim()) {
                if (elements.userInput) {
                    elements.userInput.value = "";
                }

                processCommand(finalTranscript);
            }
        };

        recognition.onerror = (event) => {
            console.warn("Recognition error:", event.error);

            state.isListening = false;

            updateCoreStatus("ONLINE");
            updateVoiceStatus("Ready");

            if (elements.micButton) {
                elements.micButton.classList.remove("active");
            }

            if (event.error !== "no-speech" &&
                event.error !== "aborted") {
                showNotification(
                    "Voice recognition error: " + event.error
                );
            }
        };

        recognition.onend = () => {
            state.isListening = false;

            updateCoreStatus("ONLINE");
            updateVoiceStatus("Ready");

            
