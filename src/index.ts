#!/usr/bin/env node

import http from "node:http";
import { URL } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { QuickbooksMCPServer } from "./server/qbo-mcp-server.js";
// import { ListInvoicesTool } from "./tools/list-invoices.tool.js";
// import { CreateCustomerTool } from "./tools/create-customer.tool.js";
import { CreateInvoiceTool } from "./tools/create-invoice.tool.js";
import { RegisterTool } from "./helpers/register-tool.js";
import { ReadInvoiceTool } from "./tools/read-invoice.tool.js";
import { SearchInvoicesTool } from "./tools/search-invoices.tool.js";
import { UpdateInvoiceTool } from "./tools/update-invoice.tool.js";
import { CreateAccountTool } from "./tools/create-account.tool.js";
import { UpdateAccountTool } from "./tools/update-account.tool.js";
import { SearchAccountsTool } from "./tools/search-accounts.tool.js";
import { ReadItemTool } from "./tools/read-item.tool.js";
import { SearchItemsTool } from "./tools/search-items.tool.js";
import { CreateItemTool } from "./tools/create-item.tool.js";
import { UpdateItemTool } from "./tools/update-item.tool.js";
// import { ListAccountsTool } from "./tools/list-accounts.tool.js";
// import { UpdateCustomerTool } from "./tools/update-customer.tool.js";
import { CreateCustomerTool } from "./tools/create-customer.tool.js";
import { GetCustomerTool } from "./tools/get-customer.tool.js";
import { UpdateCustomerTool } from "./tools/update-customer.tool.js";
import { DeleteCustomerTool } from "./tools/delete-customer.tool.js";
import { CreateEstimateTool } from "./tools/create-estimate.tool.js";
import { GetEstimateTool } from "./tools/get-estimate.tool.js";
import { UpdateEstimateTool } from "./tools/update-estimate.tool.js";
import { DeleteEstimateTool } from "./tools/delete-estimate.tool.js";
import { SearchCustomersTool } from "./tools/search-customers.tool.js";
import { SearchEstimatesTool } from "./tools/search-estimates.tool.js";
import { CreateBillTool } from "./tools/create-bill.tool.js";
import { UpdateBillTool } from "./tools/update-bill.tool.js";
import { DeleteBillTool } from "./tools/delete-bill.tool.js";
import { GetBillTool } from "./tools/get-bill.tool.js";
import { CreateVendorTool } from "./tools/create-vendor.tool.js";
import { UpdateVendorTool } from "./tools/update-vendor.tool.js";
import { DeleteVendorTool } from "./tools/delete-vendor.tool.js";
import { GetVendorTool } from "./tools/get-vendor.tool.js";
import { SearchBillsTool } from "./tools/search-bills.tool.js";
import { SearchVendorsTool } from "./tools/search-vendors.tool.js";

// Employee tools
import { CreateEmployeeTool } from "./tools/create-employee.tool.js";
import { GetEmployeeTool } from "./tools/get-employee.tool.js";
import { UpdateEmployeeTool } from "./tools/update-employee.tool.js";
import { SearchEmployeesTool } from "./tools/search-employees.tool.js";

// Journal Entry tools
import { CreateJournalEntryTool } from "./tools/create-journal-entry.tool.js";
import { GetJournalEntryTool } from "./tools/get-journal-entry.tool.js";
import { UpdateJournalEntryTool } from "./tools/update-journal-entry.tool.js";
import { DeleteJournalEntryTool } from "./tools/delete-journal-entry.tool.js";
import { SearchJournalEntriesTool } from "./tools/search-journal-entries.tool.js";

// Bill Payment tools
import { CreateBillPaymentTool } from "./tools/create-bill-payment.tool.js";
import { GetBillPaymentTool } from "./tools/get-bill-payment.tool.js";
import { UpdateBillPaymentTool } from "./tools/update-bill-payment.tool.js";
import { DeleteBillPaymentTool } from "./tools/delete-bill-payment.tool.js";
import { SearchBillPaymentsTool } from "./tools/search-bill-payments.tool.js";

// Purchase tools
import { CreatePurchaseTool } from "./tools/create-purchase.tool.js";
import { GetPurchaseTool } from "./tools/get-purchase.tool.js";
import { UpdatePurchaseTool } from "./tools/update-purchase.tool.js";
import { DeletePurchaseTool } from "./tools/delete-purchase.tool.js";
import { SearchPurchasesTool } from "./tools/search-purchases.tool.js";

type TransportMode = "stdio" | "sse";

