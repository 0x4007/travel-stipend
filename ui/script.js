// ui/script.ts
var form = document.getElementById("stipend-form");
var originInput = document.getElementById("origin");
var destinationInput = document.getElementById("destination");
var departureDateInput = document.getElementById("departure-date");
var returnDateInput = document.getElementById("return-date");
var ticketPriceInput = document.getElementById("ticket-price");
var calculateButton = document.getElementById("calculate-button");
var resultsTableDiv = document.getElementById("results-table");
var loadingIndicatorDiv = document.getElementById("loading-indicator");
var progressBarValue = loadingIndicatorDiv?.querySelector(".progress-bar-value");
var countdownTimerSpan = document.getElementById("countdown-timer");
var errorOutput = document.getElementById("error-output");
var progressInterval = null;
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
function showLoading() {
  const totalDuration = 53000;
  let elapsedTime = 0;
  if (resultsTableDiv)
    resultsTableDiv.style.display = "none";
  if (loadingIndicatorDiv)
    loadingIndicatorDiv.style.display = "block";
  if (errorOutput)
    errorOutput.textContent = "";
  if (calculateButton)
    calculateButton.disabled = true;
  if (progressBarValue) {
    progressBarValue.style.width = "0%";
    progressBarValue.textContent = "0%";
  }
  if (countdownTimerSpan) {
    countdownTimerSpan.textContent = `(${Math.ceil(totalDuration / 1000)}s left)`;
  }
  if (progressInterval !== null) {
    clearInterval(progressInterval);
  }
  const updateInterval = 500;
  const steps = totalDuration / updateInterval;
  const increment = 100 / steps;
  progressInterval = window.setInterval(() => {
    elapsedTime += updateInterval;
    let currentProgress = elapsedTime / totalDuration * 100;
    let remainingSeconds = Math.ceil((totalDuration - elapsedTime) / 1000);
    if (currentProgress >= 100) {
      currentProgress = 100;
      remainingSeconds = 0;
      if (progressInterval !== null)
        clearInterval(progressInterval);
    }
    if (progressBarValue) {
      progressBarValue.style.width = `${currentProgress}%`;
      progressBarValue.textContent = `${Math.round(currentProgress)}%`;
    }
    if (countdownTimerSpan) {
      countdownTimerSpan.textContent = `(${remainingSeconds}s left)`;
    }
  }, updateInterval);
}
function hideLoading(showResultsPlaceholder = false) {
  if (progressInterval !== null) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  if (loadingIndicatorDiv)
    loadingIndicatorDiv.style.display = "none";
  if (resultsTableDiv && showResultsPlaceholder) {
    resultsTableDiv.style.display = "block";
    resultsTableDiv.innerHTML = "<p>Calculation results will appear here...</p>";
  }
  if (calculateButton)
    calculateButton.disabled = false;
}
document.addEventListener("DOMContentLoaded", () => {
  if (!form) {
    console.error("Error: Could not find form element #stipend-form");
    if (errorOutput)
      errorOutput.textContent = "Initialization Error: Form not found.";
    return;
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showLoading();
    const origin = originInput.value.trim();
    const destination = destinationInput.value.trim();
    const departureDate = departureDateInput.value.trim();
    const returnDate = returnDateInput.value.trim();
    const ticketPrice = ticketPriceInput.value.trim();
    const params = new URLSearchParams({
      origin,
      destination,
      departureDate,
      returnDate
    });
    if (ticketPrice) {
      params.append("ticketPrice", ticketPrice);
    }
    try {
      const response = await fetch(`/calculate?${params.toString()}`);
      if (progressInterval !== null) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      if (progressBarValue) {
        progressBarValue.style.width = "100%";
        progressBarValue.textContent = "100%";
      }
      if (countdownTimerSpan) {
        countdownTimerSpan.textContent = "";
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }
      const result = await response.json();
      hideLoading(false);
      renderResultsTable(result);
    } catch (error) {
      console.error("Calculation error:", error);
      if (errorOutput)
        errorOutput.textContent = `Error: ${error instanceof Error ? error.message : "An unknown error occurred"}`;
      hideLoading(true);
    } finally {
      if (calculateButton)
        calculateButton.disabled = false;
      if (progressInterval !== null)
        clearInterval(progressInterval);
    }
  });
});
