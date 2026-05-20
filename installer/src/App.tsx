import { useState } from "react";
import { Step1Url } from "./components/Step1Url";
import { Step2Token } from "./components/Step2Token";
import { Step3Clients } from "./components/Step3Clients";
import { Step4Verify } from "./components/Step4Verify";
import type { WizardState } from "./types";

const INITIAL: WizardState = {
  step: 1,
  canvasUrl: "",
  canvasToken: "",
  selectedClients: [],
  installPath: null,
  error: null,
};

export default function App() {
  const [state, setState] = useState<WizardState>(INITIAL);

  function patch(updates: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...updates }));
  }

  switch (state.step) {
    case 1:
      return (
        <Step1Url
          initialValue={state.canvasUrl}
          onNext={(url) => patch({ canvasUrl: url, step: 2 })}
        />
      );
    case 2:
      return (
        <Step2Token
          onNext={(token) => patch({ canvasToken: token, step: 3 })}
          onBack={() => patch({ step: 1 })}
        />
      );
    case 3:
      return (
        <Step3Clients
          onNext={(clients) => patch({ selectedClients: clients, step: 4 })}
          onBack={() => patch({ step: 2 })}
        />
      );
    case 4:
      return (
        <Step4Verify
          canvasUrl={state.canvasUrl}
          canvasToken={state.canvasToken}
          selectedClients={state.selectedClients}
          onBack={() => patch({ step: 3 })}
        />
      );
    default:
      return null;
  }
}
