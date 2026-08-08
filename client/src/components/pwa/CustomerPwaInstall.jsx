import AppInstallCard from "@/components/pwa/AppInstallCard";

export default function CustomerPwaInstall({ compact = false }) {
  return (
    <AppInstallCard
      appName="Rovauto"
      description="Add Rovauto to your phone for quicker bookings, full-screen access, and app notifications."
      icon="/rovauto-brand-v3-icon-512.png"
      promptKey="__ROVAUTO_INSTALL_PROMPT__"
      promptEvent="rovauto-install-ready"
      installedStorageKey="rovauto_customer_pwa_installed"
      pwaId="customer"
      compact={compact}
      dark={false}
    />
  );
}
