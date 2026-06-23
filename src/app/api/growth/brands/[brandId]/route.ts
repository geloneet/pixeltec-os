import { NextResponse } from 'next/server';
import { getBrand } from '@/lib/growth/actions/brands';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(brand);
}
