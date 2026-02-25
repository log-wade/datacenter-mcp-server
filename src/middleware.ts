// datacenter-mcp-server/src/middleware.ts
// Security middleware for HTTP transport
// Provides authentication, rate limiting, request validation, CORS, error handling, and logging

import { Request, Response, NextFunction } from "express";

// ─── Types ────────────────────────────────────────────────────────────────

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

// ─── In-Memory Rate Limiting ──────────────────────────────────────────────

const rateLimitBuckets = new Map<string, RateLimitBucket>();

/**
 * Get client IP address from request
 */
function getClientIP(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
    (req.socket.remoteAddress as string) ||
    "unknown"
  );
}

/**
 * Rate limiting middleware using token bucket algorithm
 * Default: 100 requests per minute per IP
 * Configurable via RATE_LIMIT_RPM environment variable
 */
export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const maxRPM = parseInt(process.env.RATE_LIMIT_RPM || "100");
  const clientIP = getClientIP(req);
  const now = Date.now();

  // Initialize or retrieve bucket
  let bucket = rateLimitBuckets.get(clientIP);
  if (!bucket) {
    bucket = { tokens: maxRPM, lastRefill: now };
    rateLimitBuckets.set(clientIP, bucket);
  }

  // Refill tokens based on elapsed time (1 minute = 60000ms)
  const timePassed = now - bucket.lastRefill;
  const tokensToAdd = (timePassed / 60000) * maxRPM;
  bucket.tokens = Math.min(maxRPM, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;

  // Check if request is allowed
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    res.setHeader("X-RateLimit-Limit", maxRPM.toString());
    res.setHeader("X-RateLimit-Remaining", Math.floor(bucket.tokens).toString());
    res.setHeader(
      "X-RateLimit-Reset",
      Math.ceil((60000 - timePassed) / 1000).toString()
    );
    next();
  } else {
    const resetTime = Math.ceil((60000 - timePassed) / 1000);
    res.status(429).json({
      error: "Too Many Requests",
      message: `Rate limit exceeded. Try again in ${resetTime} seconds`,
    });
  }
}

// ─── API Key Authentication ────────────────────────────────────────────────

/**
 * API key authentication middleware
 * Checks for x-api-key header or Authorization: Bearer <key> header
 * Skips auth for /health endpoint
 * Dev mode: allows all requests if API_KEY env var is not set
 */
export function apiKeyAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip auth for health endpoint
  if (req.path === "/health") {
    next();
    return;
  }

  const apiKey = process.env.API_KEY;

  // Dev mode: if API_KEY not set, allow all requests
  if (!apiKey) {
    next();
    return;
  }

  // Check for API key in headers
  let providedKey: string | undefined;

  // Check x-api-key header
  if (req.headers["x-api-key"]) {
    providedKey = req.headers["x-api-key"] as string;
  }

  // Check Authorization: Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    providedKey = authHeader.slice(7);
  }

  // Validate key
  if (!providedKey || providedKey !== apiKey) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Valid API key required",
    });
    return;
  }

  next();
}

// ─── Request Size Limit ────────────────────────────────────────────────────

/**
 * Custom request size limit middleware
 * Default: 1MB (configurable via MAX_BODY_SIZE env var)
 * Returns 413 Payload Too Large on violation
 */
export function requestSizeLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const maxSize = parseInt(process.env.MAX_BODY_SIZE || "1048576"); // 1MB default

  // Get content length header
  const contentLength = req.headers["content-length"];
  if (contentLength && parseInt(contentLength) > maxSize) {
    res.status(413).json({
      error: "Payload Too Large",
      message: `Request body exceeds maximum size of ${maxSize} bytes`,
    });
    return;
  }

  // Also track actual body size
  let bodySize = 0;
  const originalWrite = res.write;
  const originalEnd = res.end;

  req.on("data", (chunk) => {
    bodySize += chunk.length;
    if (bodySize > maxSize) {
      req.pause();
      res.status(413).json({
        error: "Payload Too Large",
        message: `Request body exceeds maximum size of ${maxSize} bytes`,
      });
    }
  });

  next();
}

// ─── CORS Middleware ──────────────────────────────────────────────────────

/**
 * CORS middleware
 * Allows configurable origins via CORS_ORIGINS env var (comma-separated)
 * Defaults to '*' if not set
 * Handles OPTIONS preflight requests
 */
export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const allowedOrigins = (process.env.CORS_ORIGINS || "*")
    .split(",")
    .map((o) => o.trim());

  // Determine allowed origin
  const origin = req.headers.origin as string;
  const isAllowed =
    allowedOrigins.includes("*") || allowedOrigins.includes(origin);

  // Set CORS headers
  if (isAllowed || allowedOrigins.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigins.includes("*") ? "*" : origin);
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-API-Key"
  );
  res.setHeader("Access-Control-Max-Age", "86400");

  // Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }

  next();
}

// ─── Request Logger ────────────────────────────────────────────────────────

/**
 * Request logging middleware
 * Logs: timestamp, method, path, IP, response time, status code
 * Format: [2026-02-25T10:30:00Z] POST /mcp 192.168.1.1 200 45ms
 */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const clientIP = getClientIP(req);

  // Hook into response to log after sending
  const originalEnd = res.end;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).end = function (...args: any[]) {
    const duration = Date.now() - startTime;
    const timestamp = new Date().toISOString();
    const statusCode = res.statusCode;

    console.error(
      `[${timestamp}] ${req.method} ${req.path} ${clientIP} ${statusCode} ${duration}ms`
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (originalEnd as any).apply(res, args);
  };

  next();
}

// ─── Error Sanitizer ───────────────────────────────────────────────────────

/**
 * Global error handler middleware
 * In production: returns generic error message without stack trace
 * In development: includes full error details
 * Always logs full error with timestamp to console.error
 */
export function errorSanitizerMiddleware(
  err: Error | any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const timestamp = new Date().toISOString();

  // Always log full error
  console.error(`[${timestamp}] ERROR:`, {
    message: err.message || String(err),
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: getClientIP(req),
  });

  // Determine response based on environment
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    // Production: generic error
    res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    });
  } else {
    // Development: detailed error
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message || "Unknown error",
      stack: err.stack,
    });
  }
}

// ─── Middleware Stacks ────────────────────────────────────────────────────

/**
 * Complete middleware stack for secured HTTP transport
 * Apply in this order:
 * 1. CORS (must be first for preflight handling)
 * 2. Request Logger
 * 3. Rate Limiting
 * 4. Request Size Limit
 * 5. JSON body parser (external)
 * 6. API Key Auth
 * 7. Routes
 * 8. Error Sanitizer (must be last)
 */
export const middlewareStack = {
  cors: corsMiddleware,
  logger: requestLoggerMiddleware,
  rateLimit: rateLimitMiddleware,
  requestSizeLimit: requestSizeLimitMiddleware,
  apiKeyAuth: apiKeyAuthMiddleware,
  errorSanitizer: errorSanitizerMiddleware,
};
