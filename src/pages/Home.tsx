import { SubscriptionDialog } from "@/components/newsletter/SubscriptionDialog";
import TextStrip from "../components/text-strip/TextStrip";
import ImageLink from "../components/image/ImageLink";
import ThemeProvider from "../components/ThemeProvider";

const Spacer = ({ height }: { height: string }) => <div style={{ height }} />;

function Home() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="relative h-auto overflow-x-hidden">
        <div className="relative z-10">
          <div
            className="
              w-full 
              flex flex-wrap items-center justify-center 
              md:grid md:grid-cols-2 lg:grid-cols-4 gap-3 p-3"
          >
            <ImageLink to="/phoenix" imageUrl="/phoenix.jpg">
              The lifetree
            </ImageLink>
            <ImageLink to="/thesecretsun" imageUrl="/tss.jpg">
              The Secret Sun
            </ImageLink>
            <ImageLink to="/" imageUrl="/yantra.png">
              The Yantra
            </ImageLink>
            <ImageLink to="/white" imageUrl="/white.png">
              The White Paper
            </ImageLink>
          </div>

          <Spacer height="1vh" />

          <TextStrip title="live light">
            <p className="w-full text-justify mb-2">
              &nbsp;&nbsp;The purpose of <b>lightseed</b> is to bring joy. The
              joy of realizing the bliss of conscious, compassionate, grateful
              existence by opening a portal to the center of life. By creating a
              bridge between creator and creation, science and spirituality,
              virtual and real, nothing and everything. It is designed to
              intimately connect our inner Self, our culture, our trees and the
              tree of life, the material and the digital, online world into a
              sustainable and sustaining circle of unified vibration, sound and
              light. It aims to merge us into a common flow for all beings to be
              liberated, wise, strong, courageous and connected. It is rooted in
              nonviolence, compassion, generosity, gratitude and love. It is
              blockchain (truthfulness), cloud (global, distributed, resilient),
              ai (for connecting dreams and technology), regen (nature centric)
              native. It is an inspiration, an impulse towards a quantum leap in
              consciousness, a prompt both for human and artificial intelligence
              for action towards transcending humanity into a new era, a New
              Earth, Universe and Field with the help of our most important
              evolutionary sisters and brothers, the trees.
            </p>
          </TextStrip>

          <Spacer height="3vh" />

          <TextStrip title="The first steps">
            <p className="w-full text-justify mb-2">
              We plant lightseed (our vision) with the seed of a tree we have a
              deep connection with in four realms:
            </p>
            <div className="w-full text-justify mb-1">
              <ul className="list-disc pl-4 pt-2 mx-1">
                <li>
                  in our spiritual heart, with the intention of realization (or
                  our highest goal)
                </li>
                <li>
                  in the soil of an important place for us (or in a pot if we
                  haven't found that place yet) for the tree to flourish (this
                  will be our first lifetree)
                </li>
                <li>
                  in our community or culture as an inspiration (e.g.{" "}
                  <b>
                    <a href="http://lightseed.online/thesecretsun">
                      The Secret Sun
                    </a>
                  </b>
                  )
                </li>
                <li>
                  in the light, in virtual (by creating our servers and online
                  projects to be guided by nature)
                </li>
              </ul>
            </div>
            <p className="w-full text-justify">
              All four quadrants are ultimately (and intimately) connected with
              the animating force or lifeforce - the beginning of creation.
            </p>
          </TextStrip>

          <Spacer height="3vh" />

          <TextStrip title="We stand for trees">
            <p className="w-full text-justify">
              Subscribe to a very rare newsletter with the button below:
              <br />
              <br />
            </p>
            <div className="centered-holder">
              <SubscriptionDialog />
            </div>
          </TextStrip>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default Home;
