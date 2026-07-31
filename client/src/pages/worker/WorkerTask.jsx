import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  FiCamera,
  FiCheckCircle,
  FiExternalLink,
  FiMapPin,
  FiNavigation,
  FiRefreshCw,
  FiSquare,
  FiUploadCloud,
  FiVideo,
  FiVolume2,
} from "react-icons/fi";
import { workerTaskApi } from "@/api/workerTasks";

const COPY = {
  en: {
    title: "Rovauto Worker Task",
    loading: "Loading your assigned task…",
    invalid: "This task could not be opened",
    refresh: "Refresh task",
    hindi: "हिंदी",
    english: "English",
    listen: "Listen",
    assigned: "Assigned to",
    expires: "Link expires",
    vehicle: "Vehicle",
    booking: "Booking",
    services: "Services",
    destination: "Destination",
    openMap: "Open map",
    tracking: "Live tracking",
    trackingHelp: "Allow location access and keep this page open while travelling.",
    startTracking: "Start live tracking",
    stopTracking: "Stop tracking",
    trackingActive: "Live tracking is active",
    locationSent: "Last location sent",
    evidence: "Required photo and video evidence",
    evidenceHelp: "Take 5–15 clear photos and exactly one video. Photos must be at most 1 MB each and video at most 50 MB.",
    photos: "Select photos",
    video: "Select one video",
    selectedPhotos: "photos selected",
    selectedVideo: "Video selected",
    camera: "Open camera",
    gallery: "Choose gallery",
    cameraPhotoHelp: "Take a new photo",
    galleryPhotoHelp: "Select existing photos",
    cameraVideoHelp: "Record a new video",
    galleryVideoHelp: "Select an existing video",
    otp: "Customer handover OTP",
    otpHelp: "Ask the customer for the handover OTP only when physically receiving the vehicle.",
    completeHandover: "Verify OTP and complete handover",
    completeDelivery: "Complete service and start delivery",
    uploading: "Uploading…",
    completed: "This task is completed",
    completedHelp: "The evidence and activity are saved against the booking. This link no longer allows task actions.",
    selfDrop: "The customer shares the one-time route to the garage. Wait until they arrive, then upload before-service evidence. No OTP is required.",
    noLogin: "No worker login or worker OTP is required.",
    returnJourney: "Return the vehicle to the garage",
    returnJourneyHelp: "The customer handover is verified. Keep live tracking running while taking the vehicle to the garage.",
    reachedGarage: "Reached garage — complete task",
    returnJourneyStarted: "Handover verified. Continue live tracking until you reach the garage.",
    arrivedCustomer: "Arrived at customer",
    arrivedCustomerHelp: "Confirm arrival only after reaching the customer address.",
    waitingPayment: "Waiting for customer payment",
    waitingPaymentHelp: "The customer must choose Cash or UPI, enter the amount and send it. Garage staff will then confirm receipt.",
    serviceDeliveryStarted: "Service evidence saved. Keep live tracking active while delivering the vehicle to the customer.",
    confirmPayment: "Payment received — complete booking",
    confirmingPayment: "Confirming payment…",
    paymentReady: "Customer payment is ready for confirmation",
    paymentReadyHelp: "Confirm only after you have received the Cash or UPI amount shown below.",
  },
  hi: {
    title: "रोवऑटो वर्कर टास्क",
    loading: "आपका दिया गया काम खुल रहा है…",
    invalid: "यह काम नहीं खुल सका",
    refresh: "काम फिर से खोलें",
    hindi: "हिंदी",
    english: "English",
    listen: "सुनें",
    assigned: "काम करने वाला",
    expires: "लिंक की समय सीमा",
    vehicle: "गाड़ी",
    booking: "बुकिंग",
    services: "सर्विस",
    destination: "जाने की जगह",
    openMap: "नक्शा खोलें",
    tracking: "लाइव लोकेशन",
    trackingHelp: "लोकेशन की अनुमति दें और रास्ते में यह पेज खुला रखें।",
    startTracking: "लाइव लोकेशन शुरू करें",
    stopTracking: "लोकेशन बंद करें",
    trackingActive: "लाइव लोकेशन चल रही है",
    locationSent: "आखिरी लोकेशन भेजी गई",
    evidence: "जरूरी फोटो और वीडियो",
    evidenceHelp: "5 से 15 साफ फोटो और ठीक एक वीडियो लें। हर फोटो 1 एमबी तक और वीडियो 50 एमबी तक होना चाहिए।",
    photos: "फोटो चुनें",
    video: "एक वीडियो चुनें",
    selectedPhotos: "फोटो चुने गए",
    selectedVideo: "वीडियो चुना गया",
    camera: "कैमरा खोलें",
    gallery: "गैलरी चुनें",
    cameraPhotoHelp: "नई फोटो लें",
    galleryPhotoHelp: "मौजूदा फोटो चुनें",
    cameraVideoHelp: "नया वीडियो रिकॉर्ड करें",
    galleryVideoHelp: "मौजूदा वीडियो चुनें",
    otp: "ग्राहक का हैंडओवर ओटीपी",
    otpHelp: "गाड़ी लेते समय ही ग्राहक से हैंडओवर ओटीपी पूछें।",
    completeHandover: "ओटीपी जांचें और गाड़ी लेना पूरा करें",
    completeDelivery: "सर्विस पूरी करके डिलीवरी शुरू करें",
    uploading: "अपलोड हो रहा है…",
    completed: "यह काम पूरा हो गया है",
    completedHelp: "फोटो, वीडियो और गतिविधि बुकिंग में सुरक्षित हैं। अब इस लिंक से कोई काम नहीं किया जा सकता।",
    selfDrop: "यह सेल्फ ड्रॉप बुकिंग है। पिकअप की लाइव लोकेशन जरूरी नहीं है।",
    noLogin: "वर्कर लॉगिन या वर्कर ओटीपी की जरूरत नहीं है।",
    returnJourney: "गाड़ी को गैरेज वापस ले जाएं",
    returnJourneyHelp: "ग्राहक का हैंडओवर पूरा हो गया है। गैरेज पहुंचने तक लाइव लोकेशन चालू रखें।",
    reachedGarage: "गैरेज पहुंच गए — काम पूरा करें",
    returnJourneyStarted: "हैंडओवर पूरा हो गया। गैरेज पहुंचने तक लाइव लोकेशन चालू रखें।",
    arrivedCustomer: "ग्राहक के पास पहुंच गए",
    arrivedCustomerHelp: "ग्राहक के पते पर पहुंचने के बाद ही आगमन की पुष्टि करें।",
    waitingPayment: "ग्राहक के भुगतान की प्रतीक्षा",
    waitingPaymentHelp: "ग्राहक कैश या यूपीआई चुनेगा, रकम भेजेगा और फिर गैरेज भुगतान मिलने की पुष्टि करेगा।",
    serviceDeliveryStarted: "सर्विस के फोटो और वीडियो सुरक्षित हैं। ग्राहक तक गाड़ी पहुंचाते समय लाइव लोकेशन चालू रखें।",
    confirmPayment: "भुगतान मिला — बुकिंग पूरी करें",
    confirmingPayment: "भुगतान की पुष्टि हो रही है…",
    paymentReady: "ग्राहक का भुगतान पुष्टि के लिए तैयार है",
    paymentReadyHelp: "नीचे दिखाई गई कैश या यूपीआई रकम मिलने के बाद ही पुष्टि करें।",
  },
};

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

