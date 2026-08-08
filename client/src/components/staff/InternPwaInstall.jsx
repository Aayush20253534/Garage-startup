import AppInstallCard from "@/components/pwa/AppInstallCard";

export default function InternPwaInstall({ compact = false }) {
  return (
    <AppInstallCard
      appName="Rovauto Intern"
      description="Install the dedicated intern app with its own icon, start screen, shortcuts, and isolated PWA scope."
      icon="/intern-brand-v4-icon-512.png"
      promptKey="__ROVAUTO_INTERN_INSTALL_PROMPT__"
      promptEvent="rovauto-intern-install-ready"
      installedStorageKey="rovauto_intern_pwa_installed"
      pwaId="intern"
      compact={compact}
      dark={false}
    />
  );
}
