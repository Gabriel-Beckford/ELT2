# Voice Interaction Workflow

## Overview
This document outlines the architecture and error handling for the single-turn voice interaction flow. 
The flow consists of five main stages: Voice Recording, Speech-to-Text (STT), AI Response Generation, Text-to-Speech (TTS), and Audio Playback.

## Single-Turn Flow

### 1. User Speaks (Voice Recording)
- **Action**: The user presses and holds a button or toggles a recording state to capture audio from their microphone.
- **Constraints**: 
  - Max audio length: **30 seconds**. This ensures predictable latency for the subsequent STT and generative steps.
- **Failure Mode**: Microphone permission denied or hardware unavailable.
  - **User Experience**: Display a toast or inline error: "Microphone access is required to use voice features."
  - **Retry Behavior**: User is prompted to grant permission and try again.

### 2. Speech-to-Text Transcription
- **Action**: Once recording finishes, the audio is sent to ElevenLabs STT for transcription.
- **Constraints**:
  - Expected latency: ~1-2 seconds.
  - Timeout: **5 seconds**.
- **Failure Mode**: Network error, timeout, or unintelligible audio.
  - **User Experience**: "We couldn't catch that. Please try again."
  - **Retry Behavior**: The system does not automatically retry STT. The user must manually speak again.

### 3. Text to Gemini Response
- **Action**: The transcribed text is sent to the Gemini API (Pro/Flash/Flash Lite) to generate a response.
- **Constraints**:
  - Max input tokens: Based on the 30-second audio transcript (typically <100 words).
  - Max output tokens/length: **100-150 tokens** (approx. 2-3 sentences). Keeping the response concise guarantees low latency for TTS generation and avoids overwhelming the user.
  - Timeout: **10 seconds**.
- **Failure Mode**: API timeout, rate limit exceeded, or safety filter triggered.
  - **User Experience**: "Sorry, I'm having trouble thinking right now." (If safety triggered: "I can't respond to that.")
  - **Retry Behavior**: Manual retry by the user. If the error is a `503` or rate limit, a 1-time automatic retry with backoff (e.g., 2 seconds) can be implemented.

### 4. Text-to-Speech Generation
- **Action**: The generated text response string is sent to ElevenLabs TTS to generate the audio buffer.
- **Constraints**:
  - Expected latency: ~1-3 seconds.
  - Timeout: **10 seconds**.
- **Failure Mode**: API timeout or service unavailable.
  - **User Experience**: The system displays the *text* of the Gemini response visually on the screen and says, "Audio playback is currently unavailable."
  - **Retry Behavior**: No automatic retry for audio generation to prevent blocking the visual response. Fall back to reading text visually.

### 5. Audio Playback
- **Action**: The generated TTS audio buffer is played back to the user through their speakers.
- **Constraints**:
  - Playback completes when the audio file ends.
- **Failure Mode**: Autoplay blocked by the browser or unplayable audio format.
  - **User Experience**: "Click to play the response." (Present a manual play button to override browser autoplay restrictions).
  - **Retry Behavior**: Manual interaction to play audio.
