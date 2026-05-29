import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const { patientId } = await params;

    const res = await fetch(`${BACKEND_URL}/v1/patients/${patientId}/fit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail ?? `Backend fit failed: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json({ result: "ok", fitted_at: data.fitted_at });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Retrain error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
