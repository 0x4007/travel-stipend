// Type definition for the expected API response (subset of StipendBreakdown)
interface StipendResult {
    total_stipend: number;
    // Add other fields if you want to display more details
    [key: string]: any; // Allow other properties
}

// DOM Elements
const form = document.getElementById('stipend-form') as HTMLFormElement;
const originInput = document.getElementById('origin') as HTMLInputElement;
const destinationInput = document.getElementById('destination') as HTMLInputElement;
const departureDateInput = document.getElementById('departure-date') as HTMLInputElement;
const returnDateInput = document.getElementById('return-date') as HTMLInputElement;
const ticketPriceInput = document.getElementById('ticket-price') as HTMLInputElement;
const calculateButton = document.getElementById('calculate-button') as HTMLButtonElement;
const resultsOutput = document.getElementById('results-output') as HTMLPreElement;
const errorOutput = document.getElementById('error-output') as HTMLDivElement;

// Wait for the DOM to be fully loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Ensure form exists before adding listener
    if (!form) {
        console.error("Error: Could not find form element #stipend-form");
        errorOutput.textContent = "Initialization Error: Form not found.";
        return;
    }

    // Form submission handler
    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

        // Clear previous results/errors
    resultsOutput.textContent = 'Calculating...';
    errorOutput.textContent = '';
    calculateButton.disabled = true;

    // Get form data
    const origin = originInput.value.trim();
    const destination = destinationInput.value.trim();
    const departureDate = departureDateInput.value.trim();
    const returnDate = returnDateInput.value.trim();
    const ticketPrice = ticketPriceInput.value.trim(); // Keep as string for API

    // Construct query parameters
    const params = new URLSearchParams({
        origin,
        destination,
        departureDate,
        returnDate,
    });
    if (ticketPrice) {
        params.append('ticketPrice', ticketPrice);
    }

    try {
        // Make API call
        const response = await fetch(`/calculate?${params.toString()}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
        }

        const result: StipendResult = await response.json();

        // Display results
        resultsOutput.textContent = JSON.stringify(result, null, 2);

    } catch (error) {
        console.error('Calculation error:', error);
        errorOutput.textContent = `Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`;
        resultsOutput.textContent = 'Calculation failed.';
        } finally {
            if (calculateButton) calculateButton.disabled = false;
        }
    });
});
