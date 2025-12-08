
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ThemeProvider from "@/components/ThemeProvider";
import TailwindIndicator from "@/components/utils/TailwindIndicator";
import GlowBorder from "@/components/utils/layout/GlowBorder";

// Layout
import Layout from "@/pages/Layout";

// Content Pages (Lightseed)
import Home from "@/pages/Home";
import TheSecretSun from "@/pages/TheSecretSun";
import TheWhitePaper from "@/pages/White";
import Photography from "@/pages/Photography";
import Phoenix from "@/pages/Phoenix";
import Contact from "@/pages/Contact";

// App Pages (Lifeseed)
import Forest from "@/pages/Forest";
import Pulses from "@/pages/Pulses";
import Visions from "@/pages/Visions";
import Matches from "@/pages/Matches";

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <LanguageProvider>
        <AuthProvider>
          <GlowBorder />
          <div className="relative flex min-h-screen flex-col">
            <div className="flex-1">
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Home />} />
                  
                  {/* Content Routes */}
                  <Route path="thesecretsun" element={<TheSecretSun />} />
                  <Route path="white" element={<TheWhitePaper />} />
                  <Route path="phoenix" element={<Phoenix />} />
                  <Route path="photos" element={<Photography />} />
                  <Route path="contact" element={<Contact />} />
                  
                  {/* App Routes */}
                  <Route path="forest" element={<Forest />} />
                  <Route path="pulses" element={<Pulses />} />
                  <Route path="visions" element={<Visions />} />
                  <Route path="matches" element={<Matches />} />
                  
                  <Route path="*" element={<div className="p-10 text-center">404 Not Found</div>} />
                </Route>
              </Routes>
            </div>
          </div>
          <TailwindIndicator />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
