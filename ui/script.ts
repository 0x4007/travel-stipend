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
// Removed logOutput element reference
const errorOutput = document.getElementById('error-output') as HTMLDivElement;

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
    if (!resultsTableDiv) return;
    resultsTableDiv.innerHTML = ''; // Clear previous content
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

// Function to show loading state
function showLoading() {
    if (resultsTableDiv) {
        // Simple text and spinner (could be enhanced with CSS)
        resultsTableDiv.innerHTML = `
            <div class="spinner"></div>
            <p>Checking Google Flights for the latest price data...</p>
        `;
    }
    if (errorOutput) errorOutput.textContent = '';
    if (calculateButton) calculateButton.disabled = true;
}

// Function to hide loading state (clear results area)
function hideLoading(errorOccurred = false) {
     if (resultsTableDiv && !errorOccurred) {
        // Clear loading message if no error, otherwise let error message show
         resultsTableDiv.innerHTML = '<p>Calculation results will appear here...</p>';
     }
    if (calculateButton) calculateButton.disabled = false;
}


// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    if (!form) {
        console.error("Error: Could not find form element #stipend-form");
        if (errorOutput) errorOutput.textContent = "Initialization Error: Form not found.";
        return;
    }

    // Form submission handler - Back to simple HTTP Fetch
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        showLoading(); // Show spinner and message

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

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
            }

            const result: StipendBreakdown = await response.json();

            // Display results (hide loading implicitly by rendering table)
            renderResultsTable(result);

        } catch (error) {
            console.error('Calculation error:', error);
            if (errorOutput) errorOutput.textContent = `Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`;
            hideLoading(true); // Hide loading but indicate error occurred
        } finally {
             // Ensure button is re-enabled even if render/hideLoading fails
             if (calculateButton) calculateButton.disabled = false;
        }
    });
});
