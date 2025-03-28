// Mirror the StipendBreakdown type for clarity
// We could also import it if we adjust build process/paths, but defining here is simpler for now.
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
const resultsTableDiv = document.getElementById('results-table') as HTMLDivElement; // Changed ID
const errorOutput = document.getElementById('error-output') as HTMLDivElement;

// Helper to format currency
function formatCurrency(value: number | undefined): string {
    if (value === undefined || isNaN(value)) return "$0.00";
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Helper to format property names for display
function formatLabel(key: string): string {
    return key
        .replace(/_/g, ' ') // Replace underscores with spaces
        .replace(/([A-Z])/g, ' $1') // Add space before capital letters
        .replace(/^./, (str) => str.toUpperCase()); // Capitalize first letter
}

// Function to render the results table
function renderResultsTable(result: StipendBreakdown): void {
    if (!resultsTableDiv) return;

    resultsTableDiv.innerHTML = ''; // Clear previous content

    const table = document.createElement('table');
    const tbody = document.createElement('tbody');

    // Define the order and labels for rows
    const displayOrder: (keyof StipendBreakdown)[] = [
        'conference', 'origin', 'destination', 'conference_start', 'conference_end',
        'flight_departure', 'flight_return', 'flight_cost', 'flight_price_source',
        'lodging_cost', 'meals_cost', 'basic_meals_cost', 'business_entertainment_cost',
        'local_transport_cost', 'ticket_price', 'internet_data_allowance', 'incidentals_allowance',
        'total_stipend'
    ];

    displayOrder.forEach(key => {
        const value = result[key];
        // Skip undefined/null values unless it's a core field we always want to show
        if (value === undefined || value === null) {
            // Optionally skip fields like distance_km if not present
            if (key === 'distance_km') return;
        }

        const tr = document.createElement('tr');
        const th = document.createElement('th');
        const td = document.createElement('td');

        th.textContent = formatLabel(key);

        // Format currency values
        if (key.endsWith('_cost') || key.endsWith('_price') || key.endsWith('_allowance') || key === 'total_stipend') {
            td.textContent = formatCurrency(value as number);
        } else if (key === 'flight_price_source' && typeof value === 'string') {
             td.textContent = `${result.flight_price_source}`; // Already includes source info
        }
         else {
            td.textContent = String(value);
        }

        tr.appendChild(th);
        tr.appendChild(td);
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    resultsTableDiv.appendChild(table);
}


// Wait for the DOM to be fully loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Ensure form exists before adding listener
    if (!form) {
        console.error("Error: Could not find form element #stipend-form");
        if (errorOutput) errorOutput.textContent = "Initialization Error: Form not found.";
        return;
    }

    // Form submission handler
    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

        // Clear previous results/errors
        if (resultsTableDiv) resultsTableDiv.innerHTML = '<p>Calculating...</p>'; // Clear table
        if (errorOutput) errorOutput.textContent = '';
        if (calculateButton) calculateButton.disabled = true;

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

            const result: StipendBreakdown = await response.json();

            // Display results
            renderResultsTable(result);

        } catch (error) {
            console.error('Calculation error:', error);
            if (errorOutput) errorOutput.textContent = `Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`;
            if (resultsTableDiv) resultsTableDiv.innerHTML = '<p>Calculation failed.</p>';
        } finally {
            if (calculateButton) calculateButton.disabled = false;
        }
    });
});
