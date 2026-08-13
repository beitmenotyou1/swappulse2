import React, { useState } from "react";
import { Search, Loader2, UserPlus, UserCheck, ExternalLink, Globe } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { createBridgedFollow } from "@/lib/followBridge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Avatar from "@/components/Avatar";

// ExternalActorSearch — lets SwapPulse users discover and follow AT Protocol
// accounts from other PDSs (federation follows). Searches via the public
// AppView, resolves handle → DID + profile, and creates a local Follow entity.
export default function ExternalActorSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [following, setFollowing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    const handle = query.trim().replace(/^@/, "");
    if (!handle) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke("resolve-atproto-actor", { handle });
      if (res.data?.found) {
        setResult(res.data);
        // Check if already following
        const me = await base44.auth.me().catch(() => null);
        const myDid = me?.did || "";
        if (myDid) {
          const existing = await base44.entities.Follow.filter({
            did: myDid,
            subject_did: res.data.did,
          }).catch(() => []);
          setIsFollowing(existing.length > 0);
        }
      } else {
        setError(res.data?.error || "No account found with that handle.");
      }
    } catch (err) {
      setError(err.message || "Could not search for that handle.");
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!result) return;
    setFollowing(true);
    try {
      await createBridgedFollow(result.did, result.displayName, result.handle, result.avatar);
      setIsFollowing(true);
    } catch (err) {
      console.error("follow error", err);
    } finally {
      setFollowing(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-base">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="h-5 w-5 text-primary" />
        <h2 className="font-bold">Find people on the AT Protocol</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Follow collectors from Bluesky or any other AT Protocol site — their posts will appear in your feed.
      </p>
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="text"
            placeholder="e.g. alice.bsky.social"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {result && (
        <div className="mt-4 rounded-lg border border-border p-3 animate-fade-in">
          <div className="flex items-start gap-3">
            <Avatar name={result.displayName || result.handle} src={result.avatar} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold">{result.displayName || result.handle}</p>
                {result.isMember ? (
                  <Badge variant="secondary" className="text-xs">SwapPulse member</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs gap-1">
                    <ExternalLink className="w-3 h-3" />
                    External
                  </Badge>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">@{result.handle}</p>
              {result.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{result.description}</p>
              )}
              <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                <span>{result.followsCount || 0} following</span>
                <span>{result.followersCount || 0} followers</span>
                <span>{result.postsCount || 0} posts</span>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <Button
              size="sm"
              onClick={handleFollow}
              disabled={following || isFollowing}
              className={isFollowing ? "bg-secondary text-secondary-foreground hover:bg-secondary" : ""}
            >
              {following ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : isFollowing ? <UserCheck className="w-4 h-4 mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
              {isFollowing ? "Following" : "Follow"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}