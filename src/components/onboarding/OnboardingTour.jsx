import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Compass, Scan, ArrowLeftRight, Users, User, X, ArrowRight } from "lucide-react";

const STEPS = [
  { icon: Sparkles, title: "Welcome to SwapPulse!", body: "The decentralized social network for Pokémon TCG collectors. Let's take a quick tour of the key features.", color: "text-primary" },
  { icon: Compass, title: "Explore the catalog", body: "Browse thousands of cards from every set. Check prices, variants, and join community discussions on any card.", color: "text-accent" },
  { icon: Scan, title: "Scan your cards", body: "Use the AI scanner to instantly identify and add cards to your collection by photo, no manual searching needed.", color: "text-success" },
  { icon: ArrowLeftRight, title: "Trade with collectors", body: "List cards for trade, negotiate with others, and build your reputation in the community trust graph.", color: "text-warning" },
  { icon: Users, title: "Join the community", body: "Follow collectors, join circles, participate in challenges, and attend local meetups.", color: "text-primary" },
  { icon: User, title: "Your profile", body: "This is your home base. Edit your bio, showcase your binder, and manage your collection, all in your control.", color: "text-accent" },
];

export default function OnboardingTour({ onComplete }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const next = () => {
    if (isLast) {
      localStorage.setItem("swappulse_onboarding_done", "1");
      onComplete?.();
    } else {
      setStep(step + 1);
    }
  };

  const skip = () => {
    localStorage.setItem("swappulse_onboarding_done", "1");
    onComplete?.();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg border border-border p-8 relative">
          <button onClick={skip} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" aria-label="Skip tour">
            <X className="h-5 w-5" />
          </button>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary mb-5">
              <Icon className={`w-8 h-8 ${current.color}`} />
            </div>
            <h2 className="text-2xl font-bold mb-3">{current.title}</h2>
            <p className="text-muted-foreground mb-6">{current.body}</p>
          </div>
          <div className="flex justify-center gap-2 mb-6">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-2 rounded-full transition-all ${i === step ? "w-8 bg-primary" : "w-2 bg-border"}`} />
            ))}
          </div>
          <div className="flex gap-3">
            {step > 0 && (
              <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button className="flex-1 h-12 font-medium" onClick={next}>
              {isLast ? "Go to profile" : "Next"}
              {!isLast && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
          <button onClick={skip} className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground">
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}