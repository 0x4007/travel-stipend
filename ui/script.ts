// Mirror the StipendBreakdown type
interface StipendBreakdown {
    conference: string;
    origin: string;
    destination: string;
    conference_start: string;
    conference_end: string;
    flight_departure: string;
    flight_return: string;
    flight_cost: number;
    flight_price_source: string;
    lodging_cost: number;
    basic_meals_cost: number;
    business_entertainment_cost: number;
    local_transport_cost: number;
    ticket_price: number;
    internet_data_allowance: number;
    incidentals_allowance: number;
    total_stipend: number;
    meals_cost: number;
    distance_km?: number;
}

// DOM Elements
const form = document.getElementById('stipend-form') as HTMLFormElement;
const originInput = document.getElementById('origin') as HTMLInputElement;
const destinationInput = document.getElementById('destination') as HTMLInputElement;
const departureDateInput = document.getElementById('departure-date') as HTMLInputElement;
const returnDateInput = document.getElementById('return-date') as HTMLInputElement;
const ticketPriceInput = document.getElementById('ticket-price') as HTMLInputElement;
const calculateButton = document.getElementById('calculate-button') as HTMLButtonElement;
const resultsTableDiv = document.getElementById('results-table') as HTMLDivElement;
const loadingIndicatorDiv = document.getElementById('loading-indicator') as HTMLDivElement;
const progressBarValue = loadingIndicatorDiv?.querySelector('.progress-bar-value') as HTMLDivElement | null;
const countdownTimerSpan = document.getElementById('countdown-timer') as HTMLSpanElement | null;
const errorOutput = document.getElementById('error-output') as HTMLDivElement;

let progressInterval: number | null = null;
const DEFAULT_DURATION_MS = 53000; // Fallback duration

// Helper to format currency
function formatCurrency(value: number | undefined): string {
    if (value === undefined || isNaN(value)) return "$0.00";
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Helper to format property names for display
function formatLabel(key: string): string {
    return key
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase());
}

// Function to render the results table
function renderResultsTable(result: StipendBreakdown): void {
    // ... (renderResultsTable function remains the same) ...
    if (!resultsTableDiv) return;
    resultsTableDiv.innerHTML = '';
    resultsTableDiv.style.display = 'block';

    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const displayOrder: (keyof StipendBreakdown)[] = [
        'conference', 'origin', 'destination', 'conference_start', 'conference_end',
        'flight_departure', 'flight_return', 'flight_cost', 'flight_price_source',
        'lodging_cost', 'meals_cost', 'basic_meals_cost', 'business_entertainment_cost',
        'local_transport_cost', 'ticket_price', 'internet_data_allowance', 'incidentals_allowance',
        'total_stipend'
    ];

    displayOrder.forEach(key => {
        const value = result[key];
        if (value === undefined || value === null) {
            if (key === 'distance_km') return;
        }
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        const td = document.createElement('td');
        th.textContent = formatLabel(key);
        if (key.endsWith('_cost') || key.endsWith('_price') || key.endsWith('_allowance') || key === 'total_stipend') {
            td.textContent = formatCurrency(value as number);
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

// Function to show loading state and start progress bar/timer
function showLoading(totalDurationMs: number) { // Accept duration
    let elapsedTime = 0;
    const totalDuration = totalDurationMs > 0 ? totalDurationMs : DEFAULT_DURATION_MS; // Use fetched or default

    if (resultsTableDiv) resultsTableDiv.style.display = 'none';
    if (loadingIndicatorDiv) loadingIndicatorDiv.style.display = 'block';
    if (errorOutput) errorOutput.textContent = '';
    if (calculateButton) calculateButton.disabled = true;

    // Reset progress bar and timer
    if (progressBarValue) {
        progressBarValue.style.width = '0%';
        progressBarValue.textContent = '0%';
    }
     if (countdownTimerSpan) {
        countdownTimerSpan.textContent = `(~${Math.ceil(totalDuration / 1000)}s left)`; // Indicate estimate
     }

    // Clear any existing interval
    if (progressInterval !== null) {
        clearInterval(progressInterval);
    }

    // Start new interval for progress bar and timer
    const updateInterval = 500;
    const steps = totalDuration / updateInterval;
    const increment = 100 / steps;

    progressInterval = window.setInterval(() => {
        elapsedTime += updateInterval;
        let currentProgress = (elapsedTime / totalDuration) * 100;
        let remainingSeconds = Math.ceil((totalDuration - elapsedTime) / 1000);

        if (currentProgress >= 100) {
            currentProgress = 100;
            remainingSeconds = 0;
            if (progressInterval !== null) clearInterval(progressInterval);
            // Don't clear timer text immediately, let fetch completion handle it
        }

        if (progressBarValue) {
            progressBarValue.style.width = `${currentProgress}%`;
            progressBarValue.textContent = `${Math.round(currentProgress)}%`;
        }
        if (countdownTimerSpan) {
            // Update timer text, handle pluralization
            countdownTimerSpan.textContent = `(~${remainingSeconds}s left)`;
        }

    }, updateInterval);
}

// Function to hide loading state
function hideLoading(showResultsPlaceholder = false) {
    if (progressInterval !== null) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
     if (loadingIndicatorDiv) loadingIndicatorDiv.style.display = 'none';
     if (resultsTableDiv && showResultsPlaceholder) {
         resultsTableDiv.style.display = 'block';
         resultsTableDiv.innerHTML = '<p>Calculation results will appear here...</p>';
     }
    if (calculateButton) calculateButton.disabled = false;
    // Clear timer text when hiding loading indicator
    if (countdownTimerSpan) {
        countdownTimerSpan.textContent = '';
    }
}


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

        let estimatedDuration = DEFAULT_DURATION_MS;
        try {
            // Fetch estimated duration (median) before showing loading
            const durationResponse = await fetch('/estimated-duration'); // Updated endpoint
            if (durationResponse.ok) {
                const data = await durationResponse.json();
                estimatedDuration = data.durationMs || DEFAULT_DURATION_MS;
            }
        } catch (e) {
            console.warn("Could not fetch last duration, using default.", e);
        }

        showLoading(estimatedDuration); // Show progress bar with estimated duration

        // Get form data
        const origin = originInput.value.trim();
        const destination = destinationInput.value.trim();
        const departureDate = departureDateInput.value.trim();
        const returnDate = returnDateInput.value.trim();
        const ticketPrice = ticketPriceInput.value.trim();

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

            // Stop progress bar immediately when response received
            if (progressInterval !== null) {
                clearInterval(progressInterval);
                progressInterval = null;
            }
             // Force bar to 100% visually
            if (progressBarValue) {
                 progressBarValue.style.width = '100%';
                 progressBarValue.textContent = 'Done!'; // Change text on completion
            }
             // Clear timer text
             if (countdownTimerSpan) {
                 countdownTimerSpan.textContent = '';
             }

            // Short delay before hiding loading and showing results
            await new Promise(resolve => setTimeout(resolve, 300));

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
            }

            const result: StipendBreakdown = await response.json();

            // Hide loading indicator and display results table
            hideLoading(false);
            renderResultsTable(result);

        } catch (error) {
            console.error('Calculation error:', error);
            if (errorOutput) errorOutput.textContent = `Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`;
            hideLoading(true);
        } finally {
             if (calculateButton) calculateButton.disabled = false;
             if (progressInterval !== null) clearInterval(progressInterval);
        }
    });
});
