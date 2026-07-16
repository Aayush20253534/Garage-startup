import {
  SiSuzuki,
  SiHyundai,
  SiTata,
  SiKia,
  SiHonda,
  SiToyota,
  SiRenault,
  SiVolkswagen,
  SiBmw,
  SiAudi,
  SiNissan,
  SiMg,
  SiJeep,
  SiLandrover,
  SiSkoda,
  SiJaguar,
} from "react-icons/si";

export const mockGarage = {
  id: "garage_123",
  name: "AutoCare Multi-Brand Service Center",
  ownerName: "Rajesh Kumar",
  phone: "+919876543210",
  email: "autocare@rovauto.com",
  gst: "29AAACB1234D1Z5",
  address: "123, Service Road, HSR Layout, Bengaluru, Karnataka",
  location: { lat: 12.9716, lng: 77.5946 },
  workingRadius: 15,
  garageType: "MULTI_BRAND",
  brands: [],
  images: [
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1489824904134-891ab64532f1?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1542281286-9e0a16bb7366?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1621482562852-fac372f533c8?w=800&h=600&fit=crop",
  ],
  isOnboardingComplete: true,
  rating: 4.7,
  reviewCount: 128,
};

export const mockBookings = [
  {
    id: "RVT-2026-1022",
    status: "NEW",
    vehicle: {
      brand: "Hyundai",
      model: "i 20",
      year: 2022,
      number: "KA01AB1234",
    },
    services: [{ name: "General Service", price: 3500 }],
    estimatedBill: 3500,
    distance: 2.4,
    createdAt: new Date().toISOString(),
    customer: {
      name: "Arjun Patel",
      phone: "+919812345678",
      address: "456, Main Road, Koramangala, Bengaluru",
      location: { lat: 12.9352, lng: 77.6245 },
    },
  },
  {
    id: "RVT-2026-1023",
    status: "ACCEPTED",
    vehicle: {
      brand: "Maruti Suzuki",
      model: "Swift",
      year: 2021,
      number: "KA02CD5678",
    },
    services: [
      { name: "Oil Change", price: 1800 },
      { name: "Wheel Alignment", price: 1200 },
    ],
    estimatedBill: 3000,
    distance: 3.1,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    customer: {
      name: "Priya Sharma",
      phone: "+919876543210",
      address: "789, 1st Cross, Indiranagar, Bengaluru",
      location: { lat: 12.9716, lng: 77.6406 },
    },
  },
  {
    id: "RVT-2026-1024",
    status: "SERVICE_STARTED",
    vehicle: {
      brand: "Tata",
      model: "Nexon",
      year: 2023,
      number: "KA03EF9012",
    },
    services: [
      { name: "AC Service", price: 2500 },
      { name: "Car Wash", price: 500 },
    ],
    estimatedBill: 3000,
    distance: 1.8,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    customer: {
      name: "Vikram Singh",
      phone: "+919901234567",
      address: "321, 5th Block, HSR Layout, Bengaluru",
      location: { lat: 12.9141, lng: 77.6512 },
    },
  },
];

export const mockServices = [
  {
    id: "service_1",
    name: "General Service",
    description:
      "Complete general service including oil change, filter replacement, and inspection",
    estimatedTime: "2 Hours",
    startingPrice: 2500,
    maximumPrice: 4000,
    category: "Periodic Maintenance",
  },
  {
    id: "service_2",
    name: "Oil Change",
    description: "Engine oil and filter replacement",
    estimatedTime: "1 Hour",
    startingPrice: 1500,
    maximumPrice: 2500,
    category: "Periodic Maintenance",
  },
  {
    id: "service_3",
    name: "Brake Service",
    description: "Complete brake inspection and service",
    estimatedTime: "1.5 Hours",
    startingPrice: 2000,
    maximumPrice: 3500,
    category: "Safety & Brakes",
  },
  {
    id: "service_4",
    name: "Wheel Alignment",
    description: "Professional wheel alignment service",
    estimatedTime: "45 Minutes",
    startingPrice: 1000,
    maximumPrice: 1500,
    category: "Wheels & Tires",
  },
];

export const mockBrands = [
  { id: "maruti", name: "Maruti Suzuki", icon: SiSuzuki },
  { id: "hyundai", name: "Hyundai", icon: SiHyundai },
  { id: "tata", name: "Tata", icon: SiTata },
  { id: "mahindra", name: "Mahindra" },
  { id: "honda", name: "Honda", icon: SiHonda },
  { id: "toyota", name: "Toyota", icon: SiToyota },
  { id: "kia", name: "Kia", icon: SiKia },
  { id: "volkswagen", name: "Volkswagen", icon: SiVolkswagen },
  { id: "skoda", name: "Skoda", icon: SiSkoda },
  { id: "bmw", name: "BMW", icon: SiBmw },
  { id: "mercedes", name: "Mercedes" },
  { id: "audi", name: "Audi", icon: SiAudi },
  { id: "jaguar", name: "Jaguar", icon: SiJaguar },
  { id: "landrover", name: "Land Rover", icon: SiLandrover },
  { id: "renault", name: "Renault", icon: SiRenault },
  { id: "nissan", name: "Nissan", icon: SiNissan },
  { id: "mg", name: "MG", icon: SiMg },
  { id: "jeep", name: "Jeep", icon: SiJeep },
  { id: "force", name: "Force Motors" },
];

export const mockTransactions = [
  {
    id: "txn_1",
    type: "BOOKING_DEDUCTION",
    amount: -250,
    description: "Booking RVT-2026-1020",
    date: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "txn_2",
    type: "COMMISSION",
    amount: 2800,
    description: "Booking RVT-2026-1019 Completed",
    date: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "txn_3",
    type: "RECHARGE",
    amount: 10000,
    description: "Wallet Recharge",
    date: new Date(Date.now() - 259200000).toISOString(),
  },
];

export const mockReviews = [
  {
    id: "review_1",
    name: "Rahul M.",
    rating: 5,
    comment: "Excellent service, very professional team!",
    date: "2 days ago",
  },
  {
    id: "review_2",
    name: "Anita K.",
    rating: 4,
    comment: "Good service, reasonable pricing.",
    date: "1 week ago",
  },
];

export const mockGarages = [
  {
    id: "garage_123",
    name: "AutoCare Multi-Brand Service Center",
    address: "123, Service Road, HSR Layout, Bengaluru, Karnataka",
    rating: 4.7,
    reviewCount: 128,
    location: { lat: 12.9716, lng: 77.5946 },
    distance: 2.4,
    workingHours: {
      monday: { open: "09:00", close: "18:00" },
    },
    images: [
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&h=600&fit=crop",
    ],
  },
];

