import { connection } from "next/server";
import { loadDesk, setPublished } from "@/lib/n8n";

export async function GET() {
  await connection();
  const state = await loadDesk();
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  await connection();
  const body = (await request.json()) as { active?: boolean };
  const state = await setPublished(Boolean(body.active));
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
