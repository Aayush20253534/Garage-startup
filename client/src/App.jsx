import { Component, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "@/hooks/useApp";
import { hasSavedUserLocation } from "@/utils/signupLocation";
import { hasUsableIndiaCoordinates } from "@/utils/address";
import MainLayout from "@/layouts/MainLayout";
import DashboardLayout from "@/layouts/DashboardLayout";

function ProtectedRoute({ children }) {
  const { user, garage, authLoading } = useApp();
  const location = useLocation();
  const isGarageRoute = location.pathname.startsWith("/garage");
  const isAdminRoute = location.pathname.startsWith("/admin");

  if (authLoading) {
    return <RouteFallback />;
  }

  if (isAdminRoute) {
    if (user?.role !== "ADMIN") {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }
  } else if (isGarageRoute) {
    if (!garage) {
      return <Navigate to="/garage/login" state={{ from: location }} replace />;
    }
  } else {
    if (!user) {
      return <Navigate to="/login" state={{ from: location }} replace />;
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

  if (user?.role === "CUSTOMER" && !hasSavedUserLocation(user) && !hasLiveLocation) {
    return <Navigate to="/booking/address" state={{ from: routeLocation }} replace />;
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

const Home = lazy(() => import("@/pages/Home"));
const Services = lazy(() => import("@/pages/Services"));
const CategoryDetail = lazy(() => import("@/pages/CategoryDetail"));
const HowItWorks = lazy(() => import("@/pages/HowItWorks"));
const About = lazy(() => import("@/pages/About"));
const Partner = lazy(() => import("@/pages/Partner"));
const Contact = lazy(() => import("@/pages/Contact"));
const Warranty = lazy(() => import("@/pages/Warranty"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const SOSPanicScreen = lazy(() => import("@/pages/sos/SOSPanicScreen"));
const SOSLocationScreen = lazy(() => import("@/pages/sos/SOSLocationScreen"));
const SOSCheckoutScreen = lazy(() => import("@/pages/sos/SOSCheckoutScreen"));
const SOSSuccessScreen = lazy(() => import("@/pages/sos/SOSSuccessScreen"));

const Login = lazy(() => import("@/pages/auth/Login"));
const Register = lazy(() => import("@/pages/auth/Register"));
const OTP = lazy(() => import("@/pages/auth/OTP"));
const Forgot = lazy(() => import("@/pages/auth/Forgot"));

const VehicleSelect = lazy(() => import("@/pages/booking/VehicleSelect"));
const AddressForm = lazy(() => import("@/pages/booking/AddressForm"));
const ServiceSelect = lazy(() => import("@/pages/booking/ServiceSelect"));
const GarageSelect = lazy(() => import("@/pages/booking/GarageSelect"));
const Checkout = lazy(() => import("@/pages/booking/Checkout"));
const Tracking = lazy(() => import("@/pages/booking/Tracking"));

const CustomerDashboard = lazy(() => import("@/pages/customer/Dashboard"));
const MyVehicles = lazy(() => import("@/pages/customer/MyVehicles"));
const ActiveBookings = lazy(() => import("@/pages/customer/ActiveBookings"));
const ServiceHistory = lazy(() => import("@/pages/customer/ServiceHistory"));
const Profile = lazy(() => import("@/pages/customer/Profile"));
const Payments = lazy(() => import("@/pages/customer/Payments"));
const Notifications = lazy(() => import("@/pages/customer/Notifications"));

const GarageDashboard = lazy(() => import("@/pages/garage/Dashboard"));
const GarageLogin = lazy(() => import("@/pages/garage/auth/Login"));
const GarageOtpLogin = lazy(() => import("@/pages/garage/auth/OtpLogin"));
const GarageForgotPassword = lazy(() => import("@/pages/garage/auth/ForgotPassword"));
const GarageOnboarding = lazy(() => import("@/pages/garage/Onboarding"));
const GarageServices = lazy(() => import("@/pages/garage/Services"));
const GarageBookings = lazy(() => import("@/pages/garage/Bookings"));
const GarageBookingDetail = lazy(() => import("@/pages/garage/BookingDetail"));
const GarageProfile = lazy(() => import("@/pages/garage/Profile"));
const GarageSettings = lazy(() => import("@/pages/garage/Settings"));
const GarageWallet = lazy(() => import("@/pages/garage/Wallet"));
const MagicLink = lazy(() => import("@/pages/garage/MagicLink"));

const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminLogin = lazy(() => import("@/pages/admin/Login"));
const AdminCustomers = lazy(() => import("@/pages/admin/Customers"));
const AdminGarages = lazy(() => import("@/pages/admin/Garages"));
const AdminBookings = lazy(() => import("@/pages/admin/Bookings"));
const AdminRevenue = lazy(() => import("@/pages/admin/Revenue"));
const AdminNotifications = lazy(() => import("@/pages/admin/Notifications"));

import { FiGrid, FiTruck, FiPlusCircle, FiCalendar, FiClock, FiShield, FiCreditCard, FiBell, FiUser,
  FiInbox, FiBriefcase, FiTrendingUp, FiStar, FiUsers, FiSettings, FiDollarSign, FiHome } from "react-icons/fi";

const isChunkLoadError = (error) => {
  const message = String(error?.message || error || "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(message);
};

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

  componentDidCatch(error) {
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
      .filter((key) => key.startsWith("rov_route_reload_attempted:") || key.startsWith("rov_chunk_reload_attempted:"))
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
            {staleChunk ? "Refreshing the latest version" : "Something stopped this page from loading"}
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
  { to: "/admin/garages", label: "Garages", icon: FiHome },
  { to: "/admin/revenue", label: "Price Ranges", icon: FiDollarSign },
  { to: "/admin/customers", label: "Customers", icon: FiUsers },
  { to: "/admin/bookings", label: "Bookings", icon: FiCalendar },
  { to: "/admin/notifications", label: "Notifications", icon: FiBell },
];

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/sos" element={<SOSPanicScreen />} />
        <Route path="/sos/location" element={<SOSLocationScreen />} />
        <Route path="/sos/checkout" element={<SOSCheckoutScreen />} />
        <Route path="/sos/success" element={<SOSSuccessScreen />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
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
          <Route path="/admin/login" element={<AdminLogin />} />

          <Route path="/garage/login" element={<GarageLogin />} />
          <Route path="/garage/otp-login" element={<GarageOtpLogin />} />
          <Route path="/garage/forgot-password" element={<GarageForgotPassword />} />
          <Route path="/garage/onboarding" element={<GarageOnboarding />} />
          <Route path="/garage/magic/:id" element={<MagicLink />} />

          <Route path="/booking/address" element={<ProtectedRoute><AddressForm /></ProtectedRoute>} />
          <Route path="/booking/vehicle" element={<ProtectedRoute><AddressCheck><VehicleSelect /></AddressCheck></ProtectedRoute>} />
          <Route path="/booking/services" element={<ProtectedRoute><AddressCheck><VehicleCheck><ServiceSelect /></VehicleCheck></AddressCheck></ProtectedRoute>} />
          <Route path="/booking/garage" element={<ProtectedRoute><AddressCheck><VehicleCheck><GarageSelect /></VehicleCheck></AddressCheck></ProtectedRoute>} />
          <Route path="/checkout" element={<ProtectedRoute><AddressCheck><VehicleCheck><Checkout /></VehicleCheck></AddressCheck></ProtectedRoute>} />
          <Route path="/tracking" element={<ProtectedRoute><AddressCheck><VehicleCheck><Tracking /></VehicleCheck></AddressCheck></ProtectedRoute>} />

        </Route>

        <Route element={<DashboardLayout items={customerItems} title="Customer Portal" />}>
          <Route path="/dashboard" element={<ProtectedRoute><AddressCheck><VehicleCheck><CustomerDashboard /></VehicleCheck></AddressCheck></ProtectedRoute>} />
          <Route path="/dashboard/vehicles" element={<ProtectedRoute><AddressCheck><MyVehicles /></AddressCheck></ProtectedRoute>} />
          <Route path="/dashboard/bookings" element={<ProtectedRoute><AddressCheck><VehicleCheck><ActiveBookings /></VehicleCheck></AddressCheck></ProtectedRoute>} />
          <Route path="/dashboard/history" element={<ProtectedRoute><AddressCheck><VehicleCheck><ServiceHistory /></VehicleCheck></AddressCheck></ProtectedRoute>} />
          <Route path="/dashboard/payments" element={<ProtectedRoute><AddressCheck><VehicleCheck><Payments /></VehicleCheck></AddressCheck></ProtectedRoute>} />
          <Route path="/dashboard/notifications" element={<ProtectedRoute><AddressCheck><VehicleCheck><Notifications /></VehicleCheck></AddressCheck></ProtectedRoute>} />
          <Route path="/dashboard/profile" element={<ProtectedRoute><AddressCheck><VehicleCheck><Profile /></VehicleCheck></AddressCheck></ProtectedRoute>} />
        </Route>

        <Route element={<DashboardLayout items={garageItems} title="Garage Portal" />}>
          <Route path="/garage" element={<ProtectedRoute><GarageDashboard /></ProtectedRoute>} />
          <Route path="/garage/bookings" element={<ProtectedRoute><GarageBookings /></ProtectedRoute>} />
          <Route path="/garage/bookings/:id" element={<ProtectedRoute><GarageBookingDetail /></ProtectedRoute>} />
          <Route path="/garage/services" element={<ProtectedRoute><GarageServices /></ProtectedRoute>} />
          <Route path="/garage/wallet" element={<ProtectedRoute><GarageWallet /></ProtectedRoute>} />
          <Route path="/garage/profile" element={<ProtectedRoute><GarageProfile /></ProtectedRoute>} />
          <Route path="/garage/settings" element={<ProtectedRoute><GarageSettings /></ProtectedRoute>} />
        </Route>

        <Route element={<DashboardLayout items={adminItems} title="Admin Console" />}>
          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/customers" element={<ProtectedRoute><AdminCustomers /></ProtectedRoute>} />
          <Route path="/admin/garages" element={<ProtectedRoute><AdminGarages /></ProtectedRoute>} />
          <Route path="/admin/bookings" element={<ProtectedRoute><AdminBookings /></ProtectedRoute>} />
          <Route path="/admin/revenue" element={<ProtectedRoute><AdminRevenue /></ProtectedRoute>} />
          <Route path="/admin/notifications" element={<ProtectedRoute><AdminNotifications /></ProtectedRoute>} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
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
      </AppErrorBoundary>
    </AppProvider>
  );
}
