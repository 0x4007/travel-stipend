// ui/script.ts
var form = document.getElementById("stipend-form");
var originInput = document.getElementById("origin");
var destinationInput = document.getElementById("destination");
var departureDateInput = document.getElementById("departure-date");
var returnDateInput = document.getElementById("return-date");
var ticketPriceInput = document.getElementById("ticket-price");
var calculateButton = document.getElementById("calculate-button");
var statusMessageDiv = document.getElementById("status-message");
var errorOutput = document.getElementById("error-output");
document.addEventListener("DOMContentLoaded", () => {
  if (!form) {
    console.error("Error: Could not find form element #stipend-form");
    if (errorOutput)
      errorOutput.textContent = "Initialization Error: Form not found.";
    return;
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (statusMessageDiv) {
      statusMessageDiv.innerHTML = "<p>Triggering workflow...</p>";
      statusMessageDiv.classList.remove("success");
    }
    if (errorOutput)
      errorOutput.textContent = "";
    if (calculateButton)
      calculateButton.disabled = true;
    const origin = originInput.value.trim();
    const destination = destinationInput.value.trim();
    const departureDate = departureDateInput.value.trim();
    const returnDate = returnDateInput.value.trim();
    const ticketPrice = ticketPriceInput.value.trim() || "0";
    const requestData = {
      origin,
      destination,
      startDate: departureDate,
      endDate: returnDate,
      price: ticketPrice
    };
    try {
      const proxyApiUrl = "http://localhost:8000/api/trigger-workflow";
      const response = await fetch(proxyApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestData)
      });
      if (!response.ok) {
        let errorMsg = response.statusText;
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorMsg;
        } catch (e) {
        }
        throw new Error(errorMsg || `HTTP error! Status: ${response.status}`);
      }
      if (statusMessageDiv) {
        statusMessageDiv.innerHTML = "<p>Workflow triggered successfully! Check GitHub Actions for progress.</p>";
        statusMessageDiv.classList.add("success");
      }
    } catch (error) {
      console.error("Workflow trigger error:", error);
      if (errorOutput)
        errorOutput.textContent = `Error: ${error instanceof Error ? error.message : "An unknown error occurred"}`;
      if (statusMessageDiv) {
        statusMessageDiv.innerHTML = "<p>Failed to trigger workflow.</p>";
        statusMessageDiv.classList.remove("success");
      }
    } finally {
      if (calculateButton)
        calculateButton.disabled = false;
    }
  });
});
