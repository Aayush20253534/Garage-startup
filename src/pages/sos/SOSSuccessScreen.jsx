import { FiCheck, FiPhone } from "react-icons/fi";

export default function SOSSuccessScreen() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container-x py-10 text-center">
        <div className="mb-10">
          <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-6">
            <FiCheck className="text-4xl text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-green-400 mb-2">Mechanic Found!</h1>
          <p className="text-gray-400">Help is on the way</p>
        </div>
        <div className="max-w-md mx-auto bg-gray-800 rounded-2xl p-6 border border-gray-700 mb-8">
          <div className="text-xl font-semibold mb-2">Rajesh Kumar</div>
          <div className="text-sm text-gray-400 mb-6">Verified Mechanic • 2.1 km away</div>
          <a href="tel:+919000000000" className="block w-full p-5 rounded-2xl bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-3 font-bold text-lg transition-all">
            <FiPhone className="text-2xl" />
            Call Mechanic
          </a>
        </div>
      </div>
    </div>
  );
}
