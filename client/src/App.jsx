import { Component, lazy, Suspense, useEffect, useState } from "react";
import { Link, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { AppProvider, useApp } from "@/hooks/useApp";
import { hasSavedUserLocation } from "@/utils/signupLocation";
import { hasUsableIndiaCoordinates } from "@/utils/address";
import MainLayout from "@/layouts/MainLayout";
import DashboardLayout from "@/layouts/DashboardLayout";
import api from "@/api/axios";
import { CATEGORY_UI } from "@/data/services";
import ComingSoonOverlay from "@/components/services/ComingSoonOverlay";
import { getCategoryThumbnailUrl } from "@/utils/imageCache";
import { reportSystemIssue } from "@/utils/errorReporter";
import {
  createMissingLazyDefaultError,
  isChunkLoadError,
  reloadForLatestBuild,
} from "@/utils/chunkRecovery";
import PrivatePageSeo from "@/components/seo/PrivatePageSeo";
import Home from "@/pages/Home";

const getEffectiveAccountType = (user) => {
  if (user?.accountType) {
    return user.accountType;
  }

  if (user?.role === "ADMIN" || user?.role === "INTERN") {
    return "STAFF";
  }

  if (user?.role === "CUSTOMER" || user?.role === "GARAGE_OWNER") {
    return "USER";
  }

  return null;
};

const hasPortalRole = (user, role, accountType) =>
  user?.role === role && getEffectiveAccountType(user) === accountType;

const getAccountPortal = (user) => {
  if (hasPortalRole(user, "ADMIN", "STAFF")) {
    return "/admin";
  }

  if (hasPortalRole(user, "INTERN", "STAFF")) {
    return "/intern";
  }

  if (hasPortalRole(user, "GARAGE_OWNER", "USER")) {
    return "/garage";
  }

  if (hasPortalRole(user, "CUSTOMER", "USER")) {
    return "/dashboard";
  }

  return "/login";
};

function ProtectedRoute({ children }) {
  const { user, garage, authLoading } = useApp();
  const location = useLocation();

  const isGarageRoute =
    location.pathname === "/garage" || location.pathname.startsWith("/garage/");
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isInternRoute = location.pathname.startsWith("/intern");

  if (authLoading) {
    return <RouteFallback />;
  }

  if (isAdminRoute) {
    const isAdmin = hasPortalRole(user, "ADMIN", "STAFF");

    if (!isAdmin) {
      return (
        <Navigate
          to={user ? getAccountPortal(user) : "/admin/login"}
          state={{ from: location }}
          replace
        />
      );
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

function AddressCheck({ children }) {
  const { user, location } = useApp();
  const routeLocation = useLocation();
  const hasLiveLocation =
    Boolean(location?.address || location?.fullAddress) &&
    hasUsableIndiaCoordinates(location);

  if (
    user?.role === "CUSTOMER" &&
    !hasSavedUserLocation(user) &&
    !hasLiveLocation
  ) {
    return (
      <Navigate to="/booking/address" state={{ from: routeLocation }} replace />
    );
  }

  return children;
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

const Services = lazyPage(() => import("@/pages/Services"), "Services");
const Garages = lazyPage(() => import("@/pages/Garages"), "Garages");
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

const Login = lazyPage(() => import("@/pages/auth/Login"), "Login");
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
const GarageSelect = lazyPage(
  () => import("@/pages/booking/GarageSelect"),
  "GarageSelect",
);
const Checkout = lazyPage(() => import("@/pages/booking/Checkout"), "Checkout");
const Tracking = lazyPage(() => import("@/pages/booking/Tracking"), "Tracking");

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
const Profile = lazyPage(() => import("@/pages/customer/Profile"), "Profile");
const Payments = lazyPage(
  () => import("@/pages/customer/Payments"),
  "Payments",
);
const Notifications = lazyPage(
  () => import("@/pages/customer/Notifications"),
  "Notifications",
);

const GarageDashboard = lazyPage(
  () => import("@/pages/garage/Dashboard"),
  "GarageDashboard",
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

const AdminDashboard = lazyPage(
  () => import("@/pages/admin/Dashboard"),
  "AdminDashboard",
);
const AdminLogin = lazyPage(() => import("@/pages/admin/Login"), "AdminLogin");
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
const AdminPayments = lazyPage(
  () => import("@/pages/admin/Payments"),
  "Payments",
);
const AdminNotifications = lazyPage(
  () => import("@/pages/admin/Notifications"),
  "AdminNotifications",
);
const AdminEmail = lazyPage(() => import("@/pages/admin/Email"), "AdminEmail");
const AdminCars = lazyPage(() => import("@/pages/admin/Cars"), "AdminCars");
const AdminServices = lazyPage(
  () => import("@/pages/admin/Services"),
  "AdminServices",
);
const AdminSystemIssues = lazyPage(
  () => import("@/pages/admin/SystemIssues"),
  "AdminSystemIssues",
);
const AdminDangerous = lazyPage(
  () => import("@/pages/admin/Dangerous"),
  "AdminDangerous",
);
const InternLogin = lazyPage(() => import("@/pages/intern/Login"), "InternLogin");

import {
  FiArrowLeft,
  FiAlertTriangle,
  FiAlertOctagon,
  FiGrid,
  FiTruck,
  FiPlusCircle,
  FiCalendar,
  FiClock,
  FiShield,
  FiCreditCard,
  FiBell,
  FiUser,
  FiInbox,
  FiBriefcase,
  FiStar,
  FiUsers,
  FiSettings,
  FiDollarSign,
  FiHome,
  FiMail,
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
      window.location.replace(url.toString());
    }, 250);
  }

  clearAndReload = () => {
    Object.keys(sessionStorage)
      .filter(
        (key) =>
          key.startsWith("rov_route_reload_attempted:") ||
          key.startsWith("rov_chunk_reload_attempted:") ||
          key === "rovauto:stale-chunk-reload",
      )
      .forEach((key) => sessionStorage.removeItem(key));

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
              className="rounded-full bg-brand px-5 py-3 text-sm font-bold text-ink"
            >
              {isRecovering ? "Reloading..." : "Reload page"}
            </button>
            <button
              type="button"
              onClick={this.goHome}
              className="rounded-full border border-line px-5 py-3 text-sm font-bold text-ink"
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
  { to: "/dashboard/history", label: "Service History", icon: FiClock },
  { to: "/warranty", label: "Warranty Center", icon: FiShield },
  { to: "/dashboard/payments", label: "Payments", icon: FiCreditCard },
  { to: "/dashboard/notifications", label: "Notifications", icon: FiBell },
  { to: "/dashboard/profile", label: "Profile", icon: FiUser },
];

const garageItems = [
  { to: "/garage", label: "Dashboard", icon: FiGrid },
  { to: "/garage/bookings", label: "Bookings", icon: FiCalendar },
  { to: "/garage/services", label: "Services", icon: FiInbox },
  { to: "/garage/wallet", label: "Wallet", icon: FiCreditCard },
  { to: "/garage/profile", label: "Profile", icon: FiUser },
  { to: "/garage/settings", label: "Settings", icon: FiSettings },
];

const adminItems = [
  { to: "/admin", label: "Dashboard", icon: FiGrid },
  { to: "/admin/cars", label: "Cars", icon: FiTruck },
  { to: "/admin/services", label: "Services", icon: FiBriefcase },
  { to: "/admin/garages", label: "Garages", icon: FiHome },
  { to: "/admin/revenue", label: "Price Ranges", icon: FiDollarSign },
  { to: "/admin/payments", label: "Payments", icon: FiCreditCard },
  { to: "/admin/customers", label: "Customers", icon: FiUsers },
  { to: "/admin/bookings", label: "Bookings", icon: FiCalendar },
  { to: "/admin/pending-bookings", label: "Pending Bookings", icon: FiClock },
  { to: "/admin/system-issues", label: "System Issues", icon: FiAlertTriangle },
  { to: "/admin/dangerous", label: "Dangerous", icon: FiAlertOctagon },
  { to: "/admin/notifications", label: "Notifications", icon: FiBell },
  { to: "/admin/email", label: "Email", icon: FiMail },
];

const internItems = [
  { to: "/intern", label: "Dashboard", icon: FiGrid },
  { to: "/intern/services", label: "Services", icon: FiBriefcase },
  { to: "/intern/garages", label: "Garages", icon: FiHome },
  { to: "/intern/revenue", label: "Price Ranges", icon: FiDollarSign },
  { to: "/intern/customers", label: "Customers", icon: FiUsers },
  { to: "/intern/bookings", label: "Bookings", icon: FiCalendar },
  { to: "/intern/pending-bookings", label: "Pending Bookings", icon: FiClock },
  { to: "/intern/system-issues", label: "System Issues", icon: FiAlertTriangle },
  { to: "/intern/notifications", label: "Notifications", icon: FiBell },
  { to: "/intern/email", label: "Email", icon: FiMail },
];

function AppRoutes() {
  return (
    <>
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
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route
            path="/garages"
            element={
              <ProtectedRoute>
                <Garages />
              </ProtectedRoute>
            }
          />
          <Route path="/services/:categoryId" element={<CategoryDetail />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/partner" element={<Partner />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/warranty" element={<Warranty />} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/otp" element={<OTP />} />
          <Route path="/forgot" element={<Forgot />} />
          <Route
            path="/reset-password"
            element={<Navigate to="/forgot" replace />}
          />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/intern/login" element={<InternLogin />} />

          <Route path="/garage/login" element={<GarageLogin />} />
          <Route path="/garage/otp-login" element={<GarageOtpLogin />} />
          <Route
            path="/garage/forgot-password"
            element={<GarageForgotPassword />}
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
            path="/booking/garage"
            element={
              <ProtectedRoute>
                <AddressCheck>
                  <VehicleCheck>
                    <GarageSelect />
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
            <DashboardLayout items={garageItems} title="Garage Portal" />
          }
        >
          <Route
            path="/garage"
            element={
              <ProtectedRoute>
                <GarageDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/garage/bookings"
            element={
              <ProtectedRoute>
                <GarageBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/garage/bookings/:id"
            element={
              <ProtectedRoute>
                <GarageBookingDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/garage/services"
            element={
              <ProtectedRoute>
                <GarageServices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/garage/wallet"
            element={
              <ProtectedRoute>
                <GarageWallet />
              </ProtectedRoute>
            }
          />
          <Route
            path="/garage/profile"
            element={
              <ProtectedRoute>
                <GarageProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/garage/settings"
            element={
              <ProtectedRoute>
                <GarageSettings />
              </ProtectedRoute>
            }
          />
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
                <AdminSystemIssues />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dangerous"
            element={
              <ProtectedRoute>
                <AdminDangerous />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/notifications"
            element={
              <ProtectedRoute>
                <AdminNotifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/email"
            element={
              <ProtectedRoute>
                <AdminEmail />
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
            path="/intern/system-issues"
            element={
              <ProtectedRoute>
                <AdminSystemIssues />
              </ProtectedRoute>
            }
          />
          <Route
            path="/intern/notifications"
            element={
              <ProtectedRoute>
                <AdminNotifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/intern/email"
            element={
              <ProtectedRoute>
                <AdminEmail />
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
  return (
    <AppProvider>
      <AppErrorBoundary>
        <AppRoutes />
        <Analytics />
        <SpeedInsights />
      </AppErrorBoundary>
    </AppProvider>
  );
}
