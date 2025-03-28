// ui/script.ts
var form = document.getElementById("stipend-form");
var originInput = document.getElementById("origin");
var destinationInput = document.getElementById("destination");
var departureDateInput = document.getElementById("departure-date");
var returnDateInput = document.getElementById("return-date");
var ticketPriceInput = document.getElementById("ticket-price");
var calculateButton = document.getElementById("calculate-button");
var resultsOutput = document.getElementById("results-output");
var errorOutput = document.getElementById("error-output");
document.addEventListener("DOMContentLoaded", () => {
  if (!form) {
    console.error("Error: Could not find form element #stipend-form");
    errorOutput.textContent = "Initialization Error: Form not found.";
    return;
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    resultsOutput.textContent = "Calculating...";
    errorOutput.textContent = "";
    calculateButton.disabled = true;
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
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }
      const result = await response.json();
      resultsOutput.textContent = JSON.stringify(result, null, 2);
    } catch (error) {
      console.error("Calculation error:", error);
      errorOutput.textContent = `Error: ${error instanceof Error ? error.message : "An unknown error occurred"}`;
      resultsOutput.textContent = "Calculation failed.";
    } finally {
      if (calculateButton)
        calculateButton.disabled = false;
    }
  });
});
