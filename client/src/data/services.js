import {
  FiSettings,
  FiZap,
  FiWind,
  FiShield,
  FiPackage,
  FiUmbrella,
} from "react-icons/fi";

import carWash from "@/assets/car_wash.png";
import serviceRepair from "@/assets/Service And Repair.png";
import acService from "@/assets/AC service.png";
import painting from "@/assets/painting.png";
import battery from "@/assets/battery.png";
import roadside from "@/assets/Roadside.png";
import modification from "@/assets/Modification.png";

export const CATEGORY_UI = {
  "Car/Bike Wash & Care": {
    image: carWash,
    icon: FiShield,
    color: "#06b6d4",
  },
  "Car Servicing & Repair": {
    image: serviceRepair,
    icon: FiPackage,
    color: "#b9f000",
  },
  "AC Service": {
    image: acService,
    icon: FiWind,
    color: "#56c2ff",
  },
  "Denting & Painting": {
    image: painting,
    icon: FiSettings,
    color: "#ff8a3d",
  },
  Batteries: {
    image: battery,
    icon: FiZap,
    color: "#22c55e",
  },
  "Roadside Assistance": {
    image: roadside,
    icon: FiUmbrella,
    color: "#ef4444",
    isSos: true,
  },
  Modifications: {
    image: modification,
    icon: FiSettings,
    color: "#a78bfa",
  },
};
