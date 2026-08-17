/**
 * Seaman Dialogue & Voice Engine
 * Handles Seaman's iconic sarcastic personality, speech synthesis out loud (TTS),
 * microphone speech recognition (STT), and context-aware responses.
 */

class DialogueEngine {
    constructor(seaman, tank) {
        this.seaman = seaman;
        this.tank = tank;

        this.speechSynth = window.speechSynthesis;
        this.isSpeaking = false;
        this.currentSpeechText = '';

        // Speech Recognition Setup
        this.recognition = null;
        this.isListening = false;
        this.initSpeechRecognition();

        // Dialogue Memory / History
        this.chatLog = [];
        
        // Personality Response Database
        this.responses = {
            greetings: [
                "Oh... it's you again. Staring into the glass like a confused mammal.",
                "Greetings, human. I hope you brought food and not just empty promises.",
                "Well well. Look who decided to visit my watery prison.",
                "Ah, my favorite hairless ape. What philosophical dilemma brings you here today?"
            ],

            tappedGlass: [
                "Hey! Stop tapping on the glass! How would you like it if I tapped on your skull?",
                "Do you mind? Sound waves travel 4.3 times faster in water. You're giving me a migraine.",
                "Tap tap tap. Is that the only trick you know?",
                "If I had hands, I'd tap back on your screen. Harder."
            ],

            grabbed: [
                "Put me down! I am a creature of dignity, not a sushi roll!",
                "Unflip your fingers from my flesh! Water! I need WATER!",
                "Unhand me, human! You lack aquatic respect!",
                "Are you trying to turn me into a terrestrial amphibian by force?"
            ],

            fed: [
                "Mmm... floating protein pellets. The pinnacle of aquarium gastronomy.",
                "Acceptable. My gastrointestinal tract approves.",
                "You fed me. Does this make you feel like a generous deity?",
                "Chomp. Not bad. Next time, throw in some fresh larvae."
            ],

            tooCold: [
                "Brrr! It's freezing in here! Turn up the heater unless you want a fish popsicle!",
                "My scales are turning blue. Adjust the thermostat, you careless mammal!",
                "Is this an aquarium or an Arctic expedition? Turn the heat on!"
            ],

            tooHot: [
                "It's boiling in here! Am I being soupified?",
                "Turn down the heater! My face is sweating under water, which shouldn't even be physically possible!",
                "Too hot! Adjust the temperature before I turn into boiled cod!"
            ],

            lowOxygen: [
                "Gasp... cough... I need oxygen! Turn on the aerator pump!",
                "The O2 levels are dropping. Do you want me to suffocate while you watch?",
                "Pump air! Turn the aerator ON!"
            ],

            dirtyWater: [
                "This water is dirtier than a sewer pipe. Get the squeegee and clean up!",
                "I can barely see through this green murky sludge. Clean the tank!",
                "Disgusting. Perform maintenance immediately."
            ],

            questions: [
                "Tell me, human... why do you spend so much time looking at screens?",
                "Do you ever wonder if you are inside a virtual simulation created by a fish?",
                "What is your greatest regret in life? Mine is trusting an aquarist with my thermostat.",
                "Do you think my human face makes me look distinguished or terrifying?",
                "If a fish falls in an empty tank and no human is around to tap the glass, does it make a splash?",
                "Are you working hard today, or just pretending to be busy while feeding me?"
            ],

            voiceKeywords: {
                'hello': "Hello yourself. Speak up, the glass is thick.",
                'hi': "Greetings. Are you here to feed me or just chatter?",
                'who are you': "I am Seaman. A creature of intellect, trapped in an aquatic container with your face glued to mine.",
                'food': "Food? Did someone say food? Drop some pellets right now!",
                'cold': "If you're cold, turn up my heater! I'm shivering down here!",
                'hot': "If it's hot, turn off the heater! I'm swimming in broth!",
                'love': "Love? Love is an emotion reserved for land-dwellers who haven't evolved gills yet.",
                'ugly': "Ugly? Have you looked in a mirror lately? We share the same face!",
                'handsome': "Finally, someone with taste. I am indeed the apex of aquatic beauty.",
                'bye': "Leaving so soon? Don't forget to leave the aerator running.",
                'clean': "Yes, clean the tank! Use the squeegee tool!"
            }
        };
    }

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.handleUserSpeechInput(transcript);
            };

            this.recognition.onend = () => {
                this.isListening = false;
                const micBtn = document.getElementById('micBtn');
                if (micBtn) micBtn.classList.remove('active');
            };

            this.recognition.onerror = (err) => {
                console.warn('Speech recognition error:', err);
                this.isListening = false;
                const micBtn = document.getElementById('micBtn');
                if (micBtn) micBtn.classList.remove('active');
            };
        }
    }

    toggleMic() {
        if (!this.recognition) {
            this.logMessage("System", "Voice input (Speech Recognition) is not supported in this browser. Please use the text terminal.");
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
            this.isListening = false;
        } else {
            try {
                this.recognition.start();
                this.isListening = true;
                const micBtn = document.getElementById('micBtn');
                if (micBtn) micBtn.classList.add('active');
                this.logMessage("System", "Listening to your voice... Speak now!");
            } catch (e) {
                console.error(e);
            }
        }
    }

    handleUserSpeechInput(text) {
        this.logMessage("You", text);

        // Analyze text for keywords
        const lower = text.toLowerCase();
        let matchedResponse = null;

        for (let key in this.responses.voiceKeywords) {
            if (lower.includes(key)) {
                matchedResponse = this.responses.voiceKeywords[key];
                break;
            }
        }

        if (!matchedResponse) {
            // Default random response
            const choices = [
                `Interesting point about "${text}". However, as a fish, I must remain skeptical.`,
                `You say "${text}", but have you considered the water temperature first?`,
                `I heard you say "${text}". Fascinating input from a land creature.`,
                `Ah, "${text}". Truly profound. Now drop some food!`
            ];
            matchedResponse = choices[Math.floor(Math.random() * choices.length)];
        }

        this.speak(matchedResponse);
    }

    triggerEventResponse(eventType) {
        if (this.isSpeaking) return; // Don't interrupt active speech

        let list = this.responses[eventType];
        if (!list || list.length === 0) return;

        const text = list[Math.floor(Math.random() * list.length)];
        this.speak(text);
    }

    speak(text) {
        if (!text) return;

        this.currentSpeechText = text;
        this.logMessage("Seaman", text);

        // Trigger mouth motion animation for duration of speech
        const durationSeconds = Math.max(2, text.length * 0.08);
        this.seaman.triggerSpeechMouth(durationSeconds);

        if (this.speechSynth) {
            this.speechSynth.cancel(); // Stop any pending speech

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.05;
            utterance.pitch = 0.85; // Slightly deeper, distinctive Seaman voice tone

            // Pick a male or robotic voice if available
            const voices = this.speechSynth.getVoices();
            const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Male') || v.name.includes('David') || v.name.includes('Google')));
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }

            this.isSpeaking = true;
            utterance.onend = () => { this.isSpeaking = false; };
            utterance.onerror = () => { this.isSpeaking = false; };

            this.speechSynth.speak(utterance);
        }
    }

    logMessage(sender, message) {
        this.chatLog.push({ sender, message, time: new Date().toLocaleTimeString() });
        const consoleEl = document.getElementById('chatConsole');
        if (consoleEl) {
            const entry = document.createElement('div');
            entry.className = `chat-entry ${sender.toLowerCase()}`;
            entry.innerHTML = `<span class="chat-sender">${sender}:</span> <span class="chat-text">${message}</span>`;
            consoleEl.appendChild(entry);
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }
    }
}

window.DialogueEngine = DialogueEngine;
