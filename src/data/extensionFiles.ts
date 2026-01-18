export const extensionFiles = {
  "manifest.json": `{
  "manifest_version": 3,
  "name": "Agent-Zero Gesture Control",
  "version": "1.0.0",
  "description": "Control Agent-Zero with hand gestures via webcam",
  "permissions": ["activeTab", "scripting"],
  "host_permissions": ["http://72.60.104.92:50080/*"],
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [
    {
      "matches": ["http://72.60.104.92:50080/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["gesture.js"],
      "matches": ["http://72.60.104.92:50080/*"]
    }
  ]
}`,

  "background.js": `// Background service worker for Agent-Zero Gesture Control
// Handles message passing between popup and content scripts

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Agent-Zero Gesture] Extension installed");
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_STATUS") {
    // Forward status request to active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "GET_STATUS" }, (response) => {
          sendResponse(response || { enabled: false, cameraActive: false });
        });
      } else {
        sendResponse({ enabled: false, cameraActive: false });
      }
    });
    return true; // Keep channel open for async response
  }

  if (message.type === "TOGGLE_GESTURE") {
    // Forward toggle request to active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_GESTURE" }, sendResponse);
      }
    });
    return true;
  }
});`,

  "content.js": `// Content script for Agent-Zero Gesture Control
// Runs only on http://72.60.104.92:50080/*

(function() {
  "use strict";

  // State management
  let gestureEnabled = false;
  let cameraActive = false;
  let lastGesture = null;
  let lastCommand = null;
  let lastCommandTime = 0;
  let videoElement = null;
  let canvasElement = null;
  let handsInstance = null;
  let cameraInstance = null;

  // Configuration
  const CONFIG = {
    CONFIDENCE_THRESHOLD: 0.85,
    COOLDOWN_MS: 2000,
    GESTURE_COMMANDS: {
      "open_palm": "Pause current task",
      "fist": "Stop immediately",
      "two_fingers": "Execute the next task",
      "thumbs_up": "Confirm and proceed"
    }
  };

  // Initialize MediaPipe when gesture control is enabled
  async function initializeMediaPipe() {
    if (handsInstance) return;

    // Load MediaPipe scripts dynamically
    await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");
    await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
    await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js");

    // Create video element for camera feed
    videoElement = document.createElement("video");
    videoElement.id = "gesture-video-feed";
    videoElement.style.cssText = \`
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 200px;
      height: 150px;
      border-radius: 12px;
      border: 3px solid #10b981;
      z-index: 99999;
      transform: scaleX(-1);
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    \`;
    document.body.appendChild(videoElement);

    // Create canvas for drawing landmarks
    canvasElement = document.createElement("canvas");
    canvasElement.id = "gesture-canvas";
    canvasElement.width = 200;
    canvasElement.height = 150;
    canvasElement.style.cssText = \`
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 200px;
      height: 150px;
      border-radius: 12px;
      z-index: 100000;
      pointer-events: none;
      transform: scaleX(-1);
    \`;
    document.body.appendChild(canvasElement);

    // Initialize MediaPipe Hands
    handsInstance = new Hands({
      locateFile: (file) => \`https://cdn.jsdelivr.net/npm/@mediapipe/hands/\${file}\`
    });

    handsInstance.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: CONFIG.CONFIDENCE_THRESHOLD,
      minTrackingConfidence: CONFIG.CONFIDENCE_THRESHOLD
    });

    handsInstance.onResults(onHandResults);

    // Start camera
    cameraInstance = new Camera(videoElement, {
      onFrame: async () => {
        if (gestureEnabled && handsInstance) {
          await handsInstance.send({ image: videoElement });
        }
      },
      width: 640,
      height: 480
    });

    await cameraInstance.start();
    cameraActive = true;
    console.log("[Agent-Zero Gesture] Camera started");
  }

  // Load external script dynamically
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(\`script[src="\${src}"]\`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Process hand detection results
  function onHandResults(results) {
    const canvasCtx = canvasElement.getContext("2d");
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      
      // Draw landmarks
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: "#10b981", lineWidth: 2 });
      drawLandmarks(canvasCtx, landmarks, { color: "#34d399", lineWidth: 1, radius: 3 });

      // Classify gesture
      const gesture = classifyGesture(landmarks);
      
      if (gesture && gesture !== lastGesture) {
        const now = Date.now();
        if (now - lastCommandTime >= CONFIG.COOLDOWN_MS) {
          const command = CONFIG.GESTURE_COMMANDS[gesture];
          if (command) {
            injectCommand(command);
            lastCommand = command;
            lastCommandTime = now;
            showNotification(gesture, command);
          }
        }
        lastGesture = gesture;
      }
    } else {
      lastGesture = null;
    }
  }

  // Rule-based gesture classification
  function classifyGesture(landmarks) {
    // Landmark indices
    const WRIST = 0;
    const THUMB_TIP = 4;
    const INDEX_TIP = 8;
    const MIDDLE_TIP = 12;
    const RING_TIP = 16;
    const PINKY_TIP = 20;
    const INDEX_MCP = 5;
    const MIDDLE_MCP = 9;
    const RING_MCP = 13;
    const PINKY_MCP = 17;
    const THUMB_IP = 3;

    // Helper: check if finger is extended
    function isFingerExtended(tipIdx, mcpIdx) {
      return landmarks[tipIdx].y < landmarks[mcpIdx].y - 0.05;
    }

    // Helper: check if thumb is extended (horizontal check)
    function isThumbExtended() {
      return Math.abs(landmarks[THUMB_TIP].x - landmarks[THUMB_IP].x) > 0.05;
    }

    const indexExtended = isFingerExtended(INDEX_TIP, INDEX_MCP);
    const middleExtended = isFingerExtended(MIDDLE_TIP, MIDDLE_MCP);
    const ringExtended = isFingerExtended(RING_TIP, RING_MCP);
    const pinkyExtended = isFingerExtended(PINKY_TIP, PINKY_MCP);
    const thumbExtended = isThumbExtended();

    // Open Palm: all fingers extended
    if (indexExtended && middleExtended && ringExtended && pinkyExtended && thumbExtended) {
      return "open_palm";
    }

    // Fist: no fingers extended
    if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return "fist";
    }

    // Two Fingers (✌️): index and middle extended, others closed
    if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
      return "two_fingers";
    }

    // Thumbs Up: only thumb extended, hand relatively vertical
    if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      if (landmarks[THUMB_TIP].y < landmarks[WRIST].y) {
        return "thumbs_up";
      }
    }

    return null;
  }

  // Inject command into Agent-Zero input
  function injectCommand(command) {
    // Try multiple selectors to find the input field
    const selectors = [
      'textarea[placeholder*="message"]',
      'textarea[placeholder*="Message"]',
      'input[type="text"][placeholder*="message"]',
      'textarea.chat-input',
      'input.chat-input',
      '#message-input',
      '.message-input textarea',
      '.message-input input',
      'textarea',
      'input[type="text"]'
    ];

    let inputElement = null;
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (el.offsetParent !== null) { // Check if visible
          inputElement = el;
          break;
        }
      }
      if (inputElement) break;
    }

    if (!inputElement) {
      console.error("[Agent-Zero Gesture] Could not find input element");
      showNotification("error", "Input field not found!");
      return;
    }

    // Set the value
    inputElement.focus();
    inputElement.value = command;

    // Dispatch input event to trigger React/Vue state updates
    inputElement.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    inputElement.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));

    // Small delay before sending Enter
    setTimeout(() => {
      // Dispatch Enter key events
      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      inputElement.dispatchEvent(enterEvent);

      // Also try keyup and keypress for compatibility
      inputElement.dispatchEvent(new KeyboardEvent("keypress", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true
      }));
      inputElement.dispatchEvent(new KeyboardEvent("keyup", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true
      }));

      // Try clicking submit button as fallback
      const submitSelectors = [
        'button[type="submit"]',
        'button.send-button',
        '.send-button',
        'button[aria-label*="send"]',
        'button[aria-label*="Send"]',
        'button svg[class*="send"]'
      ];

      for (const selector of submitSelectors) {
        const btn = document.querySelector(selector);
        if (btn && btn.offsetParent !== null) {
          btn.click();
          break;
        }
      }

      console.log("[Agent-Zero Gesture] Command injected:", command);
    }, 100);
  }

  // Show floating notification
  function showNotification(gesture, command) {
    const existing = document.getElementById("gesture-notification");
    if (existing) existing.remove();

    const notification = document.createElement("div");
    notification.id = "gesture-notification";
    notification.innerHTML = \`
      <div style="font-size: 24px; margin-bottom: 8px;">
        \${gesture === "open_palm" ? "✋" : gesture === "fist" ? "✊" : gesture === "two_fingers" ? "✌️" : gesture === "thumbs_up" ? "👍" : "⚠️"}
      </div>
      <div style="font-weight: 600; font-size: 14px;">\${command}</div>
    \`;
    notification.style.cssText = \`
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      z-index: 100001;
      text-align: center;
      box-shadow: 0 8px 32px rgba(16, 185, 129, 0.4);
      animation: slideIn 0.3s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    \`;

    // Add animation keyframes if not exists
    if (!document.getElementById("gesture-styles")) {
      const style = document.createElement("style");
      style.id = "gesture-styles";
      style.textContent = \`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      \`;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease-in forwards";
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  // Cleanup when disabling
  function cleanup() {
    if (cameraInstance) {
      cameraInstance.stop();
      cameraInstance = null;
    }
    if (videoElement) {
      videoElement.remove();
      videoElement = null;
    }
    if (canvasElement) {
      canvasElement.remove();
      canvasElement = null;
    }
    handsInstance = null;
    cameraActive = false;
    console.log("[Agent-Zero Gesture] Cleaned up");
  }

  // Message listener from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_STATUS") {
      sendResponse({
        enabled: gestureEnabled,
        cameraActive: cameraActive,
        lastGesture: lastGesture,
        lastCommand: lastCommand
      });
      return true;
    }

    if (message.type === "TOGGLE_GESTURE") {
      gestureEnabled = !gestureEnabled;
      
      if (gestureEnabled) {
        initializeMediaPipe().catch(err => {
          console.error("[Agent-Zero Gesture] Failed to initialize:", err);
          gestureEnabled = false;
        });
      } else {
        cleanup();
      }

      sendResponse({
        enabled: gestureEnabled,
        cameraActive: cameraActive
      });
      return true;
    }
  });

  console.log("[Agent-Zero Gesture] Content script loaded on", window.location.href);
})();`,

  "popup.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent-Zero Gesture Control</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="logo">✋</div>
      <h1>Gesture Control</h1>
    </header>

    <div class="connection-info">
      <span class="connection-dot"></span>
      <span>Connected to: <strong>72.60.104.92:50080</strong></span>
    </div>

    <div class="toggle-section">
      <label class="toggle-label">
        <span>Enable Gesture Control</span>
        <div class="toggle-switch">
          <input type="checkbox" id="gestureToggle">
          <span class="toggle-slider"></span>
        </div>
      </label>
    </div>

    <div class="status-section">
      <div class="status-item">
        <span class="status-icon" id="cameraIcon">📷</span>
        <span class="status-text">Camera</span>
        <span class="status-badge" id="cameraStatus">Off</span>
      </div>
      <div class="status-item">
        <span class="status-icon" id="gestureIcon">👆</span>
        <span class="status-text">Last Gesture</span>
        <span class="status-badge" id="gestureStatus">None</span>
      </div>
      <div class="status-item">
        <span class="status-icon">📤</span>
        <span class="status-text">Last Command</span>
        <span class="status-badge command" id="commandStatus">None</span>
      </div>
    </div>

    <div class="gesture-guide">
      <h3>Gesture Guide</h3>
      <ul>
        <li><span>✋</span> Open Palm → Pause current task</li>
        <li><span>✊</span> Fist → Stop immediately</li>
        <li><span>✌️</span> Two Fingers → Execute next task</li>
        <li><span>👍</span> Thumbs Up → Confirm and proceed</li>
      </ul>
    </div>

    <div class="warning" id="domainWarning" style="display: none;">
      ⚠️ This extension only works on Agent-Zero (72.60.104.92:50080)
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>`,

  "popup.js": `// Popup script for Agent-Zero Gesture Control

document.addEventListener("DOMContentLoaded", async () => {
  const gestureToggle = document.getElementById("gestureToggle");
  const cameraStatus = document.getElementById("cameraStatus");
  const gestureStatus = document.getElementById("gestureStatus");
  const commandStatus = document.getElementById("commandStatus");
  const domainWarning = document.getElementById("domainWarning");

  // Check if we're on the correct domain
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isValidDomain = tab?.url?.startsWith("http://72.60.104.92:50080");

  if (!isValidDomain) {
    domainWarning.style.display = "block";
    gestureToggle.disabled = true;
    return;
  }

  // Get initial status
  updateStatus();

  // Poll for status updates
  setInterval(updateStatus, 1000);

  // Toggle handler
  gestureToggle.addEventListener("change", async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: "TOGGLE_GESTURE" });
      if (response) {
        updateUI(response);
      }
    } catch (err) {
      console.error("Failed to toggle gesture control:", err);
    }
  });

  async function updateStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
      if (response) {
        updateUI(response);
      }
    } catch (err) {
      // Content script may not be loaded yet
      console.log("Waiting for content script...");
    }
  }

  function updateUI(status) {
    gestureToggle.checked = status.enabled;
    
    // Camera status
    cameraStatus.textContent = status.cameraActive ? "Active" : "Off";
    cameraStatus.className = "status-badge " + (status.cameraActive ? "active" : "");
    
    // Gesture status
    if (status.lastGesture) {
      const gestureLabels = {
        "open_palm": "✋ Open Palm",
        "fist": "✊ Fist",
        "two_fingers": "✌️ Two Fingers",
        "thumbs_up": "👍 Thumbs Up"
      };
      gestureStatus.textContent = gestureLabels[status.lastGesture] || status.lastGesture;
      gestureStatus.className = "status-badge active";
    } else {
      gestureStatus.textContent = "None";
      gestureStatus.className = "status-badge";
    }
    
    // Command status
    if (status.lastCommand) {
      commandStatus.textContent = status.lastCommand;
      commandStatus.className = "status-badge command active";
    } else {
      commandStatus.textContent = "None";
      commandStatus.className = "status-badge command";
    }
  }
});`,

  "popup.css": `/* Agent-Zero Gesture Control - Popup Styles */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: #e2e8f0;
  min-width: 320px;
  max-width: 320px;
}

