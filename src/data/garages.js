export const GARAGES = [
  { id: "g1", name: "AutoCare Premium", area: "Indirapuram, Ghaziabad", distance: "1.2 km", rating: 4.8, reviews: 1284, cost: 3500, verified: true, badge: "Top Rated", eta: "Today, 6 PM" },
  { id: "g2", name: "Speed Motors Workshop", area: "Vaishali, Ghaziabad", distance: "2.4 km", rating: 4.7, reviews: 892, cost: 3450, verified: true, badge: "Trusted Partner", eta: "Today, 7 PM" },
  { id: "g3", name: "Prime Auto Hub", area: "Noida Sector 62", distance: "3.1 km", rating: 4.6, reviews: 654, cost: 3600, verified: true, badge: "Fast Service", eta: "Tomorrow, 10 AM" },
];

export const MECHANICS = [
  { id: "m1", name: "Rajesh Kumar", garage: "AutoCare Premium", rating: 4.9, phone: "+91 98xxx xxx12", experience: "12 yrs" },
];

export const STATUS_STEPS = [
  { key: "assigning", label: "Assigning Service", desc: "We are finding the best mechanic for your vehicle." },
  { key: "confirmed", label: "Booking Confirmed", desc: "Mechanic assigned and on the way." },
  { key: "progress", label: "Work In Progress", desc: "Your vehicle is being serviced by experts." },
  { key: "quality", label: "Quality Check", desc: "Final inspection and quality assurance." },
  { key: "completed", label: "Service Completed", desc: "Service is done. Invoice ready." },
  { key: "warranty", label: "Warranty Activated", desc: "30-day service warranty is active." },
];
