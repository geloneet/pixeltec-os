/**
 * GET /api/health
 *
 * Health check endpoint for monitoring and observability tools.
 * Returns HTTP 200 with basic status information.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
