import logo from "@/assets/Rovauto.png";

export const LOGO_URL = logo;

export const VEHICLE_BRANDS = [
  { name: "Maruti Suzuki", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Maruti_Suzuki_Logo.svg/200px-Maruti_Suzuki_Logo.svg.png", models: ["Swift", "Baleno", "Brezza", "Dzire", "WagonR", "Fronx", "Grand Vitara", "Alto", "S-presso", "Ignite", "Ertiga", "XL6"] },
  { name: "Hyundai", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Hyundai_Motor_Company_logo.svg/200px-Hyundai_Motor_Company_logo.svg.png", models: ["i20", "Creta", "Venue", "Verna", "Nios"] },
  { name: "Tata", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Tata_Motors_Logo.svg/200px-Tata_Motors_Logo.svg.png", models: ["Nexon", "Punch", "Harrier", "Altroz", "Tiago"] },
  { name: "Mahindra", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Mahindra_%26_Mahindra_logo.svg/200px-Mahindra_%26_Mahindra_logo.svg.png", models: ["XUV700/XUV 7XO", "Thar", "Scorpio N", "XUV 300/XUV 3XO", "Bolero"] },
  { name: "Kia", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Kia_logo.svg/200px-Kia_logo.svg.png", models: ["Seltos", "Sonet", "Carens", "Carnival"] },
  { name: "Honda", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Honda_Logo.svg/200px-Honda_Logo.svg.png", models: ["City", "Amaze", "Elevate"] },
  { name: "Toyota", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Toyota_Electric_logo.svg/200px-Toyota_Electric_logo.svg.png", models: ["Innova", "Fortuner", "Glanza", "Urban Cruiser"] },
  { name: "Renault", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Renault_2021_logo.svg/200px-Renault_2021_logo.svg.png", models: ["Kwid", "Kiger", "Duster", "Triber"] },
  { name: "Volkswagen", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Volkswagen_logo_2019.svg/200px-Volkswagen_logo_2019.svg.png", models: ["Virtus", "Taigun", "Polo"] },
  { name: "Mercedes", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Mercedes-Benz_Logo_2023.svg/200px-Mercedes-Benz_Logo_2023.svg.png", models: ["A-class", "C-class", "S-class","G-class"] },
  { name: "BMW", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/BMW_logo_%28gray%29.svg/200px-BMW_logo_%28gray%29.svg.png", models: ["X1", "X3", "X5","X7","Z4"] },
  
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
