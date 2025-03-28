// Mirror the StipendBreakdown type from src/types.ts
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
    type: 'log' | 'status' | 'result' | 'error';
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
const statusMessageDiv = document.getElementById('status-message') as HTMLDivElement; // Use status div
const errorOutput = document.getElementById('error-output') as HTMLDivElement;

let socket: WebSocket | null = null;
let clientId: string | null = null;

// Helper to format currency
function formatCurrency(value: number | undefined): string {
    if (value === undefined || isNaN(value)) return "$0.00";
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Helper to format property names for display
function formatLabel(key: string): string {
    return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
}

// Function to render the results table
function renderResultsTable(result: StipendBreakdown | StipendBreakdown[]): void { // Can accept single or array
    if (!resultsTableDiv) return;
    resultsTableDiv.innerHTML = '';
    resultsTableDiv.style.display = 'block';

    // If the result from the callback is an array (e.g., from consolidate), handle it
    // For now, assume the callback sends a single StipendBreakdown object
    const resultData = Array.isArray(result) ? result[0] : result; // Use first result if array for now
    if (!resultData) {
        resultsTableDiv.innerHTML = '<p>Received empty results.</p>';
        return;
    }

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
        const value = resultData[key];
        if (value === undefined || value === null) { if (key === 'distance_km') return; }
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        const td = document.createElement('td');
        th.textContent = formatLabel(key);
        if (key.endsWith('_cost') || key.endsWith('_price') || key.endsWith('_allowance') || key === 'total_stipend') {
            td.textContent = formatCurrency(value as number);
        } else { td.textContent = String(value); }
        tr.appendChild(th);
        tr.appendChild(td);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    resultsTableDiv.appendChild(table);
}

// Function to update status message
function updateStatus(message: string, isSuccess = false): void {
    if (!statusMessageDiv) return;
    statusMessageDiv.innerHTML = `<p>${message}</p>`;
    if (isSuccess) {
        statusMessageDiv.classList.add('success');
    } else {
        statusMessageDiv.classList.remove('success');
    }
}

// Function to handle WebSocket connection and messages
function connectWebSocket(requestData: any): void {
    if (!clientId) {
        clientId = crypto.randomUUID(); // Generate unique ID for this client session
    }

    if (socket && socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {
        console.log("WebSocket already open or connecting. Sending request.");
        socket.send(JSON.stringify({ type: 'request_calculation', clientId, payload: requestData }));
        updateStatus('Re-sending calculation request...');
        if (calculateButton) calculateButton.disabled = true;
        return;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`; // Connect to /ws endpoint

    updateStatus('Connecting to server...');
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log('WebSocket connection established.');
        updateStatus('Connection established. Sending calculation request...');
        // Register client and send request immediately
        socket?.send(JSON.stringify({ type: 'request_calculation', clientId, payload: requestData }));
        if (calculateButton) calculateButton.disabled = true;
    };

    socket.onmessage = (event) => {
        try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log("WS Message Received:", message);
            switch (message.type) {
                case 'log': // Generic log messages (could be used for detailed progress later)
                    console.log('LOG:', message.payload);
                    break;
                case 'status':
                    updateStatus(message.payload);
                    break;
                case 'result':
                    updateStatus('Calculation complete!', true);
                    renderResultsTable(message.payload); // Render the received results
                    if (calculateButton) calculateButton.disabled = false;
                    socket?.close(); // Close socket after getting result
                    break;
                case 'error':
                    console.error('Error from server:', message.payload);
                    if (errorOutput) errorOutput.textContent = `Error: ${message.payload}`;
                    updateStatus('Calculation failed.');
                    if (calculateButton) calculateButton.disabled = false;
                    socket?.close(); // Close socket on error
                    break;
                default:
                    console.warn(`Unknown message type: ${message.type}`);
            }
        } catch (error) {
            console.error('Error processing message:', error);
            if (errorOutput) errorOutput.textContent = 'Error processing server message.';
        }
    };

    socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
        if (errorOutput) errorOutput.textContent = 'WebSocket connection error. Check console.';
        updateStatus('Connection error.');
        if (calculateButton) calculateButton.disabled = false;
        socket = null;
    };

    socket.onclose = (event) => {
        console.log(`WebSocket connection closed (Code: ${event.code}).`);
        updateStatus('Connection closed.');
        // Only re-enable button if closed unexpectedly and calculation wasn't finished
        if (!event.wasClean && calculateButton && calculateButton.disabled) {
             calculateButton.disabled = false;
        }
        socket = null;
    };
}

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    if (!form) {
        console.error("Error: Could not find form element #stipend-form");
        if (errorOutput) errorOutput.textContent = "Initialization Error: Form not found.";
        return;
    }

    // Form submission handler - Initiates WebSocket connection
    form.addEventListener('submit', (event) => {
        event.preventDefault();

        // Clear previous results/errors
        if (resultsTableDiv) resultsTableDiv.innerHTML = ''; // Clear table
        if (statusMessageDiv) updateStatus('Initiating calculation...');
        if (errorOutput) errorOutput.textContent = '';
        if (calculateButton) calculateButton.disabled = true;

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
            startDate: departureDate,
            endDate: returnDate,
            price: ticketPrice || "0" // Send "0" if empty
        };

        // Connect WebSocket and send data
        connectWebSocket(requestData);
    });
});
