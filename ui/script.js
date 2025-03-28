// ui/script.ts
var form = document.getElementById("stipend-form");
var originInput = document.getElementById("origin");
var destinationInput = document.getElementById("destination");
var departureDateInput = document.getElementById("departure-date");
var returnDateInput = document.getElementById("return-date");
var ticketPriceInput = document.getElementById("ticket-price");
var calculateButton = document.getElementById("calculate-button");
var resultsTableDiv = document.getElementById("results-table");
var statusMessageDiv = document.getElementById("status-message");
var logContainerDiv = document.getElementById("log-container");
var logOutput = document.getElementById("log-output");
var errorOutput = document.getElementById("error-output");
var socket = null;
var clientId = null;
function formatCurrency(value) {
  if (value === undefined || isNaN(value))
    return "$0.00";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatLabel(key) {
  return key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
}
function renderResultsTable(result) {
  if (!resultsTableDiv)
    return;
  resultsTableDiv.innerHTML = "";
  resultsTableDiv.style.display = "block";
  const resultData = Array.isArray(result) ? result[0] : result;
  if (!resultData) {
    resultsTableDiv.innerHTML = "<p>Received empty results.</p>";
    return;
  }
  const table = document.createElement("table");
  const tbody = document.createElement("tbody");
  const displayOrder = [
    "conference",
    "origin",
    "destination",
    "conference_start",
    "conference_end",
    "flight_departure",
    "flight_return",
    "flight_cost",
    "flight_price_source",
    "lodging_cost",
    "meals_cost",
    "basic_meals_cost",
    "business_entertainment_cost",
    "local_transport_cost",
    "ticket_price",
    "internet_data_allowance",
    "incidentals_allowance",
    "total_stipend"
  ];
  displayOrder.forEach((key) => {
    const value = resultData[key];
    if (value === undefined || value === null) {
      if (key === "distance_km")
        return;
    }
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    const td = document.createElement("td");
    th.textContent = formatLabel(key);
    if (key.endsWith("_cost") || key.endsWith("_price") || key.endsWith("_allowance") || key === "total_stipend") {
      td.textContent = formatCurrency(value);
    } else {
      td.textContent = String(value);
    }
    tr.appendChild(th);
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  resultsTableDiv.appendChild(table);
}
function updateStatus(message, isSuccess = false) {
  if (!statusMessageDiv)
    return;
  statusMessageDiv.innerHTML = `<p>${message}</p>`;
  if (isSuccess)
    statusMessageDiv.classList.add("success");
  else
    statusMessageDiv.classList.remove("success");
}
function addLog(message) {
  if (!logOutput)
    return;
  logOutput.textContent += message + `
`;
  logOutput.scrollTop = logOutput.scrollHeight;
}
function connectWebSocket(requestData) {
  if (!clientId)
    clientId = crypto.randomUUID();
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    console.log("WebSocket exists. Sending request.");
    socket.send(JSON.stringify({ type: "request_calculation", clientId, payload: requestData }));
    updateStatus("Sending calculation request...");
    if (logContainerDiv)
      logContainerDiv.style.display = "block";
    if (logOutput)
      logOutput.textContent = `Sending calculation request...
`;
    if (calculateButton)
      calculateButton.disabled = true;
    return;
  }
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
  updateStatus("Connecting to server...");
  if (logContainerDiv)
    logContainerDiv.style.display = "block";
  if (logOutput)
    logOutput.textContent = `Connecting to server...
`;
  console.log(`Attempting to connect WebSocket to: ${wsUrl}`);
  socket = new WebSocket(wsUrl);
  socket.onopen = () => {
    console.log("WebSocket connection established.");
    addLog("Connection established.");
    updateStatus("Connection established. Sending calculation request...");
    socket?.send(JSON.stringify({ type: "request_calculation", clientId, payload: requestData }));
    if (calculateButton)
      calculateButton.disabled = true;
  };
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("WS Message Received:", message);
      switch (message.type) {
        case "log":
          addLog(message.payload);
          break;
        case "status":
          updateStatus(message.payload);
          addLog(`Status: ${message.payload}`);
          break;
        case "result":
          updateStatus("Calculation complete!", true);
          addLog("Calculation complete. Results received.");
          renderResultsTable(message.payload);
          if (calculateButton)
            calculateButton.disabled = false;
          socket?.close();
          break;
        case "error":
          const errorMsg = message.payload || "Unknown server error";
          console.error("Error from server:", errorMsg);
          if (errorOutput)
            errorOutput.textContent = `Error: ${errorMsg}`;
          updateStatus("Calculation failed.");
          addLog(`ERROR: ${errorMsg}`);
          if (calculateButton)
            calculateButton.disabled = false;
          socket?.close();
          break;
        default:
          console.warn(`Unknown message type: ${message.type}`);
          addLog(`Received unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error("Error processing message:", error);
      if (errorOutput)
        errorOutput.textContent = "Error processing server message.";
      addLog(`Error processing message: ${error}`);
    }
  };
  socket.onerror = (error) => {
    console.error("WebSocket Error:", error);
    if (errorOutput)
      errorOutput.textContent = "WebSocket connection error. Check console.";
    updateStatus("Connection error.");
    addLog("WebSocket connection error.");
    if (calculateButton)
      calculateButton.disabled = false;
    socket = null;
  };
  socket.onclose = (event) => {
    console.log(`WebSocket connection closed (Code: ${event.code}).`);
    if (!event.wasClean) {
      updateStatus("Connection closed unexpectedly.");
      addLog("WebSocket connection closed unexpectedly.");
    } else {
      updateStatus("Connection closed.");
    }
    if (calculateButton && calculateButton.disabled) {
      calculateButton.disabled = false;
    }
    socket = null;
  };
}
document.addEventListener("DOMContentLoaded", () => {
  if (!form) {
    console.error("Error: Could not find form element #stipend-form");
    if (errorOutput)
      errorOutput.textContent = "Initialization Error: Form not found.";
    return;
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (resultsTableDiv)
      resultsTableDiv.innerHTML = "";
    if (statusMessageDiv)
      updateStatus("Initiating calculation...");
    if (logContainerDiv)
      logContainerDiv.style.display = "none";
    if (logOutput)
      logOutput.textContent = "";
    if (errorOutput)
      errorOutput.textContent = "";
    if (calculateButton)
      calculateButton.disabled = true;
    const origin = originInput.value.trim();
    const destination = destinationInput.value.trim();
    const departureDate = departureDateInput.value.trim();
    const returnDate = returnDateInput.value.trim();
    const ticketPrice = ticketPriceInput.value.trim();
    const requestData = {
      origin,
      destination,
      startDate: departureDate,
      endDate: returnDate,
      price: ticketPrice || "0"
    };
    connectWebSocket(requestData);
  });
});
