import logo from "@/assets/Rovauto.png";
import mercedesLogo from "@/assets/mercedes logo.png";
import skodaLogo from "@/assets/skoda logo.png";
import datsunLogo from "@/assets/datsun logo.png";
import mahindraLogo from "@/assets/mahindra logo.png";
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
  SiAudi,
  SiNissan,
  SiVolvo,
  SiMg,
  SiJeep,
  SiLandrover,
  SiFord,
} from "react-icons/si";

export const LOGO_URL = logo;

export const BRAND_ICONS = {
  "Maruti Suzuki": { icon: SiSuzuki },
  Hyundai: { icon: SiHyundai },
  Tata: { icon: SiTata },
  Mahindra: { image: mahindraLogo },
  Kia: { icon: SiKia },
  Honda: { icon: SiHonda },
  Toyota: { icon: SiToyota },
  Renault: { icon: SiRenault },
  Volkswagen: { icon: SiVolkswagen },
  Mercedes: { image: mercedesLogo },
  BMW: { icon: SiBmw },
  Audi: { icon: SiAudi },
  Nissan: { icon: SiNissan },
  Volvo: { icon: SiVolvo },
  MG: { icon: SiMg },
  Jeep: { icon: SiJeep },
  "Land Rover": { icon: SiLandrover },
  Ford: { icon: SiFord },
  Skoda: { image: skodaLogo },
  Datsun: { image: datsunLogo },
};

export const FUEL_TYPES = [
  { label: "Petrol", value: "PETROL" },
  { label: "Diesel", value: "DIESEL" },
  { label: "CNG", value: "CNG" },
  { label: "Electric", value: "ELECTRIC" },
  { label: "Hybrid", value: "HYBRID" },
  { label: "Other", value: "OTHER" },
];
