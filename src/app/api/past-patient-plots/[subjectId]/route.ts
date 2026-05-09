import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  const { subjectId } = await params;

  // Validate: must be a positive integer
  if (!/^\d+$/.test(subjectId)) {
    return NextResponse.json({ error: "Invalid subject ID" }, { status: 400 });
  }

  const filePath = path.join(
    process.cwd(),
    "src/app/api/data/past-patient-plots",
    `${subjectId}.json`
  );

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return new NextResponse(content, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
