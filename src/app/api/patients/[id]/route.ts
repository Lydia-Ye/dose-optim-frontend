import { NextRequest, NextResponse } from "next/server";
import {
  backendGet,
  backendPost,
  toFrontendPatient,
  enrichWithTrajectory,
  BackendPatient,
  BackendModelResponse,
  BACKEND_URL,
} from "@/lib/backend";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const detail = await backendGet<BackendPatient>(`/v1/patients/${id}`);
    const base = toFrontendPatient(detail);

    const model = await backendPost<BackendModelResponse>(
      `/v1/patients/${id}/predict`,
      { n_samples: 200 }
    );

    return NextResponse.json(enrichWithTrajectory(base, detail, model));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch patient" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = await fetch(`${BACKEND_URL}/v1/patients/${id}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Backend DELETE → ${res.status}`);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete patient" }, { status: 500 });
  }
}
