/**
 * Converge Voice is integrated but disabled until the Supabase migration, RLS
 * adversarial tests, TURN relay, and real-device voice tests have passed.
 * Keep this flag unset in Vercel Production until those release gates pass.
 */
export const voiceCallsEnabled = process.env.NEXT_PUBLIC_CONVERGE_CALLS_ENABLED === "true";
