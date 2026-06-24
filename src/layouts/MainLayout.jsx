import Navbar from "@/components/navbar/Navbar";
import Footer from "@/components/footer/Footer";
import FAB from "@/components/FAB";
import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";

export default function MainLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <motion.main key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex-1 pt-16 sm:pt-20">
        <Outlet />
      </motion.main>
      <Footer />
      <FAB />
    </div>
  );
}
