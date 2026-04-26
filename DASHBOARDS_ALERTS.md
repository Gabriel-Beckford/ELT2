# Voice Application Dashboard & Alerts

Because this is a serverless frontend/backend running on Cloud Run, and not deeply integrated with specific APM tools (like Datadog or Prometheus) out of the box, we output structured JSON logs directly to Standard Out (`console.log`/`console.error`).

These logs automatically stream to **Google Cloud Logging** (if deployed on Google Cloud) or other log aggregators parsing STDOUT.

## Example Log Metric Output
\`\`\`json
{ "event": "STT_START", "requestId": "abcd-...", "params": { "size": 1234, "type": "audio/webm" } }
{ "event": "STT_SUCCESS", "requestId": "abcd-...", "durationMs": 1050, "wordCount": 14 }
{ "event": "LLM_SUCCESS", "requestId": "abcd-...", "durationMs": 1500, "responseTokens": 120 }
{ "event": "TTS_SUCCESS", "requestId": "abcd-...", "durationMs": 850, "bufferSize": 250000 }
\`\`\`

## Recommended Dashboard Queries

### 1. End-To-End Latency
Calculate latency by summing `durationMs` across `STT_SUCCESS`, `LLM_SUCCESS`, `TTS_SUCCESS` per `requestId`.
*Alert:* If `P95(STT + LLM + TTS) > 5000ms`.

### 2. Failure Rates (Elevated errors)
Monitor the frequency of `*_ERROR` events.
*Alert:* If the error rate for `STT_ERROR`, `LLM_ERROR`, or `TTS_ERROR` > **5%** over a 5-minute rolling window.
*Filter for severity:* You can ignore `invalid_audio` or `invalid_input` from being critical pager-alerts, but `network_failure` and `rate_limit` indicate backend exhaustion.

### 3. Rate Limit Tracking
Since we use external APIs (Gemini & ElevenLabs), alert on `RATE_LIMIT` errors gracefully handled for users, indicating quota should be raised in those providers.
*Alert:* If `RATE_LIMIT` > 1 in any rolling window.

## User-Safe Error Handling
The backend catches provider errors and throws obfuscated fallback errors to the user:
- `invalid_audio`: "Invalid audio file detected. Please check your microphone."
- `rate_limit`: "Voice service is currently busy. Please try again."
- `safety_filter`: "I cannot process that request."
- `network_failure`: "Network error occurred while processing audio. Please try again."
