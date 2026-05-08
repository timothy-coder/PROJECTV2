import OpportunityDetailPage from "@/components/opportunities/OpportunityDetailPage";

export default async function Page({ params }) {
  const { id } = await params;
  return <OpportunityDetailPage id={id} />;
}
