import { setRequestLocale } from "next-intl/server";

import { AboutTeaser } from "@/components/sections/AboutTeaser";
import { Contact } from "@/components/sections/Contact";
import { Hero } from "@/components/sections/Hero";
import { Projects } from "@/components/sections/Projects";
import { Proof } from "@/components/sections/Proof";
import { Services } from "@/components/sections/Services";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <Hero />
      <Proof />
      <Services />
      <Projects />
      <AboutTeaser />
      <Contact />
    </>
  );
}
