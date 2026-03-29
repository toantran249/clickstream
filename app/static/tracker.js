// Function to generate a random session ID
function generateUUID() {
  return "sess_" + Math.random().toString(36).substr(2, 9);
}

// 1. Initial State Setup
const sessionId = generateUUID();
const API_URL = "http://localhost:8000/api/track";
const currentUrl = window.location.pathname;

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
    metaStr = `Depth: ${data.element_metadata.scroll_percent}`;
  } else if (data.event_type === "view") {
    metaStr = `URL: ${data.url}`;
  }

  const textNode = document.createTextNode(metaStr);
  p.appendChild(textNode);

  // Append to terminal and auto-scroll
  terminalLog.appendChild(p);
  terminalLog.scrollTop = terminalLog.scrollHeight;
}
