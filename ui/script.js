// ui/script.ts
var form = document.getElementById("stipend-form");
var originInput = document.getElementById("origin");
var destinationInput = document.getElementById("destination");
var departureDateInput = document.getElementById("departure-date");
var returnDateInput = document.getElementById("return-date");
var ticketPriceInput = document.getElementById("ticket-price");
var calculateButton = document.getElementById("calculate-button");
var resultsTableDiv = document.getElementById("results-table");
var logOutput = document.getElementById("log-output");
var errorOutput = document.getElementById("error-output");
var socket = null;
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
    const value = result[key];
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
function addLog(message) {
  if (!logOutput)
    return;
  logOutput.textContent += message + `
`;
  logOutput.scrollTop = logOutput.scrollHeight;
}
function connectWebSocket(data) {
  if (socket && socket.readyState !== WebSocket.CLOSED) {
    socket.close();
  }
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
  socket = new WebSocket(wsUrl);
  socket.onopen = () => {
    addLog("WebSocket connection established.");
    addLog("Sending calculation request...");
    socket?.send(JSON.stringify(data));
    if (calculateButton)
      calculateButton.disabled = true;
  };
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case "log":
          addLog(message.payload);
          break;
        case "result":
          addLog("Calculation complete.");
          renderResultsTable(message.payload);
          if (calculateButton)
            calculateButton.disabled = false;
          socket?.close();
          break;
        case "error":
          addLog(`ERROR: ${message.payload}`);
          if (errorOutput)
            errorOutput.textContent = `Error: ${message.payload}`;
          if (resultsTableDiv)
            resultsTableDiv.innerHTML = "<p>Calculation failed.</p>";
          if (calculateButton)
            calculateButton.disabled = false;
          socket?.close();
          break;
        default:
          addLog(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      addLog(`Error processing message: ${error}`);
      console.error("WebSocket message error:", error);
    }
  };
  socket.onerror = (error) => {
    addLog("WebSocket error. See console for details.");
    console.error("WebSocket Error:", error);
    if (errorOutput)
      errorOutput.textContent = "WebSocket connection error.";
    if (resultsTableDiv)
      resultsTableDiv.innerHTML = "<p>Calculation failed.</p>";
    if (calculateButton)
      calculateButton.disabled = false;
  };
  socket.onclose = (event) => {
    addLog(`WebSocket connection closed (Code: ${event.code}).`);
    if (!event.wasClean && calculateButton) {
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
      resultsTableDiv.innerHTML = "<p>Calculation results will appear here...</p>";
    if (logOutput)
      logOutput.textContent = `Initiating calculation...
`;
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
      departureDate,
      returnDate,
      ticketPrice: ticketPrice || undefined
    };
    connectWebSocket(requestData);
  });
});
