import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import TheSecretSun from "@/pages/TheSecretSun";
import TheWhitePaper from "@/pages/White";
import Photography from "@/pages/Photography";
import Phoenix from "@/pages/Phoenix";
import TheTree from "@/pages/TheTree";
import Home from "@/pages/Home";
import Layout from "@/pages/Layout";
import Forest from "@/pages/Forest";
import Pulses from "@/pages/Pulses";
import Visions from "@/pages/Visions";
import Contact from "@/pages/Contact";
import ThemeProvider from "@/components/ThemeProvider";
import TailwindIndicator from "@/components/utils/TailwindIndicator";
import GlowBorder from "@/components/utils/layout/GlowBorder";

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
                  <Route path="*" element={<hr />} />
                  <Route path="thesecretsun" element={<TheSecretSun />} />
                  <Route path="white" element={<TheWhitePaper />} />
                  <Route path="phoenix" element={<Phoenix />} />
                  <Route path="photos" element={<Photography />} />
                  <Route path="thetree" element={<TheTree />} />
                  
                  {/* NEW ROUTES */}
                  <Route path="forest" element={<Forest />} />
                  <Route path="pulses" element={<Pulses />} />
                  <Route path="visions" element={<Visions />} />
                  <Route path="contact" element={<Contact />} />
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