.container {
  padding: 20px;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo {
  font-size: 32px;
  filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.5));
}

h1 {
  font-size: 18px;
  font-weight: 600;
  background: linear-gradient(135deg, #10b981, #34d399);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 8px;
  font-size: 12px;
  margin-bottom: 16px;
}

.connection-dot {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.toggle-section {
  margin-bottom: 20px;
}

.toggle-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.toggle-label:hover {
  background: rgba(255, 255, 255, 0.08);
}

.toggle-switch {
  position: relative;
  width: 48px;
  height: 26px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #475569;
  border-radius: 26px;
  transition: 0.3s;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.3s;
}

input:checked + .toggle-slider {
  background: linear-gradient(135deg, #10b981, #059669);
}

input:checked + .toggle-slider:before {
  transform: translateX(22px);
}

input:disabled + .toggle-slider {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.status-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.status-text {
  flex: 1;
  font-size: 13px;
  color: #94a3b8;
}

.status-badge {
  padding: 4px 10px;
  background: rgba(100, 116, 139, 0.3);
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  color: #94a3b8;
}

.status-badge.active {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.status-badge.command {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gesture-guide {
  padding: 14px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  margin-bottom: 16px;
}

.gesture-guide h3 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
  margin-bottom: 12px;
}

.gesture-guide ul {
  list-style: none;
}

.gesture-guide li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  font-size: 12px;
  color: #cbd5e1;
}

.gesture-guide li span {
  font-size: 16px;
  width: 24px;
  text-align: center;
}

.warning {
  padding: 12px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
  font-size: 12px;
  color: #fbbf24;
  text-align: center;
}`
};

export const installationInstructions = `
## 📦 Installation Instructions

### Step 1: Save the Extension Files
1. Create a new folder called agent-zero-gesture on your computer
2. Create each file listed above inside that folder
3. Create an icons subfolder and add icon images (16x16, 48x48, 128x128 PNG files)

### Step 2: Load the Extension in Chrome
1. Open Chrome and navigate to chrome://extensions/
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the agent-zero-gesture folder

### Step 3: Grant Permissions
1. Navigate to http://72.60.104.92:50080/
2. Click the extension icon in Chrome toolbar
3. Toggle **Enable Gesture Control**
4. Allow camera access when prompted

### Step 4: Test Gestures
- ✋ **Open Palm** → "Pause current task"
- ✊ **Fist** → "Stop immediately"
- ✌️ **Two Fingers** → "Execute the next task"
- 👍 **Thumbs Up** → "Confirm and proceed"

### Troubleshooting
- Ensure you're on the correct URL (http://72.60.104.92:50080/)
- Check that camera permissions are granted
- Keep hand clearly visible in frame
- Wait 2 seconds between gestures (cooldown)
`;
