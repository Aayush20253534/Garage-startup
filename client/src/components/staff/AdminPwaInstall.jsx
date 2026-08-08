import AppInstallCard from "@/components/pwa/AppInstallCard";

export default function AdminPwaInstall({ compact = false }) {
  return (
    <AppInstallCard
      appName="Rovauto Admin"
      description="Install the dedicated admin app with its own icon, start screen, shortcuts, and isolated PWA scope."
      icon="/admin-brand-v4-icon-512.png"
      promptKey="__ROVAUTO_ADMIN_INSTALL_PROMPT__"
      promptEvent="rovauto-admin-install-ready"
      installedStorageKey="rovauto_admin_pwa_installed"
      pwaId="admin"
      compact={compact}
      dark={false}
    />
  );
}
