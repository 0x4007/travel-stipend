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
const statusMessageDiv = document.getElementById('status-message') as HTMLDivElement;
const logContainerDiv = document.getElementById('log-container') as HTMLDivElement;
const logOutput = document.getElementById('log-output') as HTMLPreElement;
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
function renderResultsTable(result: StipendBreakdown | StipendBreakdown[]): void {
    console.log("Attempting to render results table with payload:", result); // Debug log
    if (!resultsTableDiv) {
        console.error("resultsTableDiv not found");
        return;
    }
    resultsTableDiv.innerHTML = ''; // Clear previous content
    resultsTableDiv.style.display = 'block'; // Ensure results table is visible

    const resultData = Array.isArray(result) ? result[0] : result;
    if (!resultData) {
        resultsTableDiv.innerHTML = '<p>Received empty or invalid results data.</p>';
        console.error("Received empty or invalid resultData for rendering.");
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
        // Skip distance_km if undefined/null, otherwise show 0 for other potentially missing numeric fields
        if (key === 'distance_km' && (value === undefined || value === null)) return;

        const tr = document.createElement('tr');
        const th = document.createElement('th');
        const td = document.createElement('td');
        th.textContent = formatLabel(key);

        if (key.endsWith('_cost') || key.endsWith('_price') || key.endsWith('_allowance') || key === 'total_stipend') {
            td.textContent = formatCurrency(value as number);
        } else {
            td.textContent = String(value ?? ''); // Display empty string if value is null/undefined
        }
        tr.appendChild(th);
        tr.appendChild(td);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    resultsTableDiv.appendChild(table);
    console.log("Results table rendered."); // Debug log
}

// Function to update status message
function updateStatus(message: string, isSuccess = false): void {
    if (!statusMessageDiv) return;
    statusMessageDiv.innerHTML = `<p>${message}</p>`;
    if (isSuccess) statusMessageDiv.classList.add('success');
    else statusMessageDiv.classList.remove('success');
}

// Function to add log messages
function addLog(message: string): void {
    if (!logOutput) return;
    logOutput.textContent += message + '\n';
    logOutput.scrollTop = logOutput.scrollHeight;
}

// Function to handle WebSocket connection and messages
function connectWebSocket(requestData: any): void {
    if (!clientId) clientId = crypto.randomUUID();

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        console.log("WebSocket exists. Sending request.");
        socket.send(JSON.stringify({ type: 'request_calculation', clientId, payload: requestData }));
        updateStatus('Sending calculation request...');
        if (logContainerDiv) logContainerDiv.style.display = 'block';
        if (logOutput) logOutput.textContent = 'Sending calculation request...\n';
        if (calculateButton) calculateButton.disabled = true;
        return;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

    updateStatus('Connecting to server...');
    if (logContainerDiv) logContainerDiv.style.display = 'block';
    if (logOutput) logOutput.textContent = 'Connecting to server...\n';
    console.log(`Attempting to connect WebSocket to: ${wsUrl}`);
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log('WebSocket connection established.');
        addLog('Connection established.');
        updateStatus('Connection established. Sending calculation request...');
        socket?.send(JSON.stringify({ type: 'request_calculation', clientId, payload: requestData }));
        if (calculateButton) calculateButton.disabled = true;
    };

    socket.onmessage = (event) => {
        try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log("WS Message Received:", message);
            switch (message.type) {
                case 'log':
                    addLog(message.payload);
                    break;
                case 'status':
                    updateStatus(message.payload);
                    addLog(`Status: ${message.payload}`);
                    break;
                case 'result':
                    updateStatus('Calculation complete!', true);
                    addLog('Calculation complete. Results received.');
                    if (logContainerDiv) logContainerDiv.style.display = 'none'; // Hide log container
                    renderResultsTable(message.payload); // Render the received results
                    if (calculateButton) calculateButton.disabled = false;
                    socket?.close();
                    break;
                case 'error':
                    const errorMsg = message.payload || 'Unknown server error';
                    console.error('Error from server:', errorMsg);
                    if (errorOutput) errorOutput.textContent = `Error: ${errorMsg}`;
                    updateStatus('Calculation failed.');
                    addLog(`ERROR: ${errorMsg}`);
                    if (logContainerDiv) logContainerDiv.style.display = 'block'; // Ensure log is visible on error
                    if (resultsTableDiv) resultsTableDiv.innerHTML = ''; // Clear results table on error
                    if (calculateButton) calculateButton.disabled = false;
                    socket?.close();
                    break;
                default:
                    console.warn(`Unknown message type: ${message.type}`);
                    addLog(`Received unknown message type: ${message.type}`);
            }
        } catch (error) {
            console.error('Error processing message:', error);
            if (errorOutput) errorOutput.textContent = 'Error processing server message.';
            addLog(`Error processing message: ${error}`);
        }
    };

    socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
        if (errorOutput) errorOutput.textContent = 'WebSocket connection error. Check console.';
        updateStatus('Connection error.');
        addLog('WebSocket connection error.');
        if (calculateButton) calculateButton.disabled = false;
        socket = null;
    };

    socket.onclose = (event) => {
        console.log(`WebSocket connection closed (Code: ${event.code}).`);
        if (!event.wasClean) {
            updateStatus('Connection closed unexpectedly.');
            addLog('WebSocket connection closed unexpectedly.');
        } else {
             updateStatus('Connection closed.');
        }
        if (calculateButton && calculateButton.disabled) {
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

    // Form submission handler
    form.addEventListener('submit', (event) => {
        event.preventDefault();

        // Clear previous results/errors
        if (resultsTableDiv) resultsTableDiv.innerHTML = '';
        if (statusMessageDiv) updateStatus('Initiating calculation...');
        if (logContainerDiv) logContainerDiv.style.display = 'none'; // Hide log container initially
        if (logOutput) logOutput.textContent = '';
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
            price: ticketPrice || "0"
        };

        // Connect WebSocket and send data
        connectWebSocket(requestData);
    });
});
