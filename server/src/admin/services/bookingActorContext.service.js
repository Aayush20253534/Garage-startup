const setBookingActorContext = async (client, staff, actorType = "STAFF") => {
  const actorId = String(staff?.id || "");
  const actorName = String(staff?.name || staff?.loginId || staff?.role || "Staff").slice(0, 160);
  const actorRole = String(staff?.role || "").slice(0, 60);
  await client.$queryRaw`
    SELECT
      set_config('rovauto.actor_type', ${actorType}, true),
      set_config('rovauto.actor_id', ${actorId}, true),
      set_config('rovauto.actor_name', ${actorName}, true),
      set_config('rovauto.actor_role', ${actorRole}, true)
  `;
};

module.exports = { setBookingActorContext };
