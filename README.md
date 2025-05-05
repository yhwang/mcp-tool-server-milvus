# mcp-tool-server-milvus
A MCP server which provides tools function to insert into and query data from the Milvus vector database.

By default, the server creates a database and a collection. The insert and search tools operate upon
the default database and collection. You can use the following env vars to configure the database and collection:
- `MILVUS_DB`: The name of the Milvus database. Default is `mcp_db`. The db will be created if it does not exist.
- `MILVUS_COLLECTION`: The name of the Milvus collection. Default is `full_text_search`.
  The collection will be created if it does not exist.

## Run MCP Server

Use docker compose to start up the server
```bash
docker compose up -d
```

This starts a MCP server with Milvus as the backend. The server will be available at `http://localhost:3000`.

## Interact with MCP server using MCP-Cli

You can also use the `mcp-cli` command line tool to interact with your MCP server. To use it, run the following command:
```
npx @wong2/mcp-cli --url http://localhost:3000/mcp
```
This will connect to the MCP server via streamable HTTP. It will prompt you the list of available tools and allow you to call them with JSON arguments. For example:
```
$ npx @wong2/mcp-cli --url http://localhost:3000/mcp
✔ Connected, server capabilities: tools
? Pick a primitive ›
❯   tool(insert-multiple) - insert the texts into the collection
    tool(insert) - insert the text into the collection
    tool(search) - search the text in the collection
```
You can use cursor to navigate the list and select the desired primitive. Then, you will be prompted to enter the arguments for the selected primitive.

- For `tool(insert-multiple)`, you can enter a JSON array of strings as the argument. However, MCP-Cli doesn't support
  it yet. You can use the `simpleStreamableHttp` example in the `@modelcontextprotocol/sdk` package to interact with
  this tool API.
- For `tool(insert)`, you can enter a string as the argument to insert a single text string into the collection.
- For `tool(search)`, you can enter a string as the argument to search for the text in the collection and return
  the matching results.


## Use simpleStreamableHttp example
You can interact with the MCP server using the simple streamable HTTP client from the MCP typescript-sdk repo:
https://github.com/modelcontextprotocol/typescript-sdk.git

Here is the usage:
```
git clone https://github.com/modelcontextprotocol/typescript-sdk.git
cd typescript-sdk
npm install
npx tsx src/examples/client/simpleStreamableHttp.ts
```
By default, the client will connect to `http://localhost:3000` and you should see the following outputs:
```
MCP Interactive Client
=====================
Connecting to http://localhost:3000/mcp...
Transport created with session ID: 44dff10f-89bc-4965-b280-e1df3eb56a51
Connected to MCP server

Available commands:
  connect [url]              - Connect to MCP server (default: http://localhost:3000/mcp)
  disconnect                 - Disconnect from server
  terminate-session          - Terminate the current session
  reconnect                  - Reconnect to the server
  list-tools                 - List available tools
  call-tool <name> [args]    - Call a tool with optional JSON arguments
  greet [name]               - Call the greet tool
  multi-greet [name]         - Call the multi-greet tool with notifications
  start-notifications [interval] [count] - Start periodic notifications
  list-prompts               - List available prompts
  get-prompt [name] [args]   - Get a prompt with optional JSON arguments
  list-resources             - List available resources
  help                       - Show this help
  quit                       - Exit the program

>
```

Then you are in the interactive prompt mode. To connect to different MCP server, just type `connect [url]` and press enter.

Use the `list-tools` command to list all available tools. There are 3 available tools:
```
> list-tools
Available tools:
  - insert-multiple: insert the texts into the collection
  - insert: insert the text into the collection
  - search: search the text in the collection
```

Use the `call-tool <name>` command to call a tool with optional JSON arguments. For example, here is how you call
the `insert-multiple` tool to insert multiple texts into the collection:
```
> call-tool insert-multiple {"texts": ["call-tool <name> [args]: Call a tool with optional JSON arguments", "list-prompts: List available prompts"]}
Calling tool 'insert-multiple' with args: {
  texts: [
    'call-tool <name> [args]: Call a tool with optional JSON arguments',
    'list-prompts: List available prompts'
  ]
}
Tool result:
  2
```

The number: `2` indicates that the insert operation has inserted two records into the collection.