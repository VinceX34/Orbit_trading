import { AnalysisDetail } from "@/components/analysis-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnalysisDetail id={id} />;
}
