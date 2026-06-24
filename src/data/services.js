// First import your local images
import { FiTool, FiDroplet, FiZap, FiWind, FiShield, FiCircle, FiPackage, FiUmbrella, FiSun } from "react-icons/fi";
import carWash from "@/assets/car_wash.png";
import serviceRepair from "@/assets/Service And Repair.png";
import acService from "@/assets/AC Service.png";
import painting from "@/assets/painting.png";
import battery from "@/assets/battery.png";
import roadside from "@/assets/Roadside.png";
import modification from "@/assets/Modification.png";

export const SERVICE_CATEGORIES = [
  { id: "wash", name: "Car/Bike Wash & Care", image: carWash, icon: FiShield, color: "#06b6d4" },
  { id: "scheduled", name: "Car Servicing & Repair", image: serviceRepair, icon: FiPackage, color: "#b9f000" },
  { id: "ac", name: "AC Service", image: acService, icon: FiWind, color: "#56c2ff" },
  { id: "denting", name: "Denting & Painting", image: painting, icon: FiTool, color: "#ff8a3d" },
  { id: "battery", name: "Batteries", image: battery, icon: FiZap, color: "#22c55e" },
  { id: "roadside", name: "Roadside Assistance", image: roadside, icon: FiUmbrella, color: "#ef4444", isSos: true },
  { id: "modification", name: "Modifications", image: modification, icon: FiTool, color: "#a78bfa" },
];

// Define packages for each category
export const CATEGORY_PACKAGES = {
  scheduled: [
    {
      id: "std-car-service",
      name: "Standard Car Service",
      image: serviceRepair,
      price: 3292,
      originalPrice: 3950,
      discount: "25% OFF",
      rating: 4.8,
      totalRatings: 22456,
      bookings: "1.3K Bookings in Last 30 Days",
      time: "6 Hours",
      warranty: "3 Months / 1000 km",
      serviceInterval: "Every 10000 km / 6 Months (Recommended)",
      servicesIncluded: 15,
      includes: ["Engine Oil Change", "Oil Filter Replacement", "Air Filter Cleaning", "Coolant Top-up", "Brake Inspection", "Battery Check", "Tyre Pressure Check", "Wiper Fluid Top-up", "30-point Inspection"]
    },
    {
      id: "comp-car-service",
      name: "Comprehensive Car Service",
      image: serviceRepair,
      price: 4820,
      originalPrice: 5784,
      discount: "25% OFF",
      rating: 4.7,
      totalRatings: 22456,
      bookings: "1.6K Bookings in Last 30 Days",
      time: "8 Hours",
      warranty: "3 Months / 1000 km",
      serviceInterval: "Every 20000 km / 12 Months",
      servicesIncluded: 21,
      includes: ["Synthetic Engine Oil", "All Filters (Oil, Air, Fuel)", "AC Vent Cleaning", "Brake Inspection & Cleaning", "Battery Check & Terminal Cleaning", "Tyre Rotation & Balancing", "Spark Plug Check", "Clutch Adjustment", "Full Body Inspection"]
    }
  ],
  ac: [
    {
      id: "reg-ac-service",
      name: "Regular AC Service",
      image: acService,
      price: 2161,
      originalPrice: 2549,
      discount: "25% OFF",
      rating: 4.2,
      totalRatings: 2365,
      bookings: "1.1K Bookings in Last 30 Days",
      time: "4 Hours",
      warranty: "3 Months / 5000 km",
      serviceInterval: "Every 3 Months / 5000 km (Recommended)",
      servicesIncluded: 5,
      includes: ["AC Gas Top-up", "Condenser Cleaning", "Cooling Coil Service", "Leak Test", "AC Vent Disinfection"]
    },
    {
      id: "high-perf-ac-service",
      name: "High Performance AC Service",
      image: acService,
      price: 3922,
      originalPrice: 4626,
      discount: "20% OFF",
      rating: 4.4,
      totalRatings: 1840,
      bookings: "850+ Bookings in Last 30 Days",
      time: "8 Hours",
      warranty: "1 Month / 1000 km",
      serviceInterval: "Every 10000 km / 3 Months",
      servicesIncluded: 9,
      includes: ["Full AC Gas Recharge", "Condenser Deep Cleaning", "Cooling Coil Replacement", "Expansion Valve Check", "Compressor Health Check", "AC System Flush", "Blower Motor Service", "Cabin Filter Replacement"]
    }
  ],
  wash: [
    {
      id: "express-wash",
      name: "Express Exterior Wash",
      image: carWash,
      price: 299,
      originalPrice: 399,
      discount: "25% OFF",
      rating: 4.5,
      totalRatings: 15420,
      bookings: "5.2K Bookings in Last 30 Days",
      time: "30 Minutes",
      warranty: "N/A",
      serviceInterval: "Every 2 Weeks",
      servicesIncluded: 3,
      includes: ["Foam Wash", "High-pressure Rinse", "Hand Dry"]
    },
    {
      id: "full-wash",
      name: "Full Car Wash & Interior",
      image: carWash,
      price: 999,
      originalPrice: 1299,
      discount: "23% OFF",
      rating: 4.7,
      totalRatings: 9870,
      bookings: "2.8K Bookings in Last 30 Days",
      time: "2 Hours",
      warranty: "N/A",
      serviceInterval: "Every Month",
      servicesIncluded: 8,
      includes: ["Foam Wash", "Underbody Wash", "Interior Vacuum", "Dashboard Polish", "Window Cleaning", "Tyre Dressing", "Seat Cleaning", "Air Freshener"]
    }
  ],
  battery: [
    {
      id: "battery-check",
      name: "Battery Health Check",
      image: battery,
      price: 99,
      originalPrice: 199,
      discount: "50% OFF",
      rating: 4.3,
      totalRatings: 4560,
      bookings: "2.1K Bookings in Last 30 Days",
      time: "15 Minutes",
      warranty: "N/A",
      serviceInterval: "Every 6 Months",
      servicesIncluded: 3,
      includes: ["Battery Voltage Test", "Terminal Inspection", "Charging System Check"]
    },
    {
      id: "battery-replace",
      name: "Battery Replacement",
      image: battery,
      price: 4999,
      originalPrice: 5999,
      discount: "17% OFF",
      rating: 4.9,
      totalRatings: 7890,
      bookings: "1.9K Bookings in Last 30 Days",
      time: "1 Hour",
      warranty: "55 Months (Brand Warranty)",
      serviceInterval: "Every 4-5 Years",
      servicesIncluded: 5,
      includes: ["Old Battery Pickup", "New Battery Installation", "Terminal Cleaning & Greasing", "Battery Registration", "Old Battery Disposal"]
    }
  ]
};

export const SERVICES = Object.entries(CATEGORY_PACKAGES).flatMap(([catId, packages]) =>
  packages.map(pkg => ({ ...pkg, catId, duration: pkg.time, desc: pkg.includes.join(", ") }))
);
