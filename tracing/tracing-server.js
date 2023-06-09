const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();
const port = 3001;
let cors = require('cors');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { ConsoleSpanExporter, BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { PgInstrumentation } = require('@opentelemetry/instrumentation-pg');

// Optionally register instrumentation libraries
registerInstrumentations({
	instrumentations: [new HttpInstrumentation(), new PgInstrumentation()],
});

// Create a tracer provider
const provider = new NodeTracerProvider();

// Create a span exporter and exports in console in batches
const exporter = new ConsoleSpanExporter();
const processor = new BatchSpanProcessor(exporter);
provider.addSpanProcessor(processor);

// Initialize the tracer provider
provider.register();

// Log data to .txt file
const rootDirectory = path.resolve(__dirname, '..');
const logFilePath = path.join(rootDirectory, 'log.txt');

function logData(data) {
	fs.appendFileSync(logFilePath, data + '\n');
}

// Add a span processor to log the span data
provider.addSpanProcessor({
	// onStart needed or run into error saying onStart is not a function
	onStart: (span) => {
		// Doing nothing on start
	},
	onEnd: (span) => {
		if (span.attributes['http.target'] === '/api/log-xhr-data' && span.attributes['http.method'] === 'POST') {
			return;
		}
		if (span.attributes['http.method'] !== 'OPTIONS') {
			if (span.attributes['http.method']) {
				logData(`HTTP method: ${span.attributes['http.method']}`);
			}
			if (span.attributes['http.target']) {
				logData(`API route: ${span.attributes['http.target']}`);
			}
			if (span.attributes['http.method'] && span.duration) {
				logData(`Execution time (ms): ${span.duration}`);
			}
			if (span.attributes['http.status_code']) {
				logData(`HTTP status code: ${span.attributes['http.status_code']}`);
			}
			if (span.attributes['db.statement']) {
				logData(`SQL Query: ${span.attributes['db.statement']}`);
			}
		}
	},
});

// Express logic below
app.use(
	cors({
		credentials: true,
	})
);

app.use(express.json());

app.post('/api/log-xhr-data', (req, res) => {
	const { requestPayload, responseData } = req.body;
	logData(`Request Payload: ${requestPayload}`);
	logData(`Response Data: ${responseData}`);
	res.json({ status: 'success', message: 'XHR data received' });
});

app.listen(port, () => {
	console.log(`Server listening on port ${port}`);
});
