import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "@/api/axios";

const CampaignContext = createContext({ independenceDayActive: false });

const NON_CUSTOMER_PREFIXES = ["/admin", "/intern", "/support", "/garage"];

const isCustomerFacingPath = (pathname) =>
  !NON_CUSTOMER_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

export function CampaignProvider({ children }) {
  const { pathname } = useLocation();
  const [independenceDayActive, setIndependenceDayActive] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadCampaign = () =>
      api
        .get("/public/independence-campaign", {
          skipSessionExpiryMessage: true,
        })
        .then((response) => {
          if (!mounted) return;
          setIndependenceDayActive(
            Boolean((response.data?.data || response.data || {}).active),
          );
        })
        .catch(() => {
          if (mounted) setIndependenceDayActive(false);
        });

    void loadCampaign();
    const poller = window.setInterval(loadCampaign, 60 * 1000);

    return () => {
      mounted = false;
      window.clearInterval(poller);
    };
  }, []);

  const customerCampaignActive =
    independenceDayActive && isCustomerFacingPath(pathname);

  const value = useMemo(
    () => ({ independenceDayActive, customerCampaignActive }),
    [customerCampaignActive, independenceDayActive],
  );

  return (
    <CampaignContext.Provider value={value}>
      <div
        className={customerCampaignActive ? "rov-independence-theme" : undefined}
        data-independence-campaign={customerCampaignActive ? "active" : "inactive"}
      >
        {children}
      </div>
    </CampaignContext.Provider>
  );
}

export const useCampaign = () => useContext(CampaignContext);
