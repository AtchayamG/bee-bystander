import type { NextFunction, Request, RequestHandler, Response } from 'express';
import cors from 'cors';

/**
 * Who may talk to this server from a browser.
 *
 * Bystander holds a consent ledger. A wide-open CORS policy meant any page in
 * the wearer's browser could flip a bystander to CONSENTED over 127.0.0.1 and
 * then read the speech that consent had been protecting. Two controls close
 * that, and both are needed:
 *
 *  1. Origin allowlist, enforced on the SERVER. A browser always attaches
 *     Origin to a cross-site write and a page cannot forge it. CORS headers on
 *     their own only stop an attacker reading the reply - the write has
 *     already landed by then - so the request is refused outright here.
 *     The MCP Streamable HTTP spec requires this for /mcp as well.
 *  2. Host allowlist, against DNS rebinding: a hostile domain re-pointed at
 *     127.0.0.1 arrives with its own name in Host.
 *
 * A request with no Origin is a non-browser caller (curl, a Node MCP client,
 * the test suite) that is already running on this machine, and is allowed.
 */

const DEFAULT_ORIGINS = [
  'http://127.0.0.1:5175',
  'http://localhost:5175',
  // vite preview
  'http://127.0.0.1:4175',
  'http://localhost:4175'
];

const DEFAULT_HOSTNAMES = ['127.0.0.1', 'localhost', '[::1]', '::1'];

function fromEnv(name: string): string[] | null {
  const raw = process.env[name];
  if (!raw) return null;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function allowedOrigins(): string[] {
  return fromEnv('BYSTANDER_ALLOWED_ORIGINS') ?? DEFAULT_ORIGINS;
}

export function allowedHostnames(): string[] {
  return fromEnv('BYSTANDER_ALLOWED_HOSTS') ?? DEFAULT_HOSTNAMES;
}

function hostnameOf(hostHeader: string | undefined): string | null {
  if (!hostHeader) return null;
  // IPv6 literal: [::1]:3002
  if (hostHeader.startsWith('[')) {
    const end = hostHeader.indexOf(']');
    return end > 0 ? hostHeader.slice(0, end + 1) : hostHeader;
  }
  return hostHeader.split(':')[0].toLowerCase();
}

export function originGuard(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const host = hostnameOf(req.headers.host);
    if (!host || !allowedHostnames().includes(host)) {
      return res.status(403).json({
        error: `Host "${req.headers.host ?? ''}" is not allowed`,
        code: 'HOST_NOT_ALLOWED'
      });
    }

    const origin = req.headers.origin;
    if (origin && !allowedOrigins().includes(origin)) {
      return res.status(403).json({
        error: `Origin "${origin}" is not allowed to use this server`,
        code: 'ORIGIN_NOT_ALLOWED'
      });
    }
    return next();
  };
}

/** CORS grants only for the allowlisted origins - never "*". */
export function corsForAllowedOrigins(): RequestHandler {
  return cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, false);
      return callback(null, allowedOrigins().includes(origin) ? origin : false);
    },
    exposedHeaders: ['Mcp-Session-Id', 'MCP-Protocol-Version']
  });
}
