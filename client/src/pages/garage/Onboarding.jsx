
import { useState } from "react";
import Step1 from "./onboarding/Step1";
import Step2 from "./onboarding/Step2";
import Step3 from "./onboarding/Step3";
import Step4 from "./onboarding/Step4";

export default function GarageOnboarding() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    name: "",
    ownerName: "",
    phone: "",
    email: "",
    gst: "",
    address: "",
    city: "",
    area: "",
    description: "",
    location: { lat: null, lng: null },
    locationSource: "MANUAL",
    workingRadius: 15,
    images: [],
    garageType: "MULTI_BRAND",
    brands: [],
  });

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const steps = {
    1: <Step1 data={data} onChange={setData} onNext={handleNext} />,
    2: <Step2 data={data} onChange={setData} onNext={handleNext} onBack={handleBack} />,
    3: <Step3 data={data} onChange={setData} onNext={handleNext} onBack={handleBack} />,
    4: <Step4 data={data} onChange={setData} onBack={handleBack} />,
  };

  return steps[step];
}
