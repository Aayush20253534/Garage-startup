import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/navbar/Navbar";
import Footer from "@/components/footer/Footer";
import FAB from "@/components/FAB";

export default function MainLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="min-w-0 flex-1 pt-16 sm:pt-20"
      >
        <Outlet />
      </motion.main>

      <Footer />

      <FAB />
    </div>
  );
}