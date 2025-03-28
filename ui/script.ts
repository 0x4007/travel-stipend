// DOM Elements
const form = document.getElementById('stipend-form') as HTMLFormElement;
const originInput = document.getElementById('origin') as HTMLInputElement;
const destinationInput = document.getElementById('destination') as HTMLInputElement;
const departureDateInput = document.getElementById('departure-date') as HTMLInputElement;
const returnDateInput = document.getElementById('return-date') as HTMLInputElement;
const ticketPriceInput = document.getElementById('ticket-price') as HTMLInputElement;
const calculateButton = document.getElementById('calculate-button') as HTMLButtonElement;
const statusMessageDiv = document.getElementById('status-message') as HTMLDivElement; // Changed ID
const errorOutput = document.getElementById('error-output') as HTMLDivElement;

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    if (!form) {
        console.error("Error: Could not find form element #stipend-form");
        if (errorOutput) errorOutput.textContent = "Initialization Error: Form not found.";
        return;
    }

    // Form submission handler
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Clear previous status/errors
        if (statusMessageDiv) {
            statusMessageDiv.innerHTML = '<p>Triggering workflow...</p>';
            statusMessageDiv.classList.remove('success');
        }
        if (errorOutput) errorOutput.textContent = '';
        if (calculateButton) calculateButton.disabled = true;

        // Get form data
        const origin = originInput.value.trim();
        const destination = destinationInput.value.trim();
        const departureDate = departureDateInput.value.trim();
        const returnDate = returnDateInput.value.trim();
        const ticketPrice = ticketPriceInput.value.trim() || "0"; // Default to "0" if empty

        // Data to send to the proxy API
        const requestData = {
            origin,
            destination,
            startDate: departureDate, // Match workflow input names
            endDate: returnDate,     // Match workflow input names
            price: ticketPrice,      // Match workflow input names
        };

        try {
            // Make API call to the proxy endpoint (replace with your actual proxy URL)
            // For local testing, you might run the proxy on a different port or path
            // For deployment, this would be the URL of your deployed function
            const proxyApiUrl = '/api/trigger-workflow'; // Example path

            const response = await fetch(proxyApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
            });

            if (!response.ok) {
                let errorMsg = response.statusText;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorMsg;
                } catch (e) { /* Ignore JSON parsing error */ }
                throw new Error(errorMsg || `HTTP error! Status: ${response.status}`);
            }

            // Display success message
            if (statusMessageDiv) {
                 statusMessageDiv.innerHTML = '<p>Workflow triggered successfully! Check GitHub Actions for progress.</p>';
                 statusMessageDiv.classList.add('success');
            }

        } catch (error) {
            console.error('Workflow trigger error:', error);
            if (errorOutput) errorOutput.textContent = `Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`;
             if (statusMessageDiv) {
                 statusMessageDiv.innerHTML = '<p>Failed to trigger workflow.</p>';
                 statusMessageDiv.classList.remove('success');
             }
        } finally {
             if (calculateButton) calculateButton.disabled = false; // Re-enable button
        }
    });
});
