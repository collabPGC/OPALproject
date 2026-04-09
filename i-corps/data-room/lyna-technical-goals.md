# LYNA Pre-Fundraise Technical Goals

## Voice & Audio Pipeline (Highest Priority)

1. Build a bench prototype of the audio capture system — microphone, basic noise suppression, wake-word detection. Doesn't need to be on custom hardware yet. Can run on a dev board with an external mic.

2. Record a voiceprint enrollment flow. Nurse speaks a set of sample phrases, system builds a voice profile. Prove the enrollment works and the system can distinguish the enrolled voice from a second speaker in the same room.

3. Test wake-word detection at escalating noise levels — start at 60dB (normal conversation), then 70dB (busy unit), then 80dB (alarms firing). Document accuracy at each level.

4. Build a basic speech-to-text pipeline from wake-word to parsed command. "Hey LYNA, what's the hypokalemia protocol" goes in, a structured query comes out. Can use Whisper or Deepgram for the transcription layer.

5. Demonstrate end-to-end voice command: wake word → voice isolation → transcription → intent parsing → response delivered through speaker. Can be rough. Has to work.

## Hardware (Parallel Track)

6. Finalize dev board selection and get the edge computing baseline running — confirm the processor can handle on-device ML inference for voice isolation at acceptable latency.

7. Design the RFID authentication flow. Nurse taps badge or device, system identifies clinician and pulls their patient assignment. Build a working demo.

8. Prototype the bone conduction audio output. Confirm the transducer delivers intelligible speech responses at conversational volume. Test whether the nurse can hear LYNA's response while ambient noise is present.

9. Start enclosure design with infection control constraints — sealed, non-porous, bleach-compatible materials. Doesn't need to be final form factor yet but needs to reflect clinical durability requirements.

10. Magnetic charging proof of concept. Show the device can charge without removing it from a lanyard or clip.

## Software & Integration (Supports the Demo)

11. Build a basic protocol lookup engine. Load one hospital's nursing protocols into a searchable database. When the voice pipeline sends a parsed query, this returns the right protocol. Start with 20–30 common protocols — hypokalemia, fall prevention, blood transfusion, chest pain, etc.

12. Build a basic communication routing layer. "Hey LYNA, page the charge nurse" → system identifies the charge nurse on duty and initiates the page.

13. Stub out the FHIR read integration. Connect to Epic's open sandbox and pull sample lab values. "What's my patient's potassium" returns a real FHIR response. Doesn't need to connect to a live hospital — just prove the data flow works.

14. Build a simple dashboard that logs every voice interaction — what was asked, what was returned, response time, whether the nurse had to repeat.

---

*Source: Slack canvas F0AJF77P7U3, #devdashboard*
