import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  await params;
  return NextResponse.json({ error: "No cached prediction results" }, { status: 404 });
}
