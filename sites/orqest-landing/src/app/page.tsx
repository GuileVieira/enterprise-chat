'use client';

import { useState } from "react";
import { GlassNav } from "@/components/ui/GlassNav";
import { QualificationModal } from "@/components/ui/QualificationModal";
import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { FalseHope } from "@/components/sections/FalseHope";
import { Solution } from "@/components/sections/Solution";
import { AgentsBento } from "@/components/sections/AgentsBento";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Proof } from "@/components/sections/Proof";
import { WhoIsFor } from "@/components/sections/WhoIsFor";
import { FAQ } from "@/components/sections/FAQ";
import { Closing } from "@/components/sections/Closing";
import { Footer } from "@/components/sections/Footer";

export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main className="relative">
      <GlassNav onCtaClick={() => setModalOpen(true)} />
      <Hero onCtaClick={() => setModalOpen(true)} />
      <Problem />
      <FalseHope />
      <Solution />
      <AgentsBento />
      <HowItWorks />
      <Proof />
      <WhoIsFor />
      <FAQ />
      <Closing onCtaClick={() => setModalOpen(true)} />
      <Footer />
      <QualificationModal open={modalOpen} onOpenChange={setModalOpen} />
    </main>
  );
}
