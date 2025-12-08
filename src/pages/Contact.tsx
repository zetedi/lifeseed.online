import ThemeProvider from "@/components/ThemeProvider";
import TextStrip from "@/components/text-strip/TextStrip";
import { SubscriptionDialog } from "@/components/newsletter/SubscriptionDialog";

export default function Contact() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="relative h-auto overflow-x-hidden min-h-screen p-8">
        <TextStrip title="Contact & Updates">
          <div className="flex flex-col items-center justify-center space-y-8">
            <p className="text-center">
              We stand for trees. Connect with us to stay updated on the growth of the network.
            </p>
            <div className="centered-holder">
              <SubscriptionDialog />
            </div>
            
            <div className="mt-8 text-center">
                <p className="mb-2 font-bold">Email</p>
                <a href="mailto:hello@lightseed.online" className="text-accent hover:underline">hello@lightseed.online</a>
            </div>
          </div>
        </TextStrip>
      </div>
    </ThemeProvider>
  );
}