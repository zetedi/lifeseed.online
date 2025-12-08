import { useState } from "react";
import { SimpleButton } from "@/components/SimpleButton";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/Input";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export function SubscriptionDialog() {
  const [email, setEmail] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const submitHandler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      alert("Invalid email address");
      return;
    }
    try {
      await addDoc(collection(db, "emails"), {
        email,
        timestamp: serverTimestamp(),
      });
      setEmail("");
      setIsOpen(false);
      alert("Thank you! You are subscribed.");
    } catch (e) {
      console.error("Error adding document: ", e);
      alert("Subscription failed. Please try again.");
    }
  };

  return (
    <>
      <SimpleButton 
        className="redbutton text-white text-base px-6 py-2 rounded-full"
        onClick={() => setIsOpen(true)}
      >
        One email every seven weeks
      </SimpleButton>

      {isOpen && (
        <Modal title="Subscribe" onClose={() => setIsOpen(false)}>
          <div className="space-y-4">
            <div className="text-sm text-slate-500">
              One email every seven weeks. You might get the first one earlier.
            </div>
            <form onSubmit={submitHandler} className="flex flex-col gap-4">
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2">
                <SimpleButton type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                  Cancel
                </SimpleButton>
                <SimpleButton type="submit">
                  Subscribe
                </SimpleButton>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}
