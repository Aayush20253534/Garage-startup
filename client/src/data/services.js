import {
  FiSettings,
  FiZap,
  FiWind,
  FiShield,
  FiPackage,
  FiUmbrella,
} from "react-icons/fi";

export const CATEGORY_UI = {
  "Car/Bike Wash & Care": {
    icon: FiShield,
    color: "#06b6d4",
  },
  "Car Servicing & Repair": {
    icon: FiPackage,
    color: "#b9f000",
  },
  "AC Service": {
    icon: FiWind,
    color: "#56c2ff",
  },
  "Denting & Painting": {
    icon: FiSettings,
    color: "#ff8a3d",
  },
  Batteries: {
    icon: FiZap,
    color: "#22c55e",
  },
  "Roadside Assistance": {
    icon: FiUmbrella,
    color: "#ef4444",
    isSos: true,
  },
  Modifications: {
    icon: FiSettings,
    color: "#a78bfa",
  },
};
