import AppInstallCard from "@/components/pwa/AppInstallCard";

export default function GaragePwaInstall({ compact = false }) {
  return (
    <AppInstallCard
      appName="Rovauto Garage"
      description="Install the dedicated garage app with its own icon, job shortcuts, full-screen workspace, and garage notifications."
      icon="/garage-brand-v4-icon-512.png"
      promptKey="__ROVAUTO_GARAGE_INSTALL_PROMPT__"
      promptEvent="rovauto-garage-install-ready"
      installedStorageKey="rovauto_garage_pwa_installed"
      pwaId="garage"
      compact={compact}
    />
  );
}
