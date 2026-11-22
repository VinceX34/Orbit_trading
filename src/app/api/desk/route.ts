import { connection } from "next/server";
import { defaultFlow } from "@/lib/flows";
import { loadDesk, runFlow, setFlowLimit, setFlowPublished } from "@/lib/n8n";

export async function GET() {
  await connection();
  const state = await loadDesk();
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  await connection();
  const body = (await request.json()) as { active?: boolean; run?: boolean; flowId?: string; maxPositions?: number };
  const flowId = body.flowId || defaultFlow().id;
  const state = body.run ? await runFlow(flowId) : body.maxPositions !== undefined ? await setFlowLimit(flowId, body.maxPositions) : await setFlowPublished(flowId, Boolean(body.active));
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
