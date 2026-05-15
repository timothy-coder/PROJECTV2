import PostventaOpportunityDetailPage from "@/components/postventa/PostventaOpportunityDetailPage";

export default async function Page({ params }) {
  const { id } = await params;
  return <PostventaOpportunityDetailPage id={id} />;
}
