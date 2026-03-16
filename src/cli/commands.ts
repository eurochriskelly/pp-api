import axios from 'axios';
import { loadRouteInventory } from './route-inventory';
import { CommandContext, CommandDefinition } from './types';
import {
  getBooleanOption,
  getRepeatedStringOption,
  getStringOption,
  parseKeyValueEntries,
  printJson,
  projectRoot,
  readJsonInput,
  resolveApiBaseUrl,
} from './utils';

export const commands: CommandDefinition[] = [
  {
    name: 'serve',
    summary: 'Start the API server with optional runtime overrides.',
    usage:
      'pp-api-cli serve [--port 4001] [--database EuroTourno] [--app development/mobile] [--env development] [--mock]',
    run: async ({ parsed }: CommandContext) => {
      const port = getStringOption(parsed, 'port');
      const database = getStringOption(parsed, 'database');
      const app = getStringOption(parsed, 'app');
      const env = getStringOption(parsed, 'env');
      const mock = getBooleanOption(parsed, 'mock');

      if (port) process.env.PP_PORT_API = port;
      if (database) {
        process.env.PP_DATABASE = database;
        process.env.PP_DBN = database;
      }
      if (app) process.env.PP_API_APP = app;
      if (env) process.env.PP_ENV = env;
      if (mock) {
        process.env.PP_DATABASE = 'MockTourno';
        process.env.PP_DBN = 'MockTourno';
      }

      await import('../server');
    },
  },
  {
    name: 'health',
    summary: 'Check the running API health endpoint.',
    usage: 'pp-api-cli health [--base-url http://localhost:4001] [--json]',
    run: async ({ parsed }: CommandContext) => {
      const baseUrl = resolveApiBaseUrl(parsed);
      const response = await axios.get(`${baseUrl}/health`);

      if (getBooleanOption(parsed, 'json')) {
        printJson(response.data);
        return;
      }

      process.stdout.write(`Health: ${response.status} ${response.statusText}\n`);
      printJson(response.data);
    },
  },
  {
    name: 'mode',
    summary: 'Inspect the running API mode and selected database.',
    usage: 'pp-api-cli mode [--base-url http://localhost:4001] [--json]',
    run: async ({ parsed }: CommandContext) => {
      const baseUrl = resolveApiBaseUrl(parsed);
      const response = await axios.get(`${baseUrl}/api/system/mode`);

      if (getBooleanOption(parsed, 'json')) {
        printJson(response.data);
        return;
      }

      process.stdout.write(`Mode endpoint: ${baseUrl}/api/system/mode\n`);
      printJson(response.data);
    },
  },
  {
    name: 'env',
    summary: 'Print resolved backend runtime configuration from env and config.ts.',
    usage: 'pp-api-cli env [--json]',
    run: async ({ parsed }: CommandContext) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const config = require('../config');
      const port = process.env.PP_PORT_API || process.env.PORT || '4001';
      const database = process.env.PP_DATABASE || process.env.PP_DBN || 'EuroTourno';
      const app =
        process.env.PP_API_APP || `${process.env.PP_ENV || 'development'}/mobile`;

      const summary = {
        env: process.env.PP_ENV || 'development',
        port,
        app,
        database,
        mode: database === 'MockTourno' ? 'mock' : 'database',
        apiBaseUrl: `http://localhost:${port}`,
        dbConf: config.dbConf,
        clubEventsDbConf: config.clubEventsDbConf,
      };

      if (getBooleanOption(parsed, 'json')) {
        printJson(summary);
        return;
      }

      printJson(summary);
    },
  },
  {
    name: 'routes',
    summary: 'List API routes discovered from src/api/routes and direct registrations.',
    usage:
      'pp-api-cli routes [--method GET] [--contains tournaments] [--json]',
    run: async ({ parsed }: CommandContext) => {
      const methodFilter = getStringOption(parsed, 'method')?.toUpperCase();
      const contains = getStringOption(parsed, 'contains');
      const routes = loadRouteInventory(projectRoot()).filter((route) => {
        if (methodFilter && route.method !== methodFilter) return false;
        if (
          contains &&
          !`${route.method} ${route.path} ${route.source}`
            .toLowerCase()
            .includes(contains.toLowerCase())
        ) {
          return false;
        }
        return true;
      });

      if (getBooleanOption(parsed, 'json')) {
        printJson(routes);
        return;
      }

      routes.forEach((route) => {
        process.stdout.write(
          `${route.method.padEnd(6)} ${route.path.padEnd(55)} ${route.source}\n`
        );
      });
      process.stdout.write(`\n${routes.length} route(s)\n`);
    },
  },
  {
    name: 'request',
    summary: 'Send an HTTP request to the API with headers, query params, and JSON bodies.',
    usage:
      'pp-api-cli request --path /api/tournaments --method GET [--base-url http://localhost:4001] [--query key=value] [--header key=value] [--body \'{"name":"Test"}\']',
    run: async ({ parsed }: CommandContext) => {
      const baseUrl = resolveApiBaseUrl(parsed);
      const method = (getStringOption(parsed, 'method') || 'GET').toUpperCase();
      const requestPath = getStringOption(parsed, 'path');
      if (!requestPath) {
        throw new Error("The 'request' command requires --path.");
      }

      const headers = parseKeyValueEntries(
        getRepeatedStringOption(parsed, 'header', 'H')
      );
      const queries = parseKeyValueEntries(
        getRepeatedStringOption(parsed, 'query', 'q')
      );
      const token = getStringOption(parsed, 'token');
      const bodyRaw = getStringOption(parsed, 'body');
      const data = bodyRaw ? readJsonInput(bodyRaw) : undefined;

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.request({
        baseURL: baseUrl,
        url: requestPath,
        method: method as any,
        headers,
        params: queries,
        data,
      });

      printJson({
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
      });
    },
  },
];
