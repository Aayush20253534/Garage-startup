import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "@/hooks/useApp";
import MainLayout from "@/layouts/MainLayout";
import DashboardLayout from "@/layouts/DashboardLayout";

function ProtectedRoute({ children }) {
  const { user } = useApp();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function VehicleCheck({ children }) {
  const { user, vehicles } = useApp();
  if (user && user.role === "customer" && vehicles.length === 0) {
    return <Navigate to="/booking/vehicle" replace />;
  }
  return children;
}

import Home from "@/pages/Home";
import Services from "@/pages/Services";
import CategoryDetail from "@/pages/CategoryDetail";
import HowItWorks from "@/pages/HowItWorks";
import About from "@/pages/About";
import Partner from "@/pages/Partner";
import Contact from "@/pages/Contact";
import Warranty from "@/pages/Warranty";
import NotFound from "@/pages/NotFound";
import SOSPanicScreen from "@/pages/sos/SOSPanicScreen";
import SOSLocationScreen from "@/pages/sos/SOSLocationScreen";
import SOSCheckoutScreen from "@/pages/sos/SOSCheckoutScreen";
import SOSSuccessScreen from "@/pages/sos/SOSSuccessScreen";

import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import OTP from "@/pages/auth/OTP";
import Forgot from "@/pages/auth/Forgot";

import VehicleSelect from "@/pages/booking/VehicleSelect";
import ServiceSelect from "@/pages/booking/ServiceSelect";
import GarageSelect from "@/pages/booking/GarageSelect";
import Checkout from "@/pages/booking/Checkout";
import Tracking from "@/pages/booking/Tracking";

import CustomerDashboard from "@/pages/customer/Dashboard";
import MyVehicles from "@/pages/customer/MyVehicles";
import ActiveBookings from "@/pages/customer/ActiveBookings";
import ServiceHistory from "@/pages/customer/ServiceHistory";
import Profile from "@/pages/customer/Profile";
import Payments from "@/pages/customer/Payments";
import Notifications from "@/pages/customer/Notifications";

import GarageDashboard from "@/pages/garage/Dashboard";
import GarageLeads from "@/pages/garage/Leads";
import GarageWallet from "@/pages/garage/Wallet";
import GarageJobs from "@/pages/garage/Jobs";
import GarageEarnings from "@/pages/garage/Earnings";
import MagicLink from "@/pages/garage/MagicLink";

import AdminDashboard from "@/pages/admin/Dashboard";
import AdminCustomers from "@/pages/admin/Customers";
import AdminGarages from "@/pages/admin/Garages";
import AdminBookings from "@/pages/admin/Bookings";
import AdminRevenue from "@/pages/admin/Revenue";

import { FiGrid, FiTruck, FiPlusCircle, FiCalendar, FiClock, FiShield, FiCreditCard, FiBell, FiUser,
  FiInbox, FiBriefcase, FiTrendingUp, FiStar, FiUsers, FiSettings, FiDollarSign, FiHome } from "react-icons/fi";

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
  { to: "/garage/leads", label: "Leads", icon: FiInbox },
  { to: "/garage/jobs", label: "Active Jobs", icon: FiBriefcase },
  { to: "/garage/wallet", label: "Wallet", icon: FiCreditCard },
  { to: "/garage/earnings", label: "Earnings", icon: FiTrendingUp },
];

const adminItems = [
  { to: "/admin", label: "Dashboard", icon: FiGrid },
  { to: "/admin/customers", label: "Customers", icon: FiUsers },
  { to: "/admin/garages", label: "Garages", icon: FiHome },
  { to: "/admin/bookings", label: "Bookings", icon: FiCalendar },
  { to: "/admin/revenue", label: "Revenue", icon: FiDollarSign },
];

function AppRoutes() {
  return (
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

        <Route path="/booking/vehicle" element={<ProtectedRoute><VehicleSelect /></ProtectedRoute>} />
        <Route path="/booking/services" element={<ProtectedRoute><VehicleCheck><ServiceSelect /></VehicleCheck></ProtectedRoute>} />
        <Route path="/booking/garage" element={<ProtectedRoute><VehicleCheck><GarageSelect /></VehicleCheck></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute><VehicleCheck><Checkout /></VehicleCheck></ProtectedRoute>} />
        <Route path="/tracking" element={<ProtectedRoute><VehicleCheck><Tracking /></VehicleCheck></ProtectedRoute>} />

        <Route path="/garage/magic/:id" element={<MagicLink />} />
      </Route>

      <Route element={<DashboardLayout items={customerItems} title="Customer Portal" />}>
        <Route path="/dashboard" element={<ProtectedRoute><VehicleCheck><CustomerDashboard /></VehicleCheck></ProtectedRoute>} />
        <Route path="/dashboard/vehicles" element={<ProtectedRoute><MyVehicles /></ProtectedRoute>} />
        <Route path="/dashboard/bookings" element={<ProtectedRoute><VehicleCheck><ActiveBookings /></VehicleCheck></ProtectedRoute>} />
        <Route path="/dashboard/history" element={<ProtectedRoute><VehicleCheck><ServiceHistory /></VehicleCheck></ProtectedRoute>} />
        <Route path="/dashboard/payments" element={<ProtectedRoute><VehicleCheck><Payments /></VehicleCheck></ProtectedRoute>} />
        <Route path="/dashboard/notifications" element={<ProtectedRoute><VehicleCheck><Notifications /></VehicleCheck></ProtectedRoute>} />
        <Route path="/dashboard/profile" element={<ProtectedRoute><VehicleCheck><Profile /></VehicleCheck></ProtectedRoute>} />
      </Route>

      <Route element={<DashboardLayout items={garageItems} title="Garage Portal" />}>
        <Route path="/garage" element={<ProtectedRoute><GarageDashboard /></ProtectedRoute>} />
        <Route path="/garage/leads" element={<ProtectedRoute><GarageLeads /></ProtectedRoute>} />
        <Route path="/garage/jobs" element={<ProtectedRoute><GarageJobs /></ProtectedRoute>} />
        <Route path="/garage/wallet" element={<ProtectedRoute><GarageWallet /></ProtectedRoute>} />
        <Route path="/garage/earnings" element={<ProtectedRoute><GarageEarnings /></ProtectedRoute>} />
      </Route>

      <Route element={<DashboardLayout items={adminItems} title="Admin Console" />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/customers" element={<AdminCustomers />} />
        <Route path="/admin/garages" element={<AdminGarages />} />
        <Route path="/admin/bookings" element={<AdminBookings />} />
        <Route path="/admin/revenue" element={<AdminRevenue />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
}
