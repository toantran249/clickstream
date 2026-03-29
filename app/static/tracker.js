// Function to generate a random session ID
function generateUUID() {
  return "sess_" + Math.random().toString(36).substr(2, 9);
}

// 1. Initial State Setup
const sessionId = generateUUID();
const API_URL = "http://localhost:8000/api/track";
const currentUrl = window.location.pathname;

// --- Add this block right below where you defined currentUrl ---
let currentWriteMode = "batch";
const modeToggleBtn = document.getElementById("modeToggle");

modeToggleBtn.addEventListener("click", () => {
  if (currentWriteMode === "batch") {
    currentWriteMode = "direct";
    modeToggleBtn.textContent = "🐢 Direct Mode (PostgreSQL Insert)";
    modeToggleBtn.className = "mode-btn direct-mode";
    console.log("Switched to Direct PostgreSQL mode");
  } else {
    currentWriteMode = "batch";
    modeToggleBtn.textContent = "⚡ Batch Mode (Redis Queue)";
    modeToggleBtn.className = "mode-btn batch-mode";
    console.log("Switched to Redis Batch mode");
  }
});

// --- Update your captureEvent function to include the mode ---
async function captureEvent(eventType, metadata = {}) {
  const payload = {
    session_id: sessionId,
    event_type: eventType,
    url: currentUrl,
    element_metadata: metadata,
    write_mode: currentWriteMode, // <-- Added this line
  };

  try {
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Error sending tracking event:", error);
  }
}

console.log(`Tracking started. Session: ${sessionId}`);

// Ensure we track a 'VIEW' event immediately on load
window.addEventListener("load", () => {
  captureEvent("view", { url_full: window.location.href });
});

// --- CORE FUNCTION: Capture and Post Event ---
async function captureEvent(eventType, metadata = {}) {
  const payload = {
    session_id: sessionId,
    event_type: eventType,
    url: currentUrl,
    element_metadata: metadata,
  };

  try {
    // Send asynchronously to the API (which pushes to Redis)
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Error sending tracking event:", error);
  }
}

// --- Event Listeners: Left Panel ---
const mockWebsite = document.getElementById("mockWebsite");

// 1. Track Clicks
mockWebsite.addEventListener("click", (event) => {
  const target = event.target;
  let metadata = {};

  // Capture metadata based on what was clicked
  if (target.tagName === "BUTTON") {
    metadata = {
      element_id: target.id,
      button_text: target.innerText.trim(),
      parent_class: target.parentElement.className,
    };
  } else if (target.tagName === "A") {
    metadata = {
      element_id: target.id,
      link_url: target.getAttribute("href"),
      link_text: target.innerText,
    };
  } else {
    // If they just clicked a div or image
    metadata = {
      element_id: target.id || "none",
      element_type: target.tagName,
    };
  }

  captureEvent("click", metadata);
});

// 2. Track Scrolling (With Throttling)
// We throttle the scroll event so we don't send 200 events per second.
let scrollTimeout;
mockWebsite.addEventListener("scroll", () => {
  // Only capture a scroll event every 750 milliseconds
  if (!scrollTimeout) {
    scrollTimeout = setTimeout(() => {
      const scrollTop = mockWebsite.scrollTop;
      const scrollHeight = mockWebsite.scrollHeight;
      const clientHeight = mockWebsite.clientHeight;
      const scrollPercent = Math.round(
        (scrollTop / (scrollHeight - clientHeight)) * 100,
      );

      captureEvent("scroll", {
        scroll_pos_px: scrollTop,
        scroll_percent: `${scrollPercent}%`,
      });

      scrollTimeout = null;
    }, 750);
  }
});

// --- Live Console: WebSocket Connection ---
const terminalLog = document.getElementById("terminalLog");
const ws = new WebSocket("ws://localhost:8000/ws/console");

ws.onopen = () => {
  const p = document.createElement("p");
  p.className = "sys-msg";
  p.textContent = "[SYSTEM] WebSocket Connected! Live Console is active.";
  terminalLog.appendChild(p);
};

// When a message arrives (published from Redis by our FastAPI backend)
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  appendTerminalLog(data);
};

ws.onerror = (error) => {
  const p = document.createElement("p");
  p.style.color = "#ff4444"; // Red for error
  p.textContent = `[SYSTEM ERROR] WebSocket connection failed. ${error.message}`;
  terminalLog.appendChild(p);
};

// Function to append logs to the terminal UI
function appendTerminalLog(data) {
  const now = new Date();
  const timeStr = now.toISOString().split("T")[1].substr(0, 8); // e.g., 17:35:00

  // Create the terminal line element
  const p = document.createElement("p");

  // Timestamp
  const timeSpan = document.createElement("span");
  timeSpan.className = "log-time";
  timeSpan.textContent = `[${timeStr}] `;
  p.appendChild(timeSpan);

  // Event Type (styled specifically)
  const eventSpan = document.createElement("span");
  eventSpan.className = `log-event-${data.event_type}`;
  eventSpan.textContent = `[${data.event_type.toUpperCase()}] `;
  p.appendChild(eventSpan);

  // Dynamic Metadata
  let metaStr = "";
  if (data.event_type === "click") {
    metaStr = `Target: ${data.element_metadata.button_text || data.element_metadata.element_id}`;
  } else if (data.event_type === "scroll") {
    metaStr = `Depth: ${data.element_metadata.scroll_percent ? data.element_metadata.scroll_percent : "test"}`;
  } else if (data.event_type === "view") {
    metaStr = `URL: ${data.url}`;
  }

  const textNode = document.createTextNode(metaStr);
  p.appendChild(textNode);

  // Append to terminal and auto-scroll
  terminalLog.appendChild(p);
  terminalLog.scrollTop = terminalLog.scrollHeight;
}

// --- Stress Test Logic ---
const stressTestBtn = document.getElementById("stressTestBtn");

var numOfStressTestEvents = 10;

stressTestBtn.addEventListener("click", async () => {
  stressTestBtn.disabled = true;
  stressTestBtn.textContent = "⏳ Running...";

  const pStart = document.createElement("p");
  pStart.style.color = "#ff9800";
  pStart.textContent = `[SYSTEM] Initiating stress test... ${numOfStressTestEvents} random events in ${currentWriteMode.toUpperCase()} mode.`;
  terminalLog.appendChild(pStart);
  terminalLog.scrollTop = terminalLog.scrollHeight;

  try {
    const response = await fetch("http://localhost:8000/api/stress-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        write_mode: currentWriteMode,
        count: numOfStressTestEvents,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();

    const pResult = document.createElement("p");
    // If there are failed writes, show yellow (warning), otherwise green
    pResult.style.color = result.failed_writes > 0 ? "#ffeb3b" : "#00ff00";
    pResult.innerHTML = `[TEST COMPLETE] Mode: <b>${result.mode}</b><br>
                             Time Taken: <b>${result.time_taken_seconds}s</b><br>
                             Success: ${result.successful_writes} | Failed: <span style="color:#ff4444">${result.failed_writes}</span>`;
    terminalLog.appendChild(pResult);
  } catch (error) {
    // Now errors will display in the terminal instead of failing silently
    const pErr = document.createElement("p");
    pErr.style.color = "#ff4444";
    pErr.textContent = `[SYSTEM ERROR] Stress test failed: ${error.message}`;
    terminalLog.appendChild(pErr);
  } finally {
    stressTestBtn.disabled = false;
    stressTestBtn.textContent = `🔥 Run ${numOfStressTestEvents} Users Stress Test`;
    terminalLog.scrollTop = terminalLog.scrollHeight;
  }
});
