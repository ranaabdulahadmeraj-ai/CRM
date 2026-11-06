import { NextResponse } from "next/server";
import { createWebsiteInquiry } from "@/lib/leads";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_384) {
    return NextResponse.json({ error: "Inquiry payload is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16_384) {
      return NextResponse.json({ error: "Inquiry payload is too large." }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch (error) {
    console.warn("Website inquiry request contained malformed JSON.", error);
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const result = await createWebsiteInquiry(body);
    if (result.kind === "invalid") {
      return NextResponse.json({
        error: "Invalid inquiry payload.",
        details: result.issues.map((issue) => issue.message),
      }, { status: 400 });
    }
    if (result.kind === "duplicate") {
      return NextResponse.json({ error: "An inquiry with these contact details already exists." }, { status: 409 });
    }
    return NextResponse.json(
      { success: true, leadId: result.leadId, customerId: result.customerId },
      { status: 201 },
    );
  } catch (error) {
    console.error("Website inquiry could not be persisted.", error);
    return NextResponse.json({ error: "Unable to save inquiry. Please try again later." }, { status: 500 });
  }
}
