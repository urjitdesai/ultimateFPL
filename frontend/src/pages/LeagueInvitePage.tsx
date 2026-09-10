import { ArrowRight, CircleAlert, KeyRound, LogIn, UserPlus, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import {
  clearPendingLeagueInvite,
  getOrCreateLeagueInviteRequest,
  isValidLeagueInviteCode,
  leagueInvitePath,
  normalizeLeagueInviteCode,
  savePendingLeagueInvite,
} from "../auth/league-invite";
import { hasPendingOnboarding } from "../auth/onboarding-state";
import { useAuth } from "../auth/AuthContext";
import { AuthShell } from "../components/AuthShell";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { navigate } from "../navigation";

const JOIN_TIMEOUT_MS = 15_000;

export function LeagueInvitePage({ inviteCode: rawInviteCode }: { inviteCode: string }) {
  const inviteCode = normalizeLeagueInviteCode(rawInviteCode);
  const validInviteCode = isValidLeagueInviteCode(inviteCode);
  const { user, profile, loading: authLoading } = useAuth();
  const profileUid = profile?.uid ?? "";
  const [joinError, setJoinError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const joinRequest = useRef<{ key: string; promise: ReturnType<typeof api.joinLeague> } | null>(null);

  useEffect(() => {
    if (validInviteCode) savePendingLeagueInvite(inviteCode);
  }, [inviteCode, validInviteCode]);

  useEffect(() => {
    if (authLoading || !validInviteCode || !user) return;
    if (!profileUid) {
      navigate("/complete-profile", true);
      return;
    }

    const attemptKey = `${user.uid}:${inviteCode}:${retryCount}`;
    const request = getOrCreateLeagueInviteRequest(
      joinRequest.current,
      attemptKey,
      () => api.joinLeague(user, inviteCode),
    );
    joinRequest.current = request;

    let active = true;
    let timeoutId = 0;
    setJoinError("");

    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error("Joining is taking longer than expected. Please try again."));
      }, JOIN_TIMEOUT_MS);
    });

    Promise.race([request.promise, timeout]).then((league) => {
      if (!active) return;
      clearPendingLeagueInvite();
      const destination = `/leagues/${encodeURIComponent(league.id)}`;
      navigate(hasPendingOnboarding(user.uid)
        ? `/onboarding?next=${encodeURIComponent(destination)}`
        : destination, true);
    }).catch((requestError) => {
      if (active) setJoinError(requestError instanceof Error ? requestError.message : "We couldn't join that league.");
    }).finally(() => {
      window.clearTimeout(timeoutId);
    });
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [authLoading, inviteCode, profileUid, retryCount, user, validInviteCode]);

  const continueWithoutInvite = () => {
    clearPendingLeagueInvite();
    navigate(profile && user && hasPendingOnboarding(user.uid) ? "/onboarding" : profile ? "/leagues" : "/", true);
  };

  if (!validInviteCode) return <AuthShell><div className="auth-card login-card invite-card invite-error-card">
    <span className="invite-card-icon"><CircleAlert /></span>
    <span className="invite-eyebrow">League invitation</span>
    <h2>That invite link isn’t valid</h2>
    <p>Check that you received the complete link or ask the league creator to send it again.</p>
    <button className="primary-button" type="button" onClick={continueWithoutInvite}>Go to home <ArrowRight /></button>
  </div></AuthShell>;

  if (authLoading || user) return <AuthShell><div className="auth-card login-card invite-card invite-progress-card">
    {joinError ? <>
      <span className="invite-card-icon"><CircleAlert /></span>
      <span className="invite-eyebrow">League invitation</span>
      <h2>We couldn’t join this league</h2>
      <p>{joinError}</p>
      <div className="invite-actions"><button className="primary-button" type="button" onClick={() => setRetryCount((count) => count + 1)}>Try again <ArrowRight /></button><button className="invite-secondary-button" type="button" onClick={continueWithoutInvite}>{user && hasPendingOnboarding(user.uid) ? "Continue setup" : "Go to my leagues"}</button></div>
    </> : <>
      <span className="invite-card-icon"><Users /></span>
      <span className="invite-eyebrow">Invitation {inviteCode}</span>
      <h2>{profile ? "Joining your league…" : "Preparing your profile…"}</h2>
      <p>{profile ? "We’re adding you to the table and getting the standings ready." : "Complete your player profile and we’ll add you automatically."}</p>
      <LoadingIndicator compact label={profile ? "Joining league…" : "Opening profile setup…"} />
    </>}
  </div></AuthShell>;

  return <AuthShell><div className="auth-card login-card invite-card">
    <span className="invite-card-icon"><KeyRound /></span>
    <span className="invite-eyebrow">You’ve been invited</span>
    <h2>Join the league</h2>
    <p>Sign in or create your player profile. Your invitation will be waiting and you’ll be added automatically.</p>
    <div className="invite-code-panel"><span>League code</span><strong>{inviteCode}</strong></div>
    <div className="invite-actions">
      <button className="primary-button" type="button" onClick={() => { savePendingLeagueInvite(inviteCode); navigate("/login"); }}><LogIn /> Log in to join</button>
      <button className="invite-secondary-button" type="button" onClick={() => { savePendingLeagueInvite(inviteCode); navigate("/register"); }}><UserPlus /> Create an account</button>
    </div>
    <button className="invite-dismiss-button" type="button" onClick={continueWithoutInvite}>Not now</button>
  </div></AuthShell>;
}
