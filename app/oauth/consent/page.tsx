import OAuthConsent from "./oauth-consent";

type PageProps = {
  searchParams: Promise<{ authorization_id?: string }>;
};

export default async function OAuthConsentPage({ searchParams }: PageProps) {
  const { authorization_id: authorizationId } = await searchParams;
  return <OAuthConsent authorizationId={authorizationId ?? ""} />;
}
