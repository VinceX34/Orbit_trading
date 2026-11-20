import { connection } from "next/server";
import { loadDesk, runNow, setPublished } from "@/lib/n8n";

export async function GET() {
  await connection();
  const state = await loadDesk();
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  await connection();
  const body = (await request.json()) as { active?: boolean; run?: boolean };
  const state = body.run ? await runNow() : await setPublished(Boolean(body.active));
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
