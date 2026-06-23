import logo from "@/assets/rovauto-logo.png.asset.json";

export const LOGO_URL = logo.url;

export const VEHICLE_BRANDS = [
  { name: "Maruti Suzuki", models: ["Swift", "Baleno", "Brezza", "Dzire", "WagonR"] },
  { name: "Hyundai", models: ["i20", "Creta", "Venue", "Verna", "Nios"] },
  { name: "Tata", models: ["Nexon", "Punch", "Harrier", "Altroz", "Tiago"] },
  { name: "Mahindra", models: ["XUV700", "Thar", "Scorpio N", "XUV300", "Bolero"] },
  { name: "Kia", models: ["Seltos", "Sonet", "Carens", "Carnival"] },
  { name: "Honda", models: ["City", "Amaze", "Elevate"] },
  { name: "Toyota", models: ["Innova", "Fortuner", "Glanza", "Urban Cruiser"] },
  { name: "Volkswagen", models: ["Virtus", "Taigun", "Polo"] },
];

export const FUEL_TYPES = ["Petrol", "Diesel", "CNG", "Electric"];

export const DEFAULT_VEHICLE = {
  id: "v1",
  brand: "Hyundai",
  model: "i20",
  fuel: "Petrol",
  reg: "DL 3C AB 1234",
  year: 2022,
};
