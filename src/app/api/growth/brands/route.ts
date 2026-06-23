import { NextResponse } from 'next/server';
import { getBrands } from '@/lib/growth/actions/brands';

export async function GET() {
  const brands = await getBrands();
  return NextResponse.json(brands);
}
