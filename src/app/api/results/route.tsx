import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "The optimize endpoint has been removed. Use /api/manual-predict instead." },
    { status: 410 }
  );
}

export async function PUT() {
  return NextResponse.json({ result: null });
}
