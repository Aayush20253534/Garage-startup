import logo from "@/assets/Rovauto.png";
import mercedesLogo from "@/assets/mercedes logo.png";
import {
  SiSuzuki,
  SiHyundai,
  SiTata,
  SiMahindra,
  SiKia,
  SiHonda,
  SiToyota,
  SiRenault,
  SiVolkswagen,
  SiBmw,
} from "react-icons/si";

export const LOGO_URL = logo;

export const VEHICLE_BRANDS = [
  { name: "Maruti Suzuki", icon: SiSuzuki, models: ["Swift", "Baleno", "Brezza", "Dzire", "WagonR", "Fronx", "Grand Vitara", "Alto", "S-presso", "Ignite", "Ertiga", "XL6"] },
  { name: "Hyundai", icon: SiHyundai, models: ["i20", "Creta", "Venue", "Verna", "Nios"] },
  { name: "Tata", icon: SiTata, models: ["Nexon", "Punch", "Harrier", "Altroz", "Tiago"] },
  { name: "Mahindra", icon: SiMahindra, models: ["XUV700/XUV 7XO", "Thar", "Scorpio N", "XUV 300/XUV 3XO", "Bolero"] },
  { name: "Kia", icon: SiKia, models: ["Seltos", "Sonet", "Carens", "Carnival"] },
  { name: "Honda", icon: SiHonda, models: ["City", "Amaze", "Elevate"] },
  { name: "Toyota", icon: SiToyota, models: ["Innova", "Fortuner", "Glanza", "Urban Cruiser"] },
  { name: "Renault", icon: SiRenault, models: ["Kwid", "Kiger", "Duster", "Triber"] },
  { name: "Volkswagen", icon: SiVolkswagen, models: ["Virtus", "Taigun", "Polo"] },
  { name: "Mercedes", image: mercedesLogo, models: ["A-class", "C-class", "S-class","G-class"] },
  { name: "BMW", icon: SiBmw, models: ["X1", "X3", "X5","X7","Z4"] },
  
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
