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

// Type for WebSocket messages from server
interface WebSocketMessage {
    type: 'log' | 'result' | 'error';
    payload: any;
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
const logOutput = document.getElementById('log-output') as HTMLPreElement; // Added log element
const errorOutput = document.getElementById('error-output') as HTMLDivElement;

let socket: WebSocket | null = null;

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

// Function to add log messages
function addLog(message: string): void {
    if (!logOutput) return;
    logOutput.textContent += message + '\n';
    logOutput.scrollTop = logOutput.scrollHeight; // Auto-scroll to bottom
}

// Function to handle WebSocket connection and messages
function connectWebSocket(data: any): void {
    // Close existing socket if any
    if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.close();
    }

    // Determine WebSocket protocol based on window location
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`; // Use /ws endpoint

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        addLog('WebSocket connection established.');
        addLog('Sending calculation request...');
        socket?.send(JSON.stringify(data)); // Send form data
        if (calculateButton) calculateButton.disabled = true; // Disable button during calculation
    };

    socket.onmessage = (event) => {
        try {
            const message: WebSocketMessage = JSON.parse(event.data);
            switch (message.type) {
                case 'log':
                    addLog(message.payload);
                    break;
                case 'result':
                    addLog('Calculation complete.');
                    renderResultsTable(message.payload as StipendBreakdown);
                    if (calculateButton) calculateButton.disabled = false; // Re-enable button
                    socket?.close(); // Close socket after getting result
                    break;
                case 'error':
                    addLog(`ERROR: ${message.payload}`);
                    if (errorOutput) errorOutput.textContent = `Error: ${message.payload}`;
                    if (resultsTableDiv) resultsTableDiv.innerHTML = '<p>Calculation failed.</p>';
                    if (calculateButton) calculateButton.disabled = false; // Re-enable button
                    socket?.close(); // Close socket on error
                    break;
                default:
                    addLog(`Unknown message type: ${message.type}`);
            }
        } catch (error) {
            addLog(`Error processing message: ${error}`);
            console.error('WebSocket message error:', error);
        }
    };

    socket.onerror = (error) => {
        addLog('WebSocket error. See console for details.');
        console.error('WebSocket Error:', error);
        if (errorOutput) errorOutput.textContent = 'WebSocket connection error.';
        if (resultsTableDiv) resultsTableDiv.innerHTML = '<p>Calculation failed.</p>';
        if (calculateButton) calculateButton.disabled = false;
    };

    socket.onclose = (event) => {
        addLog(`WebSocket connection closed (Code: ${event.code}).`);
        // Optionally re-enable button if closed unexpectedly
        if (!event.wasClean && calculateButton) {
             calculateButton.disabled = false;
        }
        socket = null; // Clear socket reference
    };
}


// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    if (!form) {
        console.error("Error: Could not find form element #stipend-form");
        if (errorOutput) errorOutput.textContent = "Initialization Error: Form not found.";
        return;
    }

    // Form submission handler - Now initiates WebSocket connection
    form.addEventListener('submit', (event) => {
        event.preventDefault();

        // Clear previous results/errors
        if (resultsTableDiv) resultsTableDiv.innerHTML = '<p>Calculation results will appear here...</p>';
        if (logOutput) logOutput.textContent = 'Initiating calculation...\n'; // Clear/reset log
        if (errorOutput) errorOutput.textContent = '';
        if (calculateButton) calculateButton.disabled = true; // Disable button immediately

        // Get form data
        const origin = originInput.value.trim();
        const destination = destinationInput.value.trim();
        const departureDate = departureDateInput.value.trim();
        const returnDate = returnDateInput.value.trim();
        const ticketPrice = ticketPriceInput.value.trim();

        // Data to send via WebSocket
        const requestData = {
            origin,
            destination,
            departureDate,
            returnDate,
            ticketPrice: ticketPrice || undefined // Send undefined if empty
        };

        // Connect WebSocket and send data
        connectWebSocket(requestData);
    });
});
