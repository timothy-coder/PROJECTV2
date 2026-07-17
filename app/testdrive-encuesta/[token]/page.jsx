import PublicTestDriveSurveyPage from "@/components/opportunities/PublicTestDriveSurveyPage";

export default async function Page({ params }) {
  const { token } = await params;
  return <PublicTestDriveSurveyPage token={token} />;
}
