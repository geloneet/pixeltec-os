import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cspViolations } from '@/lib/db/schema';
import { enforceRateLimit } from '@/lib/rate-limit';

// Browsers send one of these for CSP/Reporting-API violation reports.
const ALLOWED_CONTENT_TYPES = ['application/csp-report', 'application/json', 'application/reports+json'];

// Body cap — real CSP reports are a few hundred bytes; be generous but bounded.
const MAX_BODY_BYTES = 10 * 1024;

const RATE_LIMIT = { max: 20, windowMs: 5 * 60 * 1000 };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Loose shape check — enough to reject arbitrary junk without over-fitting to one browser's format. */
function looksLikeCspReport(body: unknown): boolean {
  if (!isPlainObject(body)) return false;
  if (isPlainObject(body['csp-report'])) return true;
  // Some browsers (Reporting API) send an array of reports; report-uri sends a single flat object.
  const candidate = body;
  return (
    'blocked-uri' in candidate ||
    'blockedURL' in candidate ||
    'violated-directive' in candidate ||
    'effectiveDirective' in candidate
  );
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    const isAllowedContentType = ALLOWED_CONTENT_TYPES.some((t) => contentType.includes(t));
    if (!isAllowedContentType) {
      // Silently ignore — don't reveal that it was rejected.
      return new NextResponse(null, { status: 204 });
    }

    const contentLength = Number(req.headers.get('content-length') ?? '0');
    if (contentLength > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 204 });
    }

    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 204 });
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown';
    const rl = await enforceRateLimit({
      ip,
      bucket: 'csp_report',
      max: RATE_LIMIT.max,
      windowMs: RATE_LIMIT.windowMs,
    });
    if (!rl.allowed) {
      return new NextResponse(null, { status: 204 });
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new NextResponse(null, { status: 204 });
    }

    if (!looksLikeCspReport(body) || !isPlainObject(body)) {
      return new NextResponse(null, { status: 204 });
    }

    const violation = isPlainObject(body['csp-report']) ? body['csp-report'] : body;

    const lineRaw = violation['line-number'] ?? violation.lineNumber;
    const lineNumber = typeof lineRaw === 'number' && Number.isFinite(lineRaw) ? Math.trunc(lineRaw) : null;

    db.insert(cspViolations).values({
      blockedUri: String(violation['blocked-uri'] ?? violation.blockedURL ?? '') || null,
      violatedDirective: String(violation['violated-directive'] ?? violation.effectiveDirective ?? '') || null,
      sourceFile: String(violation['source-file'] ?? violation.sourceFile ?? '') || null,
      lineNumber,
      documentUri: String(violation['document-uri'] ?? violation.documentURL ?? '') || null,
      userAgent: req.headers.get('user-agent') ?? null,
    }).catch((err: unknown) => console.error('[csp-report] db write failed:', err));

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}

export const runtime = 'nodejs';
