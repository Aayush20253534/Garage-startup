import AppInstallCard from "@/components/pwa/AppInstallCard";

export default function SupportPwaInstall({ compact = false }) {
  return (
    <AppInstallCard
      appName="Rovauto Support"
      description="Install the dedicated support app with its own icon, start screen, and PWA notifications."
      icon="/support-icon-512.png"
      promptKey="__ROVAUTO_SUPPORT_INSTALL_PROMPT__"
      promptEvent="rovauto-support-install-ready"
      installedStorageKey="rovauto_support_pwa_installed"
      pwaId="support"
      compact={compact}
      dark={false}
    />
  );
}
