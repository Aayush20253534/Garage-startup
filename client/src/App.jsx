import { Component, lazy, Suspense, useEffect, useState } from "react";
import { Link, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "@/hooks/useApp";
import { hasSavedUserLocation } from "@/utils/signupLocation";
import MainLayout from "@/layouts/MainLayout";
import DashboardLayout from "@/layouts/DashboardLayout";
import api from "@/api/axios";
import { CATEGORY_UI } from "@/data/services";
import ComingSoonOverlay from "@/components/services/ComingSoonOverlay";
import { getCategoryThumbnailUrl } from "@/utils/imageCache";
import { reportSystemIssue } from "@/utils/errorReporter";
import {
  clearLocalFrontendState,
  createMissingLazyDefaultError,
  isChunkLoadError,
  reloadForLatestBuild,
} from "@/utils/chunkRecovery";
import PrivatePageSeo from "@/components/seo/PrivatePageSeo";
import Home from "@/pages/Home";
import Login from "@/pages/auth/Login";


const runAfterInitialPaint = (callback) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  if ("requestIdleCallback" in window) {
    const idleId = window.requestIdleCallback(callback, { timeout: 2500 });
    return () => window.cancelIdleCallback?.(idleId);
  }

  const timeoutId = window.setTimeout(callback, 1600);
  return () => window.clearTimeout(timeoutId);
};

const isLocalFrontendHost = () => {
  if (typeof window === "undefined") return false;

  return ["localhost", "127.0.0.1", "::1"].includes(
    window.location.hostname,
  );
};

const shouldLoadVercelInsights = () => {
  const configuredValue = String(
    import.meta.env.VITE_VERCEL_INSIGHTS_ENABLED ?? "",
  )
    .trim()
    .toLowerCase();

  if (configuredValue) {
    return ["1", "true", "yes", "on"].includes(configuredValue);
  }

  return import.meta.env.PROD && !isLocalFrontendHost();
};

