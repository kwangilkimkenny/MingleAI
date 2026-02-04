import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initDatabase } from "./storage/database.js";
import { registerProfileTools } from "./tools/profile.tools.js";
import { registerPartyTools } from "./tools/party.tools.js";
import { registerReportTools } from "./tools/report.tools.js";
import { registerDatePlanTools } from "./tools/date-plan.tools.js";
import { registerSafetyTools } from "./tools/safety.tools.js";

const db = initDatabase();

const server = new McpServer({
  name: "mingle-mcp",
  version: "0.1.0",
});

registerProfileTools(server, db);
registerPartyTools(server, db);
registerReportTools(server, db);
registerDatePlanTools(server, db);
registerSafetyTools(server, db);

const transport = new StdioServerTransport();
await server.connect(transport);
