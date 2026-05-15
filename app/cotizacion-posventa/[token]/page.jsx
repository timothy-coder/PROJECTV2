import PublicPostventaQuotePage from "@/components/postventaquotes/PublicPostventaQuotePage";

export default async function Page({ params }) {
  const { token } = await params;
  return <PublicPostventaQuotePage token={token} />;
}
