import { motion } from "framer-motion";

export default function StatsCard({
  label,
  value,
  icon: Icon,
  color = "brand",
}) {
  const colorMap = {
    brand: "bg-brand-soft text-ink",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    orange: "bg-orange-50 text-orange-700",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-soft p-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted text-sm mb-1">{label}</p>
          <h3 className="text-3xl font-bold">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${colorMap[color]}`}>
          <Icon className="w-7 h-7" />
        </div>
      </div>
    </motion.div>
  );
}
