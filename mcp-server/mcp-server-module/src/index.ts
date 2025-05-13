import express from "express";
import { Client } from './milves.js'
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"

// Get Milvus URI
const MILVUS_URI = process.env.MILVUS_URI || "http://milvus:19530";
const MILVUS_TOKEN = process.env.MILVUS_TOKEN || "root:Milvus";
const MILVUS_DB = process.env.MILVUS_DB || "mcp_db";
const MILVUS_COLLECTION = process.env.MILVUS_COLLECTION || "full_text_search";

// console.log(`MILVUS_URI: ${MILVUS_URI}`);
// console.log(`MILVUS_TOKEN: ${MILVUS_TOKEN}`);
// console.log(`MILVUS_DB: ${MILVUS_DB}`);
// console.log(`MILVUS_COLLECTION: ${MILVUS_COLLECTION}`);

await Client.wait4Server(MILVUS_URI, MILVUS_TOKEN, MILVUS_DB);
const client = await Client.createClient(MILVUS_URI, MILVUS_TOKEN, MILVUS_DB, MILVUS_COLLECTION);

function createServer() {
    // Create an MCP server
    const server = new McpServer({
        name: "milvus",
        version: "0.0.1"
    }, {
        capabilities: {
            tools: {}
        }
    });

    // Add the insert tool to insert multiple records
    server.tool("insert-multiple",
        'insert the texts into the collection',
        { texts: z.array(z.string()) },
        async ({texts}) => {
            let rev = 0;
            try {
                rev = await client.insert(texts);
            } catch (error) {
                console.log(`insert error: ${JSON.stringify(error, null, 2)}`);
            }
            return {
                content: [{ type: "text", text: `${rev}`}]
            };
        }
    );

    // Add the insert tool to insert single record
    server.tool("insert",
        'insert the text into the collection',
        { text: z.string() },
        async ({text}) => {
            let rev = 0;
            try {
                rev = await client.insert([text]);
            } catch (error) {
                console.log(`insert error: ${JSON.stringify(error, null, 2)}`);
            }
            return {
                content: [{ type: "text", text:  `${rev}`}]
            };
        }
    );

    server.tool("search",
        'search the text in the collection',
        { text: z.string() },
        async ({text}) => {
            const result = await client.search(text);
            return {
                content: result.map((item) => ({
                    type: "text",
                    text: JSON.stringify({id: item.id, contexts: item.text})
                }))
            };
        }
    );
    return server;
}

const app = express();
app.use(express.json());

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// Handle POST requests for client-to-server communication
app.post('/mcp', async (req, res) => {
    // Check for existing session ID
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;
    if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request
        transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            // enableJsonResponse: true,
            onsessioninitialized: (sessionId) => {
                console.log(`new transport: ${sessionId}`);
                // Store the transport by session ID
                transports[sessionId] = transport;
            }
        });

        // Clean up transport when closed
        transport.onclose = () => {
            if (transport.sessionId) {
                console.log(`clean up transport: ${transport.sessionId}`);
                delete transports[transport.sessionId];
            }
        };
        const server = createServer();
        // Connect to the MCP server
        await server.connect(transport);
    } else {
        // Invalid request
        res.status(400).json({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Bad Request: No valid session ID provided',
            },
            id: null,
        });
        return;
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body);
});

// Reusable handler for GET and DELETE requests
const handleSessionRequest = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
};

// Handle GET requests for server-to-client notifications via SSE
app.get('/mcp', handleSessionRequest);

// Handle DELETE requests for session termination
app.delete('/mcp', handleSessionRequest);

async function handleTermination() {
    console.log('Shutting down server...');
    // Close all active transports to properly clean up resources
    for (const sessionId in transports) {
        try {
            console.log(`Closing transport for session ${sessionId}`);
            await transports[sessionId].close();
            delete transports[sessionId];
        } catch (error) {
            console.error(`Error closing transport for session ${sessionId}:`, error);
        }
    }
    // Then the redis connection
    await client.close();
    console.log('Server shut down successfully');
}

// Handle process termination
process.on('SIGINT', async () => {
    await handleTermination();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await handleTermination();
    process.exit(0);
});

app.listen(3000, (error) => {
    if (error) {
        console.log(`failed to bind to 3000: ${error}`);
        return;
    }
    console.log('mcp server is listening on 3000');
});