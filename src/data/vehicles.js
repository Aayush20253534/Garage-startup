import logo from "@/assets/Rovauto.png";
import { FiCar } from "react-icons/fi";

export const LOGO_URL = logo;

export const VEHICLE_BRANDS = [
  { name: "Maruti Suzuki", icon: FiCar, models: ["Swift", "Baleno", "Brezza", "Dzire", "WagonR", "Fronx", "Grand Vitara", "Alto", "S-presso", "Ignite", "Ertiga", "XL6"] },
  { name: "Hyundai", icon: FiCar, models: ["i20", "Creta", "Venue", "Verna", "Nios"] },
  { name: "Tata", icon: FiCar, models: ["Nexon", "Punch", "Harrier", "Altroz", "Tiago"] },
  { name: "Mahindra", icon: FiCar, models: ["XUV700/XUV 7XO", "Thar", "Scorpio N", "XUV 300/XUV 3XO", "Bolero"] },
  { name: "Kia", icon: FiCar, models: ["Seltos", "Sonet", "Carens", "Carnival"] },
  { name: "Honda", icon: FiCar, models: ["City", "Amaze", "Elevate"] },
  { name: "Toyota", icon: FiCar, models: ["Innova", "Fortuner", "Glanza", "Urban Cruiser"] },
  { name: "Renault", icon: FiCar, models: ["Kwid", "Kiger", "Duster", "Triber"] },
  { name: "Volkswagen", icon: FiCar, models: ["Virtus", "Taigun", "Polo"] },
  { name: "Mercedes", icon: FiCar, models: ["A-class", "C-class", "S-class","G-class"] },
  { name: "BMW", icon: FiCar, models: ["X1", "X3", "X5","X7","Z4"] },
  
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