const registerTools = (server: ReturnType<typeof QuickbooksMCPServer.GetServer>) => {
  // Customers
  RegisterTool(server, CreateCustomerTool);
  RegisterTool(server, GetCustomerTool);
  RegisterTool(server, UpdateCustomerTool);
  RegisterTool(server, DeleteCustomerTool);
  RegisterTool(server, SearchCustomersTool);
  // Estimates
  RegisterTool(server, CreateEstimateTool);
  RegisterTool(server, GetEstimateTool);
  RegisterTool(server, UpdateEstimateTool);
  RegisterTool(server, DeleteEstimateTool);
  RegisterTool(server, SearchEstimatesTool);
  // Bills
  RegisterTool(server, CreateBillTool);
  RegisterTool(server, UpdateBillTool);
  RegisterTool(server, DeleteBillTool);
  RegisterTool(server, GetBillTool);
  RegisterTool(server, SearchBillsTool);
  // Invoices
  RegisterTool(server, ReadInvoiceTool);
  RegisterTool(server, SearchInvoicesTool);
  RegisterTool(server, CreateInvoiceTool);
  RegisterTool(server, UpdateInvoiceTool);
  // Chart of accounts
  RegisterTool(server, CreateAccountTool);
  RegisterTool(server, UpdateAccountTool);
  RegisterTool(server, SearchAccountsTool);
  // Items
  RegisterTool(server, ReadItemTool);
  RegisterTool(server, SearchItemsTool);
  RegisterTool(server, CreateItemTool);
  RegisterTool(server, UpdateItemTool);
  // Vendors
  RegisterTool(server, CreateVendorTool);
  RegisterTool(server, UpdateVendorTool);
  RegisterTool(server, DeleteVendorTool);
  RegisterTool(server, GetVendorTool);
  RegisterTool(server, SearchVendorsTool);
  // Employees
  RegisterTool(server, CreateEmployeeTool);
  RegisterTool(server, GetEmployeeTool);
  RegisterTool(server, UpdateEmployeeTool);
  RegisterTool(server, SearchEmployeesTool);
  // Journal entries
  RegisterTool(server, CreateJournalEntryTool);
  RegisterTool(server, GetJournalEntryTool);
  RegisterTool(server, UpdateJournalEntryTool);
  RegisterTool(server, DeleteJournalEntryTool);
  RegisterTool(server, SearchJournalEntriesTool);
  // Bill payments
  RegisterTool(server, CreateBillPaymentTool);
  RegisterTool(server, GetBillPaymentTool);
  RegisterTool(server, UpdateBillPaymentTool);
  RegisterTool(server, DeleteBillPaymentTool);
  RegisterTool(server, SearchBillPaymentsTool);
  // Purchases
  RegisterTool(server, CreatePurchaseTool);
  RegisterTool(server, GetPurchaseTool);
  RegisterTool(server, UpdatePurchaseTool);
  RegisterTool(server, DeletePurchaseTool);
  RegisterTool(server, SearchPurchasesTool);
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  let transport: TransportMode = "stdio";
  let host = "127.0.0.1";
  let port = 8812;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--transport") {
      const next = args[i + 1];
      if (next !== "stdio" && next !== "sse") {
        throw new Error(`Invalid transport: ${next ?? "(missing)"}`);
      }
      transport = next;
      i += 1;
      continue;
    }
    if (arg === "--host") {
      host = args[i + 1] ?? host;
      i += 1;
      continue;
    }
    if (arg === "--port") {
      const next = Number.parseInt(args[i + 1] ?? "", 10);
      if (!Number.isFinite(next) || next <= 0 || next > 65535) {
        throw new Error(`Invalid port: ${args[i + 1] ?? "(missing)"}`);
      }
      port = next;
      i += 1;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      console.log("Usage: quickbooks-mcp [--transport stdio|sse] [--host 127.0.0.1] [--port 8812]");
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { transport, host, port };
};

const startStdio = async () => {
  const server = QuickbooksMCPServer.GetServer();
  registerTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

const startSse = async (host: string, port: number) => {
  const sessions = new Map<string, SSEServerTransport>();

  const webServer = http.createServer(async (req, res) => {
    try {
      if (!req.url) {
        res.writeHead(400).end("Missing URL");
        return;
      }

      const url = new URL(req.url, `http://${host}:${port}`);

      if (req.method === "GET" && url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === "GET" && url.pathname === "/sse") {
        const transport = new SSEServerTransport("/message", res);
        const server = QuickbooksMCPServer.GetServer();
        registerTools(server);

        transport.onclose = () => {
          sessions.delete(transport.sessionId);
        };
        transport.onerror = (error) => {
          console.error("SSE transport error:", error);
        };

        sessions.set(transport.sessionId, transport);
        await server.connect(transport);
        return;
      }

      if (req.method === "POST" && url.pathname === "/message") {
        const sessionId = url.searchParams.get("sessionId");
        if (!sessionId) {
          res.writeHead(400).end("Missing sessionId");
          return;
        }
        const transport = sessions.get(sessionId);
        if (!transport) {
          res.writeHead(404).end("Session not found");
          return;
        }
        await transport.handlePostMessage(req, res);
        return;
      }

      res.writeHead(404).end("Not found");
    } catch (error) {
      console.error("Request error:", error);
      if (!res.headersSent) {
        res.writeHead(500).end("Internal server error");
      } else {
        res.end();
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    webServer.once("error", reject);
    webServer.listen(port, host, () => resolve());
  });

  console.error(`QuickBooks MCP SSE server listening on http://${host}:${port}/sse`);
};

const main = async () => {
  const { transport, host, port } = parseArgs();

  if (transport === "sse") {
    await startSse(host, port);
    return;
  }

  await startStdio();
};

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
