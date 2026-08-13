import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, Loader2, AtSign } from "lucide-react";

export default function UsernameField({ value, onChange }) {
  const [status, setStatus] = useState("idle"); // idle | checking | available | taken
  const [suggestions, setSuggestions] = useState([]);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const normalized = value.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
    if (normalized !== value) onChange(normalized);
    if (!normalized || normalized.length < 3) {
      setStatus("idle");
      setSuggestions([]);
      return;
    }
    setStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke("check-username", { username: normalized });
        if (res.data?.available) {
          setStatus("available");
          setSuggestions([]);
          setReason("");
        } else {
          setStatus("taken");
          setSuggestions(res.data?.suggestions || []);
          setReason(res.data?.reason || "That username is taken");
        }
      } catch {
        setStatus("idle");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="space-y-2">
      <Label htmlFor="username">Username <span className="text-destructive">*</span></Label>
      <div className="relative">
        <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <Input
          id="username"
          type="text"
          autoComplete="username"
          autoFocus
          placeholder="cardmaster"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-10 h-12"
          required
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {status === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {status === "available" && <Check className="h-4 w-4 text-success" />}
          {status === "taken" && <X className="h-4 w-4 text-destructive" />}
        </div>
      </div>
      {status === "available" && <p className="text-xs text-success">Available!</p>}
      {status === "taken" && (
        <div className="space-y-1">
          <p className="text-xs text-destructive">{reason}</p>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-muted-foreground">Try:</span>
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => onChange(s)} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary/20">
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}