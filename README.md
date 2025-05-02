# mcp-tool-server-milvus
A MCP server which provides tools function to insert into and query data from the Milvus vector database.

By default, the server creates a database and a collection. The insert and search tools are operated on
the default database and collection.

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
❯   tool(insert) - insert the text into the collection
    tool(search) - search the text in the collection
```
You can use cursor to navigate the list and select the desired primitive. Then, you will be prompted to enter the arguments for the selected primitive.
