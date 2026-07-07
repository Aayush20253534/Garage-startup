import { useLocation, useNavigate } from "react-router-dom";
import { FiCheck, FiNavigation, FiShield } from "react-icons/fi";

export default function SOSSuccessScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const bookingId = location.state?.bookingId;
  const bookingCode = location.state?.bookingCode;

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12 text-white">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-green-500 text-4xl shadow-2xl shadow-green-500/20">
          <FiCheck />
        </div>
        <h1 className="mt-6 text-3xl font-extrabold text-green-300">
          SOS request broadcast
        </h1>
        <p className="mt-3 text-gray-400">
          Nearby eligible garages are receiving your request. The first valid
          acceptance will become your assigned garage.
        </p>

        <div className="mt-8 rounded-3xl border border-gray-800 bg-gray-900 p-6 text-left">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-yellow-400/10 text-yellow-300">
              <FiShield />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                Emergency booking
              </p>
              <h2 className="mt-1 text-xl font-bold">
                {bookingCode || "Request created"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-400">
                Keep your phone reachable and remain at the confirmed safe
                pickup point whenever possible.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              navigate("/tracking", {
                replace: true,
                state: { bookingId, bookingCode },
              })
            }
            disabled={!bookingId}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 py-4 font-bold text-gray-950 transition hover:bg-yellow-300 disabled:opacity-50"
          >
            <FiNavigation /> Track garage search
          </button>
        </div>
      </div>
    </div>
  );
}
