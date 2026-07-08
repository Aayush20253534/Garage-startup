import Bookings from "@/pages/admin/Bookings";

export default function PendingBookings() {
  return (
    <Bookings
      fixedStatus="PENDING_PAYMENT"
      title="Pending Bookings"
      description="Bookings created but not paid yet. Keep these separate so retries do not mix with active garage work."
      showStatusFilter={false}
      showBulkActions={false}
    />
  );
}

export { PendingBookings };
