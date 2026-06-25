import logo from "@/assets/Rovauto.png";

export const LOGO_URL = logo;

export const VEHICLE_BRANDS = [
  { name: "Maruti Suzuki", logo: "https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/suzuki.svg", models: ["Swift", "Baleno", "Brezza", "Dzire", "WagonR", "Fronx", "Grand Vitara", "Alto", "S-presso", "Ignite", "Ertiga", "XL6"] },
  { name: "Hyundai", logo: "https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/hyundai.svg", models: ["i20", "Creta", "Venue", "Verna", "Nios"] },
  { name: "Tata", logo: "https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/tata.svg", models: ["Nexon", "Punch", "Harrier", "Altroz", "Tiago"] },
  { name: "Mahindra", logo: "https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/mahindra.svg", models: ["XUV700/XUV 7XO", "Thar", "Scorpio N", "XUV 300/XUV 3XO", "Bolero"] },
  { name: "Kia", logo: "https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/kia.svg", models: ["Seltos", "Sonet", "Carens", "Carnival"] },
  { name: "Honda", logo: "https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/honda.svg", models: ["City", "Amaze", "Elevate"] },
  { name: "Toyota", logo: "https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/toyota.svg", models: ["Innova", "Fortuner", "Glanza", "Urban Cruiser"] },
  { name: "Renault", logo: "https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/renault.svg", models: ["Kwid", "Kiger", "Duster", "Triber"] },
  { name: "Volkswagen", logo: "https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/volkswagen.svg", models: ["Virtus", "Taigun", "Polo"] },
  { name: "Mercedes", logo: "https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/mercedesbenz.svg", models: ["A-class", "C-class", "S-class","G-class"] },
  { name: "BMW", logo: "https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/bmw.svg", models: ["X1", "X3", "X5","X7","Z4"] },
  
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