const mapsUrl = (destination) => {
  const latitude = Number(destination?.latitude);
  const longitude = Number(destination?.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }
  return destination?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination.address)}`
    : null;
};

const fileError = (images, video) => {
  if (images.length < 5 || images.length > 15) {
    return "Select between 5 and 15 photos.";
  }
  if (images.some((file) => file.size > 1024 * 1024)) {
    return "Every photo must be 1 MB or smaller.";
  }
  if (!video) return "Select exactly one video.";
  if (video.size > 50 * 1024 * 1024) return "Video must be 50 MB or smaller.";
  return "";
};

export default function WorkerTask() {
  const { token } = useParams();
  const [language, setLanguage] = useState("en");
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [locationSentAt, setLocationSentAt] = useState(null);
  const [images, setImages] = useState([]);
  const [video, setVideo] = useState(null);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const watchIdRef = useRef(null);
  const sendingLocationRef = useRef(false);
  const lastLocationSentRef = useRef(0);
  const photoCameraInputRef = useRef(null);
  const photoGalleryInputRef = useRef(null);
  const videoCameraInputRef = useRef(null);
  const videoGalleryInputRef = useRef(null);
  const copy = COPY[language];

  const addEvidenceImages = (fileList) => {
    const selectedImages = Array.from(fileList || []).filter((file) =>
      file.type?.startsWith("image/"),
    );
    if (selectedImages.length === 0) return;

    setImages((currentImages) =>
      [...currentImages, ...selectedImages].slice(0, 15),
    );
  };

  const selectEvidenceVideo = (file) => {
    if (!file?.type?.startsWith("video/")) return;
    setVideo(file);
  };

  const handlePhotoInput = (event) => {
    addEvidenceImages(event.target.files);
    event.target.value = "";
  };

  const handleVideoInput = (event) => {
    selectEvidenceVideo(event.target.files?.[0]);
    event.target.value = "";
  };

  const loadTask = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await workerTaskApi.getPublic(token);
      setTask(data);
    } catch (err) {
      setTask(null);
      setError(err.response?.data?.message || "The worker task link is invalid or expired.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  useEffect(() => {
    if (!task || task.status === "COMPLETED") return undefined;
    if (!["WAITING_FOR_PAYMENT", "CONFIRM_PAYMENT", "READY_FOR_SELF_PICKUP"].includes(task.stage)) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void loadTask();
    }, 4000);

    return () => window.clearInterval(interval);
  }, [loadTask, task?.stage, task?.status]);

  const clearTrackingWatch = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  }, []);

  useEffect(() => clearTrackingWatch, [clearTrackingWatch]);

  const voiceText = useMemo(() => {
    if (!task) return copy.title;
    const taskName =
      task.stage === "RETURN_TO_GARAGE"
        ? language === "hi"
          ? "गाड़ी को गैरेज वापस ले जाने का काम"
          : "return journey to the garage"
        : task.taskType === "DELIVERY"
          ? language === "hi"
            ? task.isSelfDropOff
              ? "गाड़ी ग्राहक के सेल्फ पिकअप के लिए तैयार करने का काम"
              : "गाड़ी ग्राहक तक पहुंचाने का काम"
            : task.isSelfDropOff
              ? "vehicle ready-for-self-pickup evidence task"
              : "vehicle delivery task"
          : task.isSelfDropOff
            ? language === "hi"
              ? "गैरेज पर गाड़ी लेने का काम"
              : "vehicle handover at the garage"
            : language === "hi"
              ? "ग्राहक से गाड़ी पिकअप करने का काम"
              : "vehicle pickup and handover task";
    const vehicle = [task.booking?.vehicle?.brand, task.booking?.vehicle?.model]
      .filter(Boolean)
      .join(" ");
    if (task.stage === "RETURN_TO_GARAGE") {
      return language === "hi"
        ? `${task.workerName}, ग्राहक का हैंडओवर पूरा हो गया है। गाड़ी ${vehicle} को गैरेज वापस ले जाएं। लाइव लोकेशन चालू रखें और गैरेज पहुंचने पर आगमन की पुष्टि करें।`
        : `${task.workerName}, the customer handover is verified. Take ${vehicle} back to the garage, keep live tracking active, and confirm arrival after reaching the garage.`;
    }
    if (task.stage === "DELIVER_TO_CUSTOMER") {
      return language === "hi"
        ? `${task.workerName}, सर्विस पूरी हो चुकी है। गाड़ी ${vehicle} को ग्राहक के पते तक पहुंचाएं, लाइव लोकेशन चालू रखें और पहुंचने पर पुष्टि करें।`
        : `${task.workerName}, service is complete. Deliver ${vehicle} to the customer, keep live tracking active, and confirm after reaching the address.`;
    }
    if (task.stage === "WAITING_FOR_PAYMENT") {
      return language === "hi"
        ? `${task.workerName}, गाड़ी ग्राहक तक पहुंच चुकी है। ग्राहक के कैश या यूपीआई भुगतान भेजने की प्रतीक्षा करें।`
        : `${task.workerName}, the vehicle has reached the customer. Wait for the customer to submit Cash or UPI payment details.`;
    }
    if (task.stage === "CONFIRM_PAYMENT") {
      const mode = task.booking?.finalPaymentMethod === "UPI" ? "UPI" : language === "hi" ? "कैश" : "Cash";
      const amount = Number(task.booking?.finalPaymentAmount || 0).toLocaleString("en-IN");
      return language === "hi"
        ? `${task.workerName}, ग्राहक ने ${mode} से ${amount} रुपये भेजने की जानकारी दी है। रकम मिलने के बाद भुगतान की पुष्टि करके बुकिंग पूरी करें।`
        : `${task.workerName}, the customer submitted ${mode} payment details for rupees ${amount}. Confirm only after receiving the amount, then complete the booking.`;
    }
    if (task.isSelfDropOff && task.taskType === "HANDOVER") {
      return language === "hi"
        ? `${task.workerName}, ग्राहक गाड़ी ${vehicle} लेकर गैरेज आ रहा है। उसके पहुंचने के बाद पांच से पंद्रह फोटो और एक वीडियो अपलोड करें। ओटीपी की जरूरत नहीं है।`
        : `${task.workerName}, the customer is bringing ${vehicle} to the garage. After arrival, upload five to fifteen before-service photos and one video. No OTP is required.`;
    }
    return language === "hi"
      ? `${task.workerName}, आपको ${taskName} दिया गया है। गाड़ी ${vehicle} है। पहले निर्देश पढ़ें। रास्ते में लाइव लोकेशन शुरू करें और पेज खुला रखें। गाड़ी लेते या देते समय पांच से पंद्रह फोटो और एक वीडियो अपलोड करें। ग्राहक से गाड़ी लेते समय ही हैंडओवर ओटीपी पूछें।`
      : `${task.workerName}, you have been assigned a ${taskName} for ${vehicle}. Read the instructions first. Start live tracking during travel and keep this page open. Upload five to fifteen photos and one video at handover or delivery. Ask for the customer handover OTP only while physically receiving the vehicle.`;
  }, [copy.title, language, task]);

  const speak = () => {
    if (!("speechSynthesis" in window)) {
      setError("Voice instructions are not supported by this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(voiceText);
    utterance.lang = language === "hi" ? "hi-IN" : "en-IN";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const startTracking = async () => {
    setError("");
    setSuccess("");
    if (!navigator.geolocation) {
      setError("This phone or browser does not support live location.");
      return;
    }

    try {
      await workerTaskApi.startTracking(token);
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const now = Date.now();
          if (sendingLocationRef.current || now - lastLocationSentRef.current < 8000) return;
          sendingLocationRef.current = true;
          try {
            await workerTaskApi.sendLocation(token, {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracyM: position.coords.accuracy,
              heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
              speedKph: Number.isFinite(position.coords.speed)
                ? position.coords.speed * 3.6
                : null,
              recordedAt: new Date(position.timestamp).toISOString(),
            });
            lastLocationSentRef.current = now;
            setLocationSentAt(new Date());
          } catch (err) {
            setError(err.response?.data?.message || "Location could not be sent. Keep the page open and try again.");
          } finally {
            sendingLocationRef.current = false;
          }
        },
        (geoError) => {
          setError(
            geoError.code === 1
              ? "Location permission was denied. Allow location access in browser settings."
              : "Live location is unavailable. Check GPS and mobile data.",
          );
          clearTrackingWatch();
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
      );
      setTracking(true);
      setSuccess(copy.trackingActive);
      await loadTask();
    } catch (err) {
      setError(err.response?.data?.message || "Live tracking could not be started.");
    }
  };

  const stopTracking = async () => {
    clearTrackingWatch();
    try {
      await workerTaskApi.stopTracking(token);
      setSuccess("Live tracking stopped.");
      await loadTask();
    } catch (err) {
      setError(err.response?.data?.message || "Tracking could not be stopped.");
    }
  };

  const completeReturnJourney = async () => {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await workerTaskApi.completeHandoverJourney(token);
      clearTrackingWatch();
      setSuccess("Return journey completed successfully.");
      await loadTask();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "The return journey could not be completed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCustomerArrival = async () => {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await workerTaskApi.markArrivedAtCustomer(token);
      clearTrackingWatch();
      setSuccess(copy.waitingPaymentHelp);
      await loadTask();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Arrival at the customer address could not be confirmed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmPayment = async () => {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await workerTaskApi.confirmFinalPayment(token);
      clearTrackingWatch();
      setSuccess("Payment confirmed and booking completed.");
      await loadTask();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "The payment could not be confirmed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitEvidence = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    const validationError = fileError(images, video);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (task.taskType === "HANDOVER" && !/^\d{4,8}$/.test(otp.trim())) {
      setError("Enter the customer handover OTP.");
      return;
    }

    const formData = new FormData();
    images.forEach((file) => formData.append("images", file));
    formData.append("video", video);
    if (task.taskType === "HANDOVER" && !task.isSelfDropOff) {
      formData.append("otp", otp.trim());
    }

    setSubmitting(true);
    try {
      if (task.taskType === "HANDOVER") {
        await workerTaskApi.verifyHandover(token, formData);
      } else {
        await workerTaskApi.markServiceComplete(token, formData);
      }
      const continuesToGarage =
        task.taskType === "HANDOVER" && !task.isSelfDropOff;
      if (continuesToGarage) {
        setSuccess(copy.returnJourneyStarted);
      } else if (task.taskType === "DELIVERY" && !task.isSelfDropOff) {
        setSuccess(copy.serviceDeliveryStarted);
      } else {
        clearTrackingWatch();
        setSuccess("Evidence saved successfully.");
      }
      setImages([]);
      setVideo(null);
      setOtp("");
      await loadTask();
    } catch (err) {
      setError(err.response?.data?.message || "Evidence could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-bg-soft px-4 py-12"><div className="mx-auto max-w-xl rounded-xl border border-line bg-white p-6 text-center text-muted">{copy.loading}</div></div>;
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-bg-soft px-4 py-12">
        <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-white p-6">
          <h1 className="text-xl font-bold text-ink">{copy.invalid}</h1>
          <p className="mt-2 text-sm leading-6 text-red-700">{error}</p>
          <button type="button" onClick={loadTask} className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white"><FiRefreshCw /> {copy.refresh}</button>
        </div>
      </div>
    );
  }

  const vehicleLabel = [task.booking?.vehicle?.brand, task.booking?.vehicle?.model]
    .filter(Boolean)
    .join(" ") || "Vehicle";
  const mapLink = mapsUrl(task.destination);
  const taskCompleted = task.status === "COMPLETED";
  const taskLabel =
    task.stage === "RETURN_TO_GARAGE"
      ? copy.returnJourney
      : task.stage === "COMPLETE_SERVICE"
        ? "Complete service evidence"
        : task.stage === "DELIVER_TO_CUSTOMER"
          ? "Deliver vehicle to customer"
          : task.stage === "WAITING_FOR_PAYMENT"
            ? copy.waitingPayment
            : task.stage === "CONFIRM_PAYMENT"
              ? copy.paymentReady
              : task.taskType === "DELIVERY"
              ? task.isSelfDropOff
                ? "Ready for customer self pickup"
                : "Vehicle delivery"
              : task.isSelfDropOff
                ? "Vehicle handover at garage"
                : "Vehicle pickup and handover";

  return (
    <main className="min-h-screen bg-bg-soft px-3 py-5 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-xl border border-line bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{copy.title}</p>
              <h1 className="mt-1 text-2xl font-extrabold text-ink">{vehicleLabel}</h1>
              <p className="mt-1 text-sm text-muted">{taskLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setLanguage(language === "hi" ? "en" : "hi")} className="inline-flex h-11 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-bold text-ink">
                {language === "hi" ? copy.english : copy.hindi}
              </button>
              <button type="button" onClick={speak} className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white">
                <FiVolume2 /> {copy.listen}
              </button>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-900">{copy.noLogin}</div>
        </header>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</div>}
        {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">{success}</div>}

        <section className="grid gap-3 rounded-xl border border-line bg-white p-4 shadow-sm sm:grid-cols-2">
          <div><span className="text-xs font-bold uppercase tracking-wide text-muted">{copy.assigned}</span><strong className="mt-1 block text-ink">{task.workerName}</strong></div>
          <div><span className="text-xs font-bold uppercase tracking-wide text-muted">{copy.expires}</span><strong className="mt-1 block text-ink">{formatDateTime(task.expiresAt)}</strong></div>
          <div><span className="text-xs font-bold uppercase tracking-wide text-muted">{copy.booking}</span><strong className="mt-1 block text-ink">{task.booking?.bookingCode}</strong></div>
          <div><span className="text-xs font-bold uppercase tracking-wide text-muted">{copy.vehicle}</span><strong className="mt-1 block text-ink">{vehicleLabel}</strong></div>
          <div className="sm:col-span-2"><span className="text-xs font-bold uppercase tracking-wide text-muted">{copy.services}</span><strong className="mt-1 block text-ink">{(task.booking?.services || []).map((item) => item.name).join(", ") || "Service"}</strong></div>
        </section>

        <section className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <FiMapPin className="mt-1 shrink-0 text-xl" />
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-ink">{copy.destination}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{task.destination?.label}</p>
              <p className="text-sm leading-6 text-muted">{task.destination?.address}</p>
            </div>
          </div>
          {mapLink && <a href={mapLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-bold text-ink"><FiExternalLink /> {copy.openMap}</a>}
        </section>

        {taskCompleted ? (
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3"><FiCheckCircle className="mt-1 shrink-0 text-2xl text-emerald-700" /><div><h2 className="text-lg font-bold text-emerald-900">{copy.completed}</h2><p className="mt-1 text-sm leading-6 text-emerald-800">{copy.completedHelp}</p></div></div>
          </section>
        ) : (
          <>
            <section className="rounded-xl border border-line bg-white p-4 shadow-sm">
              <h2 className="font-bold text-ink">{copy.tracking}</h2>
              {task.stage === "RETURN_TO_GARAGE" && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-900">
                  <strong className="block">{copy.returnJourney}</strong>
                  <span>{copy.returnJourneyHelp}</span>
                </div>
              )}
              {task.isSelfDropOff ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">{copy.selfDrop}</div>
              ) : task.canTrack ? (
                <>
                  <p className="mt-1 text-sm leading-6 text-muted">{copy.trackingHelp}</p>
                  {tracking ? (
                    <button type="button" onClick={stopTracking} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 text-base font-bold text-red-700"><FiSquare /> {copy.stopTracking}</button>
                  ) : (
                    <button type="button" onClick={startTracking} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-base font-bold text-white"><FiNavigation /> {copy.startTracking}</button>
                  )}
                  {locationSentAt && <p className="mt-2 text-xs font-semibold text-emerald-700">{copy.locationSent}: {formatDateTime(locationSentAt)}</p>}
                  {task.canCompleteReturnJourney && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={completeReturnJourney}
                      className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-base font-bold text-white disabled:opacity-50"
                    >
                      <FiCheckCircle /> {copy.reachedGarage}
                    </button>
                  )}
                  {task.canConfirmCustomerArrival && (
                    <>
                      <p className="mt-3 text-sm leading-6 text-muted">
                        {copy.arrivedCustomerHelp}
                      </p>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={confirmCustomerArrival}
                        className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-base font-bold text-white disabled:opacity-50"
                      >
                        <FiCheckCircle /> {copy.arrivedCustomer}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">Live tracking is not available for the current booking stage.</p>
              )}
            </section>

            {task.stage === "WAITING_FOR_PAYMENT" && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                <h2 className="font-bold">{copy.waitingPayment}</h2>
                <p className="mt-1 text-sm leading-6">{copy.waitingPaymentHelp}</p>
              </section>
            )}

            {task.stage === "CONFIRM_PAYMENT" && (
              <section className="overflow-hidden rounded-xl border border-amber-300 bg-white shadow-sm">
                <div className="border-b border-amber-200 bg-amber-50 p-5 text-amber-900">
                  <h2 className="font-bold">{copy.paymentReady}</h2>
                  <p className="mt-1 text-sm leading-6">{copy.paymentReadyHelp}</p>
                </div>
                <div className="p-5">
                  <div className="rounded-lg border border-line bg-bg-soft p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">Payment submitted</p>
                    <p className="mt-1 text-xl font-extrabold text-ink">
                      {task.booking?.finalPaymentMethod === "UPI" ? "UPI" : "Cash"} · ₹{Number(task.booking?.finalPaymentAmount || 0).toLocaleString("en-IN")}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {formatDateTime(task.booking?.finalPaymentSubmittedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={submitting || !task.canConfirmFinalPayment}
                    onClick={confirmPayment}
                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-base font-bold text-white disabled:opacity-50"
                  >
                    <FiCheckCircle /> {submitting ? copy.confirmingPayment : copy.confirmPayment}
                  </button>
                </div>
              </section>
            )}

            {task.requiresEvidence && (
            <form onSubmit={submitEvidence} className="rounded-xl border border-line bg-white p-4 shadow-sm">
              <h2 className="font-bold text-ink">{copy.evidence}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{copy.evidenceHelp}</p>

              {task.taskType === "HANDOVER" && !task.isSelfDropOff && (
                <label className="mt-4 grid gap-1.5 text-sm font-bold text-ink">
                  {copy.otp}
                  <input inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))} className="h-12 rounded-lg border border-line px-4 text-lg tracking-[0.25em] outline-none focus:border-ink" placeholder="000000" />
                  <span className="text-xs font-normal leading-5 text-muted">{copy.otpHelp}</span>
                </label>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-bg-soft p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-xl shadow-sm">
                      <FiCamera />
                    </span>
                    <div>
                      <strong className="text-sm text-ink">{copy.photos}</strong>
                      <p className="mt-0.5 text-xs text-muted">
                        {images.length} {copy.selectedPhotos}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <button
                      type="button"
                      onClick={() => photoCameraInputRef.current?.click()}
                      disabled={images.length >= 15}
                      className="flex min-h-11 items-center justify-between rounded-lg bg-ink px-3 text-left text-sm font-bold text-white disabled:opacity-50"
                    >
                      <span>{copy.camera}</span>
                      <span className="text-[11px] font-medium text-white/60">{copy.cameraPhotoHelp}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => photoGalleryInputRef.current?.click()}
                      disabled={images.length >= 15}
                      className="flex min-h-11 items-center justify-between rounded-lg border border-line bg-white px-3 text-left text-sm font-bold text-ink disabled:opacity-50"
                    >
                      <span>{copy.gallery}</span>
                      <span className="text-[11px] font-medium text-muted">{copy.galleryPhotoHelp}</span>
                    </button>
                  </div>
                  <input ref={photoCameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoInput} />
                  <input ref={photoGalleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoInput} />
                </div>

                <div className="rounded-xl border border-line bg-bg-soft p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-xl shadow-sm">
                      <FiVideo />
                    </span>
                    <div>
                      <strong className="text-sm text-ink">{copy.video}</strong>
                      <p className="mt-0.5 text-xs text-muted">
                        {video ? copy.selectedVideo : "MP4 / video"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <button
                      type="button"
                      onClick={() => videoCameraInputRef.current?.click()}
                      className="flex min-h-11 items-center justify-between rounded-lg bg-ink px-3 text-left text-sm font-bold text-white"
                    >
                      <span>{copy.camera}</span>
                      <span className="text-[11px] font-medium text-white/60">{copy.cameraVideoHelp}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => videoGalleryInputRef.current?.click()}
                      className="flex min-h-11 items-center justify-between rounded-lg border border-line bg-white px-3 text-left text-sm font-bold text-ink"
                    >
                      <span>{copy.gallery}</span>
                      <span className="text-[11px] font-medium text-muted">{copy.galleryVideoHelp}</span>
                    </button>
                  </div>
                  <input ref={videoCameraInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={handleVideoInput} />
                  <input ref={videoGalleryInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoInput} />
                </div>
              </div>

              <button type="submit" disabled={submitting} className="mt-4 inline-flex h-13 min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-base font-bold text-white disabled:opacity-50">
                <FiUploadCloud /> {submitting ? copy.uploading : task.taskType === "HANDOVER"
                    ? task.isSelfDropOff
                      ? language === "hi"
                        ? "आगमन की पुष्टि करें और सर्विस शुरू करें"
                        : "Confirm arrival and start service"
                      : copy.completeHandover
                    : copy.completeDelivery}
              </button>
            </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