function DeferredVercelInsights() {
  const [analyticsComponents, setAnalyticsComponents] = useState(null);

  useEffect(() => {
    if (!shouldLoadVercelInsights()) {
      return undefined;
    }

    let mounted = true;

    const cancelIdleTask = runAfterInitialPaint(async () => {
      try {
        const [{ Analytics }, { SpeedInsights }] = await Promise.all([
          import("@vercel/analytics/react"),
          import("@vercel/speed-insights/react"),
        ]);

        if (mounted) {
          setAnalyticsComponents({ Analytics, SpeedInsights });
        }
      } catch (error) {
        console.warn("Unable to load analytics widgets", error);
      }
    });

    return () => {
      mounted = false;
      cancelIdleTask();
    };
  }, []);

  if (!analyticsComponents) return null;

  const { Analytics, SpeedInsights } = analyticsComponents;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

const getEffectiveAccountType = (user) => {
  if (user?.accountType) {
    return user.accountType;
  }

  if (["ADMIN", "SUB_ADMIN", "INTERN"].includes(user?.role)) {
    return "STAFF";
  }

  if (user?.role === "CUSTOMER_SUPPORT") {
    return "CUSTOMER_SUPPORT";
  }

  if (user?.role === "CUSTOMER" || user?.role === "GARAGE_OWNER") {
    return "USER";
  }

  if (user?.role === "GARAGE_CONTROLLER") return "GARAGE_CONTROLLER";

  return null;
};

const hasPortalRole = (user, role, accountType) =>
  user?.role === role && getEffectiveAccountType(user) === accountType;

const getAccountPortal = (user) => {
  if (hasPortalRole(user, "ADMIN", "STAFF") || hasPortalRole(user, "SUB_ADMIN", "STAFF")) {
    return "/admin";
  }

  if (hasPortalRole(user, "INTERN", "STAFF")) {
    return "/intern";
  }

  if (hasPortalRole(user, "CUSTOMER_SUPPORT", "CUSTOMER_SUPPORT")) {
    return "/support";
  }

  if (hasPortalRole(user, "GARAGE_OWNER", "USER")) {
    return "/garage";
  }

  if (hasPortalRole(user, "GARAGE_CONTROLLER", "GARAGE_CONTROLLER")) {
    return "/garage";
  }

  if (hasPortalRole(user, "CUSTOMER", "USER")) {
    return "/dashboard";
  }

  return "/login";
};

const getExpectedDocumentShell = (pathname) => {
  if (pathname === "/support" || pathname.startsWith("/support/")) {
    return "support";
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "admin";
  }

  if (pathname === "/intern" || pathname.startsWith("/intern/")) {
    return "intern";
  }

  if (pathname === "/garage" || pathname.startsWith("/garage/")) {
    return "garage";
  }

  return "main";
};

function PwaDocumentShellGuard() {
  const location = useLocation();

  useEffect(() => {
    const expectedShell = getExpectedDocumentShell(location.pathname);
    const currentShell =
      document.documentElement.dataset.appShell || "main";

    if (expectedShell === currentShell) return;

    const target = `${location.pathname}${location.search}${location.hash}`;
    const reloadKey = "rovauto:pwa-shell-reload";
    const previous = sessionStorage.getItem(reloadKey);

    if (previous === `${expectedShell}:${target}`) {
      sessionStorage.removeItem(reloadKey);
      return;
    }

    sessionStorage.setItem(reloadKey, `${expectedShell}:${target}`);
    window.location.replace(target);
  }, [location.hash, location.pathname, location.search]);

  return null;
}

function ProtectedRoute({ children, mainAdminOnly = false }) {
  const { user, garage, authLoading } = useApp();
  const location = useLocation();

  const isGarageRoute =
    location.pathname === "/garage" || location.pathname.startsWith("/garage/");
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isInternRoute = location.pathname.startsWith("/intern");
  const isCustomerSupportRoute =
    location.pathname === "/support" || location.pathname.startsWith("/support/");

  if (authLoading) {
    return <RouteFallback />;
  }

  if (isAdminRoute) {
    const isAdmin = hasPortalRole(user, "ADMIN", "STAFF") || hasPortalRole(user, "SUB_ADMIN", "STAFF");

    if (!isAdmin) {
      return (
        <Navigate
          to={user ? getAccountPortal(user) : "/admin/login"}
          state={{ from: location }}
          replace
        />
      );
    }

    if (mainAdminOnly && !hasPortalRole(user, "ADMIN", "STAFF")) {
      return <Navigate to="/admin" replace />;
    }
  } else if (isInternRoute) {
    const isIntern = hasPortalRole(user, "INTERN", "STAFF");

    if (!isIntern) {
      return (
        <Navigate
          to={user ? getAccountPortal(user) : "/intern/login"}
          state={{ from: location }}
          replace
        />
      );
    }
  } else if (isCustomerSupportRoute) {
    const isCustomerSupport = hasPortalRole(
      user,
      "CUSTOMER_SUPPORT",
      "CUSTOMER_SUPPORT",
    );

    if (!isCustomerSupport) {
      return (
        <Navigate
          to={user ? getAccountPortal(user) : "/support/login"}
          state={{ from: location }}
          replace
        />
      );
    }
  } else if (isGarageRoute) {
    if (!garage) {
      return (
        <Navigate
          to="/garage/login"
          state={{ from: location }}
          replace
        />
      );
    }

    if (
      garage.mustChangePassword &&
      location.pathname !== "/garage/first-login"
    ) {
      return <Navigate to="/garage/first-login" replace />;
    }
  } else {
    const isCustomer = hasPortalRole(user, "CUSTOMER", "USER");

    if (!isCustomer) {
      return (
        <Navigate
          to={getAccountPortal(user)}
          state={{ from: location }}
          replace
        />
      );
    }
  }

  return children;
}

function GaragePortalRoute({ children, ownerOnly = false }) {
  const { garage } = useApp();

  return (
    <ProtectedRoute>
      {ownerOnly && garage?.isControllerSession ? (
        <Navigate to="/garage" replace />
      ) : (
        children
      )}
    </ProtectedRoute>
  );
}

function AddressCheck({ children }) {
  const { user, location, fetchProfile } = useApp();
  const routeLocation = useLocation();
  const hasSavedLocation = hasSavedUserLocation(user, location);
  const [retryKey, setRetryKey] = useState(0);
  const [verification, setVerification] = useState({
    userId: null,
    status: "idle",
    hasSavedLocation: false,
  });

  useEffect(() => {
    let active = true;

    if (user?.role !== "CUSTOMER") {
      setVerification({
        userId: user?.id || null,
        status: "verified",
        hasSavedLocation: false,
      });
      return () => {
        active = false;
      };
    }

    if (hasSavedLocation) {
      setVerification({
        userId: user.id,
        status: "verified",
        hasSavedLocation: true,
      });
      return () => {
        active = false;
      };
    }

    setVerification({
      userId: user.id,
      status: "loading",
      hasSavedLocation: false,
    });

    // Authentication responses and Redux hydration can arrive before the full
    // customer profile. Verify the authoritative profile before deciding that
    // this customer needs to confirm an address again.
    Promise.resolve(fetchProfile?.({ force: true }))
      .then((profile) => {
        if (!active) return;

        setVerification({
          userId: user.id,
          status: "verified",
          hasSavedLocation: hasSavedUserLocation(profile),
        });
      })
      .catch(() => {
        if (!active) return;

        // A temporary profile/network failure is not proof that the customer
        // has no saved location. Offer retry instead of forcing address setup.
        setVerification({
          userId: user.id,
          status: "error",
          hasSavedLocation: false,
        });
      });

    return () => {
      active = false;
    };
  }, [hasSavedLocation, retryKey, user?.id, user?.role]);

  if (
    user?.role !== "CUSTOMER" ||
    hasSavedLocation ||
    (verification.userId === user?.id && verification.hasSavedLocation)
  ) {
    return children;
  }

  if (
    verification.userId !== user?.id ||
    verification.status === "idle" ||
    verification.status === "loading"
  ) {
    return <RouteFallback />;
  }

  if (verification.status === "error") {
    return (
      <div className="container-x mx-auto max-w-xl py-12">
        <div className="card-soft rounded-2xl p-6 text-center">
          <h1 className="text-xl font-bold text-ink">
            Could not verify your saved location
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Your saved address was not changed. Check your connection and try
            again.
          </p>
          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
            className="mt-5 rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-ink"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <Navigate to="/booking/address" state={{ from: routeLocation }} replace />
  );
}

function VehicleCheck({ children }) {
  const { user, vehicles } = useApp();
  const vehicleList = Array.isArray(vehicles) ? vehicles : [];

  if (user?.role === "CUSTOMER" && vehicleList.length === 0) {
    return <Navigate to="/booking/vehicle" replace />;
  }

  return children;
}

const toBoolean = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  String(value).toLowerCase() === "true";

function SOSAvailabilityGuard({ children }) {
  const [loading, setLoading] = useState(true);
  const [sosCategory, setSosCategory] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const checkSOSAvailability = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get("/services/categories");
        const categories = response.data?.data || [];

        const category =
          categories.find((item) => CATEGORY_UI[item.name]?.isSos) ||
          categories.find((item) =>
            /roadside|emergency|sos/i.test(String(item.name || "")),
          ) ||
          null;

        if (mounted) {
          setSosCategory(category);
        }
      } catch (err) {
        console.error("Unable to check SOS availability:", err);

        if (mounted) {
          setError(
            err.response?.data?.message ||
              "Unable to check roadside assistance availability.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkSOSAvailability();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 px-4 py-16 text-white">
        <div className="mx-auto max-w-md rounded-2xl border border-gray-700 bg-gray-800 p-6 text-center text-gray-300">
          Checking roadside assistance...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 px-4 py-16 text-white">
        <div className="mx-auto max-w-md rounded-2xl border border-red-500/30 bg-gray-800 p-6 text-center">
          <h1 className="text-xl font-bold">Roadside assistance unavailable</h1>

          <p className="mt-3 text-sm leading-6 text-gray-400">{error}</p>

          <Link
            to="/"
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-gray-900 transition hover:bg-gray-100"
          >
            <FiArrowLeft />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const categoryServices = Array.isArray(sosCategory?.services)
    ? sosCategory.services
    : [];

  const isComingSoon =
    toBoolean(sosCategory?.isComingSoon) ||
    (categoryServices.length > 0 &&
      categoryServices.every((service) =>
        toBoolean(service?.isComingSoon),
      ));

  if (!isComingSoon) {
    return children;
  }

  const image = getCategoryThumbnailUrl(sosCategory);

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-12 text-white">
      <div className="mx-auto max-w-xl">
        <div className="overflow-hidden rounded-3xl border border-gray-700 bg-gray-800 shadow-2xl">
          <div className="relative h-64 overflow-hidden bg-gray-950">
            {image ? (
              <img
                src={image}
                alt={sosCategory?.name || "Roadside Assistance"}
                className="h-full w-full scale-105 object-cover blur-sm grayscale"
              />
            ) : (
              <div className="grid h-full place-items-center bg-gradient-to-br from-gray-800 to-gray-950 text-6xl text-gray-500">
                <FiTruck />
              </div>
            )}

            <ComingSoonOverlay />
          </div>

          <div className="p-6 text-center sm:p-8">
            <span className="inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">
              Coming Soon
            </span>

            <h1 className="mt-4 text-3xl font-extrabold">
              Roadside Assistance
            </h1>

            <p className="mt-3 leading-7 text-gray-400">
              Emergency roadside assistance is being prepared. Verified
              mechanics and towing support will be available here soon.
            </p>

            <Link
              to="/"
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-gray-900 transition hover:bg-gray-100"
            >
              <FiArrowLeft />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const pickLazyPage = (module, moduleName) => {
  const explicitPage = module?.default || module?.[moduleName];

  if (explicitPage) {
    return explicitPage;
  }

  const compatibleNames = {
    CustomerDashboard: ["Dashboard"],
    GarageDashboard: ["Dashboard"],
    AdminDashboard: ["Dashboard"],
    AdminPayments: ["Payments"],
  }[moduleName] || [];

  for (const exportName of compatibleNames) {
    if (module?.[exportName]) {
      return module[exportName];
    }
  }

  const exportedComponents = Object.values(module || {}).filter(
    (value) =>
      typeof value === "function" ||
      (value && typeof value === "object" && "$$typeof" in value),
  );

  return exportedComponents.length === 1 ? exportedComponents[0] : null;
};

const lazyPage = (loader, moduleName) =>
  lazy(() =>
    loader()
      .then((module) => {
        const Page = pickLazyPage(module, moduleName);

        if (!Page) {
          throw createMissingLazyDefaultError(moduleName);
        }

        return { default: Page };
      })
      .catch((error) => {
        if (reloadForLatestBuild(error)) {
          return new Promise(() => {});
        }

        throw error;
      }),
  );

const loadServicesPage = () => import("@/pages/Services");
const Services = lazyPage(loadServicesPage, "Services");
const CategoryDetail = lazyPage(
  () => import("@/pages/CategoryDetail"),
  "CategoryDetail",
);
const HowItWorks = lazyPage(() => import("@/pages/HowItWorks"), "HowItWorks");
const About = lazyPage(() => import("@/pages/About"), "About");
const Partner = lazyPage(() => import("@/pages/Partner"), "Partner");
const Contact = lazyPage(() => import("@/pages/Contact"), "Contact");
const Warranty = lazyPage(() => import("@/pages/Warranty"), "Warranty");
const NotFound = lazyPage(() => import("@/pages/NotFound"), "NotFound");
const SOSPanicScreen = lazyPage(
  () => import("@/pages/sos/SOSPanicScreen"),
  "SOSPanicScreen",
);
const SOSLocationScreen = lazyPage(
  () => import("@/pages/sos/SOSLocationScreen"),
  "SOSLocationScreen",
);
const SOSCheckoutScreen = lazyPage(
  () => import("@/pages/sos/SOSCheckoutScreen"),
  "SOSCheckoutScreen",
);
const SOSSuccessScreen = lazyPage(
  () => import("@/pages/sos/SOSSuccessScreen"),
  "SOSSuccessScreen",
);

const Register = lazyPage(() => import("@/pages/auth/Register"), "Register");
const OTP = lazyPage(() => import("@/pages/auth/OTP"), "OTP");
const Forgot = lazyPage(() => import("@/pages/auth/Forgot"), "Forgot");

const VehicleSelect = lazyPage(
  () => import("@/pages/booking/VehicleSelect"),
  "VehicleSelect",
);
const AddressForm = lazyPage(
  () => import("@/pages/booking/AddressForm"),
  "AddressForm",
);
const ServiceSelect = lazyPage(
  () => import("@/pages/booking/ServiceSelect"),
  "ServiceSelect",
);
const TermsAndConditions = lazyPage(() => import("@/pages/legal/TermsAndConditions"), "TermsAndConditions");
const PrivacyPolicy = lazyPage(() => import("@/pages/legal/PrivacyPolicy"), "PrivacyPolicy");
const GaragePartnerTerms = lazyPage(() => import("@/pages/legal/GaragePartnerTerms"), "GaragePartnerTerms");
const Checkout = lazyPage(() => import("@/pages/booking/Checkout"), "Checkout");
const Tracking = lazyPage(() => import("@/pages/booking/Tracking"), "Tracking");
const BookingVerification = lazyPage(
  () => import("@/pages/booking/Verification"),
  "BookingVerification",
);

const CustomerDashboard = lazyPage(
  () => import("@/pages/customer/Dashboard"),
  "CustomerDashboard",
);
const MyVehicles = lazyPage(
  () => import("@/pages/customer/MyVehicles"),
  "MyVehicles",
);
const ActiveBookings = lazyPage(
  () => import("@/pages/customer/ActiveBookings"),
  "ActiveBookings",
);
const CustomerPendingBookings = lazyPage(
  () => import("@/pages/customer/PendingBookings"),
  "PendingBookings",
);
const ServiceHistory = lazyPage(
  () => import("@/pages/customer/ServiceHistory"),
  "ServiceHistory",
);
const CustomerWarrantyCenter = lazyPage(
  () => import("@/pages/customer/WarrantyCenter"),
  "CustomerWarrantyCenter",
);
const Profile = lazyPage(() => import("@/pages/customer/Profile"), "Profile");
const Payments = lazyPage(
  () => import("@/pages/customer/Payments"),
  "Payments",
);
const Notifications = lazyPage(
  () => import("@/pages/customer/Notifications"),
  "Notifications",
);
const CustomerSupport = lazyPage(
  () => import("@/pages/customer/Support"),
  "CustomerSupport",
);

const GarageDashboard = lazyPage(
  () => import("@/pages/garage/Dashboard"),
  "GarageDashboard",
);
const GarageControllerDashboard = lazyPage(
  () => import("@/pages/garage/ControllerDashboard"),
  "GarageControllerDashboard",
);
const GarageControllers = lazyPage(
  () => import("@/pages/garage/Controllers"),
  "GarageControllers",
);
const GarageLogin = lazyPage(
  () => import("@/pages/garage/auth/Login"),
  "GarageLogin",
);
const GarageOtpLogin = lazyPage(
  () => import("@/pages/garage/auth/OtpLogin"),
  "GarageOtpLogin",
);
const GarageForgotPassword = lazyPage(
  () => import("@/pages/garage/auth/ForgotPassword"),
  "GarageForgotPassword",
);
const GarageFirstLoginPassword = lazyPage(
  () => import("@/pages/garage/auth/FirstLoginPassword"),
  "GarageFirstLoginPassword",
);
const GarageOnboarding = lazyPage(
  () => import("@/pages/garage/Onboarding"),
  "GarageOnboarding",
);
const GarageServices = lazyPage(
  () => import("@/pages/garage/Services"),
  "GarageServices",
);
const GarageBookings = lazyPage(
  () => import("@/pages/garage/Bookings"),
  "GarageBookings",
);
const GarageBookingDetail = lazyPage(
  () => import("@/pages/garage/BookingDetail"),
  "GarageBookingDetail",
);
const GarageServiceHistory = lazyPage(
  () => import("@/pages/garage/ServiceHistory"),
  "GarageServiceHistory",
);
const GarageProfile = lazyPage(
  () => import("@/pages/garage/Profile"),
  "GarageProfile",
);
const GarageSettings = lazyPage(
  () => import("@/pages/garage/Settings"),
  "GarageSettings",
);
const GarageWallet = lazyPage(
  () => import("@/pages/garage/Wallet"),
  "GarageWallet",
);
const MagicLink = lazyPage(() => import("@/pages/garage/MagicLink"), "MagicLink");
const WorkerTask = lazyPage(
  () => import("@/pages/worker/WorkerTask"),
  "WorkerTask",
);

const AdminDashboard = lazyPage(
  () => import("@/pages/admin/Dashboard"),
  "AdminDashboard",
);
const AdminControlCenter = lazyPage(
  () => import("@/pages/admin/ControlCenter"),
  "AdminControlCenter",
);
const AdminSystemHealth = lazyPage(
  () => import("@/pages/admin/SystemHealth"),
  "AdminSystemHealth",
);
const AdminLogin = lazyPage(() => import("@/pages/admin/Login"), "AdminLogin");
const AdminForgotPassword = lazyPage(() => import("@/pages/admin/ForgotPassword"), "AdminForgotPassword");
const AdminCustomers = lazyPage(
  () => import("@/pages/admin/Customers"),
  "AdminCustomers",
);
const AdminGarages = lazyPage(
  () => import("@/pages/admin/Garages"),
  "AdminGarages",
);
const AdminBookings = lazyPage(
  () => import("@/pages/admin/Bookings"),
  "AdminBookings",
);
const AdminPendingBookings = lazyPage(
  () => import("@/pages/admin/PendingBookings"),
  "PendingBookings",
);
const AdminRevenue = lazyPage(
  () => import("@/pages/admin/Revenue"),
  "AdminRevenue",
);
const AdminPricingOperations = lazyPage(
  () => import("@/pages/admin/PricingOperations"),
  "AdminPricingOperations",
);
const AdminPayments = lazyPage(
  () => import("@/pages/admin/Payments"),
  "Payments",
);
const AdminCars = lazyPage(() => import("@/pages/admin/Cars"), "AdminCars");
const AdminServices = lazyPage(
  () => import("@/pages/admin/Services"),
  "AdminServices",
);
const AdminSubAdminAccounts = lazyPage(
  () => import("@/pages/admin/SubAdminAccounts"),
  "AdminSubAdminAccounts",
);

const AdminDangerous = lazyPage(
  () => import("@/pages/admin/Dangerous"),
  "AdminDangerous",
);
const AdminPseudoData = lazyPage(
  () => import("@/pages/admin/PseudoData"),
  "AdminPseudoData",
);
const AdminSupportTickets = lazyPage(
  () => import("@/pages/admin/SupportTickets"),
  "AdminSupportTickets",
);
const AdminCustomerSupportAccounts = lazyPage(
  () => import("@/pages/admin/CustomerSupportAccounts"),
  "AdminCustomerSupportAccounts",
);
const AdminGarageControllers = lazyPage(
  () => import("@/pages/admin/GarageControllers"),
  "AdminGarageControllers",
);
const AdminInternAccounts = lazyPage(
  () => import("@/pages/admin/InternAccounts"),
  "AdminInternAccounts",
);
const CustomerSupportLogin = lazyPage(
  () => import("@/pages/support/Login"),
  "CustomerSupportLogin",
);
const CustomerSupportDashboard = lazyPage(
  () => import("@/pages/support/Dashboard"),
  "CustomerSupportDashboard",
);
const CustomerSupportTickets = lazyPage(
  () => import("@/pages/support/Tickets"),
  "CustomerSupportTickets",
);
const CustomerSupportLeads = lazyPage(
  () => import("@/pages/support/Leads"),
  "CustomerSupportLeads",
);
const CustomerSupportNotify = lazyPage(
  () => import("@/pages/support/Notify"),
  "CustomerSupportNotify",
);
const CustomerSupportNotifications = lazyPage(
  () => import("@/pages/support/Notifications"),
  "CustomerSupportNotifications",
);
const CustomerSupportEmail = lazyPage(
  () => import("@/pages/support/Email"),
  "CustomerSupportEmail",
);
const InternLogin = lazyPage(() => import("@/pages/intern/Login"), "InternLogin");
const InternForgotPassword = lazyPage(
  () => import("@/pages/intern/ForgotPassword"),
  "InternForgotPassword",
);

import {
  FiArrowLeft,
  FiAlertTriangle,
  FiAlertOctagon,
  FiActivity,
  FiGrid,
  FiTruck,
  FiPlusCircle,
  FiCalendar,
  FiClock,
  FiArchive,
  FiShield,
  FiCreditCard,
  FiBell,
  FiSend,
  FiUser,
  FiInbox,
  FiBriefcase,
  FiStar,
  FiUsers,
  FiSettings,
  FiDollarSign,
  FiSliders,
  FiHome,
  FiMail,
  FiHelpCircle,
  FiHeadphones,
  FiUserCheck,
  FiBarChart2,
  FiPhoneCall,
} from "react-icons/fi";

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      isRecovering: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    void reportSystemIssue(error, {
      title: "React rendering error",
      component: "AppErrorBoundary",
      severity: isChunkLoadError(error) ? "WARNING" : "CRITICAL",
      metadata: {
        componentStack: errorInfo?.componentStack || null,
      },
    });

    if (!isChunkLoadError(error)) return;

    const reloadKey = `rov_route_reload_attempted:${window.location.pathname}`;
    if (sessionStorage.getItem(reloadKey) === "1") {
      return;
    }

    sessionStorage.setItem(reloadKey, "1");
    this.setState({ isRecovering: true });

    window.setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("rov_reload", String(Date.now()));

      void clearLocalFrontendState().finally(() => {
        window.location.replace(url.toString());
      });
    }, 250);
  }

  clearAndReload = async () => {
    Object.keys(sessionStorage)
      .filter(
        (key) =>
          key.startsWith("rov_route_reload_attempted:") ||
          key.startsWith("rov_chunk_reload_attempted:") ||
          key.startsWith("rovauto:stale-chunk-reload"),
      )
      .forEach((key) => sessionStorage.removeItem(key));

    await clearLocalFrontendState();

    const url = new URL(window.location.href);
    url.searchParams.set("rov_reload", String(Date.now()));
    window.location.replace(url.toString());
  };

  goHome = () => {
    window.location.assign("/");
  };

  render() {
    const { error, isRecovering } = this.state;

    if (!error) {
      return this.props.children;
    }

    const staleChunk = isChunkLoadError(error);

    return (
      <div className="min-h-screen bg-bg-soft px-4 py-10">
        <div className="mx-auto max-w-lg rounded-2xl border border-line bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            {staleChunk ? "Updating Rovauto" : "Page could not load"}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-ink">
            {staleChunk
              ? "Refreshing the latest version"
              : "Something stopped this page from loading"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            {staleChunk
              ? "A newer version of this page is available. The app is reloading it now."
              : "You can reload the page or go back to the home page."}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.clearAndReload}
              className="rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-ink"
            >
              {isRecovering ? "Reloading..." : "Reload page"}
            </button>
            <button
              type="button"
              onClick={this.goHome}
              className="rounded-lg border border-line px-4 py-2.5 text-sm font-bold text-ink"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}

const customerItems = [
  { to: "/dashboard", label: "Dashboard", icon: FiGrid },
  { to: "/dashboard/vehicles", label: "My Vehicles", icon: FiTruck },
  { to: "/booking/vehicle", label: "Book Service", icon: FiPlusCircle },
  { to: "/dashboard/bookings", label: "Active Bookings", icon: FiCalendar },
  { to: "/dashboard/pending-bookings", label: "Pending Bookings", icon: FiClock },
  { to: "/dashboard/history", label: "Service History", icon: FiArchive },
  { to: "/dashboard/warranty", label: "Warranty Center", icon: FiShield },
  { to: "/dashboard/payments", label: "Payments", icon: FiCreditCard },
  { to: "/dashboard/notifications", label: "Notifications", icon: FiBell },
  { to: "/dashboard/support", label: "Support", icon: FiHelpCircle },
  { to: "/dashboard/profile", label: "Profile", icon: FiUser },
];

const garageItems = [
  { to: "/garage", label: "Dashboard", icon: FiGrid },
  { to: "/garage/bookings", label: "Bookings", icon: FiCalendar },
  { to: "/garage/history", label: "Service History", icon: FiArchive },
  { to: "/garage/services", label: "Services", icon: FiInbox },
  { to: "/garage/wallet", label: "Wallet", icon: FiCreditCard },
  { to: "/garage/profile", label: "Profile", icon: FiUser },
  { to: "/garage/settings", label: "Settings", icon: FiSettings },
  { to: "/garage/controllers", label: "Sub-controllers", icon: FiUsers },
];

const controllerItems = [
  { to: "/garage", label: "My Dashboard", icon: FiGrid },
  { to: "/garage/bookings", label: "My Bookings", icon: FiCalendar },
  { to: "/garage/history", label: "Service History", icon: FiArchive },
  { to: "/garage/wallet", label: "Shared Wallet", icon: FiCreditCard },
];

const adminItems = [
  { to: "/admin", label: "Dashboard", icon: FiGrid },
  { to: "/admin/control-center", label: "Control Center", icon: FiSettings },
  { to: "/admin/cars", label: "Cars", icon: FiTruck },
  { to: "/admin/services", label: "Services", icon: FiBriefcase },
  { to: "/admin/garages", label: "Garages", icon: FiHome },
  { to: "/admin/revenue", label: "Price Ranges", icon: FiDollarSign },
  {
    to: "/admin/pricing-operations",
    label: "Pricing Operations",
    icon: FiSliders,
  },
  { to: "/admin/payments", label: "Payments", icon: FiCreditCard },
  { to: "/admin/customers", label: "Customers", icon: FiUsers },
  { to: "/admin/bookings", label: "Bookings", icon: FiCalendar },
  { to: "/admin/pending-bookings", label: "Pending Bookings", icon: FiClock },
  { to: "/admin/system-health", label: "System Health", icon: FiActivity },
  { to: "/admin/support-tickets", label: "Support & Disputes", icon: FiHelpCircle },
  { to: "/admin/customer-support-accounts", label: "Support Accounts", icon: FiHeadphones },
  { to: "/admin/garage-controllers", label: "Garage Controllers", icon: FiUserCheck },
  { to: "/admin/intern-accounts", label: "Intern Accounts", icon: FiUserCheck },
  { to: "/admin/sub-admin-accounts", label: "Admin Accounts", icon: FiShield },
  { to: "/admin/pseudo-data", label: "Pseudo Data", icon: FiBarChart2 },
  { to: "/admin/dangerous", label: "Dangerous", icon: FiAlertOctagon, mainAdminOnly: true },
];

const customerSupportItems = [
  { to: "/support", label: "Dashboard", icon: FiGrid },
  { to: "/support/leads", label: "Leads", icon: FiPhoneCall },
  { to: "/support/tickets", label: "Support & Disputes", icon: FiHelpCircle },
  { to: "/support/notify", label: "Received Alerts", icon: FiBell },
  { to: "/support/notifications", label: "Send Notifications", icon: FiSend },
  { to: "/support/email", label: "Email", icon: FiMail },
];

const internItems = [
  { to: "/intern", label: "Dashboard", icon: FiGrid },
  { to: "/intern/services", label: "Services", icon: FiBriefcase },
  { to: "/intern/garages", label: "Garages", icon: FiHome },
  { to: "/intern/revenue", label: "Price Ranges", icon: FiDollarSign },
  { to: "/intern/customers", label: "Customers", icon: FiUsers },
  { to: "/intern/bookings", label: "Bookings", icon: FiCalendar },
  { to: "/intern/pending-bookings", label: "Pending Bookings", icon: FiClock },
  { to: "/intern/system-health", label: "System Health", icon: FiActivity },
];

function GaragePortalLayout() {
  const { garage } = useApp();
  const ownerItems =
    garage?.controllerAccountsEnabled === false
      ? garageItems.filter((item) => item.to !== "/garage/controllers")
      : garageItems;
  return (
    <DashboardLayout
      items={garage?.isControllerSession ? controllerItems : ownerItems}
      title={garage?.isControllerSession ? "Controller Portal" : "Garage Portal"}
    />
  );
}

function GarageControllerAccountsRoute({ children }) {
  const { garage } = useApp();
  if (garage?.controllerAccountsEnabled === false) {
    return <Navigate to="/garage" replace />;
  }
  return <GaragePortalRoute ownerOnly>{children}</GaragePortalRoute>;
}

function GaragePortalHome() {
  const { garage } = useApp();
  return garage?.isControllerSession ? <GarageControllerDashboard /> : <GarageDashboard />;
}

function AppRoutes() {
  return (
    <>
      <PwaDocumentShellGuard />
      <PrivatePageSeo />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route
          path="/sos"
          element={
            <SOSAvailabilityGuard>
              <SOSPanicScreen />
            </SOSAvailabilityGuard>
          }
        />
        <Route
          path="/sos/location"
          element={
            <SOSAvailabilityGuard>
              <SOSLocationScreen />
            </SOSAvailabilityGuard>
          }
        />
        <Route
          path="/sos/checkout"
          element={
            <SOSAvailabilityGuard>
              <SOSCheckoutScreen />
            </SOSAvailabilityGuard>
          }
        />
        <Route
          path="/sos/success"
          element={
            <SOSAvailabilityGuard>
              <SOSSuccessScreen />
            </SOSAvailabilityGuard>
          }
        />
        <Route path="/worker-task/:token" element={<WorkerTask />} />
        <Route path="/support/login" element={<CustomerSupportLogin />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:categoryId" element={<CategoryDetail />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/partner" element={<Partner />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/warranty" element={<Warranty />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/garage-partner-terms" element={<GaragePartnerTerms />} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/otp" element={<OTP />} />
          <Route path="/forgot" element={<Forgot />} />
          <Route
            path="/reset-password"
            element={<Navigate to="/forgot" replace />}
          />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
          <Route path="/intern/login" element={<InternLogin />} />
          <Route
            path="/intern/forgot-password"
            element={<InternForgotPassword />}
          />

          <Route path="/garage/login" element={<GarageLogin />} />
          <Route path="/garage/otp-login" element={<GarageOtpLogin />} />
          <Route
            path="/garage/forgot-password"
            element={<GarageForgotPassword />}
          />
          <Route
            path="/garage/first-login"
            element={<GarageFirstLoginPassword />}
          />
          <Route path="/garage/onboarding" element={<GarageOnboarding />} />
          <Route path="/garage/magic/:id" element={<MagicLink />} />
          <Route path="/garage/requests/:id" element={<MagicLink />} />

          <Route
            path="/booking/address"
            element={
              <ProtectedRoute>
                <AddressForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/booking/vehicle"
            element={
              <ProtectedRoute>
                <AddressCheck>
                  <VehicleSelect />
                </AddressCheck>
              </ProtectedRoute>
            }
          />
          <Route
            path="/booking/services"
            element={
              <ProtectedRoute>
                <AddressCheck>
                  <VehicleCheck>
                    <ServiceSelect />
                  </VehicleCheck>
                </AddressCheck>
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <AddressCheck>
                  <VehicleCheck>
                    <Checkout />
                  </VehicleCheck>
                </AddressCheck>
              </ProtectedRoute>
            }
          />

          <Route
            path="/booking/verification/:bookingId"
            element={
              <ProtectedRoute>
                <BookingVerification />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tracking"
            element={
              <ProtectedRoute>
                <AddressCheck>
                  <VehicleCheck>
                    <Tracking />
                  </VehicleCheck>
                </AddressCheck>
              </ProtectedRoute>
            }
          />
        </Route>

        <Route
          element={
            <DashboardLayout items={customerItems} title="Customer Portal" />
          }
        >
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AddressCheck>
                  <VehicleCheck>
                    <CustomerDashboard />
                  </VehicleCheck>
                </AddressCheck>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/vehicles"
            element={
              <ProtectedRoute>
                <AddressCheck>
                  <MyVehicles />
                </AddressCheck>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/bookings"
            element={
              <ProtectedRoute>
                <AddressCheck>
                  <VehicleCheck>
                    <ActiveBookings />
                  </VehicleCheck>
                </AddressCheck>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/pending-bookings"
            element={
              <ProtectedRoute>
                <CustomerPendingBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/history"
            element={
              <ProtectedRoute>
                <AddressCheck>
                  <VehicleCheck>
                    <ServiceHistory />
                  </VehicleCheck>
                </AddressCheck>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/warranty"
            element={
              <ProtectedRoute>
                <CustomerWarrantyCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/payments"
            element={
              <ProtectedRoute>
                <AddressCheck>
                  <VehicleCheck>
                    <Payments />
                  </VehicleCheck>
                </AddressCheck>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/notifications"
            element={
              <ProtectedRoute>
                <AddressCheck>
                  <VehicleCheck>
                    <Notifications />
                  </VehicleCheck>
                </AddressCheck>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/support"
            element={
              <ProtectedRoute>
                <CustomerSupport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route
          element={
            <GaragePortalLayout />
          }
        >
          <Route
            path="/garage"
            element={
              <GaragePortalRoute>
                <GaragePortalHome />
              </GaragePortalRoute>
            }
          />
          <Route
            path="/garage/bookings"
            element={
              <GaragePortalRoute>
                <GarageBookings />
              </GaragePortalRoute>
            }
          />
          <Route
            path="/garage/bookings/:id"
            element={
              <GaragePortalRoute>
                <GarageBookingDetail />
              </GaragePortalRoute>
            }
          />
          <Route
            path="/garage/history"
            element={
              <GaragePortalRoute>
                <GarageServiceHistory />
              </GaragePortalRoute>
            }
          />
          <Route
            path="/garage/services"
            element={
              <GaragePortalRoute ownerOnly>
                <GarageServices />
              </GaragePortalRoute>
            }
          />
          <Route
            path="/garage/wallet"
            element={
              <GaragePortalRoute>
                <GarageWallet />
              </GaragePortalRoute>
            }
          />
          <Route
            path="/garage/profile"
            element={
              <GaragePortalRoute ownerOnly>
                <GarageProfile />
              </GaragePortalRoute>
            }
          />
          <Route
            path="/garage/settings"
            element={
              <GaragePortalRoute ownerOnly>
                <GarageSettings />
              </GaragePortalRoute>
            }
          />
          <Route path="/garage/controllers" element={<GarageControllerAccountsRoute><GarageControllers /></GarageControllerAccountsRoute>} />
        </Route>

        <Route
          element={<DashboardLayout items={adminItems} title="Admin Console" />}
        >
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/control-center"
            element={
              <ProtectedRoute>
                <AdminControlCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/system-health"
            element={
              <ProtectedRoute>
                <AdminSystemHealth />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/integration-health"
            element={
              <ProtectedRoute>
                <Navigate to="/admin/system-health?view=integrations" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/customers"
            element={
              <ProtectedRoute>
                <AdminCustomers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/cars"
            element={
              <ProtectedRoute>
                <AdminCars />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/services"
            element={
              <ProtectedRoute>
                <AdminServices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/garages"
            element={
              <ProtectedRoute>
                <AdminGarages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/bookings"
            element={
              <ProtectedRoute>
                <AdminBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/pending-bookings"
            element={
              <ProtectedRoute>
                <AdminPendingBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/revenue"
            element={
              <ProtectedRoute>
                <AdminRevenue />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/pricing-operations"
            element={
              <ProtectedRoute>
                <AdminPricingOperations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payments"
            element={
              <ProtectedRoute>
                <AdminPayments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/system-issues"
            element={
              <ProtectedRoute>
                <Navigate to="/admin/system-health?view=issues" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/support-tickets"
            element={
              <ProtectedRoute>
                <AdminSupportTickets />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/customer-support-accounts"
            element={
              <ProtectedRoute>
                <AdminCustomerSupportAccounts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/intern-accounts"
            element={
              <ProtectedRoute>
                <AdminInternAccounts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/sub-admin-accounts"
            element={
              <ProtectedRoute>
                <AdminSubAdminAccounts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/garage-controllers"
            element={
              <ProtectedRoute>
                <AdminGarageControllers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/pseudo-data"
            element={
              <ProtectedRoute>
                <AdminPseudoData />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dangerous"
            element={
              <ProtectedRoute mainAdminOnly>
                <AdminDangerous />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route
          element={<DashboardLayout items={internItems} title="Intern Console" />}
        >
          <Route
            path="/intern"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/intern/customers"
            element={
              <ProtectedRoute>
                <AdminCustomers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/intern/services"
            element={
              <ProtectedRoute>
                <AdminServices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/intern/garages"
            element={
              <ProtectedRoute>
                <AdminGarages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/intern/bookings"
            element={
              <ProtectedRoute>
                <AdminBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/intern/pending-bookings"
            element={
              <ProtectedRoute>
                <AdminPendingBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/intern/revenue"
            element={
              <ProtectedRoute>
                <AdminRevenue />
              </ProtectedRoute>
            }
          />
          <Route
            path="/intern/system-health"
            element={
              <ProtectedRoute>
                <AdminSystemHealth />
              </ProtectedRoute>
            }
          />
          <Route
            path="/intern/system-issues"
            element={
              <ProtectedRoute>
                <Navigate to="/intern/system-health?view=issues" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/intern/integration-health"
            element={
              <ProtectedRoute>
                <Navigate to="/intern/system-health?view=integrations" replace />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route
          element={
            <DashboardLayout
              items={customerSupportItems}
              title="Customer Support"
            />
          }
        >
          <Route
            path="/support"
            element={
              <ProtectedRoute>
                <CustomerSupportDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/support/leads"
            element={
              <ProtectedRoute>
                <CustomerSupportLeads />
              </ProtectedRoute>
            }
          />
          <Route
            path="/support/tickets"
            element={
              <ProtectedRoute>
                <CustomerSupportTickets />
              </ProtectedRoute>
            }
          />
          <Route
            path="/support/notify"
            element={
              <ProtectedRoute>
                <CustomerSupportNotify />
              </ProtectedRoute>
            }
          />
          <Route
            path="/support/notifications"
            element={
              <ProtectedRoute>
                <CustomerSupportNotifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/support/email"
            element={
              <ProtectedRoute>
                <CustomerSupportEmail />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

function RouteFallback() {
  return (
    <div className="container-x py-12">
      <div className="card-soft p-6 text-muted">Loading...</div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    if (getExpectedDocumentShell(window.location.pathname) !== "main") {
      return;
    }

    // Start downloading the small Services route chunk immediately after the
    // first paint so clicking the Services link does not trigger a chunk wait.
    loadServicesPage().catch(() => {});
  }, []);

  return (
    <AppProvider>
      <AppErrorBoundary>
        <AppRoutes />
        <DeferredVercelInsights />
      </AppErrorBoundary>
    </AppProvider>
  );
}
