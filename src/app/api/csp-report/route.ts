import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const violation = body['csp-report'] ?? body;

    getAdminFirestore().collection('cspViolations').add({
      blockedURI: violation['blocked-uri'] ?? violation.blockedURL ?? null,
      violatedDirective: violation['violated-directive'] ?? violation.effectiveDirective ?? null,
      sourceFile: violation['source-file'] ?? violation.sourceFile ?? null,
      lineNumber: violation['line-number'] ?? violation.lineNumber ?? null,
      documentURI: violation['document-uri'] ?? violation.documentURL ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
      timestamp: FieldValue.serverTimestamp(),
    }).catch((err: unknown) => console.error('[csp-report] firestore write failed:', err));

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}

export const runtime = 'nodejs';
